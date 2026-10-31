/* Pruebas de regresión v29.3: cierre de jornada y clientes sin atascos.
   Cubre:
   1. Dos clientes que se cruzan de frente en la calle entre mesas acaban
      llegando a su destino (vigilancia anti-atasco de navStep).
   2. Ningún cliente caminando acaba dentro de la huella bloqueada de una mesa
      (deslizamiento).
   3. A la hora de cierre la jornada termina: clientes comiendo o de camino a
      mesa se van y el informe sale en <= 10,5 s aunque nadie se mueva.
   4. Los sueldos se pagan solo por el tiempo trabajado (workedWages).
   5. El precio por hora de las hamacas arranca en 3 €/h (referencia).
   Uso: node closing-anti-stuck.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// ---------- Stub mínimo de DOM para cargar los módulos reales sin navegador ----------
globalThis.window = globalThis;
globalThis.setInterval = fn => 1;
const canvas = () => ({ width: 1280, height: 720, getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }), toDataURL: () => 'data:x', addEventListener() {}, style: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } });
const el = () => ({ dataset: {}, style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, append() {}, appendChild() {}, remove() {}, querySelector: () => null, setAttribute() {}, addEventListener() {}, innerHTML: '', textContent: '', childElementCount: 0, children: [], getClientRects: () => [], getBoundingClientRect: () => ({ height: 0, top: 0, left: 0, width: 0 }) });
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
if (!globalThis.crypto?.randomUUID) { Object.defineProperty(globalThis, 'crypto', { value: { randomUUID: () => 'x' }, configurable: true }); }

const V = (await import('node:fs')).readFileSync(new URL('./version.js', import.meta.url), 'utf8').match(/VERSION='(v[0-9.]+)'/)[1].replace('v', '');
const { Game, Net, workedWages } = await import(`./state.js?v=${V}`);
await import(`./coopbridge.js?v=${V}`);
const sim = await import(`./sim.js?v=${V}`);
const cfg = await import(`./config.js?v=${V}`);
const { buildTables } = await import(`./world.js?v=${V}`);
const { navSetTarget, navStep, navFreeAt } = await import(`./nav.js?v=${V}`);
const { createBeach, stepBeach, REF_PRICE } = await import('./beach-model.mjs?v=' + V);

async function setupSoloDay() {
  Net.role = 'solo'; Net.peer = null; Net.names = { p1: 'A', p2: 'B' }; Net.roles = { p1: 'barra', p2: 'cocina' };
  Game.upgrades = { mesas: 3, workforce: { team: {} } };
  Game.staff = {};
  for (const id of cfg.ITEM_IDS) { Game.stock[id] = 50; Game.prices[id] = cfg.ITEMS[id].ref; Game.enabled[id] = true; }
  buildTables();
  Game.forecast = Array.from({ length: 40 }, () => 'sol');
  Game.speed = 1;
  sim.startDay();
}

// ---------- 1. Cruce de frente entre mesas: nadie se queda trabado ----------
test('dos clientes que se cruzan de frente entre las mesas llegan a su destino', async () => {
  await setupSoloDay();
  // calle entre las dos filas de mesas: fila 1 bloquea 498-548, fila 2 610-660
  const mk = (x, tx) => ({ id: 1, x, y: 590, tx, ty: 590, speed: 110, dir: 1, look: { walk: {} }, stridePh: 0 });
  const a = mk(640, 1100), b = mk(1100, 640);
  Game.customers = [a, b];
  navSetTarget(a, 1100, 590); navSetTarget(b, 640, 590);
  let doneA = false, doneB = false, steps = 0;
  for (; steps < 2400; steps++) { // 120 s simulados: margen de sobra
    if (!doneA) doneA = navStep(a, 0.05, 1);
    if (!doneB) doneB = navStep(b, 0.05, 1);
    if (doneA && doneB) break;
  }
  assert.ok(doneA && doneB, `ambos llegan (pasos: ${steps})`);
  assert.ok(steps < 2400, 'sin bucle eterno');
});

// ---------- 2. Deslizamiento: nunca dentro de la huella bloqueada ----------
test('un cliente caminando entre mesas nunca acaba dentro de una celda bloqueada', async () => {
  await setupSoloDay();
  const c = { id: 2, x: 700, y: 590, tx: 0, ty: 0, speed: 110, dir: 1, look: { walk: {} }, stridePh: 0 };
  Game.customers = [c];
  navSetTarget(c, 1250, 590); // cruza la terraza de lado a lado
  let done = false, guard = 0;
  for (; guard < 2400 && !done; guard++) {
    done = navStep(c, 0.05, 1);
    assert.ok(navFreeAt(c.x, c.y), `celda libre en (${c.x.toFixed(0)},${c.y.toFixed(0)})`);
  }
  assert.ok(done, 'llega a su destino');
});

// ---------- 3. Cierre: la jornada acaba aunque nadie se mueva ----------
test('al cierre, comensales lentos y clientes de camino se van y el informe sale en <= 10,5 s', async () => {
  await setupSoloDay();
  // comensal que se queda comiendo para siempre (eatT gigante a velocidad 4x)
  const t0 = Game.tables[0];
  const slow = { id: 10, x: t0.x, y: t0.y + 8, tx: t0.x, ty: t0.y + 8, speed: 110, dir: 1, look: { walk: {} }, state: 'eat', table: t0, eatT: 9999, actT: 0, served: ['papas'], patience: 99, maxPatience: 99, spot: -1, sat: 0.8, itemSt: [], order: ['papas'], mood: null, moodT: 0, floorTableId: null };
  // cliente eterno camino de la mesa (velocidad de tortuga)
  const t1 = Game.tables[1];
  const walker = { id: 11, x: t1.x - 100, y: t1.y + 40, tx: t1.x + 38, ty: t1.y + 8, speed: 2, dir: 1, look: { walk: {} }, state: 'toTable', table: t1, actT: 0, patience: 99, maxPatience: 99, spot: -1, sat: 0.7, itemSt: [], order: ['cerveza'], served: ['cerveza'], mood: null, moodT: 0, floorTableId: null };
  t0.state = 'busy'; t0.cust = slow;
  t1.state = 'busy'; t1.cust = walker;
  Game.customers = [slow, walker];
  Game.hour = cfg.SEC_PER_HOUR ? 20 : 20; // hora de cierre sin luces
  let closed = false, secs = 0;
  for (let i = 0; i < 400; i++) {
    sim.update(0.05); secs = Game.closeT;
    if (Game.mode === 'report') { closed = true; break; }
  }
  assert.ok(closed, 'el informe del día aparece');
  assert.ok(Game.closeT <= 10.5, `cierra pronto (closeT=${Game.closeT.toFixed(2)} s)`);
  // el comensal despachado deja la mesa sucia (v29.2: siempre sucia tras comer)
  assert.ok(t0.state === 'dirty', 'la mesa del comensal queda sucia');
});

// ---------- 4. Sueldos solo por tiempo trabajado ----------
test('workedWages: media jornada de camarero cuesta media jornada de sueldo', async () => {
  Net.role = 'solo';
  Game.upgrades = { workforce: { team: {} } };
  Game.staff = { camarero: 1 };
  const full = (20 - 10) * cfg.SEC_PER_HOUR; // 160 s de jornada abierta
  Game.dayStats = { staffWork: { camarero: full / 2 } };
  const half = workedWages(Game.dayStats);
  const fullW = workedWages({ staffWork: { camarero: full } });
  const st = cfg.STAFF.find(s => s.id === 'camarero');
  assert.ok(Math.abs(fullW - st.wage) < 0.01, `jornada completa = sueldo íntegro (${fullW})`);
  assert.ok(Math.abs(half - st.wage / 2) < 0.51, `media jornada ≈ medio sueldo (${half})`);
  assert.ok(workedWages({ staffWork: { camarero: 0 } }) < 0.01, 'sin trabajo no hay sueldo');
});

// ---------- 5. Precio por hora de las hamacas ----------
test('hamacas: precio por defecto 3 €/h y el alquiler cobra precio × horas', async () => {
  Net.role = 'solo';
  Game.upgrades = {}; Game.staff = {}; Game.stock = {}; Game.prices = {}; Game.enabled = {};
  sim.newSeason();
  assert.equal(Game.prices.hamacas, 3, 'precio por defecto 3 €/h');
  // el modelo cobra exactamente precio × horas contratadas
  let b = createBeach(4, 10), saw = 0;
  for (let h = 10; h < 19.9; h += 0.05) {
    const out = stepBeach(b, h, false, 'sol', 20, Game.prices.hamacas);
    b = out.state;
    for (const e of out.events) {
      saw++;
      assert.ok(Math.abs(e.amount - Math.round(Game.prices.hamacas * e.hours * 10) / 10) < 0.001, 'ingreso = precio × horas');
    }
  }
  assert.ok(saw > 0, 'con el precio de referencia hay alquileres');
  assert.equal(REF_PRICE, 3, 'referencia 3 €/h');
});
