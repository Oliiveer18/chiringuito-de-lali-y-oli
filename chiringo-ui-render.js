import {photoThread} from './management-ui.js?v=28.2';
import { Game } from './state.js?v=28.2';
import { ITEMS } from './config.js?v=28.2';
import { ICON_URL } from './icons.js?v=28.2';
import { drawPerson } from './render.js?v=28.2';
import { escapeHtml, eur } from './util.js?v=28.2';
import { influEffect } from './social-model.js?v=28.2';
import { POSTS, INFLU } from './v12.js?v=28.2';

const FOL = 'socialFollowers', RAT = 'socialRating', TAB = 'chiringo';
const KIOSCO = 'El Charco Azul';

/* Iconos SVG (sustituyen a los emojis: acabado profesional y coherente). */
const ICONS = {
  followers: '<path d="M9 11a4 4 0 100-8 4 4 0 000 8zm7 1a3 3 0 100-6 3 3 0 000 6zM2 20c0-3.5 3-6 7-6s7 2.5 7 6M16 14.6c3 .2 6 2 6 5.4h-4.3"/>',
  reach: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  chat: '<path d="M21 12a8 8 0 01-8 8H5l-2 2V12a8 8 0 0116 0z"/>',
  flame: '<path d="M12 2s5 4.5 5 9.5a5 5 0 01-10 0c0-2 1-3.2 1-3.2S5 9.5 5 12a7 7 0 0014 0C19 6.5 12 2 12 2z"/>',
  hand: '<path d="M12 21c4.5 0 7.5-3 7.5-7v-5a1.5 1.5 0 00-3 0m-4.5 12c-4.5 0-7.5-3-7.5-7V6a1.5 1.5 0 013 0v6m7.5 9V9a1.5 1.5 0 013 0v8"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  warn: '<path d="M12 3l10 18H2L12 3zm0 6v5m0 3v.5"/>',
  poll: '<path d="M4 20V10m5 10V4m5 16v-7m5 7V8"/>',
  heart: '<path d="M12 21S3 14 3 8.5A4.5 4.5 0 0112 5a4.5 4.5 0 019 3.5C21 14 12 21 12 21z"/>'
};
const icon = n => '<svg class="ci" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[n] || '') + '</svg>';
const brandMark = '<svg class="ci bm" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#0f8b8d"/><path d="M8 40c6-4 10-4 16 0s10 4 16 0 10-4 16 0v16H8z" fill="#fffdf8" opacity=".92"/><path d="M32 12v26" stroke="#fffdf8" stroke-width="3" stroke-linecap="round"/><path d="M14 24c4-10 14-13 18-12-1 8-8 14-18 12zM50 24c-4-10-14-13-18-12 1 8 8 14 18 12z" fill="#e8603c"/></svg>';

/* Reacciones personales (solo locales, sin efecto económico). */
let LIKES = new Set();
try { LIKES = new Set(JSON.parse(sessionStorage.getItem('lalioli-likes') || '[]')); } catch (e) {}
document.addEventListener('click', e => {
  const b = e.target.closest?.('[data-like]'); if (!b) return;
  const key = b.dataset.like, on = !b.classList.contains('on');
  b.classList.toggle('on', on);
  const n = b.querySelector('span'); if (n) n.textContent = Math.max(0, Number(n.textContent) + (on ? 1 : -1));
  on ? LIKES.add(key) : LIKES.delete(key);
  try { sessionStorage.setItem('lalioli-likes', JSON.stringify([...LIKES])); } catch (err) {}
});

