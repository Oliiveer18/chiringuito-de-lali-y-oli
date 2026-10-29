#!/usr/bin/env node
/* Servidor de desarrollo: estáticos del juego + proxy Tripo (/api/tripo/*).
   Uso: npm run dev   (puerto 8000 o PORT)
   Requiere TRIPO_API_KEY en .env para generación real; sin clave el juego arranca igual. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleTripoApi, readStaticFileSafe } from './server/tripo-routes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = +process.env.PORT || 8000;
const ROOT = __dirname;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
};
const PRIVATE = /^(server|serve|dev-server)\.mjs$|\.test\.m?js$|^package(-lock)?\.json$|^README\.md$|^\.env/;

const send = (res, code, type, body, extra = {}) => {
  res.writeHead(code, {
    'Content-Type': type,
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    ...extra,
  });
  res.end(body);
};

const server = http.createServer(async (req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent((req.url || '/').split('?')[0]);
  } catch {
    return send(res, 400, 'text/plain; charset=utf-8', 'Petición no válida');
  }

  if (pathname.startsWith('/api/tripo/')) {
    const handled = await handleTripoApi(req, res, pathname);
    if (handled) return;
    return send(res, 404, 'application/json', JSON.stringify({ error: 'No encontrado' }));
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'text/plain; charset=utf-8', 'Método no permitido');
  }

  const baseName = path.basename(pathname);
  if (PRIVATE.test(baseName)) {
    return send(res, 404, 'text/plain; charset=utf-8', 'No encontrado');
  }

  const filePath = readStaticFileSafe(ROOT, pathname);
  if (!filePath) return send(res, 404, 'text/plain; charset=utf-8', 'No encontrado');

  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, 'text/plain; charset=utf-8', 'No encontrado');
    send(
      res,
      200,
      MIME[path.extname(filePath)] || 'application/octet-stream',
      req.method === 'HEAD' ? undefined : data
    );
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Chiringuito (dev + Tripo) en http://localhost:${PORT}`);
  if (!process.env.TRIPO_API_KEY && process.env.TRIPO_MOCK !== '1') {
    console.log('TRIPO_API_KEY no definida: panel Tripo mostrará aviso (el juego funciona).');
  }
});

export default server;
