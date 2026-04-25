import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import compression from 'compression';
import sirv from 'sirv';

const app = express();
const PORT = 3762;
const JSON_LIMIT = '50mb';
const MAX_BACKUPS = 10240;
const SHUTDOWN_DELAY_MS = 100;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';
const root = path.resolve(__dirname, '..');

app.use(cors());
app.use(express.json({ limit: JSON_LIMIT }));

app.use((req, res, next) => {
  if (req.url === '/favicon.ico') {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    const magentaPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
    res.end(magentaPng);
    return;
  }
  if (req.url === '/quit') {
    res.end('Quitting...');
    setTimeout(() => {
      process.exit(0);
    }, 100);
    return;
  }
  next();
});

// ... rest of API routes ...

const restrictedRoot = path.resolve(process.env.DSN_RESTRICTED_ROOT || process.argv[2] || '.');
const workFolder =
  process.env.DSN_WORK_FOLDER || (process.argv[3] ? path.resolve(process.argv[3]) : null);
const folderToClient = new Map<string, string>();

function log(msg: string) {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  const now = new Date().toISOString();
  console.log(`[${now}] ${msg}`);
}

log(`Restricted root: ${restrictedRoot}`);
if (workFolder) {
  log(`Work folder: ${workFolder}`);
}

const defaultData = {
  people: [],
  episodes: [
    {
      id: 1,
      title: 'Episode 1',
      events: [
        {
          id: 2,
          title: 'Episode 1-1',
          messages: [],
          teams: {},
        },
      ],
    },
  ],
  nextUniqueId: 3,
  bodyScale: 1,
  descriptionScale: 1,
};

function getFullPath(relPath: string) {
  if (typeof relPath !== 'string') {
    return restrictedRoot;
  }
  const normalizedPath = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const fullPath = path.resolve(restrictedRoot, normalizedPath);
  if (!fullPath.startsWith(restrictedRoot)) {
    return restrictedRoot;
  }
  return fullPath;
}

function getRelativePath(fullPath: string) {
  const rel = path.relative(restrictedRoot, fullPath);
  return rel === '' ? '.' : rel;
}

async function backupData(data: unknown) {
  if (!workFolder) {
    return;
  }
  try {
    const backupDir = path.join(workFolder, 'DSN');
    if (!fs.existsSync(backupDir)) {
      await fsp.mkdir(backupDir, { recursive: true });
      log(`Disk: Created backup directory ${backupDir}`);
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `${timestamp}.json`);
    await fsp.writeFile(backupPath, JSON.stringify(data, null, 2), 'utf-8');
    log(`Disk: Written backup to ${backupPath}`);

    // Limit backups to last MAX_BACKUPS
    const files = await fsp.readdir(backupDir);
    const jsonFiles = files
      .filter((f) => {
        return f.endsWith('.json');
      })
      .sort();
    if (jsonFiles.length > MAX_BACKUPS) {
      for (const file of jsonFiles.slice(0, jsonFiles.length - MAX_BACKUPS)) {
        await fsp.unlink(path.join(backupDir, file));
        log(`Disk: Deleted old backup ${file}`);
      }
    }
  } catch (e) {
    log(`Error: Backup failed: ${e}`);
  }
}

app.get('/api/browse', async (req, res) => {
  try {
    const relPath = (req.query.path as string) || '';
    const fullPath = getFullPath(relPath);

    const entries = await fsp.readdir(fullPath, { withFileTypes: true });
    log(`Disk: Read directory ${fullPath}`);

    const folders = await Promise.all(
      entries
        .filter((e) => {
          return e.isDirectory() && !e.name.startsWith('.');
        })
        .map(async (e) => {
          const folderPath = path.join(fullPath, e.name);
          const hasDataJson = fs.existsSync(path.join(folderPath, 'data.json'));
          return {
            name: e.name,
            path: getRelativePath(folderPath),
            hasDataJson,
          };
        })
    );

    res.json({
      currentPath: getRelativePath(fullPath),
      parentPath: fullPath === restrictedRoot ? null : getRelativePath(path.dirname(fullPath)),
      folders: folders.sort((a, b) => {
        return a.name.localeCompare(b.name);
      }),
    });
  } catch (_e) {
    log(`Error: Browse failed: ${_e}`);
    res.status(500).json({ error: 'Failed to browse' });
  }
});

app.post('/api/open', async (req, res) => {
  const { path: relPath, clientId } = req.body;
  if (relPath === undefined || !clientId) {
    return res.status(400).json({ error: 'Missing path or clientId' });
  }

  const fullPath = getFullPath(relPath);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'Folder not found' });
  }

  const dataPath = path.join(fullPath, 'data.json');

  const oldClient = folderToClient.get(relPath);
  if (oldClient && oldClient !== clientId) {
    log(`Session: Client ${oldClient} evicted from folder ${relPath} by ${clientId}`);
  }
  folderToClient.set(relPath, clientId);

  if (fs.existsSync(dataPath)) {
    try {
      const content = await fsp.readFile(dataPath, 'utf-8');
      log(`Disk: Read ${dataPath}`);
      res.json(content.trim() ? JSON.parse(content) : defaultData);
    } catch (_e) {
      log(`Error: Failed to read ${dataPath}, using default`);
      res.json(defaultData);
    }
  } else {
    log(`Info: ${dataPath} not found, using default`);
    res.json(defaultData);
  }
});

function fromSafeBase64(safeBase64: string): string {
  let base64 = safeBase64.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  try {
    return Buffer.from(base64, 'base64').toString('utf-8');
  } catch (_e) {
    return '';
  }
}

