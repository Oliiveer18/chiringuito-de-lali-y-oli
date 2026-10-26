/* Modelo de seguidores de Chiringo. Funciones puras (sin DOM ni estado global) para poder probarlas con node.
   Alcance: f/(f+N) con rendimientos decrecientes. Interacción: valoración y encaje con la tendencia.
   Cierre diario: ganados (publicaciones, influencer, boca a boca...) menos perdidos (abandono, inactividad, promesas rotas...). */
export const REACH_N = 150, REF_F = 50;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = v => (Number.isFinite(v) ? v : 0);
const r3 = v => Math.round(v * 1000) / 1000;

// publicación -> producto en tendencia con el que encaja
export const TREND_POST = { papas: 'papas', algodon: 'algodon' };

// 1 con los 50 seguidores iniciales; sube hasta 1,8 y baja hasta 0,7
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
  return { arr: r3(P.arr * reach * eng * fat), followers: Math.max(1, Math.round(P.followers * eng * fat)), reach, eng, fat, match };
}
export function influEffect({ I, f, rating }) {
  const reach = reachFactor(f), eng = engagement({ rating });
  return { arr: r3(I.arr * reach * eng), followers: I.followers, reach, eng };
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
