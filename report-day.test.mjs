/* Pruebas de regresión v28.20: informe de fin de día rediseñado.
   Cubre:
   1. El panel de valoración (rep-hero) pinta la media y el reparto de reseñas.
   2. Los KPIs del día (atendidos, perdidos, propinas, caja).
   3. Las reseñas: tarjetas con avatar, estrellas coloreadas y botones de
      respuesta solo en reseñas de 1-2 estrellas.
   4. Responder a una reseña sigue subiendo la reputación.
   Uso: node report-day.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
globalThis.setInterval = fn => 1;
const canvas = () => ({ width: 1280, height: 720, getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }), toDataURL: () => 'data:x', addEventListener() {}, style: {}, classList: { add() {}, remove() {}, toggle() {} } });
const el = () => ({ dataset: {}, style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {} }, append() {}, appendChild() {}, remove() {}, querySelector: () => null, querySelectorAll: () => [], setAttribute() {}, addEventListener() {}, innerHTML: '', textContent: '', childElementCount: 0, children: [], getClientRects: () => [], getBoundingClientRect: () => ({ height: 0, top: 0, left: 0, width: 0 }), scrollTop: 0 });
const byId = {};
globalThis.document = {
  querySelector: s => (s === '#game' ? canvas() : el()),
  getElementById: id => byId[id] || (byId[id] = (id === 'game' ? canvas() : el())),
  createElement: t => (t === 'canvas' ? canvas() : el()),
  documentElement: el(), body: el(), head: el(),
  querySelectorAll: () => [], addEventListener: () => {},
};
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
globalThis.innerWidth = 1280; globalThis.innerHeight = 720;
globalThis.getComputedStyle = globalThis.getComputedStyle || (() => ({ getPropertyValue: () => '0' }));
globalThis.requestAnimationFrame = globalThis.requestAnimationFrame || (() => 0);
globalThis.addEventListener = globalThis.addEventListener || (() => {});
globalThis.MutationObserver = class { observe() {} };
globalThis.Peer = class {};
globalThis.navigator = {};

const V = '28.20.0';
const { Game, Net } = await import(`./state.js?v=${V}`);
await import(`./coopbridge.js?v=${V}`);
const { reportStatsHtml, reviewsSectionHtml, applyRevResp, refreshReportUI } = await import(`./report-render.js?v=${V}`);
const { dayStarsSummary, buildRevModel } = await import(`./report-model.js?v=${V}`);

// día de prueba: 5 visitas con satisfacciones variadas
function fakeVisits() {
  const mk = (sat, name) => ({ type: 'local', sat, order: ['cerveza'], asked: ['cerveza'], missing: 0, substituted: false, queueSec: 30, waitFrac: 0.2, priceF: 0, tipAmt: 0, total: 3, regular: null, regVisits: 0, name, look: null, hour: 16, peak: false, dirtySeen: 0, lost: null, table: true, upset: false });
  return [mk(0.95, 'Pino, Valle de San Lorenzo'), mk(0.9, 'Juanito, San Isidro'), mk(0.55, 'Fefo, Los Cristianos'), mk(0.3, 'Rosario, Guía de Isora'), mk(0.85, 'Tomás, Igueste')];
}

function setup() {
  Game.mode = 'report';
  Game.day = 4;
  Game.rep = 3.5;
  Game.money = 200;
  Game.buzz = 0.1;
  Game.dayStats = {
    served: 12, lost: 2, revenue: 180, tips: 4, tipsP: 1, combos: 1, purchases: 60,
    urgent: 0, fines: 0, courtesies: 0, hamacas: 0, beachRentals: 3, regVisits: 2,
    sold: { cerveza: 12 }, visits: fakeVisits(), extraCosts: {}, investments: {},
  };
  Net.role = 'solo'; Net.peer = null; Net.ui = { kind: 'report', eyebrow: 'Día 4', title: 'Buen día', body: '', btn: 'Siguiente día', last: false, bankrupt: false };
}

test('el panel de valoración pinta media y reparto de reseñas', async () => {
  setup();
  const s = Game.dayStats;
  const m = buildRevModel(s, dayStarsSummary(s));
  m.acc = { wage: 60, rent: 20, spoilVal: 0, spoilLines: [], soldStr: '<span class="tag">12 cervezas</span>', repStart: 3.5 };
  const html = reportStatsHtml(s, m);
  assert.ok(html.includes('rep-hero'), 'panel de valoración presente');
  assert.ok(html.includes('Valoración del día'), 'título de valoración');
  const pub = dayStarsSummary(s);
  assert.ok(html.includes(pub.avg.toFixed(1)), 'media pública visible');
  // reparto: 5 filas del histograma con los conteos de dayStarsSummary
  const filas = [...html.matchAll(/rep-hist-row" title="(\d+) reseñas de (\d+) estrellas?"/g)];
  assert.equal(filas.length, 5, 'cinco filas de histograma');
  for (const [, n, k] of filas) assert.equal(Number(n), pub.dist[k], `fila ${k}★ coincide con el reparto`);
  // estadísticas laterales
  assert.ok(html.includes('Satisfacción interna'), 'satisfacción interna');
  assert.ok(html.includes('Reputación del kiosco'), 'reputación');
});

test('los KPIs del día están en la cabecera del informe', async () => {
  setup();
  const s = Game.dayStats;
  const m = buildRevModel(s, dayStarsSummary(s));
  m.acc = { wage: 60, rent: 20, spoilVal: 0, spoilLines: [], soldStr: '', repStart: 3.5 };
  const html = reportStatsHtml(s, m);
  for (const k of ['Atendidos', 'Perdidos', 'Propinas', 'En caja', 'Caja del día', 'Detalles del día']) assert.ok(html.includes(k), `falta ${k}`);
  assert.ok(html.includes('rep-kpi'), 'tarjetas KPI');
});

test('las reseñas usan tarjetas con avatar y botones solo en malas', async () => {
  setup();
  const s = Game.dayStats;
  const m = buildRevModel(s, dayStarsSummary(s));
  m.acc = { wage: 0, rent: 20, spoilVal: 0, spoilLines: [], soldStr: '', repStart: 3.5 };
  const html = reviewsSectionHtml(m);
  const cards = [...html.matchAll(/<article class="review">/g)];
  assert.ok(cards.length >= 3, 'hay tarjetas de reseña');
  assert.ok(html.includes('rev-ava'), 'avatar en las tarjetas');
  // botones de respuesta solo en reseñas de 1-2 estrellas
  const malas = m.cards.filter(c => c.stars <= 2).length;
  const botones = [...html.matchAll(/window\.__respondReview\('/g)];
  assert.equal(botones.length, malas * 2, 'dos botones por cada reseña mala');
  // estrellas coloreadas
  assert.ok(/rev-stars sc-good/.test(html) || /rev-stars sc-mid/.test(html) || /rev-stars sc-bad/.test(html), 'estrellas con color semántico');
  assert.ok(html.includes('respuestas disponibles') || m.respCount >= 3, 'contador de respuestas');
});

test('responder a una reseña sube la reputación y queda anotado', async () => {
  setup();
  const s = Game.dayStats;
  const m = buildRevModel(s, dayStarsSummary(s));
  m.acc = { wage: 0, rent: 20, spoilVal: 0, spoilLines: [], soldStr: '', repStart: 3.5 };
  Game.revModel = m;
  const mala = m.cards.find(c => c.stars <= 2 && !c.resp);
  assert.ok(mala, 'hay una reseña mala sin responder');
  const rep0 = Game.rep;
  const ok = applyRevResp(mala.vid, 'disculpa', 'p1', Game.day);
  assert.ok(ok, 'la respuesta se aplica');
  assert.equal(mala.resp, 'disculpa', 'respuesta anotada');
  assert.ok(Game.rep > rep0, 'la reputación sube');
  assert.equal(m.respCount, 1, 'contador de respuestas');
});
