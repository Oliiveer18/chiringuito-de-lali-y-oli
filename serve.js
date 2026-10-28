#!/usr/bin/env node
/* Servidor estático local para jugar o probar en el móvil de la misma red.
   Uso: node serve.js [puerto]   (por defecto 8000)
   Sirve solo los archivos de la raíz del juego (nada de server.js, tests ni package.json). */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = +process.env.PORT || +process.argv[2] || 8000;
const ROOT = __dirname;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
const PRIVATE = /^(server|serve)\.js$|\.test\.m?js$|^package(-lock)?\.json$|^README\.md$/;
const send = (res, code, type, body) => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' }); res.end(body); };
const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'text/plain; charset=utf-8', 'Método no permitido');
  let url;
  try { url = decodeURIComponent((req.url || '/').split('?')[0]); } catch (e) { return send(res, 400, 'text/plain; charset=utf-8', 'Petición no válida'); }
  const name = url === '/' ? 'index.html' : url.slice(1);
  if (!/^[\w.-]+$/.test(name) || PRIVATE.test(name)) return send(res, 404, 'text/plain; charset=utf-8', 'No encontrado');
  fs.readFile(path.join(ROOT, name), (err, data) => {
    if (err) return send(res, 404, 'text/plain; charset=utf-8', 'No encontrado');
    send(res, 200, MIME[path.extname(name)] || 'application/octet-stream', req.method === 'HEAD' ? undefined : data);
  });
});
server.listen(PORT, '0.0.0.0', () => console.log('Chiringuito de Lali y Oli en http://localhost:' + PORT));
export default server;
