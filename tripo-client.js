/** Cliente del proxy Tripo (solo rutas /api/tripo; sin claves en el navegador). */

export async function fetchTripoConfig() {
  const res = await fetch('/api/tripo/config', { cache: 'no-store' });
  if (!res.ok) throw new Error('No se pudo comprobar la configuración de Tripo.');
  return res.json();
}

export async function fetchTripoBalance() {
  const res = await fetch('/api/tripo/balance', { cache: 'no-store' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || 'Error al leer el saldo.');
  return data;
}

export async function fetchTripoUsage() {
  const res = await fetch('/api/tripo/usage', { cache: 'no-store' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || 'Error al leer el uso.');
  return data;
}

export async function startTripoGeneration(payload) {
  const res = await fetch('/api/tripo/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || 'No se pudo iniciar la generación.');
  return data;
}

export async function fetchTripoTask(taskId) {
  const res = await fetch(`/api/tripo/tasks/${encodeURIComponent(taskId)}`, { cache: 'no-store' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || 'Error al consultar la tarea.');
  return data;
}

export async function downloadTripoGlb(taskId) {
  const res = await fetch(`/api/tripo/download/${encodeURIComponent(taskId)}`, { cache: 'no-store' });
  if (!res.ok) {
    let msg = 'Error al descargar el modelo.';
    try {
      const j = await res.json();
      msg = j.message || j.error || msg;
    } catch {
      /* binary error body */
    }
    throw new Error(msg);
  }
  const localPath = res.headers.get('X-Local-Path') || `/generated/tripo/${taskId}.glb`;
  const blob = await res.blob();
  return { blob, localPath };
}

/** Espera entre intentos con backoff (mín. 2 s, recomendado por Tripo). */
export function waitMs(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export async function pollTripoTask(taskId, { onProgress, signal, maxAttempts = 120 } = {}) {
  let delay = 2000;
  for (let i = 0; i < maxAttempts; i++) {
    if (signal?.aborted) throw new Error('Generación cancelada.');
    const body = await fetchTripoTask(taskId);
    const task = body?.data;
    onProgress?.(task);
    const st = task?.status;
    if (st === 'success') return task;
    if (st === 'failed' || st === 'cancelled' || st === 'banned' || st === 'expired') {
      throw new Error(`Generación fallida (${st}). Prueba otra descripción.`);
    }
    await waitMs(delay);
    delay = Math.min(delay * 1.15, 8000);
  }
  throw new Error('Tiempo de espera agotado. Vuelve a intentarlo más tarde.');
}
