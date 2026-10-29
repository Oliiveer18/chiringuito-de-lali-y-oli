import {
  REG_KEY,
  PLACED_KEY,
  TRIPO_ASSET_STATES,
  defaultTransform,
  makeDisplayName,
  stableAssetId,
} from './tripo-asset-constants.js';

export {
  REG_KEY,
  PLACED_KEY,
  TRIPO_ASSET_STATES,
  TRIPO_CATEGORIES,
  TRIPO_ENTITY_SLOTS,
} from './tripo-asset-constants.js';

export function loadTripoRegistry() {
  try {
    const raw = localStorage.getItem(REG_KEY);
    const data = raw ? JSON.parse(raw) : { assets: [] };
    return Array.isArray(data) ? { version: 1, assets: data } : data;
  } catch {
    return { version: 1, assets: [] };
  }
}

export function saveTripoRegistry(reg) {
  localStorage.setItem(REG_KEY, JSON.stringify(reg));
  return reg;
}

export function upsertLocalAsset(partial) {
  const reg = loadTripoRegistry();
  const id = partial.id || stableAssetId(partial.taskId);
  let asset = reg.assets.find(a => a.id === id);
  const now = new Date().toISOString();
  if (!asset) {
    asset = {
      id,
      taskId: partial.taskId,
      displayName: partial.displayName || makeDisplayName(partial.description, partial.category),
      category: partial.category || 'objeto',
      state: partial.state || TRIPO_ASSET_STATES.pendiente,
      glbPath: partial.glbPath || null,
      glbVersion: 1,
      transform: partial.transform || defaultTransform(partial.category),
      entitySlot: partial.entitySlot ?? null,
      sceneInstanceId: partial.sceneInstanceId ?? null,
      description: partial.description || '',
      style: partial.style || null,
      createdAt: now,
      updatedAt: now,
    };
    reg.assets.unshift(asset);
  } else {
    Object.assign(asset, partial, { id, updatedAt: now });
  }
  saveTripoRegistry(reg);
  return asset;
}

export function getTripoAsset(idOrTaskId) {
  const reg = loadTripoRegistry();
  return (
    reg.assets.find(a => a.id === idOrTaskId || a.taskId === idOrTaskId) || null
  );
}

/** Compatibilidad con entradas antiguas del registro. */
export function saveTripoEntry(entry) {
  return upsertLocalAsset({
    taskId: entry.taskId,
    glbPath: entry.localPath || entry.glbPath,
    description: entry.description,
    category: entry.category,
    style: entry.style,
    state: entry.state || TRIPO_ASSET_STATES.generado,
    displayName: makeDisplayName(entry.description, entry.category),
    transform: entry.transform,
    entitySlot: entry.entitySlot,
    sceneInstanceId: entry.sceneInstanceId,
  });
}

export function loadPlacedTripoAssets() {
  try {
    const raw = localStorage.getItem(PLACED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePlacedTripoAssets(list) {
  localStorage.setItem(PLACED_KEY, JSON.stringify(list.slice(0, 30)));
}

export function markAssetPlaced(assetId, sceneInstanceId, transform, entitySlot) {
  upsertLocalAsset({
    id: assetId,
    state: TRIPO_ASSET_STATES.integrado,
    sceneInstanceId,
    transform,
    entitySlot: entitySlot ?? null,
  });
  const placed = loadPlacedTripoAssets().filter(p => p.assetId !== assetId);
  placed.unshift({
    assetId,
    sceneInstanceId,
    transform,
    entitySlot: entitySlot ?? null,
    placedAt: new Date().toISOString(),
  });
  savePlacedTripoAssets(placed);
}

export function markAssetRemoved(assetId) {
  upsertLocalAsset({ id: assetId, state: TRIPO_ASSET_STATES.retirado, sceneInstanceId: null });
  savePlacedTripoAssets(loadPlacedTripoAssets().filter(p => p.assetId !== assetId));
}

export function markAssetReplaced(assetId) {
  upsertLocalAsset({ id: assetId, state: TRIPO_ASSET_STATES.sustituido, sceneInstanceId: null });
}

export async function syncRegistryFromServerManifest() {
  try {
    const res = await fetch('/api/tripo/manifest', { cache: 'no-store' });
    if (!res.ok) return loadTripoRegistry();
    const server = await res.json();
    const local = loadTripoRegistry();
    const byId = new Map(local.assets.map(a => [a.id, a]));
    for (const sa of server.assets || []) {
      const cur = byId.get(sa.id);
      byId.set(sa.id, cur ? { ...sa, ...cur, glbPath: sa.glbPath || cur.glbPath } : sa);
    }
    const merged = { version: 1, assets: [...byId.values()] };
    saveTripoRegistry(merged);
    return merged;
  } catch {
    return loadTripoRegistry();
  }
}
