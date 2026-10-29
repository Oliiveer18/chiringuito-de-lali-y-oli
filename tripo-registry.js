const REG_KEY = 'chiringuito.tripo.models';

export function loadTripoRegistry() {
  try {
    const raw = localStorage.getItem(REG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTripoEntry(entry) {
  const list = loadTripoRegistry();
  const idx = list.findIndex(e => e.taskId === entry.taskId);
  if (idx >= 0) list[idx] = { ...list[idx], ...entry };
  else list.unshift(entry);
  localStorage.setItem(REG_KEY, JSON.stringify(list.slice(0, 40)));
  return list;
}

export function getTripoEntry(taskId) {
  return loadTripoRegistry().find(e => e.taskId === taskId) || null;
}
