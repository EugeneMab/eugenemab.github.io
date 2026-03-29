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
if (workFolder) log(`Work folder: ${workFolder}`);

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
  const fullPath = path.resolve(restrictedRoot, relPath);
  if (!fullPath.startsWith(restrictedRoot)) {
    return restrictedRoot;
  }
  return fullPath;
}

function getRelativePath(fullPath: string) {
  const rel = path.relative(restrictedRoot, fullPath);
  return rel === '' ? '.' : rel;
}

async function backupData(data: any) {
  if (!workFolder) return;
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
  } catch (e) {
    log(`Error: Backup failed: ${e}`);
  }
}

app.get('/api/browse', async (req, res) => {
  try {
    const relPath = (req.query.path as string) || '';
    let fullPath = getFullPath(relPath);
    
    if (!fullPath.startsWith(restrictedRoot)) {
      fullPath = restrictedRoot;
    }

    const entries = await fsp.readdir(fullPath, { withFileTypes: true });
    log(`Disk: Read directory ${fullPath}`);
    
    const folders = await Promise.all(
      entries
        .filter(e => e.isDirectory())
        .map(async (e) => {
          const folderPath = path.join(fullPath, e.name);
          const hasDataJson = fs.existsSync(path.join(folderPath, 'data.json'));
          return {
            name: e.name,
            path: getRelativePath(folderPath),
            hasDataJson
          };
        })
    );

    res.json({
      currentPath: getRelativePath(fullPath),
      parentPath: fullPath === restrictedRoot ? null : getRelativePath(path.dirname(fullPath)),
      folders: folders.sort((a, b) => a.name.localeCompare(b.name))
    });
  } catch (e) {
    log(`Error: Browse failed: ${e}`);
    res.status(500).json({ error: 'Failed to browse' });
  }
});

app.post('/api/open', async (req, res) => {
  const { path: relPath, clientId } = req.body;
  if (relPath === undefined || !clientId) return res.status(400).json({ error: 'Missing path or clientId' });

  const fullPath = getFullPath(relPath);
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
    } catch (e) {
      log(`Error: Failed to read ${dataPath}, using default`);
      res.json(defaultData);
    }
  } else {
    log(`Info: ${dataPath} not found, using default`);
    res.json(defaultData);
  }
});

function checkSession(req: express.Request, res: express.Response) {
  const folderPath = req.headers['x-folder-path'] as string;
  const clientId = req.headers['x-client-id'] as string;
  
  if (folderPath === undefined || !clientId) {
    log(`Error: Missing headers - Folder: ${folderPath}, Client: ${clientId}`);
    res.status(400).json({ error: 'Missing x-folder-path or x-client-id' });
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
  if (!fullPath) return;

  try {
    const dataPath = path.join(fullPath, 'data.json');
    if (!fs.existsSync(fullPath)) {
      await fsp.mkdir(fullPath, { recursive: true });
      log(`Disk: Created directory ${fullPath}`);
    }
    await fsp.writeFile(dataPath, JSON.stringify(req.body, null, 2), 'utf-8');
    log(`Disk: Written ${dataPath}`);
    
    await backupData(req.body);
    
    res.json({ success: true });
  } catch (err) {
    log(`Error: Failed to write data: ${err}`);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

app.post('/api/save-image', async (req, res) => {
  const fullPath = checkSession(req, res);
  if (!fullPath) return;

  try {
    const { filename, base64 } = req.body;
    if (!filename || !base64) return res.status(400).json({ error: 'Missing filename or base64' });

    const filePath = path.join(fullPath, filename);
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
  if (!fullPath) return;

  try {
    const { activeFilenames } = req.body;
    if (!activeFilenames) return res.status(400).json({ error: 'Missing activeFilenames' });

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
  setTimeout(() => process.exit(0), 100);
});

app.listen(port, () => {
  log(`Backend listening at http://localhost:${port}`);
});
