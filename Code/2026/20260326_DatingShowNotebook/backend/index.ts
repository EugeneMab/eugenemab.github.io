import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';

const app = express();
const port = 13762;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Get folder from CLI args
const folderArg = process.argv[2] || '.';
const dataPath = path.resolve(folderArg, 'data.json');

console.log(`Using data folder: ${path.resolve(folderArg)}`);
console.log(`Data file: ${dataPath}`);

const defaultData = {
  people: [],
  episodes: [
    {
      id: 1,
      events: [
        {
          id: '1-1',
          title: 'Episode 1-1',
          messages: [],
          teams: {}
        }
      ]
    }
  ],
  nextPersonId: 1,
  bodyScale: 1,
  descriptionScale: 1
};

// Ensure folder exists
if (!fs.existsSync(path.dirname(dataPath))) {
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
}

// Load or create data.json
async function loadData() {
  if (fs.existsSync(dataPath)) {
    try {
      const content = await fsp.readFile(dataPath, 'utf-8');
      if (!content.trim()) return defaultData;
      return JSON.parse(content);
    } catch (e) {
      console.error('Error reading data.json, using default', e);
      return defaultData;
    }
  } else {
    try {
      await fsp.writeFile(dataPath, JSON.stringify(defaultData, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to create default data.json', e);
    }
    return defaultData;
  }
}

app.get('/api/data', async (req, res) => {
  const data = await loadData();
  res.json(data);
});

app.post('/api/data', async (req, res) => {
  try {
    await fsp.writeFile(dataPath, JSON.stringify(req.body, null, 2), 'utf-8');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save data' });
  }
});

app.post('/api/shutdown', (req, res) => {
  res.json({ success: true });
  console.log('Shutdown requested, exiting...');
  setTimeout(() => process.exit(0), 100);
});

app.listen(port, () => {
  console.log(`Backend listening at http://localhost:${port}`);
});
