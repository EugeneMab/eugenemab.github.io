const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 23762;

if (process.argv[2] === 'start') {
  const server = http.createServer((req, res) => {
    // Security: decode and resolve path to prevent directory traversal
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const requestedPath = urlPath === '/' ? '/index.html' : urlPath;
    const resolvedPath = path.resolve(__dirname, '.' + requestedPath);

    if (!resolvedPath.startsWith(__dirname + path.sep)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    const filePath = resolvedPath;
    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
      if (error) {
        if (error.code === 'ENOENT') {
          res.writeHead(404);
          res.end('File not found');
        } else {
          res.writeHead(500);
          res.end('Server error: ' + error.code);
        }
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        // Security: Send Buffer directly without encoding to avoid binary corruption
        res.end(content);
      }
    });
  });

  server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
  });
} else if (process.argv[2] === 'kill') {
  const { execSync } = require('child_process');
  console.log(`Searching for process listening on port ${PORT}...`);
  try {
    const output = execSync(`netstat -nao | findstr :${PORT}`).toString();
    const lines = output.trim().split('\n');
    const pidsToKill = new Set();
    
    for (const line of lines) {
      if (line.includes('LISTENING')) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0') {
          pidsToKill.add(pid);
        }
      }
    }
    
    if (pidsToKill.size === 0) {
      console.log(`No active LISTENING process found on port ${PORT}.`);
    } else {
      for (const pid of pidsToKill) {
        console.log(`Attempting to kill process with PID ${pid}...`);
        try {
          execSync(`taskkill /F /PID ${pid}`);
          console.log(`Successfully killed process ${pid}.`);
        } catch (e) {
          console.error(`Error: Failed to kill process ${pid}: ${e.message}`);
        }
      }
    }
  } catch (e) {
    console.log(`No process found listening on port ${PORT}.`);
  }
}
