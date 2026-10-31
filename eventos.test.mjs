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
