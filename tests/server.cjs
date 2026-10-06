const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.pdb': 'text/plain' };
http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!pathname.startsWith('/pdbview/')) {
      response.writeHead(404).end();
      return;
    }
    const filename = path.resolve(root, pathname.slice('/pdbview/'.length) || 'index.html');
    if (!filename.startsWith(root + path.sep)) {
      response.writeHead(403).end();
      return;
    }
    const contents = await fs.readFile(filename);
    response.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream' });
    response.end(contents);
  } catch {
    response.writeHead(404).end();
  }
}).listen(48731, '127.0.0.1');