/* Gráfica de seguidores con datos reales de la progresión. */
function sparkline(u) {
  const hist = u.progression && Array.isArray(u.progression.history) ? u.progression.history : [];
  const pts = hist.map(r => Number(r.followers) || 0);
  if (u[FOL]) pts.push(u[FOL]);
  if (pts.length < 2 || !pts.some(v => v > 0)) return '';
  const w = 138, h = 38, min = Math.min(...pts), max = Math.max(...pts), span = Math.max(1, max - min);
  const xy = pts.map((v, i) => [(i / (pts.length - 1)) * w, h - 5 - ((v - min) / span) * (h - 10)]);
  const line = xy.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const area = 'M0,' + h + ' L' + line + ' L' + w + ',' + h + ' Z';
  return '<svg class="rd-spark" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true"><path class="a" d="' + area + '"/><polyline class="l" points="' + line + '"/><circle class="d" cx="' + w + '" cy="' + xy[xy.length - 1][1].toFixed(1) + '" r="2.6"/></svg>';
}
const MIL = [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000];
const MIL_PRIZE = { 100: 'Influencer mediano', 250: 'Vídeo viral', 500: 'Influencer grande' };
const POST_ICON = { atardecer: '🌅', algodon: '🍭', show: '🎤', viral: '🎬', encuesta: '🗳️', concurso: '🎁' };
const POST_IMG = { papas: 'papas', barraquito: 'barraquito' };
const NAMES = ['Marta', 'Javi', 'Cristina', 'Hugo', 'Lucía', 'Dani', 'Sofía', 'Pablo', 'Irene', 'Álvaro', 'Nuria', 'Tom', 'Anna', 'Lars', 'Carmen', 'Iker'];
const CITIES = ['Madrid', 'Bilbao', 'Sevilla', 'La Laguna', 'Santa Cruz', 'Londres', 'Mánchester', 'Berlín', 'Dublín', 'Valencia', 'Las Palmas', 'Oslo'];
const SKINS_ = ['#f2c9a5', '#e0a97e', '#c58a5c', '#8d5a3b', '#f6d5b8'];
const SHIRTS = ['#e8603c', '#0f8b8d', '#f5b82e', '#7a5bd6', '#3f8a3a', '#d6342a', '#2a6b8a', '#f4a6c0'];
const HAIRS = ['corto', 'largo', 'coleta', 'flequillo', 'moño', 'rastas', 'calvo'];
const HAIR_COL = ['#2a211c', '#6b4226', '#d9b35a', '#b8321f', '#8b8b8b'];
const HATS = [null, null, 'sombrero', 'gorra', 'gafas'];
const REPLY = {
  disculpa: 'Gracias por avisarnos y perdón por las molestias. Mañana lo hacemos mejor.',
  descuento: 'Lo sentimos mucho. Os invitamos con un descuento en la próxima visita.'
};

function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function pick(arr, text, salt) { return arr[hash(text + '|' + salt) % arr.length]; }

const AV = {};
function avatar(text) {
  if (AV[text]) return AV[text];
  try {
    const cv = document.createElement('canvas'); cv.width = cv.height = 88; const c = cv.getContext('2d');
    c.fillStyle = '#f6e8cf'; c.beginPath(); c.arc(44, 44, 42, 0, 7); c.fill();
    const acc = hash(text + 'acc') % 4 === 0 ? ['gafasSol'] : hash(text + 'acc') % 4 === 1 ? ['pendiente'] : [];
    drawPerson(c, 44, 140, {
      shirt: pick(SHIRTS, text, 's'), skin: pick(SKINS_, text, 'k'), hat: pick(HATS, text, 'h'),
      look: { hair: { style: pick(HAIRS, text, 'p'), color: pick(HAIR_COL, text, 'c') }, build: 1, height: 1, walk: {}, acc },
      type: 'staff', scale: 1.35
    });
    AV[text] = cv.toDataURL();
  } catch (e) { AV[text] = ''; }
  return AV[text];
}

function review(text) {
  const neg = /tard|falt|caro|decep|chasco|no vimos|no quedaba/i.test(text);
  const trend = /buscaba|encuesta|acert/i.test(text);
  const tag = neg ? 'Queja' : trend ? 'Tendencia' : 'Elogio';
  const h = hash(text);
  const st = neg ? 1 + h % 2 : trend ? 5 : 4 + h % 2;
  return { neg, tag, cls: neg ? 'bad' : trend ? 'trend' : 'good', st, name: pick(NAMES, text, 'n'), city: pick(CITIES, text, 'y') };
}

