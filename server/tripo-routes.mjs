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
import { GENERATED_DIR, ROOT } from './tripo-paths.mjs';
import {
  readManifest,
  upsertAsset,
  validateAssetFile,
  registerDownloadedAsset,
  safeGlbFilename,
  assetIdFromTask,
} from './tripo-assets.mjs';

export { GENERATED_DIR } from './tripo-paths.mjs';

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
        const filePath = path.join(GENERATED_DIR, safeGlbFilename(id));
        await fsp.writeFile(filePath, mocked.binary);
        await registerDownloadedAsset({
          taskId: id,
          displayName: id,
          category: 'objeto',
          description: '',
          style: 'juego',
        });
        res.writeHead(200, {
          'Content-Type': 'model/gltf-binary',
          'Content-Disposition': `attachment; filename="${safeGlbFilename(id)}"`,
          'X-Local-Path': `/generated/tripo/${safeGlbFilename(id)}`,
          'X-Asset-Id': assetIdFromTask(id),
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

  if (req.method === 'GET' && pathname === '/api/tripo/manifest') {
    const manifest = await readManifest();
    json(res, 200, manifest);
    return true;
  }

  if (req.method === 'PATCH' && pathname.startsWith('/api/tripo/assets/') && !pathname.endsWith('/validate')) {
    const id = decodeURIComponent(pathname.slice('/api/tripo/assets/'.length));
    const body = await readBody(req);
    const asset = await upsertAsset({ ...body, id });
    json(res, 200, { asset });
    return true;
  }

  const validateMatch = pathname.match(/^\/api\/tripo\/assets\/([^/]+)\/validate$/);
  if (req.method === 'POST' && validateMatch) {
    const asset = await readManifest().then(m => m.assets.find(a => a.id === validateMatch[1]));
    const taskId = asset?.taskId || validateMatch[1].replace(/^tripo_/, '');
    const result = await validateAssetFile(taskId);
    json(res, result.ok ? 200 : 400, result);
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/tripo/assets/register') {
    const body = await readBody(req);
    if (!body.taskId) {
      json(res, 400, { error: 'Falta taskId' });
      return true;
    }
    const result = await registerDownloadedAsset(body);
    json(res, result.ok ? 200 : 400, result);
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
      const filePath = path.join(GENERATED_DIR, safeGlbFilename(taskId));
      await fsp.writeFile(filePath, buf);
      await registerDownloadedAsset({
        taskId,
        displayName: task?.data?.prompt || taskId,
        category: 'objeto',
        state: 'generado',
        style: null,
        description: '',
      });
      res.writeHead(200, {
        'Content-Type': 'model/gltf-binary',
        'Content-Disposition': `attachment; filename="${safeGlbFilename(taskId)}"`,
        'X-Local-Path': `/generated/tripo/${safeGlbFilename(taskId)}`,
        'X-Asset-Id': assetIdFromTask(taskId),
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
