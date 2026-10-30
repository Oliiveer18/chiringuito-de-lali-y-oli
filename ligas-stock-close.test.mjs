/* Pruebas de regresión v28.21: ligas legibles, sin sustituciones de género,
   clientes perdidos al cierre contados y género estropeado en la caja del día.
   1. El panel de puntos de ligas usa barras por componentes (sin tabla que se corte).
   2. Si no queda lo que pide el cliente, se marcha sin aceptar otro producto.
   3. Los clientes que siguen en cola al cierre cuentan como perdidos.
   4. La caja del día muestra el dinero perdido por género estropeado al cierre.
   Uso: node ligas-stock-close.test.mjs */
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

const V = '28.22.0';
const { Game, Net } = await import(`./state.js?v=${V}`);
await import(`./coopbridge.js?v=${V}`);
const { leaguePanel } = await import(`./management-ui.js?v=${V}`);
const { startPart } = await import(`./sim/service.js?v=${V}`);
const { update } = await import(`./sim/day.js?v=${V}`);
const { QUEUE_POS } = await import(`./world.js?v=${V}`);
const { reportStatsHtml } = await import(`./report-render.js?v=${V}`);
const { dayStarsSummary, buildRevModel } = await import(`./report-model.js?v=${V}`);

function freshStats() {
  return { revenue: 0, served: 0, lost: 0, lostPrice: 0, lostQueue: 0, lostPatience: 0, lostStock: 0, lostClose: 0, partial: 0, noTable: 0, satSum: 0, satN: 0, sold: {}, stockOuts: {}, tips: 0, tipsP: 0, combos: 0, purchases: 0, fines: 0, urgent: 0, courtesies: 0, hamacas: 0, beachRentals: 0, regVisits: 0, visits: [], usedNames: new Set(), repStart: 3.5 };
}

test('el panel de ligas usa barras por componentes, sin tabla que se corte', () => {
  const hist = [
    { day: 1, served: 10, lost: 2, rating: 4.2, revenue: 150, profit: 40, followers: 50 },
    { day: 2, served: 14, lost: 1, rating: 4.6, revenue: 200, profit: 60, followers: 80 },
  ];
  const p = {
    history: hist,
    kioskName: 'El Charco Azul',
    rivals: {
      tiers: [0, 1, 1],
      groups: { 0: [['player', 'r1', 'r2', 'r3'], [], []] },
      npcs: [
        { id: 'r1', name: 'La Ola', style: 'Chill', history: [], lastAction: null },
        { id: 'r2', name: 'El Faro', style: 'Retro', history: [], lastAction: null },
        { id: 'r3', name: 'Chio', style: 'Familiar', history: [], lastAction: null },
      ],
      previous: {},
    },
  };
  const html = leaguePanel(p, 0, 0, 2);
  assert.ok(html.includes('lg-wp-bar'), 'barras de puntos por jornada');
  assert.ok(!html.includes('<table'), 'sin tabla ancha que se corte en pantalla');
  for (const txt of ['Servicio · 40', 'Valoración · 25', 'Margen · 20', 'Comunidad · 15'])
    assert.ok(html.includes(txt), `falta la leyenda: ${txt}`);
  assert.ok(html.includes('Total semanal'), 'total semanal visible');
  assert.ok(html.includes('lg-wp-row'), 'una fila por jornada');
  // los cuatro segmentos de cada barra con su color de componente
  assert.equal((html.match(/lg-wp-bar/g) || []).length, 2, 'una barra por jornada de la semana');
  assert.ok(/class="svc"/.test(html) && /class="rat"/.test(html) && /class="mar"/.test(html) && /class="com"/.test(html), 'segmentos de servicio, valoración, margen y comunidad');
});

test('si no queda lo que pide, el cliente se marcha sin aceptar otro producto', () => {
  Game.mode = 'service';
  Game.floor = null;
  Game.floaters = [];
  Game.t = 10;
  Game.dayStats = freshStats();
  Game.stock = { papas: 0, cerveza: 5 };
  const c = { id: 1, state: 'queue', order: ['papas'], asked: ['papas'], itemSt: [0], subs: {}, patience: 50, maxPatience: 60, anger: 0, angerT: 0, spot: 0, x: 300, y: 600, served: [], regular: null };
  const slot = { who: 'p1', station: 'all', cust: null };
  const ok = startPart(c, slot);
  assert.equal(ok, true, 'startPart procesa la comanda');
  assert.equal(c.state, 'leave', 'el cliente se marcha');
  assert.deepEqual(c.order, ['papas'], 'no se sustituye lo que pidió');
  assert.equal(Game.dayStats.lostStock, 1, 'cuenta como perdido por falta de género');
  assert.equal(Game.dayStats.lost, 1, 'cuenta en el total de perdidos');
  const v = Game.dayStats.visits[0];
  assert.equal(v.lost, 'sinStock', 'la visita registra que no quedaba lo pedido');

  // control positivo: con género disponible sí se atiende
  Game.dayStats = freshStats();
  const c2 = { id: 2, state: 'queue', order: ['cerveza'], asked: ['cerveza'], itemSt: [0], subs: {}, patience: 50, maxPatience: 60, anger: 0, angerT: 0, spot: 0, x: 300, y: 600, served: [], regular: null };
  const ok2 = startPart(c2, { who: 'p1', station: 'all', cust: null });
  assert.equal(ok2, true, 'startPart atiende con género');
  assert.equal(c2.state, 'prep', 'el cliente pasa a preparación');
  assert.equal(Game.stock.cerveza, 4, 'se consume el género pedido');
  assert.equal(Game.dayStats.lost, 0, 'no cuenta como perdido');
});

