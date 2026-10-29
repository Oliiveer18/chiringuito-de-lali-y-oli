/* Panel Tripo · pipeline de activos 3D (español, sin auto-generación). */
import * as THREE from './lib/three.module.js';
import { GLTFLoader } from './lib/GLTFLoader.js';
import {
  fetchTripoConfig,
  fetchTripoBalance,
  startTripoGeneration,
  pollTripoTask,
  downloadTripoGlb,
  registerTripoAsset,
  patchTripoAsset,
} from './tripo-client.js';
import {
  upsertLocalAsset,
  syncRegistryFromServerManifest,
  TRIPO_ASSET_STATES,
  TRIPO_ENTITY_SLOTS,
  makeDisplayName,
  stableAssetId,
  defaultTransform,
} from './tripo-registry.js';
import { incorporateTripoAsset, retireTripoAssetFromScene } from './tripo-scene-bridge.js';
import { is3DReady } from './render-3d.js?v=28.16.0-vfx3d';
import { Audio } from './audio.js?v=28.16.0-vfx3d';

const WORKFLOW = [
  { key: 'generar', label: 'Generar' },
  { key: 'preview', label: 'Previsualizar' },
  { key: 'guardar', label: 'Guardar' },
  { key: 'incorporar', label: 'Incorporar escena' },
  { key: 'asociar', label: 'Asociar entidad' },
  { key: 'retirar', label: 'Retirar' },
];

let configured = false;
let generating = false;
let previewRenderer = null;
let previewScene = null;
let previewCamera = null;
let previewMesh = null;
let previewAnim = 0;
let activeAsset = null;
let abortCtrl = null;
let lastGenerateAt = 0;

const $ = id => document.getElementById(id);

function setWorkflowStep(stepKey) {
  document.querySelectorAll('#tripo-steps li').forEach(li => {
    li.classList.toggle('on', li.dataset.step === stepKey);
    li.classList.toggle('done', WORKFLOW.findIndex(w => w.key === stepKey) > WORKFLOW.findIndex(w => w.key === li.dataset.step));
  });
}

function setAssetStateLabel(state) {
  const el = $('tripo-asset-state');
  if (el) el.textContent = state || '—';
}

function setStatus(detail = '') {
  const sub = $('tripo-status-detail');
  if (sub) sub.textContent = detail || '';
}

function setProgress(pct) {
  const bar = $('tripo-progress');
  const wrap = $('tripo-progress-wrap');
  if (!wrap || !bar) return;
  if (pct == null || Number.isNaN(pct)) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;
  bar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
}

function setBalance(text) {
  const el = $('tripo-balance');
  if (el) el.textContent = text;
}

function showConfigMessage(msg) {
  const el = $('tripo-config-msg');
  if (el) {
    el.textContent = msg;
    el.hidden = !msg;
  }
}

function readTransformFromUi(category) {
  const base = defaultTransform(category);
  return {
    scale: parseFloat($('tripo-scale')?.value) || base.scale,
    rotationY: ((parseFloat($('tripo-rot')?.value) || 0) * Math.PI) / 180,
    position: { ...base.position },
  };
}

function fillTransformUi(asset) {
  const t = asset?.transform || defaultTransform(asset?.category);
  if ($('tripo-scale')) $('tripo-scale').value = t.scale ?? 1;
  if ($('tripo-rot')) $('tripo-rot').value = Math.round(((t.rotationY || 0) * 180) / Math.PI);
}

function initPreviewCanvas() {
  const cv = $('tripo-preview');
  if (!cv || previewRenderer) return;
  previewRenderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true });
  previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  previewScene = new THREE.Scene();
  previewCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  previewCamera.position.set(1.6, 1.2, 2.4);
  previewCamera.lookAt(0, 0.6, 0);
  previewScene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.1));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(2, 4, 3);
  previewScene.add(dir);
  const loop = () => {
    previewAnim = requestAnimationFrame(loop);
    if (previewMesh) previewMesh.rotation.y += 0.008;
    if (previewRenderer && previewScene && previewCamera) {
      const w = cv.clientWidth || 280;
      const h = cv.clientHeight || 200;
      previewRenderer.setSize(w, h, false);
      previewCamera.aspect = w / h;
      previewCamera.updateProjectionMatrix();
      previewRenderer.render(previewScene, previewCamera);
    }
  };
  loop();
}

async function loadPreviewFromUrl(url) {
  initPreviewCanvas();
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      gltf => {
        if (previewMesh) previewScene.remove(previewMesh);
        previewMesh = gltf.scene;
        const box = new THREE.Box3().setFromObject(previewMesh);
        const size = box.getSize(new THREE.Vector3());
        const max = Math.max(size.x, size.y, size.z, 0.001);
        previewMesh.scale.setScalar(1.2 / max);
        box.setFromObject(previewMesh);
        previewMesh.position.y -= box.min.y;
        previewScene.add(previewMesh);
        setWorkflowStep('preview');
        $('tripo-btn-save')?.removeAttribute('disabled');
        $('tripo-btn-dl')?.removeAttribute('disabled');
        resolve(gltf);
      },
      undefined,
      reject
    );
  });
}