function checkSession(req: express.Request, res: express.Response) {
  const safeFolder = req.query.folder as string;
  const clientId = req.query['client-id'] as string;

  if (!safeFolder || !clientId) {
    log(`Error: Missing query params - Folder: ${safeFolder}, Client: ${clientId}`);
    res.status(400).json({ error: 'Missing folder or client-id' });
    return null;
  }

  const folderPath = fromSafeBase64(safeFolder);
  if (!folderPath) {
    log(`Error: Invalid folder path encoding: ${safeFolder}`);
    res.status(400).json({ error: 'Invalid folder encoding' });
    return null;
  }

  const activeClient = folderToClient.get(folderPath);
  if (activeClient && activeClient !== clientId) {
    log(`Conflict: Folder ${folderPath} active=${activeClient}, request=${clientId}`);
    res.status(409).json({ error: 'Interrupted by another client' });
    return null;
  }

  folderToClient.set(folderPath, clientId);
  return getFullPath(folderPath);
}

app.post('/api/data', async (req, res) => {
  const fullPath = checkSession(req, res);
  if (!fullPath) {
    return;
  }

  try {
    const dataPath = path.join(fullPath, 'data.json');
    const tempPath = path.join(fullPath, `data.${Date.now()}.tmp`);

    if (!fs.existsSync(fullPath)) {
      await fsp.mkdir(fullPath, { recursive: true });
      log(`Disk: Created directory ${fullPath}`);
    }

    await fsp.writeFile(tempPath, JSON.stringify(req.body, null, 2), 'utf-8');
    await fsp.rename(tempPath, dataPath);
    log(`Disk: Written ${dataPath} atomically`);

    await backupData(req.body);

    res.json({ success: true });
  } catch (err) {
    log(`Error: Failed to write data: ${err}`);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

app.post('/api/save-image', async (req, res) => {
  const fullPath = checkSession(req, res);
  if (!fullPath) {
    return;
  }

  try {
    const { filename, base64 } = req.body;
    if (!filename || !base64) {
      return res.status(400).json({ error: 'Missing filename or base64' });
    }

    // Sanitize filename: only allow a-z, A-Z, 0-9, _, ., -
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, '');
    if (sanitizedFilename !== filename || sanitizedFilename.includes('..')) {
      log(`Security: Rejected invalid filename: ${filename}`);
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const filePath = path.join(fullPath, sanitizedFilename);
    const buffer = Buffer.from(base64.split(',')[1], 'base64');
    await fsp.writeFile(filePath, buffer);
    log(`Disk: Written image ${filePath}`);
    res.json({ success: true });
  } catch (e) {
    log(`Error: Failed to save image: ${e}`);
    res.status(500).json({ error: 'Failed to save image' });
  }
});

app.post('/api/cleanup-images', async (req, res) => {
  const fullPath = checkSession(req, res);
  if (!fullPath) {
    return;
  }

  try {
    const { activeFilenames } = req.body;
    if (!activeFilenames || !Array.isArray(activeFilenames)) {
      return res.status(400).json({ error: 'Missing or invalid activeFilenames' });
    }

    const files = await fsp.readdir(fullPath);
    const regex = /^\d\d_\d\d\.jpg$/;

    for (const file of files) {
      if (regex.test(file) && !activeFilenames.includes(file)) {
        const filePath = path.join(fullPath, file);
        await fsp.unlink(filePath);
        log(`Disk: Deleted image ${filePath}`);
      }
    }
    res.json({ success: true });
  } catch (e) {
    log(`Error: Failed to cleanup images: ${e}`);
    res.status(500).json({ error: 'Failed to cleanup images' });
  }
});

app.post('/api/shutdown', (req, res) => {
  log('System: Shutdown requested');
  res.json({ success: true });
  setTimeout(() => {
    process.exit(0);
  }, SHUTDOWN_DELAY_MS);
});

async function startServer() {
  let vite: import('vite').ViteDevServer | undefined;
  if (!isProd) {
    const { createServer } = await import('vite');
    vite = await createServer({
      root: path.resolve(root, 'frontend'),
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
  } else {
    app.use(compression());
    app.use(
      sirv(path.resolve(root, 'frontend/dist/client'), {
        extensions: [],
      })
    );
  }

  app.use('*', async (req, res) => {
    const url = req.originalUrl;

    try {
      let template, render;
      if (!isProd) {
        template = fs.readFileSync(path.resolve(root, 'frontend/index.html'), 'utf-8');
        if (vite) {
          template = await vite.transformIndexHtml(url, template);
          render = (await vite.ssrLoadModule('/src/entry-server.tsx')).render;
        }
      } else {
        template = fs.readFileSync(path.resolve(root, 'frontend/dist/client/index.html'), 'utf-8');
        // @ts-expect-error Production SSR bundle might not exist during build-time analysis
        if (isProd) {
          const ssrBundlePath = '../frontend/dist/server/entry-server.js';
          render = (await import(ssrBundlePath)).render;
        } else {
          // Fallback for tests or other environments where dist might not exist
          render = () => {
            return { html: '' };
          };
        }
      }

      if (render) {
        const { html: appHtml } = await render(url);
        const html = template.replace(`<!--ssr-outlet-->`, appHtml);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      }
    } catch (e: unknown) {
      const err = e as Error;
      if (!isProd && vite) {
        vite.ssrFixStacktrace(err);
      }
      console.log(err.stack);
      res.status(500).end(err.stack);
    }
  });

  app.listen(PORT, () => {
    log(`Server listening at http://localhost:${PORT}`);
  });
}

if (
  import.meta.url === `file:///${fileURLToPath(import.meta.url).replace(/\\/g, '/')}` &&
  (process.argv[1].endsWith('index.ts') || process.argv[1].endsWith('backend\\index.ts'))
) {
  startServer();
}

export { app };