function setStatus(msg, kind) { status = { msg, kind: kind || '', t: Date.now() }; }
function flash(id) { flashId = id; flashT = Date.now(); }
function milestone(f) {
  const next = MIL.find(m => m > f) || f;
  const before = [0, ...MIL].filter(m => m <= f).pop();
  const pct = next > before ? Math.round((f - before) / (next - before) * 100) : 100;
  return { next, before, pct };
}
function arrToday(u) {
  let a = 0;
  if (u.socialPostDia === Game.day && POSTS[u.socialPost]) a += (u.socialArr != null ? u.socialArr : POSTS[u.socialPost].arr);
  if (u.socialInfluContratado && INFLU[u.socialInflu]) a += (u.socialInfluArr != null ? u.socialInfluArr : INFLU[u.socialInflu].arr);
  return a;
}
const pendSum = u => (u.socialPend || []).reduce((s, e) => s + (e.n || 0), 0);
function ctxOf(u) {
  return {
    f: u[FOL] || 0, rating: u[RAT] || 3,
    trendId: (u.socialTrendDia === Game.day) ? u.socialTrend : null,
    prevId: (u.socialPostDia === Game.day - 1) ? u.socialPost : null
  };
}

function header(u) {
  const f = u[FOL] || 0, r = u[RAT] || 3, m = milestone(f), a = Math.round(arrToday(u) * 100), pend = pendSum(u);
  const prize = MIL_PRIZE[m.next] && m.next > f ? ' · desbloquea ' + MIL_PRIZE[m.next] : '';
  const kiosk = escapeHtml(u.kioskName || KIOSCO);
  const spark = sparkline(u);
  return '<div class="rd-head"><div class="rd-logo">' + brandMark + '</div><div><div class="rd-n1">' + kiosk + '</div>' +
    '<div class="rd-sub"><span>' + icon('followers') + ' <b>' + f + '</b> seguidores' + (pend ? ' <span class="rd-pend">(+' + pend + ' al cierre)</span>' : '') + '</span><span>' + icon('reach') + ' <b>' + ((u.socialStats && u.socialStats.reach) || 0) + '</b> alcance</span><span>' + icon('chat') + ' <b>' + ((u.socialStats && u.socialStats.interactions) || 0) + '</b> interacciones</span></div></div>' +
    (spark ? '<div class="rd-spark-wrap"><small>Evolución de seguidores</small>' + spark + '</div>' : '') +
    '<div class="rd-aff"><small>Afluencia hoy</small>' + (a ? '+' + a + '%' : '—') + '</div></div>' +
    '<div class="rd-prog"><div class="rd-prog-t"><span>Siguiente hito: <b>' + m.next + '</b> seguidores' + prize + '</span><span>' + (m.next > f ? 'faltan ' + (m.next - f) : '¡máximo!') + '</span></div>' +
    '<div class="rd-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + m.pct + '"><i style="width:' + m.pct + '%"></i></div></div>';
}

