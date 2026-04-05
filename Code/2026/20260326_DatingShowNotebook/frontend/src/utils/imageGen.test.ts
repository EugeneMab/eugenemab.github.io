/* Unit tests for image generation and server-side image management utilities. */
import { describe, it, expect, vi } from 'vitest';
import { saveEventImage, cleanupZombieImages } from './imageGen';
import axios from 'axios';

vi.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('imageGen utils', () => {
  /* Verifies that event images are correctly sent to the backend API for storage. */
  it('saveEventImage calls axios.post', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });
    await saveEventImage('test.jpg', 'base64data', 'folder', 'client');
    expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/save-image'),
        { filename: 'test.jpg', base64: 'base64data' }
    );
  });

  /* Tests the triggering of the image cleanup process via the backend API. */
  it('cleanupZombieImages calls axios.post', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });
    await cleanupZombieImages(['01_01.jpg'], 'folder', 'client');
    expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/cleanup-images'),
        { activeFilenames: ['01_01.jpg'] }
    );
  });
});
