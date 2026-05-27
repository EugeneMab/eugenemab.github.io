import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Python-JS Port (PYJS)
const PORT = process.env.PORT || 7957;
const PUBLIC_DIR = path.join(__dirname, '../pub');

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.py': 'text/plain',
    '.wasm': 'application/wasm',
    '.json': 'application/json',
};

const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = decodeURIComponent(url.pathname);
    console.log(`${req.method} ${pathname}`);

    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
    filePath = path.resolve(filePath);
    
    // Safety check
    if (!filePath.startsWith(path.resolve(PUBLIC_DIR))) {
        res.statusCode = 403;
        res.end('Forbidden');
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.statusCode = 404;
            res.end('Not Found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
        
        // Enable Cross-Origin Isolation for SharedArrayBuffer
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
        
        res.end(data);
    });
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`Server running at http://127.0.0.1:${PORT}/`);
    console.log(`Cross-Origin Isolation enabled (COOP/COEP)`);
});
