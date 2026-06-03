const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 23762;
const PID_FILE = path.join(__dirname, 'server.pid');

if (process.argv[2] === 'start') {
  const server = http.createServer((req, res) => {
    let urlPath = req.url.split('?')[0];
    let filePath = '.' + urlPath;
    if (filePath === './') {
      filePath = './index.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpg',
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
        res.end(content, 'utf-8');
      }
    });
  });

  server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    fs.writeFileSync(PID_FILE, process.pid.toString());
  });

  // Handle termination
  process.on('SIGINT', () => {
    if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
    process.exit();
  });
} else if (process.argv[2] === 'kill') {
  if (fs.existsSync(PID_FILE)) {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8'));
    try {
      process.kill(pid);
      console.log(`Stopped server with PID ${pid}`);
    } catch (e) {
      console.log(`Could not kill process ${pid}: ${e.message}`);
    }
    fs.unlinkSync(PID_FILE);
  } else {
    console.log('No server running (PID file not found)');
  }
}
