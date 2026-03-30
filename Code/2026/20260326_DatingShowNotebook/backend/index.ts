import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';

const app = express();
const port = 13762;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const restrictedRoot = path.resolve(process.argv[2] || '.');
const workFolder = process.argv[3] ? path.resolve(process.argv[3]) : null;
const folderToClient = new Map<string, string>();

function log(msg: string) {
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

    // Limit backups to last 10240
    const files = await fsp.readdir(backupDir);
    const jsonFiles = files.filter((f) => f.endsWith('.json')).sort();
    if (jsonFiles.length > 10240) {
      for (const file of jsonFiles.slice(0, jsonFiles.length - 10240)) {
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
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
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
      folders: folders.sort((a, b) => a.name.localeCompare(b.name)),
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
  }, 100);
});

app.listen(port, () => {
  log(`Backend listening at http://localhost:${port}`);
});
