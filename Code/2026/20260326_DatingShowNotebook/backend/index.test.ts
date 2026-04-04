import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from './index';
import fs from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';
import { toSafeBase64 } from '../frontend/src/store/useStore';

describe('Backend API', () => {
  const testRoot = process.env.DSN_RESTRICTED_ROOT!;
  const testFolder = 'test-folder';
  const fullTestFolder = path.join(testRoot, testFolder);
  let clientId = 'test-client';

  beforeAll(async () => {
    if (!fs.existsSync(testRoot)) {
      await fsp.mkdir(testRoot, { recursive: true });
    }
  });

  afterAll(async () => {
    if (fs.existsSync(testRoot)) {
      await fsp.rm(testRoot, { recursive: true, force: true });
    }
  });

  describe('GET /api/browse', () => {
    it('returns directory content', async () => {
      const res = await request(app).get('/api/browse').query({ path: '' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('currentPath');
      expect(res.body).toHaveProperty('folders');
    });

    it('handles missing path query', async () => {
        const res = await request(app).get('/api/browse');
        expect(res.status).toBe(200);
    });

    it('handles non-string path query', async () => {
        const res = await request(app).get('/api/browse').query({ path: ['a', 'b'] });
        expect(res.status).toBe(200);
    });
  });

  describe('POST /api/open', () => {
    it('opens a folder and returns data', async () => {
      if (!fs.existsSync(fullTestFolder)) {
          await fsp.mkdir(fullTestFolder, { recursive: true });
      }
      const res = await request(app)
        .post('/api/open')
        .send({ path: testFolder, clientId });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('episodes');
    });

    it('evicts old client when new client opens same folder', async () => {
        clientId = 'new-client';
        const res = await request(app)
          .post('/api/open')
          .send({ path: testFolder, clientId });
        expect(res.status).toBe(200);
    });

    it('returns 400 if missing params', async () => {
        const res = await request(app).post('/api/open').send({});
        expect(res.status).toBe(400);
    });
  });

  describe('POST /api/data', () => {
    it('saves data correctly', async () => {
      const folderParam = toSafeBase64(testFolder);
      const res = await request(app)
        .post('/api/data')
        .query({ folder: folderParam, 'client-id': clientId })
        .send({ people: [], episodes: [], nextUniqueId: 1 });
      
      expect(res.status).toBe(200);
      expect(fs.existsSync(path.join(fullTestFolder, 'data.json'))).toBe(true);
    });

    it('handles backup failure gracefully', async () => {
        const folderParam = toSafeBase64(testFolder);
        const originalWriteFile = fsp.writeFile;
        const writeFileSpy = vi.spyOn(fsp, 'writeFile').mockImplementation((path: any, data: any, options: any) => {
            if (path.toString().includes('DSN')) {
                return Promise.reject(new Error('backup failed'));
            }
            return originalWriteFile(path, data, options);
        });
        
        const res = await request(app)
          .post('/api/data')
          .query({ folder: folderParam, 'client-id': clientId })
          .send({ people: [], episodes: [], nextUniqueId: 1 });
        
        expect(res.status).toBe(200);
        writeFileSpy.mockRestore();
    });

    it('returns 409 on client conflict', async () => {
        const folderParam = toSafeBase64(testFolder);
        // First client already opened it in previous test
        const res = await request(app)
          .post('/api/data')
          .query({ folder: folderParam, 'client-id': 'wrong-client' })
          .send({});
        expect(res.status).toBe(409);
    });
  });

  describe('POST /api/save-image', () => {
    it('saves an image', async () => {
      const folderParam = toSafeBase64(testFolder);
      const res = await request(app)
        .post('/api/save-image')
        .query({ folder: folderParam, 'client-id': clientId })
        .send({ filename: 'test.jpg', base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' });
      
      expect(res.status).toBe(200);
      expect(fs.existsSync(path.join(fullTestFolder, 'test.jpg'))).toBe(true);
    });

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
      it('removes unused images', async () => {
        const folderParam = toSafeBase64(testFolder);
        // Create a "zombie" image that matches the pattern \d\d_\d\d\.jpg
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
      it('returns 500 on invalid directory in browse', async () => {
          const res = await request(app).get('/api/browse').query({ path: 'non-existent-at-all' });
          expect(res.status).toBe(500);
      });

      it('returns 400 on invalid session params', async () => {
          const res = await request(app).post('/api/data').query({ folder: '!!!' });
          expect(res.status).toBe(400);
      });

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
      it('returns success and exits process', async () => {
          vi.useFakeTimers();
          const exitMock = vi.spyOn(process, 'exit').mockImplementation(() => { return undefined as never; });
          const res = await request(app).post('/api/shutdown');
          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);
          
          vi.advanceTimersByTime(200);
          expect(exitMock).toHaveBeenCalledWith(0);
          vi.useRealTimers();
      });
  });

  describe('Session checks', () => {
      it('returns 400 if folder or client-id missing', async () => {
          const res = await request(app).post('/api/data').send({});
          expect(res.status).toBe(400);
      });

      it('returns 400 on invalid base64 folder', async () => {
          const res = await request(app).post('/api/data').query({ folder: '!', 'client-id': 'c' }).send({});
          expect(res.status).toBe(400);
      });
  });
});
