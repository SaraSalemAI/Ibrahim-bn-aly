#!/usr/bin/env node
/* Minimal static server (no dependencies): node tools/serve.js [port]  → http://localhost:8080 */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const port = +process.argv[2] || 8080;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.md': 'text/markdown; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.pdf': 'application/pdf', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
http.createServer((req, res) => {
  const p = path.normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  let f = path.join(root, p === '/' ? 'index.html' : p);
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, data) => {
    if (e) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
    res.end(data);
  });
}).listen(port, () => console.log(`SUMED P2P on http://localhost:${port}`));
