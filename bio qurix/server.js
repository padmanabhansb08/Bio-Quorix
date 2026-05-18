const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8001;
const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
};

http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0] || '/');
    let filePath = urlPath === '/' ? '/index.html' : urlPath;
    const absPath = path.join(PUBLIC_DIR, filePath);

    // prevent path traversal
    if (!absPath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403);
        res.end('403 Forbidden');
        return;
    }

    const extname = String(path.extname(absPath)).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(absPath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('404 Not Found');
            } else {
                res.writeHead(500);
                res.end('500 Internal Server Error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
}).listen(PORT);

console.log(`Server running at http://localhost:${PORT}/`);
console.log(`Serving: ${PUBLIC_DIR}`);