test('los clientes en cola al cierre cuentan como perdidos', () => {
  Game.mode = 'service';
  Game.floor = null;
  Game.floaters = [];
  Game.t = 10;
  Game.hour = 20;
  Game.closing = true;
  Game.closeT = 0.2;
  Game.slots = [];
  Game.dayStats = freshStats();
  const sp = QUEUE_POS[0];
  const c = { id: 3, state: 'queue', order: [], asked: [], itemSt: [], served: [], subs: {}, patience: 50, maxPatience: 60, anger: 0, angerT: 0, protested: false, spot: 0, x: sp.x, y: sp.y, act: 'wait', actT: 0, menuDur: 9, waited: 0, personality: 'tranquilo', regular: null };
  Game.customers = [c];
  Net.role = 'solo'; Net.peer = null;
  update(0.1);
  assert.equal(c.state, 'leave', 'el cliente de la cola se marcha al cierre');
  assert.equal(Game.dayStats.lostClose, 1, 'cuenta como perdido al cierre');
  assert.equal(Game.dayStats.lost, 1, 'cuenta en el total de perdidos');
  const v = Game.dayStats.visits[0];
  assert.equal(v.lost, 'cierre', 'la visita registra que cerró esperando');
  Game.closing = false;
  Game.customers = [];
});

test('la caja del día incluye el género estropeado al cierre', () => {
  Game.mode = 'report';
  Game.day = 4;
  Game.rep = 3.5;
  Game.money = 200;
  Game.buzz = 0;
  const s = { ...freshStats(), served: 12, lost: 2, revenue: 180, tips: 4, tipsP: 1, combos: 1, purchases: 60, sold: { cerveza: 12 } };
  s.visits = [{ type: 'local', sat: 0.9, order: ['cerveza'], asked: ['cerveza'], missing: 0, substituted: false, queueSec: 30, waitFrac: 0.2, priceF: 0, tipAmt: 0, total: 3, regular: null, regVisits: 0, name: null, look: null, hour: 16, peak: false, dirtySeen: 0, lost: null, table: true, upset: false }];
  const m = buildRevModel(s, dayStarsSummary(s));
  m.acc = { wage: 60, rent: 20, spoilVal: 12, spoilLines: ['2 × papas'], soldStr: '<span class="tag">12 cervezas</span>', repStart: 3.5 };
  const html = reportStatsHtml(s, m);
  assert.ok(html.includes('Género estropeado al cierre'), 'línea de pérdida por género estropeado');
  assert.ok(html.includes('Se ha estropeado'), 'detalle de lo estropeado');
  assert.ok(/Género estropeado al cierre<\/span><span class="neg">−/.test(html), 'aparece como gasto en la caja del día');
});

test('el desglose de clientes perdidos incluye a los que cerraron esperando', () => {
  Game.mode = 'report';
  Game.day = 4;
  Game.rep = 3.5;
  Game.money = 200;
  Game.buzz = 0;
  const s = { ...freshStats(), served: 10, lost: 4, lostPrice: 1, lostQueue: 1, lostPatience: 0, lostStock: 1, lostClose: 1 };
  s.visits = [];
  const m = buildRevModel(s, dayStarsSummary(s));
  m.acc = { wage: 60, rent: 20, spoilVal: 0, spoilLines: [], soldStr: '', repStart: 3.5 };
  const html = reportStatsHtml(s, m);
  assert.ok(html.includes('Clientes perdidos'), 'nota de clientes perdidos');
  assert.ok(html.includes('1 por cerrar con ellos esperando'), 'cuenta los perdidos al cierre');
  assert.ok(html.includes('1 porque no quedaba lo que pedían'), 'cuenta los perdidos por falta de género');
  assert.ok(html.includes('1 por precios altos'), 'cuenta los perdidos por precios');
  assert.ok(html.includes('1 por cola llena'), 'cuenta los perdidos por cola llena');
});
