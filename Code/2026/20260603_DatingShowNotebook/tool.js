const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 23762;
const PID_FILE = path.join(__dirname, 'server.pid');

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
    fs.writeFileSync(PID_FILE, process.pid.toString());
  });

  // Handle termination
  process.on('SIGINT', () => {
    if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
    process.exit();
  });
} else if (process.argv[2] === 'kill') {
  if (fs.existsSync(PID_FILE)) {
    const content = fs.readFileSync(PID_FILE, 'utf-8').trim();
    const pid = parseInt(content, 10);
    if (!isNaN(pid)) {
      try {
        process.kill(pid);
        console.log(`Stopped server with PID ${pid}`);
        fs.unlinkSync(PID_FILE);
      } catch (e) {
        if (e.code === 'ESRCH') {
          console.log(`Server with PID ${pid} already stopped (stale PID file)`);
          fs.unlinkSync(PID_FILE);
        } else {
          console.log(`Could not kill process ${pid}: ${e.message}`);
        }
      }
    } else {
      console.log('Invalid PID in PID file, removing stale file.');
      fs.unlinkSync(PID_FILE);
    }
  } else {
    console.log('No server running (PID file not found)');
  }
}
