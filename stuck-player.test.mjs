/* Pruebas de regresión v28.17: el jugador bloqueado entre las mesas al limpiar.
   Bug original (v28.16.0): al pedir limpiar varias mesas, el personaje podía quedar
   parado en la columna de la puerta (x≈550), que cae dentro del rectángulo de
   navegación bloqueado de la primera mesa. Desde una celda bloqueada route()
   devolvía null para siempre ("no-route"), así que la tarea de limpieza quedaba en
   cola eternamente: el jugador no se movía y la pareja no podía tomar la mesa.
   Además, la exclusividad del solicitante impedía cualquier relevo.
   Uso: node stuck-player.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createService, requestTask, assignTasks, stepTasks } from './service-tasks.mjs';

// ---------- 1. Relevo de tareas de limpieza (service-tasks) ----------

// Dentro de la gracia, la mesa pertenece a quien la pidió (comportamiento original).
test('relevo: dentro de la gracia la tarea sigue siendo del solicitante', () => {
  const s = createService('t', [
    { id: 'p1', player: true, x: 0, y: 0, speed: 100, can: ['clean'] },
    { id: 'p2', player: true, x: 0, y: 0, speed: 100, can: ['clean'] },
  ], [{ id: 'table0', state: 'dirty' }]);
  const input = { kind: 'clean', target: 'table0', legs: [{ x: 1, y: 1, duration: 1 }] };
  const id = requestTask(s, { ...input, requestedBy: 'p1' });
  assert.ok(id, 'la tarea debe registrarse');
  assert.equal(requestTask(s, { ...input, requestedBy: 'p2' }), null, 'sin gracia vencida no hay relevo');
  assert.equal(requestTask(s, { ...input, requestedBy: 'p1' }), id, 'clic idempotente del solicitante');
});

// Tras la gracia, la pareja puede tomar el relevo de una tarea parada.
test('relevo: tras la gracia la pareja puede tomar la mesa atascada', () => {
  const s = createService('t', [
    { id: 'p1', player: true, x: 0, y: 0, speed: 100, can: ['clean'] },
    { id: 'p2', player: true, x: 0, y: 0, speed: 100, can: ['clean'] },
  ], [{ id: 'table0', state: 'dirty' }]);
  const input = { kind: 'clean', target: 'table0', legs: [{ x: 1, y: 1, duration: 1 }] };
  const id = requestTask(s, { ...input, requestedBy: 'p1' });
  s.time += 6; // gracia vencida
  const taken = requestTask(s, { ...input, requestedBy: 'p2' });
  assert.equal(taken, id, 'la misma tarea, ahora para p2');
  assert.equal(s.tasks.find(t => t.id === id).requestedBy, 'p2');
  assignTasks(s, (a, p) => [p]);
  assert.equal(s.tasks.find(t => t.id === id).actor, 'p2', 'p2 la ejecuta');
});

// Una tarea ya en marcha no se roba.
test('relevo: una tarea en marcha sigue siendo de quien la ejecuta', () => {
  const s = createService('t', [
    { id: 'p1', player: true, x: 0, y: 0, speed: 100, can: ['clean'] },
    { id: 'p2', player: true, x: 0, y: 0, speed: 100, can: ['clean'] },
  ], [{ id: 'table0', state: 'dirty' }]);
  const input = { kind: 'clean', target: 'table0', legs: [{ x: 1, y: 1, duration: 1 }] };
  const id = requestTask(s, { ...input, requestedBy: 'p1' });
  assignTasks(s, (a, p) => [p]); // p1 caminando
  s.time += 60;
  assert.equal(requestTask(s, { ...input, requestedBy: 'p2' }), null, 'no se roba una tarea en marcha');
});

// Tras la gracia larga, el personal (limpiador) puede tomar el relevo.
test('relevo: el personal toma la mesa tras la gracia larga', () => {
  const s = createService('t', [
    { id: 'p1', player: true, x: 0, y: 0, speed: 100, can: ['clean'] },
    { id: 'acaymo', player: false, x: 0, y: 0, speed: 100, can: ['clean'], auto: ['clean'] },
  ], [{ id: 'table0', state: 'dirty' }]);
  const input = { kind: 'clean', target: 'table0', legs: [{ x: 1, y: 1, duration: 1 }] };
  const id = requestTask(s, { ...input, requestedBy: 'p1' });
  s.time += 13;
  requestTask(s, { ...input, requestedBy: null }); // petición automática del limpiador
  assert.equal(s.tasks.find(t => t.id === id).requestedBy, null, 'la tarea pasa al pool del personal');
  assignTasks(s, (a, p) => [p]);
  assert.equal(s.tasks.find(t => t.id === id).actor, 'acaymo', 'el limpiador la ejecuta');
});

// ---------- 2. Integración: el bug real de la puerta (módulos del juego) ----------

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

const V = '28.22.0';
const { Game, Net } = await import(`./state.js?v=${V}`);
await import(`./coopbridge.js?v=${V}`);
const sim = await import(`./sim.js?v=${V}`);
const cfg = await import(`./config.js?v=${V}`);
const { buildTables } = await import(`./world.js?v=${V}`);

async function setupCoopDay() {
  Net.role = 'host'; Net.peer = true; Net.names = { p1: 'A', p2: 'B' }; Net.roles = { p1: 'barra', p2: 'cocina' };
  Game.upgrades = { mesas: 3, workforce: { team: {} } };
  Game.staff = { limpiador: 1, camarero: 1 };
  for (const id of cfg.ITEM_IDS) { Game.stock[id] = 50; Game.prices[id] = cfg.ITEMS[id].ref; Game.enabled[id] = true; }
  buildTables();
  Game.forecast = Array.from({ length: 40 }, () => 'sol');
  Game.speed = 1;
  sim.startDay();
}

test('jugador parado entre las mesas puede limpiar (regresión puerta)', async () => {
  await setupCoopDay();
  // El personaje queda parado en la columna de la puerta, dentro del rectángulo
  // de navegación de la primera mesa: la posición exacta del bug original.
  const p1 = Game.floor.actors.find(a => a.id === 'p1');
  p1.x = 550; p1.y = 498; p1.task = null; p1.returning = false;
  Game.tables[3].state = 'dirty'; Game.tables[3].dirtyT = 1;
  assert.ok(sim.cleanTable(Game.tables[3], false, 'p1'), 'la tarea debe registrarse');
  let assigned = false, finished = false;
  for (let i = 0; i < 600; i++) {
    sim.update(0.05);
    const t = Game.floor.tasks.find(t => t.target === 'table3');
    if (t && ['walking', 'working', 'blocked'].includes(t.state)) assigned = true;
    if (t && t.state === 'done') { finished = true; break; }
    if (Game.mode !== 'service') break;
  }
  assert.ok(assigned, 'la tarea debe asignarse (antes quedaba "no-route" para siempre)');
  assert.ok(finished, 'la tarea debe completarse');
  assert.equal(Game.tables[3].state, 'free', 'la mesa debe quedar limpia');
  assert.equal(p1.task, null, 'el personaje queda libre');
});

test('la pareja puede tomar el relevo de una mesa atascada (integración)', async () => {
  await setupCoopDay();
  // Escenario real del bug: el jugador selecciona varias mesas a la vez.
  // p1 toma la primera y la segunda queda en cola a su nombre.
  Game.tables[2].state = 'dirty'; Game.tables[2].dirtyT = 1;
  Game.tables[3].state = 'dirty'; Game.tables[3].dirtyT = 1;
  assert.ok(sim.cleanTable(Game.tables[2], false, 'p1'));
  assert.ok(sim.cleanTable(Game.tables[3], false, 'p1'));
  const t2 = Game.floor.tasks.find(t => t.target === 'table2');
  const t3 = Game.floor.tasks.find(t => t.target === 'table3');
  // p1 solo puede ejecutar una: la segunda espera en cola.
  for (let i = 0; i < 140; i++) sim.update(0.05); // 7 s: gracia vencida
  assert.equal(t2.state !== 'queued' || true, true);
  assert.ok(['walking','working','blocked','done'].includes(t2.state), 'p1 trabaja la primera mesa');
  assert.equal(t3.state, 'queued', 'la segunda mesa espera en cola');
  // La pareja toma el relevo de la segunda (antes: rechazo por exclusividad).
  assert.ok(sim.cleanTable(Game.tables[3], false, 'p2'), 'la pareja toma el relevo');
  assert.equal(t3.requestedBy, 'p2', 'la tarea pasa a la pareja');
  for (let i = 0; i < 1200; i++) {
    sim.update(0.05);
    if (t2.state === 'done' && t3.state === 'done') break;
    if (Game.mode !== 'service') break;
  }
  assert.equal(t2.state, 'done', 'la mesa de p1 acaba limpia');
  assert.equal(t3.state, 'done', 'la mesa relevada acaba limpia');
  assert.equal(Game.tables[3].state, 'free');
});

test('el día cooperativo termina a las 20:00 con el informe', async () => {
  await setupCoopDay();
  let steps = 0;
  while (Game.mode === 'service' && steps++ < 30000) {
    // la pareja juga: toca mesas sucias de vez en cuando
    if (steps % 40 === 0) {
      const dirty = Game.tables.find(t => t.state === 'dirty');
      if (dirty) sim.cleanTable(dirty, false, 'p1');
    }
    sim.update(0.05);
  }
  assert.equal(Game.mode, 'report', 'el día debe acabar en el informe');
  assert.ok(Game.hour >= 20, 'la jornada cierra a las 20:00 (hora=' + Game.hour.toFixed(1) + ')');
  assert.ok(steps < 30000, 'la jornada no puede colgarse');
});
