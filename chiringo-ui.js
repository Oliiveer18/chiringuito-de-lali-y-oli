/* v19: Chiringo (cabecera, tarjeta «Hoy», publicaciones en tarjetas, balance de seguidores, feed de reseñas y respuesta inmediata).
   Sustituye la pestaña «Red» de v12.js por «Chiringo». Reutiliza las acciones de v12 (data-post, data-influ, data-resp).
   Los efectos mostrados salen de social-model.js, el mismo cálculo que aplica v12.js. */
import { Game, Net } from './state.js';
import { ITEMS } from './config.js';
import { Plan, toast, estimateCustomers } from './ui.js';
import { Audio } from './audio.js';
import { ICON_URL } from './icons.js';
import { drawPerson } from './render.js';
import { netDirty } from './net.js';
import { escapeHtml, eur, stars } from './util.js';
import { postEffect, influEffect } from './social-model.js';
// Misma URL que usa game.js: así se comparte la instancia de v12 y no se duplican sus temporizadores.
import { POSTS, INFLU } from './v12.js?v=18';

const FOL = 'socialFollowers', RAT = 'socialRating', TAB = 'chiringo';
const KIOSCO = 'El Charco Azul';
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

let sel = null, status = null, flashId = null, flashT = 0, prev = { init: false }, prevDay = null;

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
  return '<div class="rd-head"><div class="rd-logo">🏝️</div><div><div class="rd-n1">' + KIOSCO + '</div>' +
    '<div class="rd-sub"><span>👥 <b>' + f + '</b> seguidores' + (pend ? ' <span class="rd-pend">(+' + pend + ' al cierre)</span>' : '') + '</span><span><span class="rd-stars">' + stars(r) + '</span> ' + r.toFixed(1).replace('.', ',') + '</span></div></div>' +
    '<div class="rd-aff"><small>Afluencia hoy</small>' + (a ? '+' + a + '%' : '—') + '</div></div>' +
    '<div class="rd-prog"><div class="rd-prog-t"><span>Siguiente hito: <b>' + m.next + '</b> seguidores' + prize + '</span><span>' + (m.next > f ? 'faltan ' + (m.next - f) : '¡máximo!') + '</span></div>' +
    '<div class="rd-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + m.pct + '"><i style="width:' + m.pct + '%"></i></div></div>';
}

