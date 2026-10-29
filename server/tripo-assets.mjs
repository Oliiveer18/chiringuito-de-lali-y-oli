import fs from 'node:fs/promises';
import path from 'node:path';
import { GENERATED_DIR } from './tripo-paths.mjs';

export const MANIFEST_VERSION = 1;
export const MAX_GLB_BYTES = 80 * 1024 * 1024;

export const ASSET_STATES = [
  'pendiente',
  'generado',
  'validado',
  'integrado',
  'sustituido',
  'retirado',
];

export const CATEGORIES = [
  'personaje',
  'vehículo',
  'arma',
  'objeto',
  'mobiliario',
  'escenario',
];

export function manifestPath() {
  return path.join(GENERATED_DIR, 'manifest.json');
}

export function safeGlbFilename(taskId) {
  const id = String(taskId).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 80);
  if (!id) throw new Error('Identificador de tarea no válido');
  return `${id}.glb`;
}

export function assetIdFromTask(taskId) {
  return `tripo_${safeGlbFilename(taskId).replace(/\.glb$/, '')}`;
}

export function validateGlbBuffer(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) {
    return { ok: false, reason: 'Archivo demasiado pequeño' };
  }
  if (buf.slice(0, 4).toString('ascii') !== 'glTF') {
    return { ok: false, reason: 'Cabecera GLB inválida (se espera glTF)' };
  }
  if (buf.length > MAX_GLB_BYTES) {
    return { ok: false, reason: 'GLB supera el tamaño máximo permitido' };
  }
  return { ok: true, bytes: buf.length };
}

export async function readManifest() {
  try {
    const raw = await fs.readFile(manifestPath(), 'utf8');
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return emptyManifest();
    if (!Array.isArray(data.assets)) data.assets = [];
    data.version = MANIFEST_VERSION;
    return data;
  } catch {
    return emptyManifest();
  }
}

export function emptyManifest() {
  return { version: MANIFEST_VERSION, updatedAt: new Date().toISOString(), assets: [] };
}

export async function writeManifest(manifest) {
  await fs.mkdir(GENERATED_DIR, { recursive: true });
  manifest.version = MANIFEST_VERSION;
  manifest.updatedAt = new Date().toISOString();
  await fs.writeFile(manifestPath(), JSON.stringify(manifest, null, 2));
  return manifest;
}

export async function upsertAsset(partial) {
  const manifest = await readManifest();
  const id = partial.id || assetIdFromTask(partial.taskId);
  let asset = manifest.assets.find(a => a.id === id);
  const now = new Date().toISOString();
  if (!asset) {
    asset = {
      id,
      taskId: partial.taskId,
      displayName: partial.displayName || id,
      category: partial.category || 'objeto',
      state: partial.state || 'pendiente',
      glbPath: partial.glbPath || null,
      glbVersion: partial.glbVersion || 1,
      bytes: partial.bytes ?? null,
      style: partial.style || null,
      description: partial.description || '',
      transform: partial.transform || defaultTransform(partial.category),
      entitySlot: partial.entitySlot ?? null,
      sceneInstanceId: partial.sceneInstanceId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    manifest.assets.unshift(asset);
  } else {
    Object.assign(asset, partial, { id, updatedAt: now });
  }
  if (partial.state && !ASSET_STATES.includes(partial.state)) {
    throw new Error('Estado de activo no válido');
  }
  if (partial.category && !CATEGORIES.includes(partial.category)) {
    throw new Error('Categoría no válida');
  }
  await writeManifest(manifest);
  return asset;
}

export function defaultTransform(category = 'objeto') {
  const scale = category === 'vehículo' || category === 'escenario' ? 0.85 : 1;
  return { scale, rotationY: 0, position: { x: 4.5, y: 0, z: -2 } };
}

export async function validateAssetFile(taskId) {
  const file = path.join(GENERATED_DIR, safeGlbFilename(taskId));
  const buf = await fs.readFile(file);
  const v = validateGlbBuffer(buf);
  if (!v.ok) return { ...v, taskId };
  const glbPath = `/generated/tripo/${safeGlbFilename(taskId)}`;
  const asset = await upsertAsset({
    taskId,
    id: assetIdFromTask(taskId),
    glbPath,
    bytes: v.bytes,
    state: 'validado',
  });
  return { ok: true, asset, bytes: v.bytes };
}

export async function registerDownloadedAsset(meta) {
  const v = await validateAssetFile(meta.taskId);
  if (!v.ok) {
    await upsertAsset({
      ...meta,
      id: assetIdFromTask(meta.taskId),
      state: 'generado',
      glbPath: `/generated/tripo/${safeGlbFilename(meta.taskId)}`,
    });
    return v;
  }
  await upsertAsset({
    ...meta,
    id: assetIdFromTask(meta.taskId),
    state: 'validado',
    bytes: v.bytes,
    glbPath: v.asset.glbPath,
    displayName: meta.displayName,
    category: meta.category,
    style: meta.style,
    description: meta.description,
  });
  return v;
}