function todayCard(u, posted) {
  const money = Game.money, day = Game.day;
  const tr = u.socialTrend;
  let h = '<div class="rd-today"><div class="rd-h">Hoy · día ' + day + '</div>';
  h += '<div class="rd-line trend"><span>' + icon('flame') + '</span><div>' + (tr && ITEMS[tr] && u.socialTrendDia === day
    ? 'Tendencia: <b>' + ITEMS[tr].name + '</b>. Vende 3 o más y publícalo para ganar seguidores.'
    : 'Hoy no hay ninguna tendencia.') + '</div></div>';
  const ik = u.socialInflu, I = ik && INFLU[ik];
  if (I && u.socialInfluDia === day && !u.socialInfluContratado) {
    const okReq = I.req(), poor = money < I.cost, c = ctxOf(u), ie = influEffect({ I, f: c.f, rating: c.rating });
    h += '<div class="rd-line rd-influ"><span>' + icon('hand') + '</span><div><b>Influencer · ' + I.name + '</b><br><span class="rd-mut">' + I.cost + ' € · +' + Math.round(ie.arr * 100) + '% afluencia · +' + ie.followers + ' seguidores (prestados: se van antes)' +
      (okReq ? '' : ' · 🔒 ' + I.reqTxt) + '</span></div><button class="btn sm primary" data-influ="1" ' + (poor || !okReq ? 'disabled' : '') + '>' + (poor && okReq ? 'Faltan ' + (I.cost - money) + ' €' : 'Contratar') + '</button></div>';
  } else if (u.socialInfluContratado && I) {
    h += '<div class="rd-line rd-influ ok"><span>' + icon('hand') + '</span><div>' + icon('check') + ' Colaboración cerrada con <b>' + I.name + '</b>.</div></div>';
  } else h += '<div class="rd-line rd-influ"><span>' + icon('hand') + '</span><div>Hoy no hay ofertas de influencers.</div></div>';
  const P = posted && POSTS[u.socialPost];
  h += '<div class="rd-line rd-pub ' + (posted ? 'ok' : '') + '"><span>' + (posted ? icon('check') : icon('poll')) + '</span><div>' +
    (posted ? '<b>Ya has publicado hoy</b> · ' + (P ? P.name : '') : '<b>Aún no has publicado hoy</b><br><span class="rd-mut">Elige una publicación abajo.</span>') + '</div></div>';
  if (posted && u.socialPost === 'encuesta' && ITEMS[u.socialPoll]) h += '<div class="rd-line rd-pollwin"><span>' + icon('poll') + '</span><div>Encuesta cerrada · ha ganado <b>' + ITEMS[u.socialPoll].name + '</b>. Vended 3 o más.</div></div>';
  if ((u.socialIdle || 0) >= 1 && !posted) h += '<div class="rd-line rd-warn"><span>' + icon('warn') + '</span><div>Lleváis ' + u.socialIdle + ' día(s) sin publicar: desde el segundo se pierden seguidores.</div></div>';
  return h + '</div>';
}

function ledger(u) {
  const r = u.socialReport; if (!r) return '';
  const rows = (a, sg) => a.length ? a.map(x => '<li><span>' + escapeHtml(x.k) + '</span><b>' + sg + x.n + '</b></li>').join('') : '<li class="rd-mut">Nada</li>';
  return '<div class="rd-h">Balance del último cierre · ' + (r.net >= 0 ? '+' : '') + r.net + ' seguidores</div><div class="rd-ledger">' +
    '<div class="rd-col good"><h5>Ganados +' + r.gainSum + '</h5><ul>' + rows(r.gains, '+') + '</ul></div>' +
    '<div class="rd-col bad"><h5>Perdidos −' + r.lossSum + '</h5><ul>' + rows(r.losses, '−') + '</ul></div></div>';
}

function postIcon(id) {
  const k = POST_IMG[id];
  return k && ICON_URL[k] ? '<img src="' + ICON_URL[k] + '" alt="">' : '<span>' + (POST_ICON[id] || '📣') + '</span>';
}

