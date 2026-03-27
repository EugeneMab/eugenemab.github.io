import express from 'express';
import cors from 'cors';
import fs from 'fs';
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
  nextPersonId: 1
};

// Ensure folder exists
if (!fs.existsSync(path.dirname(dataPath))) {
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
}

// Load or create data.json
function loadData() {
  if (fs.existsSync(dataPath)) {
    try {
      return JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    } catch (e) {
      console.error('Error reading data.json, using default', e);
      return defaultData;
    }
  }
  return defaultData;
}

app.get('/api/data', (req, res) => {
  const data = loadData();
  res.json(data);
});

app.post('/api/data', (req, res) => {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(req.body, null, 2), 'utf-8');
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
