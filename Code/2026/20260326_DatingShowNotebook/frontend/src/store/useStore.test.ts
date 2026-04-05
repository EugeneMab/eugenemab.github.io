/* Unit tests for the Zustand application store and global state management. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStore, toSafeBase64 } from './useStore';
import axios from 'axios';

describe('utils', () => {
    /* Verifies the URL-safe base64 encoding utility. */
    it('toSafeBase64 encodes strings correctly', () => {
        const encoded = toSafeBase64('test-string');
        expect(encoded).toBe(btoa('test-string').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
    });
});

vi.mock('axios');
vi.mock('../utils/imageGen', async (importOriginal) => {
    const actual = await importOriginal<any>();
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

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('useStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      data: {
        people: [],
        episodes: [],
        nextUniqueId: 1,
        bodyScale: 1,
        descriptionScale: 1,
      },
      currentFolderPath: null,
      undoStack: [],
      isRefreshing: false,
    });
  });

  /* Checks that the store starts with an empty and valid initial state. */
  it('initializes with default data', () => {
    const state = useStore.getState();
    expect(state.data.people).toEqual([]);
    expect(state.activeMode).toBe('message');
  });

  /* Tests the switching of interaction modes (e.g., message, team, eraser). */
  it('setActiveMode updates state', () => {
    useStore.getState().setActiveMode('eraser');
    expect(useStore.getState().activeMode).toBe('eraser');
  });

  /* Verifies the complete workflow of opening a folder, including data cleaning and ID compaction. */
  it('openFolder fetches data and updates state', async () => {
    const mockData = {
      people: [{ id: 1, name: 'Test' }, { id: 2, name: 'Test 2' }],
      episodes: [
          { 
              id: 10, title: 'Ep', 
              events: [{ 
                  id: 20, title: 'Ev', 
                  messages: [
                      { from: 1, to: 2, type: 'bidirectional' },
                      { from: 2, to: 1, type: 'bidirectional' }, // reverse duplicate
                      { from: 99, to: 1, type: 'strong' }, // invalid from ID
                      { from: 1, to: 99, type: 'strong' }, // invalid to ID
                      { from: 0, to: 1, type: 'strong' } // falsy from ID
                  ],
                  teams: { '0': [1, 2, 1] } // duplicate member
              }] 
          }
      ],
      nextUniqueId: 2,
    };
    mockedAxios.post.mockResolvedValueOnce({ data: mockData });
    mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

    await useStore.getState().openFolder('test-path');

    expect(useStore.getState().currentFolderPath).toBe('test-path');
    expect(useStore.getState().data.people).toHaveLength(2);
    // Check that IDs were compacted/cleaned (logic in openFolder)
    expect(useStore.getState().data.episodes[0].events[0].messages).toHaveLength(1);
  });

  /* Ensures that multiple concurrent folder opening requests are prevented. */
  it('openFolder returns early if isOpening is true', async () => {
      useStore.setState({ isOpening: true });
      await useStore.getState().openFolder('another');
      expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  /* Tests the state update mechanism and the automatic creation of undo points. */
  it('saveData updates state and pushes to undo stack', async () => {
    useStore.setState({ currentFolderPath: 'test' });
    
    await useStore.getState().saveData((prev) => ({
      ...prev,
      nextUniqueId: 100,
    }));

    expect(useStore.getState().data.nextUniqueId).toBe(100);
    expect(useStore.getState().undoStack).toHaveLength(1);
  });

  /* Verifies that the undo functionality correctly reverts the application state. */
  it('undo restores previous state', () => {
      const oldData = useStore.getState().data;
      useStore.setState({ 
          currentFolderPath: 'test',
          data: { ...oldData, nextUniqueId: 200 },
          undoStack: [oldData] 
      });

      useStore.getState().undo();

      expect(useStore.getState().data.nextUniqueId).toBe(oldData.nextUniqueId);
      expect(useStore.getState().undoStack).toHaveLength(0);
  });

  /* Tests the batch image generation process for all events in all episodes. */
  it('fullRefresh iterates episodes and events', async () => {
    const mockData = {
        people: [],
        episodes: [
            { id: 1, title: 'Ep 1', events: [{ id: 2, title: 'Ev 1-1', messages: [], teams: {} }] }
        ],
        nextUniqueId: 3,
        bodyScale: 1,
        descriptionScale: 1
    };
    useStore.setState({ data: mockData, currentFolderPath: 'test', clientId: 'test-client' });
    
    await useStore.getState().fullRefresh();
    
    expect(useStore.getState().isRefreshing).toBe(false);
  });

  /* Ensures that the long-running refresh process can be safely interrupted. */
  it('fullRefresh returns early if cancelled', async () => {
      const mockData = {
          people: [],
          episodes: [
              { id: 1, title: 'Ep 1', events: [{ id: 2, title: 'Ev 1-1', messages: [], teams: {} }] }
          ],
          nextUniqueId: 3,
          bodyScale: 1,
          descriptionScale: 1
      };
      useStore.setState({ data: mockData, currentFolderPath: 'test', clientId: 'test-client', cancelRefresh: true });
      await useStore.getState().fullRefresh();
      expect(useStore.getState().isRefreshing).toBe(false);
  });

  /* Checks the selection logic for navigating between episodes and events. */
  it('setSelectedView updates state', () => {
      useStore.getState().setSelectedView(1, 2);
      expect(useStore.getState().selectedEpisodeId).toBe(1);
      expect(useStore.getState().selectedEventId).toBe(2);
  });

  /* Verifies the persistent update of the global UI scaling factor. */
  it('setBodyScale calls saveData', () => {
      useStore.setState({ currentFolderPath: 'test' });
      useStore.getState().setBodyScale(1.5);
      expect(useStore.getState().data.bodyScale).toBe(1.5);
  });

  /* Verifies the persistent update of the description text scaling factor. */
  it('setDescriptionScale calls saveData', () => {
      useStore.setState({ currentFolderPath: 'test' });
      useStore.getState().setDescriptionScale(1.2);
      expect(useStore.getState().data.descriptionScale).toBe(1.2);
  });

  /* Tests the progress reporting mechanism for long-running operations. */
  it('setRefreshState updates progress', () => {
      useStore.getState().setRefreshState(true, 5, 10);
      expect(useStore.getState().isRefreshing).toBe(true);
      expect(useStore.getState().refreshProgress.current).toBe(5);
      expect(useStore.getState().refreshProgress.total).toBe(10);
  });

  /* Checks the signaling mechanism for canceling background tasks. */
  it('setCancelRefresh updates state', () => {
      useStore.getState().setCancelRefresh(true);
      expect(useStore.getState().cancelRefresh).toBe(true);
  });

  /* Verifies the state change when a session is interrupted by another client. */
  it('setInterrupted updates state', () => {
      useStore.getState().setInterrupted(true);
      expect(useStore.getState().isInterrupted).toBe(true);
  });
});
