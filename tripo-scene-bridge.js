/** Puente escena 3D ↔ activos Tripo (carga GLB, incorporar, ranuras). */
import * as THREE from './lib/three.module.js';
import { GLTFLoader } from './lib/GLTFLoader.js';
import { TRIPO_ENTITY_SLOTS } from './tripo-asset-constants.js';
import {
  addTripoModelToScene,
  removeTripoModelByAssetId,
  bindTripoModelToSlot,
  is3DReady,
  hasTripoAssetInScene,
} from './render-3d.js?v=28.16.0-vfx3d';
import {
  loadPlacedTripoAssets,
  markAssetPlaced,
  markAssetRemoved,
  markAssetReplaced,
  getTripoAsset,
} from './tripo-registry.js';

const loader = new GLTFLoader();

export async function loadGltfFromPath(glbPath) {
  return new Promise((resolve, reject) => {
    loader.load(glbPath, resolve, undefined, reject);
  });
}

export function applyTransformToObject(object3D, transform = {}) {
  const t = transform || {};
  const scale = t.scale ?? 1;
  object3D.scale.setScalar(scale);
  if (t.rotationY != null) object3D.rotation.y = t.rotationY;
  const p = t.position || {};
  object3D.position.set(p.x ?? 0, p.y ?? 0, p.z ?? 0);
  const box = new THREE.Box3().setFromObject(object3D);
  if (Number.isFinite(box.min.y)) object3D.position.y -= box.min.y;
}

export async function incorporateTripoAsset(asset, { replaceSlot = false } = {}) {
  if (!is3DReady()) throw new Error('La escena 3D no está lista.');
  if (!asset?.glbPath) throw new Error('No hay GLB guardado para este activo.');
  if (hasTripoAssetInScene(asset.id)) {
    removeTripoModelByAssetId(asset.id, { markRetired: false });
  }
  const gltf = await loadGltfFromPath(asset.glbPath);
  const root = gltf.scene;
  const transform = { ...asset.transform };
  if (asset.entitySlot && TRIPO_ENTITY_SLOTS[asset.entitySlot]?.position) {
    transform.position = { ...TRIPO_ENTITY_SLOTS[asset.entitySlot].position };
  }
  applyTransformToObject(root, transform);
  const sceneInstanceId = `inst_${asset.id}_${Date.now()}`;
  root.userData.tripoAssetId = asset.id;
  root.userData.tripoInstanceId = sceneInstanceId;
  if (replaceSlot && asset.entitySlot) {
    removeTripoModelByAssetId(asset.id, { markRetired: false });
    const prev = loadPlacedTripoAssets().find(
      p => p.entitySlot === asset.entitySlot && p.assetId !== asset.id
    );
    if (prev) markAssetReplaced(prev.assetId);
  }
  addTripoModelToScene(root, {
    assetId: asset.id,
    sceneInstanceId,
    name: asset.displayName || asset.id,
    ...transform.position,
    scale: transform.scale,
    rotationY: transform.rotationY,
  });
  if (asset.entitySlot) bindTripoModelToSlot(asset.id, asset.entitySlot);
  markAssetPlaced(asset.id, sceneInstanceId, transform, asset.entitySlot);
  return { sceneInstanceId, object3D: root };
}

export function retireTripoAssetFromScene(assetId) {
  removeTripoModelByAssetId(assetId);
  markAssetRemoved(assetId);
}

export async function restorePlacedTripoAssets() {
  if (!is3DReady()) return;
  const placed = loadPlacedTripoAssets();
  for (const p of placed.slice().reverse()) {
    const asset = getTripoAsset(p.assetId);
    if (!asset || asset.state !== 'integrado' || !asset.glbPath) continue;
    if (hasTripoAssetInScene(p.assetId)) continue;
    try {
      await incorporateTripoAsset({ ...asset, transform: p.transform || asset.transform, entitySlot: p.entitySlot }, {
        replaceSlot: false,
      });
    } catch (e) {
      console.warn('No se pudo restaurar activo Tripo', p.assetId, e);
    }
  }
}