function todayCard(u, posted) {
  const money = Game.money, day = Game.day;
  const tr = u.socialTrend;
  let h = '<div class="rd-today"><div class="rd-h">Hoy · día ' + day + '</div>';
  h += '<div class="rd-line"><span>📈</span><div>' + (tr && ITEMS[tr] && u.socialTrendDia === day
    ? 'Tendencia: <b>' + ITEMS[tr].name + '</b>. Vende 3 o más y publícalo para ganar seguidores.'
    : 'Hoy no hay ninguna tendencia.') + '</div></div>';
  const ik = u.socialInflu, I = ik && INFLU[ik];
  if (I && u.socialInfluDia === day && !u.socialInfluContratado) {
    const okReq = I.req(), poor = money < I.cost, c = ctxOf(u), ie = influEffect({ I, f: c.f, rating: c.rating });
    h += '<div class="rd-line"><span>🤝</span><div><b>Oferta: ' + I.name + '</b><br><span class="rd-mut">' + I.cost + ' € · +' + Math.round(ie.arr * 100) + '% afluencia · +' + ie.followers + ' seguidores (prestados: se van antes)' +
      (okReq ? '' : ' · 🔒 ' + I.reqTxt) + '</span></div><button class="btn sm primary" data-influ="1" ' + (poor || !okReq ? 'disabled' : '') + '>' + (poor && okReq ? 'Faltan ' + (I.cost - money) + ' €' : 'Contratar') + '</button></div>';
  } else if (u.socialInfluContratado && I) {
    h += '<div class="rd-line"><span>🤝</span><div>✅ Colaboración cerrada con <b>' + I.name + '</b>.</div></div>';
  } else h += '<div class="rd-line"><span>🤝</span><div>Hoy no hay ofertas de influencers.</div></div>';
  const P = posted && POSTS[u.socialPost];
  h += '<div class="rd-line rd-pub ' + (posted ? 'ok' : '') + '"><span>' + (posted ? '✅' : '⭕') + '</span><div>' +
    (posted ? '<b>Ya has publicado hoy</b> · ' + (P ? P.name : '') : '<b>Aún no has publicado hoy</b><br><span class="rd-mut">Elige una publicación abajo.</span>') + '</div></div>';
  if (posted && u.socialPost === 'encuesta' && ITEMS[u.socialPoll]) h += '<div class="rd-line"><span>🗳️</span><div>Ha ganado: <b>' + ITEMS[u.socialPoll].name + '</b>. Vended 3 o más.</div></div>';
  if ((u.socialIdle || 0) >= 1 && !posted) h += '<div class="rd-line"><span>⚠️</span><div>Lleváis ' + u.socialIdle + ' día(s) sin publicar: desde el segundo se pierden seguidores.</div></div>';
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

function postCard(id, P, posted, money, c) {
  const ok = P.req ? P.req() : true, poor = money < P.cost;
  const fx = postEffect({ id, P, f: c.f, rating: c.rating, trendId: c.trendId, prevId: c.prevId });
  const cls = ['rd-card', !ok ? 'locked' : '', posted ? 'done' : '', sel === id ? 'sel' : '', flashId === id ? 'flash' : ''].join(' ');
  return '<div class="' + cls + '" role="button" tabindex="0" data-sel="' + id + '" aria-disabled="' + (!ok || posted) + '">' +
    '<div class="rd-ico">' + postIcon(id) + '</div><div class="rd-pn">' + P.name + '</div>' +
    '<div class="rd-meta"><span>' + (P.cost ? P.cost + ' €' : 'Gratis') + '</span><span>+' + Math.round(fx.arr * 100) + '%</span><span>+' + fx.followers + ' 👥</span>' +
    (fx.match ? '<span title="Encaja con la tendencia">🔥</span>' : '') + (fx.fat < 1 ? '<span title="Repetida: efecto reducido">😴 −40%</span>' : '') + '</div>' +
    (!ok ? '<div class="rd-lock">🔒 ' + (P.reqTxt || 'No disponible') + '</div>' : posted ? (flashId === id || Game.upgrades.socialPost === id ? '<div class="rd-ok">✅ Publicado</div>' : '') : poor ? '<div class="rd-warn">Faltan ' + (P.cost - money) + ' €</div>' : '') + '</div>';
}

function previewPanel(u, posted, c) {
  if (!sel || !POSTS[sel] || posted) return '';
  const P = POSTS[sel], money = Game.money, poor = money < P.cost, ok = P.req ? P.req() : true;
  const fx = postEffect({ id: sel, P, f: c.f, rating: c.rating, trendId: c.trendId, prevId: c.prevId });
  let visits = 0; try { visits = Math.round(estimateCustomers() * fx.arr); } catch (e) { }
  return '<div class="rd-prev"><div class="rd-prev-h"><b>' + P.name + '</b><span class="rd-mut">' + P.desc + '</span></div><ul>' +
    '<li>💶 Coste: <b>' + (P.cost ? P.cost + ' €' : 'gratis') + '</b> · te quedarán <b>' + eur(money - P.cost) + '</b></li>' +
    '<li>📈 Afluencia hoy: <b>+' + Math.round(fx.arr * 100) + '%</b>' + (visits ? ' (≈ ' + visits + ' visitas más)' : '') + '</li>' +
    '<li>👥 Seguidores: <b>+' + fx.followers + '</b> al cierre, si cumplís lo prometido (ahora ' + c.f + ')</li>' +
    '<li>📊 Alcance ×' + fx.reach.toFixed(2).replace('.', ',') + ' · interacción ×' + fx.eng.toFixed(2).replace('.', ',') + (fx.match ? ' · encaja con la tendencia 🔥' : '') + (fx.fat < 1 ? ' · repetida: ×0,6' : '') + '</li></ul>' +
    '<div class="rd-prev-b"><button class="btn sm primary" data-post="' + sel + '" ' + (poor || !ok ? 'disabled' : '') + '>' + (poor ? 'Faltan ' + (P.cost - money) + ' €' : 'Confirmar y publicar') + '</button>' +
    '<button class="btn sm" data-selx="1">Cancelar</button></div></div>';
}

function feed(u) {
  const cms = u.socialComments || [];
  if (!cms.length) return '<div class="rd-h">Reseñas</div><p class="rd-mut">Todavía no hay reseñas. Aparecerán al cerrar el primer día.</p>';
  const rep = u.socialReply;
  let h = '<div class="rd-h">Reseñas</div><div class="rd-feed">';
  cms.forEach((c, i) => {
    const r = review(c), av = avatar(c);
    const replied = rep && rep.text === c && cms.indexOf(c) === i && REPLY[rep.kind];
    const canReply = i === 0 && r.neg && !u.socialRespondido && !replied;
    h += '<div class="rd-rev"><div class="rd-rev-top">' + (av ? '<img class="rd-av" src="' + av + '" alt="">' : '<div class="rd-av">🙂</div>') +
      '<div class="rd-who"><b>' + r.name + '</b><span class="rd-mut">' + r.city + '</span><div class="rd-stars">' + stars(r.st) + '</div></div>' +
      '<span class="rd-tag ' + r.cls + '">' + r.tag + '</span></div><p class="rd-txt">“' + escapeHtml(c) + '”</p>';
    if (replied) h += '<div class="rd-reply"><b>🏝️ ' + KIOSCO + '</b><br>' + REPLY[rep.kind] + '</div>';
    if (canReply) h += '<div class="rd-reply-do"><span class="rd-mut">Responder (si no, perdéis seguidores mañana):</span><button class="btn sm teal" data-resp="disculpa">Disculparos</button><button class="btn sm primary" data-resp="descuento" ' + (Game.money < 50 ? 'disabled' : '') + '>Descuento · 50 €</button></div>';
    h += '</div>';
  });
  return h + '</div>';
}

function render(force) {
  const b = document.querySelector('#tab-body');
  if (!b || Plan.tab !== TAB || Game.mode !== 'plan') return;
  const u = Game.upgrades;
  if (u[FOL] == null) return;
  if (prevDay !== Game.day) { prevDay = Game.day; sel = null; }
  const posted = u.socialPostDia === Game.day, influ = !!u.socialInfluContratado, resp = !!u.socialRespondido;
  if (Net.role === 'guest' && prev.init) {
    if (posted && !prev.posted) { setStatus('✅ Publicado hoy: ' + ((POSTS[u.socialPost] || {}).name || ''), 'good'); flash(u.socialPost); sel = null; }
    if (influ && !prev.influ) setStatus('✅ Colaboración cerrada', 'good');
    if (resp && !prev.resp) setStatus('✅ Respuesta publicada', 'good');
  }
  prev = { init: true, posted, influ, resp };
  if (flashId && Date.now() - flashT > 1400) flashId = null;
  if (status && Date.now() - status.t > 6000) status = null;
  const c = ctxOf(u);
  let h = '';
  if (status) h += '<div class="rd-status ' + status.kind + '" role="status" aria-live="polite">' + status.msg + '</div>';
  h += header(u) + todayCard(u, posted) + ledger(u);
  h += '<div class="rd-h">Publicar en Chiringo' + (posted ? ' <span class="rd-mut">· ya has publicado hoy, vuelve mañana</span>' : '') + '</div><div class="rd-grid">';
  for (const [id, P] of Object.entries(POSTS)) h += postCard(id, P, posted, Game.money, c);
  h += '</div>' + previewPanel(u, posted, c) + feed(u);
  h = '<div class="rd">' + h + '</div>';
  if (!force && b.__rd === h && b.firstChild) return;
  b.__rd = h; b.innerHTML = h;
}

function buzz() { try { navigator.vibrate && navigator.vibrate(25); } catch (e) { } }

function afterAction(t) {
  const k = t.dataset.post ? 'post' : t.dataset.influ ? 'influ' : 'resp';
  if (Net.role === 'guest') { Audio.click(); setStatus('📨 Enviado al anfitrión…', ''); render(true); return; }
  const u = Game.upgrades;
  const ok = k === 'post' ? u.socialPostDia === Game.day : k === 'influ' ? !!u.socialInfluContratado : !!u.socialRespondido;
  if (!ok) { Audio.bad(); buzz(); setStatus('⚠️ No se ha podido registrar. Revisa la caja y los requisitos.', 'bad'); render(true); return; }
  const lastPend = (pred) => [...(u.socialPend || [])].reverse().find(pred);
  if (k === 'post') {
    const P = POSTS[t.dataset.post], e = lastPend(x => x.post); flash(t.dataset.post); sel = null;
    setStatus('✅ Publicado: ' + P.name + ' · +' + (e ? e.n : P.followers) + ' seguidores al cierre · +' + Math.round((u.socialArr != null ? u.socialArr : P.arr) * 100) + '% afluencia hoy', 'good');
    if (P.cost) Audio.coin();
  } else if (k === 'influ') {
    const I = INFLU[u.socialInflu], e = lastPend(x => x.prest);
    setStatus('✅ Colaboración cerrada con ' + I.name + ' · +' + (e ? e.n : I.followers) + ' seguidores al cierre (prestados)', 'good'); Audio.coin();
  } else {
    const last = (u.socialComments || [])[0];
    if (last) u.socialReply = { text: last, kind: t.dataset.resp };
    setStatus('✅ Respuesta publicada · evitáis perder seguidores por la queja', 'good'); netDirty();
  }
  setTimeout(() => Audio.good(), 130); buzz(); render(true);
}

function hito() {
  const u = Game.upgrades, f = u[FOL];
  if (f == null || Game.mode === 'title') return;
  const m = MIL.filter(x => f >= x).pop() || 0;
  if (u.socialHito == null) { u.socialHito = m; return; }
  if (m > u.socialHito) { u.socialHito = m; toast('¡Hito en Chiringo!', 'Ya sois ' + m + ' seguidores.' + (MIL_PRIZE[m] ? ' Desbloqueado: ' + MIL_PRIZE[m] + '.' : ''), 'good'); Audio.good(); netDirty(); }
  else if (m < u.socialHito) u.socialHito = m;
}

document.addEventListener('click', e => {
  const el = e.target; if (!el || !el.closest) return;
  if (el.closest('[data-selx]')) { sel = null; Audio.click(); render(true); return; }
  const s = el.closest('[data-sel]');
  if (s) {
    e.stopPropagation();
    const id = s.dataset.sel, P = POSTS[id], posted = Game.upgrades.socialPostDia === Game.day;
    if (!P) return;
    if (posted) { Audio.bad(); setStatus('ℹ️ Ya has publicado hoy. Podréis publicar de nuevo mañana.', ''); }
    else if (P.req && !P.req()) { Audio.bad(); buzz(); setStatus('🔒 ' + P.name + ': ' + (P.reqTxt || 'no disponible'), 'bad'); }
    else { Audio.click(); sel = sel === id ? null : id; }
    render(true); return;
  }
  const t = el.closest('[data-post],[data-influ],[data-resp]');
  if (t && !t.disabled && t.closest('.rd')) afterAction(t);
}, true);
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.matches && e.target.matches('[data-sel]')) { e.preventDefault(); e.target.click(); }
});

