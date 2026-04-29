/* Integration tests for the backend Express API endpoints. */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app, handleSSR } from './index';
import fs from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';
import { toSafeBase64 } from '../frontend/src/store/useStore';

describe('Backend API', () => {
  const testRoot = process.env.DSN_RESTRICTED_ROOT!;
  const testFolder = 'test-folder';
  const fullTestFolder = path.join(testRoot, testFolder);
  let clientId = 'test-client';

  const frontendDir = path.resolve(__dirname, '../frontend');
  const dummyTemplate = path.join(frontendDir, 'index.html');
  let dummyCreated = false;

  beforeAll(async () => {
    if (!fs.existsSync(testRoot)) {
      await fsp.mkdir(testRoot, { recursive: true });
    }
    if (!fs.existsSync(dummyTemplate)) {
      if (!fs.existsSync(frontendDir)) {
        await fsp.mkdir(frontendDir, { recursive: true });
      }
      await fsp.writeFile(
        dummyTemplate,
        '<html><head></head><body><!--ssr-outlet--></body></html>'
      );
      dummyCreated = true;
    }
  });

  afterAll(async () => {
    if (fs.existsSync(testRoot)) {
      await fsp.rm(testRoot, { recursive: true, force: true });
    }
    if (dummyCreated && fs.existsSync(dummyTemplate)) {
      await fsp.unlink(dummyTemplate);
    }
  });

  describe('GET /api/browse', () => {
    /* Tests that the browse API returns the correct structure for the root directory. */
    it('returns directory content', async () => {
      const res = await request(app).get('/api/browse').query({ path: '' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('currentPath');
      expect(res.body).toHaveProperty('folders');
    });

    /* Verifies that the browse API defaults to the root directory if no path is provided. */
    it('handles missing path query', async () => {
      const res = await request(app).get('/api/browse');
      expect(res.status).toBe(200);
    });

    /* Ensures the browse API remains robust when receiving unexpected query parameter types. */
    it('handles non-string path query', async () => {
      const res = await request(app)
        .get('/api/browse')
        .query({ path: ['a', 'b'] });
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/open', () => {
    /* Tests opening a valid data folder and receiving the application state. */
    it('opens a folder and returns data', async () => {
      if (!fs.existsSync(fullTestFolder)) {
        await fsp.mkdir(fullTestFolder, { recursive: true });
      }
      const res = await request(app).post('/api/open').send({ path: testFolder, clientId });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('episodes');
    });

    /* Verifies that only one client can have a folder open at a time, enforcing session exclusivity. */
    it('evicts old client when new client opens same folder', async () => {
      clientId = 'new-client';
      const res = await request(app).post('/api/open').send({ path: testFolder, clientId });
      expect(res.status).toBe(200);
    });

    /* Checks that the open API validates required request body parameters. */
    it('returns 400 if missing params', async () => {
      const res = await request(app).post('/api/open').send({});
      expect(res.status).toBe(400);
    });

    it('returns 404 if folder not found', async () => {
      const res = await request(app)
        .post('/api/open')
        .send({ path: 'non-existent', clientId: 'c' });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/data', () => {
    /* Tests the persistence of application state to the data.json file. */
    it('saves data correctly', async () => {
      const folderParam = toSafeBase64(testFolder);
      const res = await request(app)
        .post('/api/data')
        .query({ folder: folderParam, 'client-id': clientId })
        .send({ people: [], episodes: [], nextUniqueId: 1 });

      expect(res.status).toBe(200);
      expect(fs.existsSync(path.join(fullTestFolder, 'data.json'))).toBe(true);
    });

    /* Ensures that a failure in the backup process does not prevent the primary data save. */
    it('handles backup failure gracefully', async () => {
      const folderParam = toSafeBase64(testFolder);
      const originalWriteFile = fsp.writeFile;
      const writeFileSpy = vi
        .spyOn(fsp, 'writeFile')
        .mockImplementation(
          (
            path: string | fsp.FileHandle | URL,
            data:
              | string
              | NodeJS.ArrayBufferView
              | Iterable<string | NodeJS.ArrayBufferView>
              | AsyncIterable<string | NodeJS.ArrayBufferView>,
            options?: fs.WriteFileOptions
          ) => {
            if (path.toString().includes('DSN')) {
              return Promise.reject(new Error('backup failed'));
            }
            return originalWriteFile(path, data, options);
          }
        );

      const res = await request(app)
        .post('/api/data')
        .query({ folder: folderParam, 'client-id': clientId })
        .send({ people: [], episodes: [], nextUniqueId: 1 });

      expect(res.status).toBe(200);
      writeFileSpy.mockRestore();
    });

    /* Verifies that unauthorized clients are blocked from saving data to a folder owned by another client. */
    it('returns 409 on client conflict', async () => {
      const folderParam = toSafeBase64(testFolder);
      const res = await request(app)
        .post('/api/data')
        .query({ folder: folderParam, 'client-id': 'wrong-client' })
        .send({});
      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/save-image', () => {
    /* Tests the image upload API for saving participant profile pictures. */
    it('saves an image', async () => {
      const folderParam = toSafeBase64(testFolder);
      const res = await request(app)
        .post('/api/save-image')
        .query({ folder: folderParam, 'client-id': clientId })
        .send({ filename: 'test.jpg', base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' });

      expect(res.status).toBe(200);
      expect(fs.existsSync(path.join(fullTestFolder, 'test.jpg'))).toBe(true);
    });

    /* Verifies security checks that prevent directory traversal attacks via filenames. */
    it('rejects invalid filenames', async () => {
      const folderParam = toSafeBase64(testFolder);
      const res = await request(app)
        .post('/api/save-image')
        .query({ folder: folderParam, 'client-id': clientId })
        .send({ filename: '../hacked.jpg', base64: '...' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/cleanup-images', () => {
    /* Tests the cleanup logic that deletes images not currently used in the application. */
    it('removes unused images', async () => {
      const folderParam = toSafeBase64(testFolder);
      const zombiePath = path.join(fullTestFolder, '01_01.jpg');
      await fsp.writeFile(zombiePath, 'dummy');

      const res = await request(app)
        .post('/api/cleanup-images')
        .query({ folder: folderParam, 'client-id': clientId })
        .send({ activeFilenames: [] });

      expect(res.status).toBe(200);
      expect(fs.existsSync(zombiePath)).toBe(false);
    });
  });

  describe('Error handling and edge cases', () => {
    /* Checks error handling when browsing a non-existent system path. */
    it('returns 500 on invalid directory in browse', async () => {
      const res = await request(app).get('/api/browse').query({ path: 'non-existent-at-all' });
      expect(res.status).toBe(500);
    });

    /* Verifies validation of session-related query parameters. */
    it('returns 400 on invalid session params', async () => {
      const res = await request(app).post('/api/data').query({ folder: '!!!' });
      expect(res.status).toBe(400);
    });

    /* Tests that a new folder is initialized with default state if no data.json exists. */
    it('returns defaultData if file not found in open', async () => {
      const folderPath = 'new-folder';
      const fullPath = path.join(testRoot, folderPath);
      if (!fs.existsSync(fullPath)) {
        await fsp.mkdir(fullPath, { recursive: true });
      }
      const res = await request(app).post('/api/open').send({ path: folderPath, clientId: 'c2' });
      expect(res.status).toBe(200);
      expect(res.body.people).toEqual([]);
    });

    /* Handles cases where the data.json file exists but contains no content. */
    it('returns defaultData if data.json is empty', async () => {
      const folderPath = 'empty-data-folder';
      const fullPath = path.join(testRoot, folderPath);
      if (!fs.existsSync(fullPath)) {
        await fsp.mkdir(fullPath, { recursive: true });
      }
      await fsp.writeFile(path.join(fullPath, 'data.json'), '  ');
      const res = await request(app).post('/api/open').send({ path: folderPath, clientId: 'c3' });
      expect(res.status).toBe(200);
      expect(res.body.people).toEqual([]);
    });
  });

  describe('POST /api/shutdown', () => {
    /* Tests the graceful shutdown endpoint and process termination. */
    it('returns success and exits process', async () => {
      vi.useFakeTimers();
      const exitMock = vi.spyOn(process, 'exit').mockImplementation(() => {
        return undefined as never;
      });
      const res = await request(app).post('/api/shutdown');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      vi.advanceTimersByTime(200);
      expect(exitMock).toHaveBeenCalledWith(0);
      vi.useRealTimers();
    });
  });

  describe('Session checks', () => {
    /* Verifies strict parameter checking for data saving operations. */
    it('returns 400 if folder or client-id missing', async () => {
      const res = await request(app).post('/api/data').send({});
      expect(res.status).toBe(400);
    });

    /* Ensures robust handling of malformed base64 encoded parameters. */
    it('returns 400 on invalid base64 folder', async () => {
      const res = await request(app)
        .post('/api/data')
        .query({ folder: '!', 'client-id': 'c' })
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('SSR catch-all route', () => {
    beforeAll(() => {
      app.use('*', handleSSR);
    });

    it('pre-loads folder data in SSR', async () => {
      const folderPath = 'ssr-test-folder';
      const fullPath = path.join(testRoot, folderPath);
      if (!fs.existsSync(fullPath)) {
        await fsp.mkdir(fullPath, { recursive: true });
      }
      await fsp.writeFile(
        path.join(fullPath, 'data.json'),
        JSON.stringify({ people: [{ id: 1, name: 'SSR' }], episodes: [] })
      );

      const folderId = toSafeBase64(folderPath);
      const res = await request(app).get(`/folder/${folderId}`);

      expect(res.status).toBe(200);
      expect(res.text).toContain('window.__INITIAL_DATA__ =');
      expect(res.text).toContain('SSR');
    });

    it('handles non-existent folder in SSR', async () => {
      const folderId = toSafeBase64('does-not-exist');
      const res = await request(app).get(`/folder/${folderId}`);
      expect(res.status).toBe(200);
      expect(res.text).not.toContain('window.__INITIAL_DATA__ =');
    });

    it('returns 200 for root URL in SSR', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
    });
  });
});
