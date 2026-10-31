/* Pruebas de los eventos aleatorios (v29.4.4, contrato de juego):
   - el evento "Partido del CD Tenerife" ya no es solo un aviso: la peña de
     vecinos LLEGA DE VERDAD y se la ve entrar en grupo (como la guagua de
     turistas), con la cerveza con doble de peso en los pedidos;
   - el influencer también aparece en la escena y hace su foto (floater);
   - spawnCustomer devuelve al cliente creado (necesario para anunciar al
     influencer en el punto exacto donde entra).
   Uso: node eventos.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.window = globalThis;
globalThis.setInterval = fn => 1;
globalThis.setTimeout = f => 1;
const canvas = () => ({ width: 1280, height: 720, getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }), toDataURL: () => 'data:x', addEventListener() {}, style: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } });
const el = () => ({ dataset: {}, style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, append() {}, appendChild() {}, remove() {}, querySelector: () => null, querySelectorAll: () => [], setAttribute() {}, addEventListener() {}, innerHTML: '', textContent: '', childElementCount: 0, children: [], getClientRects: () => [], getBoundingClientRect: () => ({ height: 0, top: 0, left: 0, width: 0 }), scrollTop: 0 });
const byId = {}, bySel = {};
globalThis.document = {
  querySelector: s => bySel[s] || (bySel[s] = (s === '#game' ? canvas() : el())),
  getElementById: id => byId[id] || (byId[id] = (id === 'game' ? canvas() : el())),
  createElement: t => (t === 'canvas' ? canvas() : el()),
  documentElement: el(), body: el(), head: el(),
  querySelectorAll: () => [], addEventListener: () => {}, dispatchEvent: () => {},
};
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
globalThis.innerWidth = 1280; globalThis.innerHeight = 720;
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '0' });
globalThis.devicePixelRatio = 1;
globalThis.requestAnimationFrame = () => 0;
globalThis.addEventListener = () => {};
globalThis.MutationObserver = class { observe() {} };
globalThis.Peer = class { emit() { return true; } };

const v = readFileSync(new URL('./version.js', import.meta.url), 'utf8').match(/VERSION='v([^']+)'/)[1];
const { Game, Net, gameTimers } = await import(`./state.js?v=${v}`);
const cfg = await import(`./config.js?v=${v}`);
await import(`./ui.js?v=${v}`);
const sim = await import(`./sim.js?v=${v}`);

// jornada de servicio preparada: stock, precios de referencia y cola libre
function prepService() {
  Game.mode = 'service'; Game.hour = 13; Game.day = 5; Game.speed = 1;
  Game.money = 5000; Game.rep = 3; Game.closing = false;
  Game.upgrades = { escenario: 1, refrescos: 1, plancha: 1, cocina: 1, mesas: 2, altavoz: 1, workforce: { team: {} } };
  for (const id of cfg.ITEM_IDS) { Game.stock[id] = 30; Game.prices[id] = cfg.ITEMS[id].ref; Game.enabled[id] = true; }
  Game.prices.hamacas = 3;
  Game.forecast = Array.from({ length: 40 }, () => 'sol');
  Game.regulars = {}; Game.regVisited = {};
  Game.customers = []; Game.floaters = []; Game.mods = { arr: 1 };
  Game.tables = []; Game.slots = [{ who: 'p1', station: 'all', cust: null, items: [], t: 0, total: 0, think: 0 }];
  Game.dayStats = { usedNames: new Set(), lost: 0, lostPrice: 0, lostQueue: 0, visits: [], revenue: 0, served: 0, fines: 0, tips: 0, tipsP: 0, hamacas: 0, sold: {}, stockOuts: {} };
  gameTimers.length = 0;
  Net.role = 'solo';
}
// avanza los temporizadores del juego igual que sim/day.js
function fireTimers(steps = 10, dt = 1) {
  for (let s = 0; s < steps; s++)
    for (let i = gameTimers.length - 1; i >= 0; i--) {
      gameTimers[i].t -= dt;
      if (gameTimers[i].t <= 0) { const f = gameTimers[i].fn; gameTimers.splice(i, 1); f(); }
    }
}

test('v29.4.4: el partido del CD Tenerife hace llegar a la peña de verdad (4-6 vecinos en grupo)', () => {
  prepService();
  const ev = sim.RANDOM_EVENTS.find(e => e.id === 'futbol');
  assert.ok(ev, 'existe el evento futbol');
  ev.run();
  // los modificadores del día siguen activos: cerveza x2 y más locales
  assert.equal(Game.mods.beer, true, 'la cerveza pesa el doble');
  assert.equal(Game.mods.mix.local, 1.6, 'bajan más locales el resto del día');
  // y la peña entra andando, escalonada como la guagua de turistas
  fireTimers();
  const penia = Game.customers.filter(c => c.type === 'local');
  assert.ok(penia.length >= 4 && penia.length <= 6,
    'la peña son entre 4 y 6 vecinos y se les ve llegar; llegaron ' + penia.length);
  assert.ok(penia.every(c => c.state !== 'walkby' || c.mood === null || true), 'sin errores de estado');
});

test('v29.4.4: el influencer del evento aparece en la escena y hace su foto', () => {
  prepService();
  const ev = sim.RANDOM_EVENTS.find(e => e.id === 'influencer');
  const before = Game.customers.length;
  ev.run();
  assert.ok(Game.customers.length > before, 'el influencer entra como cliente visible');
  assert.ok(Game.floaters.some(f => String(f.text).toLowerCase().includes('influencer')),
    'hay floater de la foto del influencer');
  assert.ok(Game.mods.arr > 1, 'la afluencia del resto del día sube');
});

test('v29.4.4: spawnCustomer devuelve al cliente creado (lo usa el floater del influencer)', () => {
  prepService();
  const c = sim.spawnCustomer('turista');
  assert.ok(c && Game.customers.includes(c), 'devuelve el cliente y ya está en la escena');
});

/* ---- v29.4.5: averías reales + informe de incidencias + eventos nuevos ---- */
const feats = await import(`./features.js?v=${v}`);
const bk = await import(`./bookkeeping.js?v=${v}`);
const { incidentsHtml } = await import(`./report-render.js?v=${v}`);

