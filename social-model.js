/* Modelo de seguidores de Chiringo. Funciones puras (sin DOM ni estado global) para poder probarlas con node.
   Alcance: f/(f+N) con rendimientos decrecientes. Interacción: valoración y encaje con la tendencia.
   Cierre diario: ganados (publicaciones, influencer, boca a boca...) menos perdidos (abandono, inactividad, promesas rotas...). */
export const REACH_N = 150, REF_F = 50;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = v => (Number.isFinite(v) ? v : 0);
const r3 = v => Math.round(v * 1000) / 1000;

// publicación -> producto en tendencia con el que encaja
export const TREND_POST = { papas: 'papas', algodon: 'algodon' };

// 1 con ~50 seguidores de referencia; sube hasta 1,8 y baja hasta 0,7 (partida nueva empieza en 0 → alcance mínimo)
export function reachFactor(f) {
  f = Math.max(0, num(f));
  return clamp((f / (f + REACH_N)) / (REF_F / (REF_F + REACH_N)), 0.7, 1.8);
}
// 1 con valoración 3; +0,2 por estrella; +0,15 si encaja con la tendencia de hoy
export function engagement({ rating = 3, match = false } = {}) {
  return clamp(1 + (num(rating) - 3) * 0.2 + (match ? 0.15 : 0), 0.6, 1.4);
}
export const fatigue = (id, prevId) => (id && id === prevId ? 0.6 : 1);

// Alcance, interacciones y seguidores son metricas distintas.
export function postMetrics({ fx, f = 0 } = {}) {
  const reach = Math.round(Math.max(20, num(f)) * 2.5 * num((fx && fx.reach) || 1));
  const interactions = Math.round(reach * 0.06 * num((fx && fx.eng) || 1));
  const likes = Math.round(interactions * 0.7);
  return { reach, interactions, likes, comments: interactions - likes };
}
export function postEffect({ id, P, f, rating, trendId, prevId }) {
  const match = !!(trendId && TREND_POST[id] === trendId);
  const reach = reachFactor(f), eng = engagement({ rating, match }), fat = fatigue(id, prevId);
  return { arr: r3(P.arr * reach * eng * fat), followers: Math.max(0, Math.round(P.followers * eng * fat * reach * 0.72)), reach, eng, fat, match };
}
export function influEffect({ I, f, rating }) {
  const reach = reachFactor(f), eng = engagement({ rating });
  return { arr: r3(I.arr * reach * eng), followers: I.followers, reach, eng };
}

const STOCK_POST = new Set(['papas', 'barraquito', 'algodon', 'concurso']);
const SHOW_POST = new Set(['show']);
const RISK = { bajo: 'bajo', medio: 'medio', alto: 'alto' };

/** Texto de planificación (sin números garantizados) para la pestaña Chiringo. */
export function postBrief({ id, P, match = false, fat = 1, prevId = null }) {
  const promesa = P?.desc || 'Más visibilidad si el día acompaña.';
  let riesgo = RISK.bajo;
  if (SHOW_POST.has(id)) riesgo = RISK.alto;
  else if (STOCK_POST.has(id)) riesgo = RISK.medio;
  else if (id === 'viral') riesgo = RISK.medio;
  const fail = [];
  if (STOCK_POST.has(id) && id !== 'concurso') fail.push('Si promocionáis un producto y no hay stock durante la jornada, la gente se enfada y perdéis seguidores.');
  if (id === 'algodon') fail.push('Si se agota el algodón, la promesa se considera incumplida al cierre.');
  if (id === 'show') fail.push('Si el show no se celebra o decepciona, perdéis credibilidad y seguidores pendientes.');
  else fail.push('Si incumplís lo que prometéis en la publicación, al cierre se pierden seguidores pendientes.');
  if (fat < 1 || (prevId && prevId === id)) fail.push('Repetir la misma publicación que ayer reduce el margen de maniobra.');
  const trend =
    match === true ? 'encaja' : match === false && id ? 'no encaja' : '—';
  return { promesa, riesgo, siFallas: fail.slice(0, 2).join(' '), trend, repetida: fat < 1 };
}

export function influBrief() {
  return {
    promesa: 'Visibilidad extra y visitantes curiosos mientras dura la colaboración.',
    riesgo: RISK.medio,
    siFallas: 'Muchos seguidores son prestados: se irán antes si la jornada decepciona.',
  };
}

export function trendFitLabel(match) {
  if (match === true) return 'encaja';
  if (match === false) return 'no encaja';
  return '—';
}

/** Una línea de rival del mercado (copy + presión opcional de afluencia). */
export function chiringoRivalLine(rivals, day, seed) {
  if (!rivals?.npcs?.length || !Number.isFinite(day)) return null;
  const h = hashStr(String(seed ?? '') + ':' + day);
  const pool = rivals.npcs.filter(n => n.area === 0);
  const npc = pool[h % Math.max(1, pool.length)] || rivals.npcs[h % rivals.npcs.length];
  if (!npc) return null;
  const short = String(npc.name || 'Otro kiosco').split(' ·')[0].trim();
  const campaign = h % 4 === 0;
  const text = campaign
    ? `En el pueblo, ${short} también ha movido ficha en redes hoy.`
    : `${short} compite por la misma clientela de playa.`;
  return { text, pressure: campaign ? 0.985 : 1 };
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// 4 % diario con 1 estrella, 0,5 % con 5
export const churnRate = rep => clamp(0.04 - (num(rep) - 1) * 0.00875, 0.005, 0.04);

export function settle({ f = 0, rep = 3, pend = [], postOk = true, extra = [], sinResp = false, idle = 0, prestados = null }) {
  f = Math.max(0, Math.round(num(f)));
  const gains = [], losses = [];
  let broken = 0;
  for (const e of pend || []) {
    const n = Math.round(num(e.n)); if (n <= 0) continue;
    if (e.post && !postOk) { broken += n; continue; }
    gains.push({ k: e.k, n });
  }
  for (const e of extra || []) { const n = Math.round(num(e.n)); if (n > 0) gains.push({ k: e.k, n }); }
  const ab = Math.max(f >= 20 ? 1 : 0, Math.round(f * churnRate(rep)));
  if (ab > 0) losses.push({ k: 'Abandono diario', n: ab });
  if (idle >= 2 && f > 0) losses.push({ k: 'Sin publicar', n: Math.max(1, Math.round(f * 0.01)) });
  if (prestados && prestados.dias > 0 && prestados.n > 0) losses.push({ k: 'Seguidores prestados', n: Math.max(1, Math.round(prestados.n * 0.06)) });
  if (broken > 0) losses.push({ k: 'Promesa incumplida', n: broken });
  if (sinResp && f > 0) losses.push({ k: 'Queja sin responder', n: Math.max(1, Math.round(f * 0.01)) });
  const gainSum = gains.reduce((s, x) => s + x.n, 0), lossSum = losses.reduce((s, x) => s + x.n, 0);
  const total = clamp(f + gainSum - lossSum, 0, 99999);
  return { gains, losses, gainSum, lossSum, net: total - f, total };
}
