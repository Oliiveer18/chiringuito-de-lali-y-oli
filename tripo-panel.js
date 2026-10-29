/* Panel Tripo · generación 3D integrada en el estilo del chiringuito (español). */
import * as THREE from './lib/three.module.js';
import { GLTFLoader } from './lib/GLTFLoader.js';
import {
  fetchTripoConfig,
  fetchTripoBalance,
  startTripoGeneration,
  pollTripoTask,
  downloadTripoGlb,
} from './tripo-client.js';
import { saveTripoEntry, loadTripoRegistry } from './tripo-registry.js';
import { addTripoModelToScene, is3DReady } from './render-3d.js?v=28.16.0-vfx3d';
import { Audio } from './audio.js?v=28.16.0-vfx3d';

const STATUS = {
  idle: 'Lista',
  pending: 'Pendiente',
  processing: 'Procesando',
  downloading: 'Descargando',
  done: 'Completada',
  error: 'Error',
};

let configured = false;
let generating = false;
let previewRenderer = null;
let previewScene = null;
let previewCamera = null;
let previewMesh = null;
let previewAnim = 0;
let lastTask = null;
let abortCtrl = null;

const $ = id => document.getElementById(id);

function setStatus(key, detail = '') {
  const el = $('tripo-status');
  if (!el) return;
  el.textContent = STATUS[key] || key;
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

function initPreviewCanvas() {
  const cv = $('tripo-preview');
  if (!cv || previewRenderer) return;
  previewRenderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true });
  previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  previewScene = new THREE.Scene();
  previewCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  previewCamera.position.set(1.6, 1.2, 2.4);
  previewCamera.lookAt(0, 0.6, 0);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.1);
  previewScene.add(hemi);
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
        previewMesh.position.set(0, 0, 0);
        const box = new THREE.Box3().setFromObject(previewMesh);
        const size = box.getSize(new THREE.Vector3());
        const max = Math.max(size.x, size.y, size.z, 0.001);
        previewMesh.scale.setScalar(1.2 / max);
        box.setFromObject(previewMesh);
        previewMesh.position.y -= box.min.y;
        previewScene.add(previewMesh);
        $('tripo-btn-add')?.removeAttribute('disabled');
        $('tripo-btn-dl')?.removeAttribute('disabled');
        resolve(gltf);
      },
      undefined,
      err => reject(err)
    );
  });
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
      setBalance(
        `${Number(bal).toFixed(2)} créditos` + (frozen ? ` (${Number(frozen).toFixed(2)} congelados)` : '')
      );
    } else setBalance('Saldo no disponible');
  } catch (e) {
    setBalance('No se pudo leer el saldo');
  }
}

export async function initTripoPanel() {
  const panel = $('tripo-panel');
  if (!panel) return;

  initPreviewCanvas();

  $('tripo-btn-close')?.addEventListener('click', () => {
    Audio.click();
    panel.classList.remove('show');
  });

  $('tripo-btn-balance')?.addEventListener('click', () => {
    Audio.click();
    refreshBalance();
  });

  $('tripo-btn-dl')?.addEventListener('click', () => {
    if (!lastTask?.localPath) return;
    Audio.click();
    const a = document.createElement('a');
    a.href = lastTask.localPath;
    a.download = `${lastTask.taskId}.glb`;
    a.click();
  });

  $('tripo-btn-add')?.addEventListener('click', () => {
    if (!previewMesh || !lastTask) return;
    Audio.good();
    if (!is3DReady()) {
      setStatus('error', 'La escena 3D aún no está lista. Entra al servicio primero.');
      return;
    }
    const clone = previewMesh.clone(true);
    addTripoModelToScene(clone, {
      name: `tripo_${lastTask.taskId}`,
      x: 3.5 + Math.random() * 2,
      z: -1.5 - Math.random(),
    });
    saveTripoEntry({ ...lastTask, addedAt: new Date().toISOString() });
    setStatus('done', 'Modelo añadido a la escena.');
  });

  $('tripo-btn-generate')?.addEventListener('click', () => void onGenerate());

  try {
    const cfg = await fetchTripoConfig();
    configured = !!cfg.configured;
    if (!configured) {
      showConfigMessage(
        'Generación 3D desactivada: configura TRIPO_API_KEY en el servidor local (docs/tripo-setup.md). Puedes seguir jugando con normalidad.'
      );
      $('tripo-btn-generate')?.setAttribute('disabled', 'disabled');
      setBalance('—');
      setStatus('idle');
      return;
    }
    showConfigMessage(cfg.mock ? 'Modo simulación (TRIPO_MOCK): sin consumo de créditos.' : '');
    await refreshBalance();
    setStatus('idle');
  } catch {
    showConfigMessage(
      'No hay proxy Tripo en este hosting (GitHub Pages). Usa npm run dev en tu máquina con backend local.'
    );
    $('tripo-btn-generate')?.setAttribute('disabled', 'disabled');
  }
}

export function openTripoPanel() {
  const panel = $('tripo-panel');
  if (!panel) return;
  panel.classList.add('show');
  refreshBalance().catch(() => {});
}

async function onGenerate() {
  if (generating) return;
  const desc = ($('tripo-desc')?.value || '').trim();
  if (!desc) {
    setStatus('error', 'Escribe una descripción del modelo.');
    return;
  }
  if (!configured) {
    setStatus('error', 'Tripo no está configurado en el servidor.');
    return;
  }

  generating = true;
  abortCtrl = new AbortController();
  const btn = $('tripo-btn-generate');
  btn?.setAttribute('disabled', 'disabled');
  $('tripo-btn-add')?.setAttribute('disabled', 'disabled');
  $('tripo-btn-dl')?.setAttribute('disabled', 'disabled');
  setProgress(0);
  setStatus('pending', 'Enviando petición…');

  try {
    Audio.click();
    const category = $('tripo-category')?.value || 'objeto';
    const style = $('tripo-style')?.value || 'juego';
    const body = await startTripoGeneration({ description: desc, category, style });
    const taskId = body?.data?.task_id;
    if (!taskId) throw new Error('La API no devolvió un identificador de tarea.');

    setStatus('processing', `Tarea ${taskId.slice(0, 8)}…`);
    const task = await pollTripoTask(taskId, {
      signal: abortCtrl.signal,
      onProgress: t => {
        if (t?.progress != null) setProgress(t.progress);
        if (t?.status === 'running' || t?.status === 'queued') {
          setStatus('processing', t.status === 'queued' ? 'En cola…' : 'Generando malla…');
        }
      },
    });

    setStatus('downloading', 'Guardando GLB…');
    setProgress(100);
    const { blob, localPath } = await downloadTripoGlb(taskId);
    const blobUrl = URL.createObjectURL(blob);
    lastTask = {
      taskId,
      localPath,
      description: desc,
      category,
      style,
      savedAt: new Date().toISOString(),
    };
    saveTripoEntry(lastTask);
    await loadPreviewFromUrl(blobUrl);
    setStatus('done', 'Vista previa lista. Pulsa «Añadir a escena» si te gusta.');
    await refreshBalance();
  } catch (e) {
    setStatus('error', e.message || 'Error desconocido.');
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
