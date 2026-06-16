/* Unit tests for the Zustand application store and global state management. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAppStore, toSafeBase64, AppStore } from './useStore';
import netClient from '../utils/NetClient';
import * as imageGen from '../utils/imageGen';

describe('utils', () => {
  /* Verifies the URL-safe base64 encoding utility. */
  it('toSafeBase64 encodes strings correctly', () => {
    const encoded = toSafeBase64('test-string');
    expect(encoded).toBe(
      btoa('test-string').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    );
  });
});

import { Mock } from 'vitest';

vi.mock('../utils/NetClient', () => {
  return {
    default: {
      post: vi.fn(),
      interceptors: {
        response: {
          use: vi.fn(),
        },
      },
    },
  };
});
vi.mock('../utils/imageGen', async (importOriginal) => {
  const actual = await importOriginal<typeof imageGen>();
  return {
    ...actual,
    svgToJpeg: vi.fn().mockResolvedValue('fake-jpeg'),
    saveEventImage: vi.fn().mockResolvedValue({ success: true }),
    cleanupZombieImages: vi.fn().mockResolvedValue({ success: true }),
  };
});
vi.mock('../utils/svgRenderer', () => ({
  renderEventToSvgString: vi.fn().mockReturnValue('<svg></svg>'),
}));

const mockedNetClient = netClient as unknown as {
  post: Mock;
};