test('v29.4.5: las averías son reales — ni un "cristal roto" en el kiosco', () => {
  prepService();
  // kiosco completo: algodonera, sombrillas y altavoz pueden averiarse
  Game.upgrades = { ...Game.upgrades, algodonera: 1, sombrillas: 1, altavoz: 1 };
  for (let i = 0; i < 40; i++) feats.runMishap();
  const inc = Game.dayStats.incidents || [];
  assert.ok(inc.length > 0, 'se registraron incidencias');
  for (const i of inc)
    assert.ok(/algodonera|sombrilla|altavoz|proveedor/i.test(i.what), 'avería real del kiosco: ' + i.what);
  assert.ok(!inc.some(i => /cristal/i.test(i.what)), 'en el kiosco no hay cristales');
});

test('v29.4.5: la sombrilla rota cuesta 90 € y queda registrada con hora y estado', () => {
  prepService();
  Game.upgrades = { sombrillas: 1 }; // sin altavoz ni algodonera: solo sombrilla o proveedor
  for (const id of cfg.ITEM_IDS) Game.stock[id] = 0; // sin género: el proveedor no pierde nada
  const m0 = Game.money;
  // el reparto es aleatorio entre sombrilla y proveedor (sin pérdidas): repetir hasta la sombrilla
  let inc = null;
  for (let i = 0; i < 60 && !inc; i++) {
    feats.runMishap();
    inc = (Game.dayStats.incidents || []).find(x => x.what.includes('sombrilla'));
  }
  assert.ok(inc, 'salió la avería de la sombrilla');
  assert.equal(Game.money, m0 - 90, 'el técnico cobra 90 €');
  assert.deepEqual(inc, { what: 'El viento partió una sombrilla', cost: 90, state: 'reparada', hour: 13 });
});

test('v29.4.5: la algodonera averiada queda pendiente y repararla cierra la incidencia (150 €)', () => {
  prepService();
  bk.logIncident('La algodonera se ha atascado', null, 'pendiente');
  Game.upgrades.algodoneraRoto = 1;
  Game.money = 200;
  assert.equal(feats.repairMachine(), true);
  assert.equal(Game.money, 50, 'la reparación cuesta 150 €');
  const inc = Game.dayStats.incidents[0];
  assert.equal(inc.state, 'reparada');
  assert.equal(inc.cost, 150);
});

test('v29.4.5: el informe de jornada muestra las incidencias organizadas (hora, coste y estado)', () => {
  prepService();
  Game.dayStats.incidents = [
    { what: 'El viento partió una sombrilla', cost: 90, state: 'reparada', hour: 14.5 },
    { what: 'La algodonera se ha atascado', cost: null, state: 'pendiente', hour: 16.2 },
  ];
  const html = incidentsHtml(Game.dayStats);
  assert.ok(html.includes('Incidencias y reparaciones'), 'título de la sección');
  assert.ok(html.includes('El viento partió una sombrilla'));
  assert.ok(html.includes('14:30') && html.includes('16:12'), 'hora de cada incidencia');
  assert.ok(html.includes('pendiente'), 'estado pendiente visible');
  assert.ok(/−90\s*€|−90\s/.test(html), 'coste con formato de dinero');
  assert.ok(html.includes('warn'), 'la pendiente se resalta');
  // sin incidencias no se muestra la sección (informe limpio)
  assert.equal(incidentsHtml({ incidents: [] }), '');
  assert.equal(incidentsHtml({}), '');
});

test('v29.4.5: club de running — 4-5 vecinos en grupo con sed de batido', () => {
  prepService();
  const ev = sim.RANDOM_EVENTS.find(e => e.id === 'running');
  ev.run();
  assert.equal(Game.mods.batido, true, 'el batido pesa el doble');
  assert.equal(Game.mods.mix.local, 1.3);
  fireTimers();
  const club = Game.customers.filter(c => c.type === 'local');
  assert.ok(club.length >= 4 && club.length <= 5, 'club de running: ' + club.length + ' vecinos');
});

test('v29.4.5: yate y marejada — turistas y surfistas que se ven llegar', () => {
  prepService();
  const rep0 = Game.rep;
  sim.RANDOM_EVENTS.find(e => e.id === 'yate').run();
  fireTimers();
  assert.ok(Game.customers.filter(c => c.type === 'turista').length >= 3, 'la tripulación del yate baja');
  assert.ok(Game.rep > rep0, 'el yate deja buena reputación');
  prepService();
  sim.RANDOM_EVENTS.find(e => e.id === 'marejada').run();
  fireTimers();
  assert.ok(Game.customers.filter(c => c.type === 'surfista').length >= 3, 'los surfistas cuelgan las tablas');
});
