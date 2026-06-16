/* Unit tests for image generation and server-side image management utilities. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveEventImage, cleanupZombieImages, svgToJpeg } from './imageGen';
import netClient from './NetClient';

import { Mock } from 'vitest';

vi.mock('./NetClient', () => {
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

const mockedNetClient = netClient as unknown as {
  post: Mock;
};

describe('imageGen utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* Verifies that event images are correctly sent to the backend API for storage. */
  it('saveEventImage calls netClient.post', async () => {
    mockedNetClient.post.mockResolvedValueOnce({
      data: {
        success: true,
      },
    });
    await saveEventImage('test.jpg', 'base64data', 'folder', 'client');
    expect(mockedNetClient.post).toHaveBeenCalledWith(expect.stringContaining('/api/save-image'), {
      filename: 'test.jpg',
      base64: 'base64data',
    });
  });

  /* Verifies that buildUrl handles null folderPath (covers line 11). */
  it('saveEventImage handles null folderPath', async () => {
    mockedNetClient.post.mockResolvedValueOnce({
      data: {
        success: true,
      },
    });
    await saveEventImage('test.jpg', 'base64data', null, 'client');
    expect(mockedNetClient.post).toHaveBeenCalledWith('/api/save-image', expect.anything());
  });

  /* Tests the triggering of the image cleanup process via the backend API. */
  it('cleanupZombieImages calls netClient.post', async () => {
    mockedNetClient.post.mockResolvedValueOnce({
      data: {
        success: true,
      },
    });
    await cleanupZombieImages(['01_01.jpg'], 'folder', 'client');
    expect(mockedNetClient.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/cleanup-images'),
      {
        activeFilenames: ['01_01.jpg'],
      }
    );
  });

  /* Verifies buildUrl for cleanupZombieImages with null folderPath. */
  it('cleanupZombieImages handles null folderPath', async () => {
    mockedNetClient.post.mockResolvedValueOnce({
      data: {
        success: true,
      },
    });
    await cleanupZombieImages(['01_01.jpg'], null, 'client');
    expect(mockedNetClient.post).toHaveBeenCalledWith('/api/cleanup-images', expect.anything());
  });

  /* Tests svgToJpeg by mocking Image and Canvas. */
  it('svgToJpeg converts SVG string to JPEG base64', async () => {
    // Mock Canvas and Context
    const mockContext = {
      fillStyle: '',
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    };
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockContext),
      toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,fake'),
    };

    vi.stubGlobal('document', {
      createElement: (tag: string) => {
        if (tag === 'canvas') {
          return mockCanvas;
        }
        return {};
      },
    });

    // Mock Image using a constructor
    let lastInstance: { onload?: () => void; onerror?: (e: unknown) => void } | null = null;
    vi.stubGlobal(
      'Image',
      class {
        onload?: () => void;
        onerror?: (e: unknown) => void;
        src: string = '';
        width: number = 100;
        height: number = 100;
        constructor() {
          const self = this as { onload?: () => void; onerror?: (e: unknown) => void };
          lastInstance = self;
        }
      }
    );

    const promise = svgToJpeg('<svg></svg>');

    // Wait for event loop to ensure Image is instantiated
    await new Promise((r) => {
      return setTimeout(r, 0);
    });

    // Simulate image load
    if (lastInstance && lastInstance.onload) {
      lastInstance.onload();
    }

    const result = await promise;
    expect(result).toBe('data:image/jpeg;base64,fake');
    expect(mockContext.fillRect).toHaveBeenCalled();
    expect(mockContext.drawImage).toHaveBeenCalled();
  });

  /* Tests svgToJpeg error path when context is null. */
  it('svgToJpeg handles null canvas context', async () => {
    const mockCanvas = {
      getContext: vi.fn().mockReturnValue(null),
    };
    vi.stubGlobal('document', {
      createElement: (tag: string) => {
        if (tag === 'canvas') {
          return mockCanvas;
        }
        return {};
      },
    });

    let lastInstance: { onload?: () => void; onerror?: (e: unknown) => void } | null = null;
    vi.stubGlobal(
      'Image',
      class {
        onload?: () => void;
        constructor() {
          const self = this as { onload?: () => void };
          lastInstance = self;
        }
      }
    );

    const promise = svgToJpeg('<svg></svg>');

    await new Promise((r) => {
      return setTimeout(r, 0);
    });

    if (lastInstance && lastInstance.onload) {
      lastInstance.onload();
    }

    await expect(promise).rejects.toThrow('Failed to get canvas context');
  });

  /* Tests svgToJpeg error path. */
  it('svgToJpeg handles image load error', async () => {
    let lastInstance: { onload?: () => void; onerror?: (e: unknown) => void } | null = null;
    vi.stubGlobal(
      'Image',
      class {
        onload: unknown = null;
        onerror?: (e: unknown) => void;
        src: string = '';
        constructor() {
          const self = this as { onerror?: (e: unknown) => void };
          lastInstance = self;
        }
      }
    );

    const promise = svgToJpeg('<svg></svg>');

    await new Promise((r) => {
      return setTimeout(r, 0);
    });

    if (lastInstance && lastInstance.onerror) {
      lastInstance.onerror(new Error('Load failed'));
    }

    await expect(promise).rejects.toThrow('Load failed');
  });
});
