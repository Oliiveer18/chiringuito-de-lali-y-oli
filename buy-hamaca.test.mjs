/* Pruebas de regresión v29.4.2: comprar hamacas en el plan.
   El bug: applyPlanAction (ui-plan.js) usaba `toast` sin importarla de ui.js.
   Al comprar una mejora (p. ej. Hamacas) saltaba "Uncaught ReferenceError:
   toast is not defined": la compra se aplicaba a medias (dinero descontado,
   mejora instalada) y la excepción rompía el refresco de la pestaña y la
   sincronización cooperativa — el plan quedaba congelado.
   Además se verifica que, tras comprar las hamacas, la pestaña de compras
   muestra la sección Playa con el precio por hora.
   Uso: node buy-hamaca.test.mjs */
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
const { Game, Net } = await import(`./state.js?v=${v}`);
const cfg = await import(`./config.js?v=${v}`);
const ui = await import(`./ui.js?v=${v}`);
const uiPlan = await import(`./ui-plan.js?v=${v}`);

Game.money = 20000; Game.rep = 3.6; Game.hour = 10; Game.day = 3;
Game.upgrades = { escenario: 1, algodonera: 1, terraza: 1, refrescos: 1, coctelera: 1, plancha: 1, cocina: 1, mesas: 2, sombrillas: 1, redes: 1, altavoz: 1, luces: 1, workforce: { team: {} } };
for (const id of cfg.ITEM_IDS) { Game.stock[id] = 25; Game.prices[id] = cfg.ITEMS[id].ref; Game.enabled[id] = true; }
Game.prices.hamacas = 3;
Game.forecast = Array.from({ length: 40 }, (_, i) => ['sol', 'panza', 'calima', 'viento'][i % 4]);
Game.regulars = {}; for (const r of cfg.REGULARS) Game.regulars[r.id] = { loyalty: 2, visits: 3, next: 0 };
Net.role = 'solo';

test('comprar la mejora Hamacas no revienta (toast importada) y aplica la mejora completa', () => {
  const u = cfg.UPGRADES.find(x => x.id === 'hamacas');
  const before = Game.upgrades.hamacas || 0;
  const cost = u.levels[before];
  Game.money = 20000;
  Game.mode = 'plan';
  uiPlan.Plan.tab = 'compras';
  // antes de v29.4.2: Uncaught ReferenceError: toast is not defined (ui-plan.js)
  assert.doesNotThrow(() => uiPlan.applyPlanAction('p1', { up: 'hamacas' }));
  assert.equal((Game.upgrades.hamacas || 0), before + 1, 'la mejora debe quedar instalada');
  assert.equal(Game.money, 20000 - cost, 'el dinero se descuenta exactamente el coste');
});

test('tras comprarlas, la pestaña de compras muestra la sección Playa con el precio por hora', () => {
  Game.mode = 'plan';
  uiPlan.Plan.tab = 'compras';
  ui.renderTab();
  const body = bySel['#tab-body'] || byId['tab-body'];
  assert.ok(body && typeof body.innerHTML === 'string' && body.innerHTML.includes('Playa'),
    'la sección Playa debe verse tras comprar hamacas');
  assert.ok(body.innerHTML.includes('data-hprice'), 'el control de precio por hora debe estar en la pestaña');
  assert.ok(body.innerHTML.includes('€/h'), 'el precio se muestra en €/h');
});

test('subir el precio por hora de las hamacas desde el plan funciona', () => {
  Game.mode = 'plan';
  const before = Game.prices.hamacas;
  assert.doesNotThrow(() => uiPlan.applyPlanAction('p1', { hprice: 1, d: 0.5 }));
  assert.ok(Math.abs(Game.prices.hamacas - (before + 0.5)) < 1e-9, 'precio por hora actualizado');
});
