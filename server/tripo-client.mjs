/** Cliente HTTP hacia openapi.tripo3d.ai (solo servidor; nunca expone la clave). */
const TRIPO_BASE = 'https://openapi.tripo3d.ai/v3';

export function isTripoConfigured() {
  return Boolean(process.env.TRIPO_API_KEY && String(process.env.TRIPO_API_KEY).trim());
}

export function tripoHeaders() {
  const key = process.env.TRIPO_API_KEY;
  if (!key || !String(key).trim()) {
    const err = new Error('TRIPO_API_KEY no configurada');
    err.code = 'TRIPO_NOT_CONFIGURED';
    throw err;
  }
  return {
    Authorization: `Bearer ${String(key).trim()}`,
    Accept: 'application/json',
  };
}

async function readJson(res) {
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(body?.message || body?.data?.message || `Tripo HTTP ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export async function tripoGet(path) {
  const res = await fetch(`${TRIPO_BASE}${path}`, { headers: tripoHeaders() });
  return readJson(res);
}

export async function tripoPost(path, payload) {
  const res = await fetch(`${TRIPO_BASE}${path}`, {
    method: 'POST',
    headers: { ...tripoHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readJson(res);
}

export async function tripoDownloadUrl(url) {
  const res = await fetch(url, { headers: tripoHeaders() });
  if (!res.ok) {
    const err = new Error(`Descarga GLB fallida (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return Buffer.from(await res.arrayBuffer());
}