function syncActiveAsset(partial) {
  activeAsset = upsertLocalAsset({ ...activeAsset, ...partial });
  setAssetStateLabel(activeAsset.state);
  fillTransformUi(activeAsset);
  return activeAsset;
}

async function refreshBalance() {
  if (!configured) {
    setBalance('—');
    return;
  }
  try {
    const body = await fetchTripoBalance();
    const bal = body?.data?.balance;
    const frozen = body?.data?.frozen;
    if (bal != null) {
      setBalance(`${Number(bal).toFixed(2)} créditos` + (frozen ? ` (${Number(frozen).toFixed(2)} congelados)` : ''));
    } else setBalance('Saldo no disponible');
  } catch {
    setBalance('No se pudo leer el saldo');
  }
}

async function onSaveAsset() {
  if (!activeAsset?.taskId) {
    setStatus('No hay activo para guardar.');
    return;
  }
  Audio.click();
  setStatus('Validando GLB…');
  try {
    const meta = {
      taskId: activeAsset.taskId,
      displayName: activeAsset.displayName,
      category: activeAsset.category,
      style: activeAsset.style,
      description: activeAsset.description,
      glbPath: activeAsset.glbPath,
      transform: readTransformFromUi(activeAsset.category),
    };
    const result = await registerTripoAsset(meta);
    syncActiveAsset({
      ...result.asset,
      state: TRIPO_ASSET_STATES.validado,
      glbPath: result.asset?.glbPath || activeAsset.glbPath,
    });
    await syncRegistryFromServerManifest();
    setWorkflowStep('guardar');
    setStatus('Activo validado y registrado en el manifest.');
    $('tripo-btn-incorporate')?.removeAttribute('disabled');
  } catch (e) {
    setStatus(e.message || 'Error al guardar.');
  }
}

async function onIncorporate() {
  if (!activeAsset?.glbPath) {
    setStatus('Guarda y valida el modelo antes de incorporarlo.');
    return;
  }
  if (!is3DReady()) {
    setStatus('Entra al servicio 3D antes de incorporar.');
    return;
  }
  Audio.good();
  try {
    const transform = readTransformFromUi(activeAsset.category);
    const slot = $('tripo-entity-slot')?.value || null;
    const asset = syncActiveAsset({ transform, entitySlot: slot === 'prop_generico' ? null : slot });
    await incorporateTripoAsset(asset, { replaceSlot: !!slot && slot !== 'prop_generico' });
    syncActiveAsset({ state: TRIPO_ASSET_STATES.integrado });
    await patchTripoAsset(asset.id, { state: TRIPO_ASSET_STATES.integrado, transform, entitySlot: asset.entitySlot }).catch(() => {});
    setWorkflowStep('incorporar');
    setStatus('Modelo incorporado a la escena.');
    $('tripo-btn-remove')?.removeAttribute('disabled');
    $('tripo-btn-bind')?.removeAttribute('disabled');
  } catch (e) {
    setStatus(e.message || 'No se pudo incorporar.');
  }
}

async function onBindEntity() {
  if (!activeAsset || activeAsset.state !== TRIPO_ASSET_STATES.integrado) {
    setStatus('Incorpora el modelo antes de asociar una entidad.');
    return;
  }
  const slot = $('tripo-entity-slot')?.value;
  if (!slot) {
    setStatus('Elige una ranura de entidad.');
    return;
  }
  Audio.click();
  try {
    const transform = readTransformFromUi(activeAsset.category);
    syncActiveAsset({ entitySlot: slot === 'prop_generico' ? null : slot, transform });
    await incorporateTripoAsset(activeAsset, { replaceSlot: slot !== 'prop_generico' });
    syncActiveAsset({ state: TRIPO_ASSET_STATES.integrado, entitySlot: slot === 'prop_generico' ? null : slot });
    setWorkflowStep('asociar');
    setStatus('Entidad asociada.');
  } catch (e) {
    setStatus(e.message || 'No se pudo asociar.');
  }
}

function onRemoveFromScene() {
  if (!activeAsset?.id) return;
  Audio.click();
  retireTripoAssetFromScene(activeAsset.id);
  syncActiveAsset({ state: TRIPO_ASSET_STATES.retirado });
  patchTripoAsset(activeAsset.id, { state: TRIPO_ASSET_STATES.retirado }).catch(() => {});
  setWorkflowStep('retirar');
  setStatus('Modelo retirado de la escena.');
}

