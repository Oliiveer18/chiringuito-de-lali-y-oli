import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isTripoConfigured,
  tripoGet,
  tripoPost,
  tripoDownloadUrl,
} from './tripo-client.mjs';
import { handleMockRoute, mockGlbBuffer } from './tripo-mock.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
export const GENERATED_DIR = path.join(ROOT, 'generated', 'tripo');

const CATEGORY_PROMPT = {
  personaje: 'personaje de juego estilizado, ',
  vehiculo: 'vehículo, ',
  vehículo: 'vehículo, ',
  arma: 'arma de juego, ',
  objeto: 'objeto de escena, ',
  mobiliario: 'mobiliario de chiringuito, ',
  escenario: 'elemento de escenario exterior, ',
};

const STYLE_MODEL = {
  calidad: 'v3.1-20260211',
  juego: 'P2-20260801',
  movil: 'P1-20260311',
};

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

async function ensureGeneratedDir() {
  await fsp.mkdir(GENERATED_DIR, { recursive: true });
}

export function tripoConfigPayload() {
  return {
    configured: isTripoConfigured() || process.env.TRIPO_MOCK === '1',
    mock: process.env.TRIPO_MOCK === '1',
  };
}

function buildGeneratePayload(body) {
  const description = String(body.description || '').trim();
  if (!description) {
    const err = new Error('Escribe una descripción del modelo.');
    err.code = 'VALIDATION';
    throw err;
  }
  const cat = String(body.category || 'objeto').toLowerCase();
  const prefix = CATEGORY_PROMPT[cat] || CATEGORY_PROMPT.objeto;
  const style = String(body.style || 'juego').toLowerCase();
  const model = STYLE_MODEL[style] || STYLE_MODEL.juego;
  const prompt = `${prefix}${description}`.slice(0, 1024);
  const payload = { prompt, model, texture: true, pbr: true };
  if (style === 'juego' && model.startsWith('P2')) payload.quad = true;
  if (style === 'movil') payload.face_limit = 15000;
  if (body.negative_prompt) {
    payload.negative_prompt = String(body.negative_prompt).slice(0, 255);
  }
  return payload;
}

export async function handleTripoApi(req, res, pathname) {
  const mock = process.env.TRIPO_MOCK === '1';
  if (mock) {
    const mocked = handleMockRoute(req.method, pathname);
    if (mocked) {
      if (mocked.binary) {
        await ensureGeneratedDir();
        const id = pathname.split('/').pop();
        const filePath = path.join(GENERATED_DIR, `${id}.glb`);
        await fsp.writeFile(filePath, mocked.binary);
        res.writeHead(200, {
          'Content-Type': 'model/gltf-binary',
          'Content-Disposition': `attachment; filename="${mocked.filename}"`,
          'X-Local-Path': `/generated/tripo/${id}.glb`,
        });
        res.end(mocked.binary);
        return true;
      }
      json(res, mocked.status, mocked.json);
      return true;
    }
  }

  if (req.method === 'GET' && pathname === '/api/tripo/config') {
    json(res, 200, tripoConfigPayload());
    return true;
  }

  if (!isTripoConfigured()) {
    json(res, 503, {
      error: 'Tripo no configurado',
      message:
        'Añade TRIPO_API_KEY en un archivo .env local (ver docs/tripo-setup.md). El juego sigue funcionando sin generación 3D.',
    });
    return true;
  }

  try {
    if (req.method === 'GET' && pathname === '/api/tripo/balance') {
      const data = await tripoGet('/account/balance');
      json(res, 200, data);
      return true;
    }
    if (req.method === 'GET' && pathname === '/api/tripo/usage') {
      const data = await tripoGet('/account/usage');
      json(res, 200, data);
      return true;
    }
    if (req.method === 'POST' && pathname === '/api/tripo/generate') {
      const body = await readBody(req);
      const payload = buildGeneratePayload(body);
      const data = await tripoPost('/generation/text-to-model', payload);
      json(res, 200, data);
      return true;
    }
    const taskMatch = pathname.match(/^\/api\/tripo\/tasks\/([^/]+)$/);
    if (req.method === 'GET' && taskMatch) {
      const data = await tripoGet(`/tasks/${encodeURIComponent(taskMatch[1])}`);
      json(res, 200, data);
      return true;
    }
    const dlMatch = pathname.match(/^\/api\/tripo\/download\/([^/]+)$/);
    if (req.method === 'GET' && dlMatch) {
      const taskId = dlMatch[1];
      const task = await tripoGet(`/tasks/${encodeURIComponent(taskId)}`);
      const status = task?.data?.status;
      const modelUrl = task?.data?.output?.model_url;
      if (status !== 'success' || !modelUrl) {
        json(res, 409, {
          error: 'Modelo no listo',
          message: 'La tarea aún no ha terminado o no tiene URL de descarga.',
          task: task?.data,
        });
        return true;
      }
      await ensureGeneratedDir();
      const buf =
        modelUrl === 'mock://glb' ? mockGlbBuffer() : await tripoDownloadUrl(modelUrl);
      const filePath = path.join(GENERATED_DIR, `${taskId}.glb`);
      await fsp.writeFile(filePath, buf);
      const manifestPath = path.join(GENERATED_DIR, 'manifest.json');
      let manifest = [];
      try {
        manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8'));
      } catch {
        manifest = [];
      }
      if (!manifest.find(e => e.taskId === taskId)) {
        manifest.push({
          taskId,
          path: `/generated/tripo/${taskId}.glb`,
          savedAt: new Date().toISOString(),
        });
        await fsp.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      }
      res.writeHead(200, {
        'Content-Type': 'model/gltf-binary',
        'Content-Disposition': `attachment; filename="${taskId}.glb"`,
        'X-Local-Path': `/generated/tripo/${taskId}.glb`,
      });
      res.end(buf);
      return true;
    }
  } catch (e) {
    const status = e.code === 'VALIDATION' ? 400 : e.code === 'TRIPO_NOT_CONFIGURED' ? 503 : e.status || 502;
    json(res, status, {
      error: 'Error Tripo',
      message: e.message || 'No se pudo completar la petición.',
    });
    return true;
  }

  return false;
}

/** Comprueba que el bundle del cliente no filtra secretos (tests). */
export function assertNoSecretsInSource(source, label = 'source') {
  if (/sk-[a-zA-Z0-9]{20,}/.test(source)) {
    throw new Error(`Posible clave API en ${label}`);
  }
  if (/TRIPO_API_KEY\s*=\s*['"][^'"]+['"]/.test(source)) {
    throw new Error(`TRIPO_API_KEY hardcodeada en ${label}`);
  }
}

export function readStaticFileSafe(root, urlPath) {
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\//, '');
  if (rel.includes('..') || rel.startsWith('server/') || rel.startsWith('.env')) return null;
  const full = path.join(root, rel);
  if (!full.startsWith(root)) return null;
  if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) return null;
  return full;
}
