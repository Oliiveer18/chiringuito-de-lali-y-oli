/* Pruebas de regresión v28.18: personal activo, mesas, cierre de jornada y
   transición cooperativa de "siguiente día".
   Cubre:
   1. Carmela (cocinera) prepara comida de verdad: hueco de cocina y auto-atención.
   2. Yeray (camarero) atiende en cooperativo.
   3. El limpiador espera entre las mesas (cerca, no en la puerta).
   4. Un cliente que pide mesa espera hasta 12 s (antes 7 s) y se sienta si se
      libera una mesa a tiempo; ya no se va diciendo que no hay.
   5. Al cerrar, las tareas de sala van al doble de velocidad: la jornada termina
      cuando acaban los procesos, sin abortar escenas ni eternizarse.
   6. "Listo" del informe es idempotente y con reintento: doble aviso o mensajes
      repetidos ya no dejan a la pareja esperando.
   Uso: node staff-flow.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Stub mínimo de DOM para cargar los módulos reales sin navegador.
globalThis.window = globalThis;
globalThis.setInterval = fn => 1;
const canvas = () => ({ width: 1280, height: 720, getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }), toDataURL: () => 'data:x', addEventListener() {}, style: {}, classList: { add() {}, remove() {}, toggle() {} } });
const el = () => ({ dataset: {}, style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {} }, append() {}, appendChild() {}, remove() {}, querySelector: () => null, setAttribute() {}, addEventListener() {}, innerHTML: '', textContent: '', childElementCount: 0, children: [], getClientRects: () => [], getBoundingClientRect: () => ({ height: 0, top: 0, left: 0, width: 0 }) });
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

const V = '28.18.0';
const { Game, Net } = await import(`./state.js?v=${V}`);
await import(`./coopbridge.js?v=${V}`);
const sim = await import(`./sim.js?v=${V}`);
const cfg = await import(`./config.js?v=${V}`);
const { buildTables } = await import(`./world.js?v=${V}`);
const { navFreeAt } = await import(`./nav.js?v=${V}`);
const { applyAct } = await import(`./net.js?v=${V}`);
const { readyOn } = await import(`./ui.js?v=${V}`);

async function setupCoopDay(staff = { limpiador: 1, camarero: 1, cocinero: 1, terraza: 1 }) {
  Net.role = 'host'; Net.peer = true; Net.names = { p1: 'A', p2: 'B' }; Net.roles = { p1: 'barra', p2: 'cocina' };
  Game.upgrades = { mesas: 3, workforce: { team: {} } };
  Game.staff = staff;
  for (const id of cfg.ITEM_IDS) { Game.stock[id] = 50; Game.prices[id] = cfg.ITEMS[id].ref; Game.enabled[id] = true; }
  buildTables(); Game.forecast = Array.from({ length: 40 }, () => 'sol');
  Game.speed = 1;
  sim.startDay();
}

function spawnWalkIn(order) {
  const c = {
    id: 900 + Math.floor(Math.random() * 1000), type: 'local', x: 1200, y: 690, state: 'queue',
    act: 'menu', actT: 0, spot: 0, order, itemSt: order.map(() => 0), served: [], missing: 0, inPrep: 0,
    partT: {}, menuDur: 1, asked: order.slice(), patience: 100, maxPatience: 100, tQueue: 0,
    personality: 'tranquilo', mood: null, moodT: 0, moodTxt: null, tx: 0, ty: 0, table: null, eatT: 0,
    waited: 0, tag: null, anger: 0, angerT: 0, graceT: null, subs: {}, walkPhase: 0, stridePh: 0,
    bob: 0, speed: 100, shirt: '#333', skin: '#c58a5c', hat: null, floorTableId: null, floorPaid: false,
  };
  Game.customers.push(c);
  return c;
}

// ---------- 1. Carmela prepara comida de verdad ----------

test('carmela tiene hueco de cocina y atiende comandas de comida', async () => {
  await setupCoopDay({ cocinero: 1 }); // sin camarero: la cocinera es el único auto-ayuda
  const slot = Game.slots.find(s => s.who === 'carmela');
  assert.ok(slot, 'la cocinera contratada debe tener hueco de preparación');
  assert.equal(slot.station, 'cocina', 'su hueco es de cocina');
  // Cliente con comida pendiente: la cocinera debe empezar a preparársela.
  const c = spawnWalkIn(['papas', 'papas']);
  let prepared = false;
  for (let i = 0; i < 40; i++) { sim.update(0.05); if (slot.cust === c) { prepared = true; break; } }
  assert.ok(prepared, 'carmela toma la comanda de comida');
  assert.equal(c.inPrep > 0, true, 'la comanda entra en preparación');
});

test('carmela ignora comandas de solo bebida (eso es de barra)', async () => {
  await setupCoopDay();
  const slot = Game.slots.find(s => s.who === 'carmela');
  const c = spawnWalkIn(['cerveza']);
  for (let i = 0; i < 40; i++) sim.update(0.05);
  assert.notEqual(slot.cust, c, 'la cocinera no atiende solo bebidas');
});

// ---------- 2. Yeray atiende en cooperativo ----------

test('yeray tiene hueco y atiende en cooperativo', async () => {
  await setupCoopDay({ camarero: 1 }); // sin cocinera: el camarero es el único auto-ayuda
  const slot = Game.slots.find(s => s.who === 'yeray');
  assert.ok(slot, 'el camarero contratado debe tener hueco en cooperativo');
  const c = spawnWalkIn(['cerveza']);
  let prepared = false;
  for (let i = 0; i < 40; i++) { sim.update(0.05); if (slot.cust === c) { prepared = true; break; } }
  assert.ok(prepared, 'yeray atiende la comanda');
});

// ---------- 3. El limpiador espera entre las mesas ----------

test('el limpiador espera entre las mesas, en celda libre', async () => {
  await setupCoopDay();
  const acaymo = Game.floor.actors.find(a => a.id === 'acaymo');
  assert.ok(acaymo, 'limpiador contratado');
  assert.equal(acaymo.home.y, 578, 'su puesto está en el pasillo entre las filas de mesas');
  assert.ok(Math.abs(acaymo.home.x - 880) < 1, 'centrado en la zona de mesas');
  assert.ok(navFreeAt(acaymo.home.x, acaymo.home.y), 'su celda es transitable (no se atasca)');
});

// ---------- 4. Cliente que pide mesa: espera hasta 12 s ----------

test('un cliente con mesa liberada a los 9 s consigue sentarse', async () => {
  await setupCoopDay();
  assert.equal(cfg.WAIT_TABLE_MAX, 12, 'la paciencia de mesa es 12 s');
  // Las tres mesas ocupadas o sucias: el cliente pide mesa y espera.
  for (const t of Game.tables) t.state = 'busy';
  const c = spawnWalkIn(['cerveza']);
  c.totalDue = 3; c.sat = 0.8;
  c.state = 'waitTable'; c.waitT = 0;
  // A los 9 s (antes imposible: el límite era 7 s) una mesa queda libre.
  for (let i = 0; i < 180; i++) {
    sim.update(0.05);
    if (i === 179) break;
    if (Math.abs(c.waitT - 9) < 0.1) { Game.tables[1].state = 'free'; }
  }
  assert.ok(['toTable', 'eat'].includes(c.state), 'el cliente se sienta (antes se iba a las 7 s)');
});

// ---------- 5. Cierre: las tareas de sala aceleran y la jornada no aborta ----------

test('al cerrar, las tareas de sala van al doble de velocidad', async () => {
  await setupCoopDay();
  Game.hour = 19.99;
  for (let i = 0; i < 10; i++) sim.update(0.05); // dispara el cierre
  assert.ok(Game.closing, 'el día está cerrando');
  // El reloj interno de la sala (stepTasks) debe avanzar al doble que el real:
  // 0.5 s de juego tienen que consumir ~1 s de trabajo de sala.
  const t0 = Game.floor.time;
  for (let i = 0; i < 10; i++) sim.update(0.05);
  const elapsed = Game.floor.time - t0;
  assert.ok(elapsed > 0.9, `el tiempo de sala avanza al doble al cerrar (avanzó ${elapsed.toFixed(2)} s de 0.5 reales)`);
});

test('la jornada no termina con tareas de sala a medias (sin escenas omitidas)', async () => {
  await setupCoopDay();
  Game.tables[0].state = 'dirty'; Game.tables[0].dirtyT = 1;
  Game.hour = 19.99;
  let endedWhileCleaning = false, sawCleanFinish = false;
  for (let i = 0; i < 3000; i++) {
    sim.update(0.05);
    const cleaning = Game.floor && Game.floor.tasks.some(t => t.kind === 'clean' && ['queued', 'walking', 'working', 'blocked'].includes(t.state));
    if (Game.mode === 'report') { if (cleaning) endedWhileCleaning = true; break; }
    if (!cleaning && Game.floor) sawCleanFinish = true;
    if (Game.mode !== 'service') break;
  }
  assert.equal(endedWhileCleaning, false, 'el informe llega sin cortar limpiezas a medias');
  assert.equal(Game.mode, 'report', 'la jornada acaba en el informe');
  assert.equal(Game.tables[0].state, 'free', 'la mesa acaba limpia');
});

// ---------- 6. "Listo" idempotente con reintento ----------

test('el aviso de listo del invitado es idempotente', async () => {
  await setupCoopDay();
  Game.mode = 'report';
  Net.ready = { p1: false, p2: false };
  // El invitado pulsa dos veces (o el reintento repite el aviso).
  applyAct({ a: 'ready' });
  applyAct({ a: 'ready' });
  assert.equal(Net.ready.p2, true, 'p2 queda listo (el doble aviso no lo desmarca)');
  // El anfitrión se pone listo: avanzan al menú de preparación.
  readyOn('p1');
  assert.equal(Game.mode, 'plan', 'ambos listos: pasan al menú de preparación');
  assert.equal(Game.day, 2, 'el contador de día avanza');
});

test('el reintento del invitado no rompe el estado si llega repetido', async () => {
  await setupCoopDay();
  Game.mode = 'report';
  Net.ready = { p1: false, p2: false };
  for (let i = 0; i < 5; i++) applyAct({ a: 'ready' }); // 5 reintentos de red
  assert.equal(Net.ready.p2, true, 'sigue listo tras varios reintentos');
  assert.equal(Game.mode, 'report', 'sin el anfitrión no avanza solo');
});