export async function initTripoPanel() {
  const panel = $('tripo-panel');
  if (!panel) return;
  initPreviewCanvas();

  const slotSel = $('tripo-entity-slot');
  if (slotSel && !slotSel.options.length) {
    for (const [key, meta] of Object.entries(TRIPO_ENTITY_SLOTS)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = meta.label;
      slotSel.appendChild(opt);
    }
  }

  $('tripo-btn-close')?.addEventListener('click', () => {
    Audio.click();
    panel.classList.remove('show');
  });
  $('tripo-btn-balance')?.addEventListener('click', () => {
    Audio.click();
    refreshBalance();
  });
  $('tripo-btn-dl')?.addEventListener('click', () => {
    if (!activeAsset?.glbPath) return;
    Audio.click();
    const a = document.createElement('a');
    a.href = activeAsset.glbPath;
    a.download = `${activeAsset.taskId}.glb`;
    a.click();
  });
  $('tripo-btn-save')?.addEventListener('click', () => void onSaveAsset());
  $('tripo-btn-incorporate')?.addEventListener('click', () => void onIncorporate());
  $('tripo-btn-bind')?.addEventListener('click', () => void onBindEntity());
  $('tripo-btn-remove')?.addEventListener('click', onRemoveFromScene);
  $('tripo-btn-generate')?.addEventListener('click', () => void onGenerate());

  try {
    const cfg = await fetchTripoConfig();
    configured = !!cfg.configured;
    await syncRegistryFromServerManifest();
    if (!configured) {
      showConfigMessage(
        'Generación 3D desactivada: configura TRIPO_API_KEY en el servidor local (docs/tripo-setup.md).'
      );
      $('tripo-btn-generate')?.setAttribute('disabled', 'disabled');
      setBalance('—');
      setWorkflowStep('generar');
      return;
    }
    showConfigMessage(cfg.mock ? 'Modo simulación (TRIPO_MOCK): sin consumo de créditos.' : '');
    await refreshBalance();
    setWorkflowStep('generar');
  } catch {
    showConfigMessage('Usa npm run dev en local; GitHub Pages no incluye proxy Tripo.');
    $('tripo-btn-generate')?.setAttribute('disabled', 'disabled');
  }
}

export function openTripoPanel() {
  $('tripo-panel')?.classList.add('show');
  refreshBalance().catch(() => {});
}

async function onGenerate() {
  const now = Date.now();
  if (generating || now - lastGenerateAt < 800) return;
  const desc = ($('tripo-desc')?.value || '').trim();
  if (!desc) {
    setStatus('Escribe una descripción del modelo.');
    return;
  }
  if (!configured) {
    setStatus('Tripo no está configurado en el servidor.');
    return;
  }

  generating = true;
  lastGenerateAt = now;
  abortCtrl = new AbortController();
  const btn = $('tripo-btn-generate');
  btn?.setAttribute('disabled', 'disabled');
  ['tripo-btn-save', 'tripo-btn-incorporate', 'tripo-btn-bind', 'tripo-btn-remove', 'tripo-btn-dl'].forEach(id =>
    $(id)?.setAttribute('disabled', 'disabled')
  );
  setProgress(0);
  setStatus('Enviando petición…');
  setWorkflowStep('generar');

  try {
    Audio.click();
    const category = $('tripo-category')?.value || 'objeto';
    const style = $('tripo-style')?.value || 'juego';
    syncActiveAsset({
      taskId: null,
      description: desc,
      category,
      style,
      displayName: makeDisplayName(desc, category),
      state: TRIPO_ASSET_STATES.pendiente,
      transform: readTransformFromUi(category),
    });
    const body = await startTripoGeneration({ description: desc, category, style });
    const taskId = body?.data?.task_id;
    if (!taskId) throw new Error('La API no devolvió un identificador de tarea.');
    syncActiveAsset({
      taskId,
      id: stableAssetId(taskId),
      state: TRIPO_ASSET_STATES.pendiente,
    });
    setStatus(`Generando (${taskId.slice(0, 8)}…)…`);
    await pollTripoTask(taskId, {
      signal: abortCtrl.signal,
      onProgress: t => {
        if (t?.progress != null) setProgress(t.progress);
      },
    });
    setStatus('Descargando GLB…');
    setProgress(100);
    const { blob, localPath, assetId } = await downloadTripoGlb(taskId);
    const blobUrl = URL.createObjectURL(blob);
    syncActiveAsset({
      glbPath: localPath,
      id: assetId || stableAssetId(taskId),
      state: TRIPO_ASSET_STATES.generado,
    });
    await loadPreviewFromUrl(blobUrl);
    setStatus('Previsualización lista. Pulsa Guardar para validar el activo.');
    await refreshBalance();
  } catch (e) {
    setStatus(e.message || 'Error desconocido.');
    setProgress(null);
  } finally {
    generating = false;
    btn?.removeAttribute('disabled');
  }
}

export function mountTripoHudButton() {
  const hud = document.querySelector('.hud-actions');
  if (!hud || document.getElementById('btn-tripo')) return;
  const b = document.createElement('button');
  b.id = 'btn-tripo';
  b.type = 'button';
  b.className = 'hud-btn teal';
  b.setAttribute('aria-label', 'Generar modelo 3D con Tripo');
  b.innerHTML =
    '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 5l6-3 6 3v6l-6 3-6-3V5z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M10 8v8M7 10l3 2 3-2" fill="none" stroke="currentColor" stroke-width="1.2"/></svg><span>Tripo 3D</span>';
  b.addEventListener('click', () => {
    Audio.click();
    openTripoPanel();
  });
  hud.insertBefore(b, hud.firstChild);
}
