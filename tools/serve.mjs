// Kleiner Webserver zum lokalen Spielen: node tools/serve.mjs  ->  http://localhost:8080
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const port = +process.env.PORT || 8080;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, path.normalize(p));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404);
    return res.end('Nicht gefunden');
  }
  res.writeHead(200, { 'Content-Type': (types[path.extname(f)] || 'application/octet-stream') + '; charset=utf-8' });
  fs.createReadStream(f).pipe(res);
}).listen(port, () => console.log(`Weltentdecker läuft auf http://localhost:${port}`));