function feed(u) {
  const cms = u.socialComments || [];
  if (!cms.length) return '<div class="rd-h">Comentarios</div><p class="rd-mut">Todavía no hay comentarios. Aparecerán al cerrar el primer día.</p>';
  const rep = u.socialReply, ayer = (u.socialPostDia === Game.day - 1 && POSTS[u.socialPost]) ? POSTS[u.socialPost].name : null;
  let h = '<div class="rd-h">Reseñas generales y respuestas</div><div class="rd-feed">';
  cms.forEach((c, i) => {
    const r = review(c), av = avatar(c);
    const about = r.neg ? 'el servicio de ayer' : r.trend ? 'la tendencia de ayer' : ayer ? 'tu publicación «' + ayer + '»' : 'la jornada de ayer';
    const likes = 1 + hash(c) % Math.max(3, Math.round((u[FOL] || 0) / 15));
    const replied = rep && rep.text === c && cms.indexOf(c) === i && REPLY[rep.kind];
    const canReply = i === 0 && r.neg && !u.socialRespondido && !replied;
    h += '<div class="rd-rev"><div class="rd-rev-top">' + (av ? '<img class="rd-av" src="' + av + '" alt="">' : '<div class="rd-av">' + icon('followers') + '</div>') +
      '<div class="rd-who"><b>' + r.name + '</b><span class="rd-mut">' + r.city + ' · sobre ' + escapeHtml(about) + '</span></div>' +
      '<span class="rd-tag ' + r.cls + '">' + r.tag + '</span></div><p class="rd-txt">“' + escapeHtml(c) + '”</p><div class="rd-acts"><button class="rd-like' + (LIKES.has(c) ? ' on' : '') + '" data-like="' + escapeHtml(c) + '" aria-label="Me gusta" aria-pressed="' + (LIKES.has(c) ? 'true' : 'false') + '">' + icon('heart') + '<span>' + (likes + (LIKES.has(c) ? 1 : 0)) + '</span></button><span class="rd-cm">' + icon('chat') + ' ' + (replied ? 1 : 0) + '</span></div>';
    if (replied) h += '<div class="rd-reply"><b>' + brandMark + ' ' + KIOSCO + '</b><br>' + REPLY[rep.kind] + '</div>';
    if (canReply) h += '<div class="rd-reply-do"><span class="rd-mut">Responder (si no, perdéis seguidores mañana):</span><button class="btn sm teal" data-resp="disculpa">Disculparos</button><button class="btn sm primary" data-resp="descuento" ' + (Game.money < 50 ? 'disabled' : '') + '>Descuento · 50 €</button></div>';
    h += '</div>';
  });
  return h + '</div>';
}

function archiveHtml(u) {
  const records = Array.isArray(u.chiringoArchive) ? u.chiringoArchive : [];
  let h = '<section class="cs-timeline" aria-label="Historial de publicaciones"><h3>Tu perfil · Publicaciones</h3><p class="rd-mut">Historial de las últimas 60 publicaciones, registrado desde esta actualización. Las métricas son resultados calculados por el juego.</p>';
  if (!records.length) h += '<p class="cs-empty">Tu próxima publicación aparecerá aquí. Elige una de las opciones de arriba para prepararla.</p>';
  for (const r of [...records].reverse()) {
    const P = POSTS[r.post]; if (!P) continue;
    const label = escapeHtml(P.name), business = escapeHtml(u.kioskName || 'El Charco Azul');
    const m = r.metrics;
    h += '<article class="cs-post"><header><div class="cs-avatar">' + brandMark + '</div><div><b>' + business + '</b><small>Temporada ' + r.season + ' · Día ' + r.day + ' · ' + (r.cost ? 'Campaña' : 'Orgánica') + '</small></div></header>';
    h += '<div class="cs-art cs-art-' + r.post + '"><span>' + postIcon(r.post) + '</span><strong>' + label + '</strong><small>Tenerife · Ilustración de la publicación</small></div>';
    h += '<div class="cs-post-body"><p>' + escapeHtml(P.desc) + '</p><p class="cs-metrics">' + (m ? '♡ ' + m.likes + ' me gusta · ' + m.comments + ' comentarios estimados · Alcance ' + m.reach : 'Resultados pendientes del cierre') + '</p>';
    h += '<p class="rd-mut">Inversión: ' + eur(r.cost) + (m ? ' · Interacciones: ' + m.interactions : ' · Previsión de afluencia: +' + Math.round(r.arr * 100) + '%') + '</p></div>' + photoThread(r) + '</article>';
  }
  return h + '</section>';
}

export {
  FOL, RAT, TAB, KIOSCO, MIL, MIL_PRIZE, REPLY,
  milestone, arrToday, ctxOf, header, todayCard, ledger, postIcon, feed, archiveHtml,
};