describe('useStore', () => {
  let store: AppStore;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    store = createAppStore();
  });

  /* Checks that the store starts with an empty and valid initial state. */
  it('initializes with default data', () => {
    const state = store.getState();
    expect(state.data.people).toEqual([]);
    expect(state.activeMode).toBe('message');
  });

  /* Tests the switching of interaction modes (e.g., message, team, eraser). */
  it('setActiveMode updates state', () => {
    store.getState().setActiveMode('eraser');
    expect(store.getState().activeMode).toBe('eraser');
  });

  /* Verifies the complete workflow of opening a folder, including data cleaning and ID compaction. */
  it('openFolder fetches data and updates state', async () => {
    const mockData = {
      people: [
        { id: 1, name: 'Test' },
        { id: 2, name: 'Test 2' },
      ],
      episodes: [
        {
          id: 10,
          title: 'Ep',
          events: [
            {
              id: 20,
              title: 'Ev',
              messages: [
                { from: 1, to: 2, type: 'bidirectional' },
                { from: 2, to: 1, type: 'bidirectional' }, // reverse duplicate
                { from: 99, to: 1, type: 'strong' }, // invalid from ID
                { from: 1, to: 99, type: 'strong' }, // invalid to ID
                { from: 0, to: 1, type: 'strong' }, // falsy from ID
              ],
              teams: { '0': [1, 2, 1] }, // duplicate member
            },
          ],
        },
      ],
      nextUniqueId: 2,
    };
    mockedNetClient.post.mockResolvedValueOnce({ data: mockData });
    mockedNetClient.post.mockResolvedValueOnce({ data: { success: true } });

    await store.getState().openFolder('test-path');

    expect(store.getState().currentFolderPath).toBe('test-path');
    expect(store.getState().data.people).toHaveLength(2);
    // Check that IDs were compacted/cleaned (logic in openFolder)
    expect(store.getState().data.episodes[0].events[0].messages).toHaveLength(1);
  });

  it('openFolder handles error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedNetClient.post.mockRejectedValueOnce(new Error('Fetch failed'));
    await expect(store.getState().openFolder('fail')).rejects.toThrow('Fetch failed');
    expect(store.getState().isOpening).toBe(false);
    spy.mockRestore();
  });

  /* Ensures that multiple concurrent folder opening requests are prevented. */
  it('openFolder returns early if isOpening is true', async () => {
    store.setState({ isOpening: true });
    await store.getState().openFolder('another');
    expect(mockedNetClient.post).not.toHaveBeenCalled();
  });

  /* Tests the state update mechanism and the automatic creation of undo points. */
  it('saveData updates state and pushes to undo stack', async () => {
    vi.useFakeTimers();
    store.setState({ currentFolderPath: 'test' });

    await store.getState().saveData((prev) => ({
      ...prev,
      nextUniqueId: 100,
    }));

    expect(store.getState().data.nextUniqueId).toBe(100);
    expect(store.getState().undoStack).toHaveLength(1);

    // Verify debounce
    vi.advanceTimersByTime(500);
    expect(mockedNetClient.post).toHaveBeenCalled();
  });

  /* Verifies that the undo functionality correctly reverts the application state. */
  it('undo restores previous state', () => {
    const oldData = store.getState().data;
    store.setState({
      currentFolderPath: 'test',
      data: { ...oldData, nextUniqueId: 200 },
      undoStack: [oldData],
    });

    store.getState().undo();

    expect(store.getState().data.nextUniqueId).toBe(oldData.nextUniqueId);
    expect(store.getState().undoStack).toHaveLength(0);
  });

  /* Tests the batch image generation process for all events in all episodes. */
  it('fullRefresh iterates episodes and events', async () => {
    const mockData = {
      people: [],
      episodes: [
        { id: 1, title: 'Ep 1', events: [{ id: 2, title: 'Ev 1-1', messages: [], teams: {} }] },
      ],
      nextUniqueId: 3,
      bodyScale: 1,
      descriptionScale: 1,
    };
    store.setState({ data: mockData, currentFolderPath: 'test', clientId: 'test-client' });

    await store.getState().fullRefresh();

    expect(store.getState().isRefreshing).toBe(false);
  });

  /* Ensures that the long-running refresh process can be safely interrupted. */
  it('fullRefresh returns early if cancelled', async () => {
    const mockData = {
      people: [],
      episodes: [
        { id: 1, title: 'Ep 1', events: [{ id: 2, title: 'Ev 1-1', messages: [], teams: {} }] },
      ],
      nextUniqueId: 3,
      bodyScale: 1,
      descriptionScale: 1,
    };
    store.setState({
      data: mockData,
      currentFolderPath: 'test',
      clientId: 'test-client',
      cancelRefresh: true,
    });
    await store.getState().fullRefresh();
    expect(store.getState().isRefreshing).toBe(false);
  });

  it('fullRefresh handles cancellation mid-loop', async () => {
    const mockData = {
      people: [],
      episodes: [
        {
          id: 1,
          title: 'Ep 1',
          events: [
            { id: 2, title: 'Ev 1-1', messages: [], teams: {} },
            { id: 3, title: 'Ev 1-2', messages: [], teams: {} },
          ],
        },
      ],
      nextUniqueId: 4,
      bodyScale: 1,
      descriptionScale: 1,
    };
    store.setState({ data: mockData, currentFolderPath: 'test', clientId: 'test-client' });

    // Mock imageGen to trigger cancellation
    (imageGen.saveEventImage as Mock).mockImplementationOnce(() => {
      store.getState().setCancelRefresh(true);
      return Promise.resolve({ success: true });
    });

    await store.getState().fullRefresh();
    expect(store.getState().isRefreshing).toBe(false);
  });

  /* Checks the selection logic for navigating between episodes and events. */
  it('setSelectedView updates state', () => {
    store.getState().setSelectedView(1, 2);
    expect(store.getState().selectedEpisodeId).toBe(1);
    expect(store.getState().selectedEventId).toBe(2);
  });

  /* Verifies the persistent update of the global UI scaling factor. */
  it('setBodyScale calls saveData', () => {
    store.setState({ currentFolderPath: 'test' });
    store.getState().setBodyScale(1.5);
    expect(store.getState().data.bodyScale).toBe(1.5);
  });

  /* Verifies the persistent update of the description text scaling factor. */
  it('setDescriptionScale calls saveData', () => {
    store.setState({ currentFolderPath: 'test' });
    store.getState().setDescriptionScale(1.2);
    expect(store.getState().data.descriptionScale).toBe(1.2);
  });

  /* Tests the progress reporting mechanism for long-running operations. */
  it('setRefreshState updates progress', () => {
    store.getState().setRefreshState(true, 5, 10);
    expect(store.getState().isRefreshing).toBe(true);
    expect(store.getState().refreshProgress.current).toBe(5);
    expect(store.getState().refreshProgress.total).toBe(10);
  });

  /* Checks the signaling mechanism for canceling background tasks. */
  it('setCancelRefresh updates state', () => {
    store.getState().setCancelRefresh(true);
    expect(store.getState().cancelRefresh).toBe(true);
  });

  /* Verifies the state change when a session is interrupted by another client. */
  it('setInterrupted updates state', () => {
    store.getState().setInterrupted(true);
    expect(store.getState().isInterrupted).toBe(true);
  });

  it('initializeSSR sets state correctly', () => {
    const mockData = {
      people: [],
      episodes: [
        { id: 1, title: 'Ep 1', events: [{ id: 2, title: 'Ev 1-1', messages: [], teams: {} }] },
      ],
      nextUniqueId: 3,
      bodyScale: 1,
      descriptionScale: 1,
    };
    store.getState().initializeSSR(mockData, 'ssr-path');
    expect(store.getState().currentFolderPath).toBe('ssr-path');
    expect(store.getState().selectedEpisodeId).toBe(1);
    expect(store.getState().selectedEventId).toBe(2);
  });

  it('getInitialView finds the last event in the last episode with events', () => {
    const mockData = {
      people: [],
      episodes: [
        { id: 1, title: 'Ep 1', events: [{ id: 10, title: 'Ev 1-1', messages: [], teams: {} }] },
        { id: 2, title: 'Ep 2', events: [] }, // Empty last episode
      ],
      nextUniqueId: 3,
      bodyScale: 1,
      descriptionScale: 1,
    };
    store.getState().initializeSSR(mockData, 'path');
    expect(store.getState().selectedEpisodeId).toBe(1);
    expect(store.getState().selectedEventId).toBe(10);
  });

  it('getInitialView returns null if no events found in any episode', () => {
    const mockData = {
      people: [],
      episodes: [
        { id: 1, title: 'Ep 1', events: [] },
        { id: 2, title: 'Ep 2', events: [] },
      ],
      nextUniqueId: 3,
      bodyScale: 1,
      descriptionScale: 1,
    };
    store.getState().initializeSSR(mockData, 'path');
    expect(store.getState().selectedEpisodeId).toBeNull();
    expect(store.getState().selectedEventId).toBeNull();
  });

  it('getInitialView returns null if there are no episodes', () => {
    const mockData = {
      people: [],
      episodes: [],
      nextUniqueId: 1,
      bodyScale: 1,
      descriptionScale: 1,
    };
    store.getState().initializeSSR(mockData, 'path');
    expect(store.getState().selectedEpisodeId).toBeNull();
    expect(store.getState().selectedEventId).toBeNull();
  });

  it('createAppStore reads from window.__INITIAL_DATA__', () => {
    const mockData = {
      people: [],
      episodes: [
        { id: 1, title: 'Ep 1', events: [{ id: 2, title: 'Ev 1-1', messages: [], teams: {} }] },
      ],
      nextUniqueId: 3,
      bodyScale: 1,
      descriptionScale: 1,
    };
    const mockCombined = {
      data: mockData,
      path: 'ssr-path',
      clientId: 'ssr-client',
    };

    // Mock window
    vi.stubGlobal('window', {
      __INITIAL_DATA__: mockCombined,
    });

    const ssrStore = createAppStore();
    expect(ssrStore.getState().currentFolderPath).toBe('ssr-path');
    expect(ssrStore.getState().clientId).toBe('ssr-client');
    expect(ssrStore.getState().data.nextUniqueId).toBe(3);

    vi.unstubAllGlobals();
  });
});