const tabs = document.querySelector('#plan .tabs');
if (tabs) {
  const old = tabs.querySelector('[data-tab="red"]'); if (old) old.remove();
  if (!tabs.querySelector('[data-tab="' + TAB + '"]')) {
    const b = document.createElement('button'); b.className = 'tab'; b.dataset.tab = TAB; b.setAttribute('role', 'tab'); b.textContent = 'Chiringo';
    b.addEventListener('click', () => {
      Plan.tab = TAB; Audio.click();
      document.querySelectorAll('#plan .tab').forEach(x => x.classList.toggle('on', x.dataset.tab === TAB));
      render(true);
    });
    tabs.append(b);
  }
}
const body = document.getElementById('tab-body');
if (body) new MutationObserver(() => render(false)).observe(body, { childList: true });
setInterval(() => render(false), 400);
setInterval(() => { if (Net.role !== 'guest') hito(); }, 1000);

const css = `
.rd{padding-bottom:6px}
.rd-head{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:12px 14px;border-radius:16px;background:linear-gradient(135deg,var(--teal-d),var(--teal));color:#fff}
.rd-logo{width:52px;height:52px;border-radius:50%;background:var(--sand);display:grid;place-items:center;font-size:26px;flex:none;border:3px solid var(--gold)}
.rd-n1{font:600 19px/1.1 var(--font-d)}
.rd-sub{font-size:12.5px;display:flex;flex-wrap:wrap;gap:2px 12px;margin-top:4px}
.rd-pend{opacity:.85;font-size:11.5px}
.rd-stars{color:var(--gold);letter-spacing:1px}
.rd-head .rd-stars{color:#ffe08a}
.rd-aff{margin-left:auto;text-align:center;padding:6px 12px;border-radius:12px;background:rgba(255,255,255,.16);font:600 20px/1.1 var(--font-d)}
.rd-aff small{display:block;font:800 10px var(--font);letter-spacing:.1em;text-transform:uppercase;opacity:.85}
.rd-prog{margin:10px 0 12px}
.rd-prog-t{display:flex;justify-content:space-between;gap:8px;font-size:12px;color:var(--ink-2);margin-bottom:4px}
.rd-bar{height:10px;border-radius:99px;background:var(--sand-2);overflow:hidden;border:1px solid var(--line)}
.rd-bar i{display:block;height:100%;background:linear-gradient(90deg,var(--gold),var(--coral));border-radius:99px;transition:width .6s}
.rd-h{margin:14px 0 8px;font:800 11px var(--font);letter-spacing:.14em;text-transform:uppercase;color:var(--ink-2)}
.rd-mut{color:var(--ink-2);font-size:12px;font-weight:500;letter-spacing:0;text-transform:none}
.rd-today{padding:4px 14px 6px;border-radius:16px;background:var(--sand);border:1px solid var(--line)}
.rd-today .rd-h{margin:10px 0 4px}
.rd-line{display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line);font-size:13.5px}
.rd-line:last-child{border-bottom:0}
.rd-line>span:first-child{font-size:20px;flex:none;width:26px;text-align:center}
.rd-line>div{flex:1;min-width:0}
.rd-pub.ok{color:var(--good)}
.rd-pub.ok b{background:#dcf1d8;padding:2px 8px;border-radius:99px}
.rd-ledger{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.rd-col{padding:10px 12px;border-radius:14px;border:1px solid var(--line);background:var(--paper)}
.rd-col h5{margin:0 0 6px;font:600 14px var(--font-d)}
.rd-col.good h5{color:var(--good)}.rd-col.bad h5{color:var(--bad)}
.rd-col ul{list-style:none;margin:0;padding:0;display:grid;gap:3px;font-size:12.5px}
.rd-col li{display:flex;justify-content:space-between;gap:8px}
.rd-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.rd-card{position:relative;display:flex;flex-direction:column;gap:6px;padding:12px;border-radius:16px;background:var(--paper);border:2px solid var(--line);cursor:pointer;transition:transform .12s,border-color .15s,box-shadow .15s;min-height:44px}
.rd-card:hover{box-shadow:var(--sh-1)}
.rd-card:active{transform:scale(.97)}
.rd-card.sel{border-color:var(--coral);box-shadow:0 0 0 3px rgba(232,96,60,.2)}
.rd-card.locked{background:var(--sand);opacity:.7;cursor:not-allowed}
.rd-card.locked .rd-ico{filter:grayscale(1)}
.rd-card.done{opacity:.6}
.rd-card.flash{animation:rdpop .7s ease;border-color:var(--good);opacity:1}
.rd-ico{width:48px;height:48px;border-radius:12px;background:var(--sand);display:grid;place-items:center;font-size:26px}
.rd-ico img{width:40px;height:40px;object-fit:contain}
.rd-pn{font:600 14.5px/1.2 var(--font-d)}
.rd-meta{display:flex;flex-wrap:wrap;gap:4px}
.rd-meta span{padding:1px 8px;border-radius:99px;background:var(--sand-2);font-size:11.5px;font-weight:800}
.rd-lock{font-size:11.5px;color:var(--bad);font-weight:700}
.rd-warn{font-size:11.5px;color:var(--warn);font-weight:700}
.rd-ok{font-size:12px;color:var(--good);font-weight:800}
.rd-prev{margin-top:10px;padding:12px 14px;border-radius:16px;background:#fff4dc;border:1px solid #f0cf86;animation:toastin .25s ease}
.rd-prev-h{display:flex;flex-direction:column;gap:2px}
.rd-prev ul{margin:8px 0;padding-left:0;list-style:none;font-size:13px;display:grid;gap:4px}
.rd-prev-b{display:flex;gap:8px;flex-wrap:wrap}
.rd-feed{display:grid;gap:10px}
.rd-rev{padding:12px;border-radius:16px;background:var(--paper);border:1px solid var(--line)}
.rd-rev-top{display:flex;gap:10px;align-items:center}
.rd-av{width:44px;height:44px;border-radius:50%;flex:none;background:var(--sand-2);display:grid;place-items:center}
.rd-who{flex:1;min-width:0;display:flex;flex-direction:column;font-size:13.5px}
.rd-who .rd-stars{font-size:13px}
.rd-tag{padding:2px 10px;border-radius:99px;font-size:11px;font-weight:800;background:var(--sand-2)}
.rd-tag.bad{background:#fbdcd5;color:#a3321f}.rd-tag.good{background:#dcf1d8;color:#2d6a29}.rd-tag.trend{background:#d6f0f0;color:var(--teal-d)}
.rd-txt{margin:8px 0 0;font-size:13.5px}
.rd-reply{margin:8px 0 0 18px;padding:8px 12px;border-radius:12px;background:#e6f4f4;border-left:4px solid var(--teal);font-size:12.5px}
.rd-reply-do{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px}
.rd-status{position:sticky;top:0;z-index:5;margin-bottom:8px;padding:10px 14px;border-radius:12px;background:#eef3f3;border:1px solid var(--line-2);font-weight:700;font-size:13px;animation:rdpop .5s ease}
.rd-status.good{background:#dcf1d8;border-color:#bfe0b8;color:#2d6a29}
.rd-status.bad{background:#fbdcd5;border-color:#f0b4a6;color:#a3321f}
@keyframes rdpop{0%{transform:scale(.94)}45%{transform:scale(1.05)}100%{transform:scale(1)}}
@media (max-width:640px){.rd-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.rd-aff{margin-left:0}.rd-ledger{grid-template-columns:1fr}}
`;
const st = document.createElement('style'); st.id = 'rd-style'; st.textContent = css; document.head.append(st);
