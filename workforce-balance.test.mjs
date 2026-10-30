/* Pruebas de regresión v28.19: equilibrio de contrataciones (CV) y nombres de NPCs.
   Cubre:
   1. Sueldos proporcionales a lo que produce cada candidato: más experiencia =
      más rápido pero más caro; menos disponibilidad = más barato. Nada desproporcionado.
   2. La disponibilidad del currículum es real (medias jornadas y fines de semana).
   3. El limpiador "solo fines de semana" no limpia entre semana.
   4. Ningún NPC se llama "Arona" (es un municipio, no un nombre de persona).
   Uso: node workforce-balance.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { candidates, PRESENCE_PRICE } from './management-model.mjs';

// ---------- 1. Sueldos proporcionales (modelo puro) ----------

const BASE = { camarero: 55, cocinero: 65, limpiador: 30, terraza: 60 };

function pool() {
  const out = [];
  for (let seed = 0; seed < 40; seed++) for (const day of [8, 11, 20, 31, 44]) out.push(...candidates('seed-' + seed, day));
  return out;
}

test('el experto es más rápido pero cobra más que el novato', () => {
  let checked = 0;
  for (const a of pool()) for (const b of pool()) {
    if (a.role !== b.role || a.availability !== b.availability || a.workMultiplier === b.workMultiplier) continue;
    if (a.workMultiplier < b.workMultiplier) {
      // a es más rápido: debe cobrar más (tolerando el ±5% de regateo del CV)
      assert.ok(a.wage >= b.wage * 0.9, `${a.name} (${a.wage} €) es más rápido que ${b.name} (${b.wage} €) y no puede cobrar mucho menos`);
      checked++;
    }
  }
  assert.ok(checked > 30, `se compararon ${checked} parejas`);
});

test('menos disponibilidad = sueldo proporcionalmente menor', () => {
  const p = pool();
  let checked = 0;
  for (const a of p) for (const b of p) {
    if (a.role !== b.role || a.workMultiplier !== b.workMultiplier) continue;
    if (PRESENCE_PRICE[a.availability] < PRESENCE_PRICE[b.availability]) {
      assert.ok(a.wage <= b.wage * 1.15, `${a.name} (${a.availability}) no puede cobrar más que ${b.name} (${b.availability})`);
      checked++;
    }
  }
  assert.ok(checked > 10, `se compararon ${checked} parejas`);
});

test('ningún sueldo se desproporciona respecto a su base de rol', () => {
  for (const c of pool()) {
    const base = BASE[c.role];
    assert.ok(c.wage >= base * 0.3, `${c.name}: ${c.wage} € demasiado barato (base ${base})`);
    assert.ok(c.wage <= base * 1.7, `${c.name}: ${c.wage} € demasiado caro (base ${base})`);
    assert.ok(Number.isInteger(c.wage), 'sueldo entero');
    if (c.wage >= 25) assert.equal(c.wage % 5, 0, 'sueldo redondeado a 5 €');
  }
});

test('el sueldo sigue la fórmula valor x presencia x regateo', () => {
  for (const c of pool()) {
    const expected = BASE[c.role] * (2 - c.workMultiplier) * PRESENCE_PRICE[c.availability];
    const ratio = c.wage / expected;
    // tolerancia: ±5% de regateo + redondeo a 5 € (notable en sueldos bajos)
    assert.ok(ratio >= 0.85 && ratio <= 1.16, `${c.name}: ${c.wage} € no es proporcional a ${expected.toFixed(1)} € de valor`);
  }
});

test('cada candidato tiene ventajas y desventajas visibles en el CV', () => {
  const cs = candidates('seed-cv', 8).concat(candidates('seed-cv', 17));
  assert.ok(cs.length >= 3);
  for (const c of cs) {
    assert.ok(c.experienceLabel, 'experiencia visible');
    assert.ok(c.availability, 'disponibilidad visible');
    assert.ok(c.presentation.includes('precio lo refleja') || c.presentation.includes('jornada completa'), 'la disponibilidad se explica');
    assert.ok(c.workMultiplier >= 0.8 && c.workMultiplier <= 1.2, 'ritmo acotado');
  }
});

// ---------- 2-3. La disponibilidad es real (módulos del juego) ----------

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
await import(`./variety-names.js?v=${V}`);
const { staffOnDuty } = await import(`./state.js?v=${V}`);

async function setupCoopDay() {
  Net.role = 'host'; Net.peer = true; Net.names = { p1: 'A', p2: 'B' }; Net.roles = { p1: 'barra', p2: 'cocina' };
  Game.upgrades = { mesas: 3, workforce: { team: {} } };
  Game.staff = { limpiador: 1, cocinero: 1 };
  for (const id of cfg.ITEM_IDS) { Game.stock[id] = 50; Game.prices[id] = cfg.ITEMS[id].ref; Game.enabled[id] = true; }
  buildTables(); Game.forecast = Array.from({ length: 40 }, () => 'sol');
  Game.speed = 1; Game.day = 1;
  sim.startDay();
}

test('staffOnDuty respeta medias jornadas y fines de semana', async () => {
  await setupCoopDay();
  Game.upgrades.workforce.team.cocinero = { id: 'cv-2-0', availability: 'Mañanas' };
  Game.upgrades.workforce.team.limpiador = { id: 'cv-2-1', availability: 'Fines de semana' };
  Game.hour = 16;
  assert.equal(staffOnDuty('cocinero'), false, 'la cocinera de mañanas está fuera de turno a las 16:00');
  Game.hour = 11;
  assert.equal(staffOnDuty('cocinero'), true, 'la cocinera de mañanas está en turno a las 11:00');
  Game.day = 1; // lunes
  assert.equal(staffOnDuty('limpiador'), false, 'el limpiador de fines de semana no trabaja el lunes');
  Game.day = 6; // sábado
  assert.equal(staffOnDuty('limpiador'), true, 'el limpiador de fines de semana trabaja el sábado');
});

test('la cocinera de solo-mañanas no atiende por la tarde', async () => {
  await setupCoopDay();
  Game.upgrades.workforce.team.cocinero = { id: 'cv-2-0', availability: 'Mañanas', workMultiplier: 1 };
  const slot = Game.slots.find(s => s.who === 'carmela');
  // tarde: comanda de comida sin atender
  Game.hour = 17;
  const c1 = { id: 9501, state: 'queue', act: 'order', actT: 5, spot: 0, order: ['papas', 'papas'], itemSt: [0, 0], served: [], missing: 0, inPrep: 0, partT: {}, patience: 100, maxPatience: 100, personality: 'tranquilo', anger: 0, angerT: 0, subs: {}, floorTableId: null, mood: null, moodT: 0, speed: 100, x: 700, y: 690 };
  Game.customers.push(c1);
  for (let i = 0; i < 60; i++) sim.update(0.05);
  assert.notEqual(slot.cust, c1, 'por la tarde la cocinera de mañanas no atiende');
  // mañana: la misma comanda sí la atiende
  Game.hour = 11;
  for (let i = 0; i < 60; i++) { sim.update(0.05); if (slot.cust === c1) break; }
  assert.equal(slot.cust, c1, 'por la mañana la cocinera atiende');
});

test('el limpiador de solo-fines-de-semana no limpia entre semana', async () => {
  await setupCoopDay();
  Game.upgrades.workforce.team.limpiador = { id: 'cv-2-1', availability: 'Fines de semana', workMultiplier: 1 };
  Game.day = 1; // lunes
  Game.tables[0].state = 'dirty'; Game.tables[0].dirtyT = 1;
  for (let i = 0; i < 40; i++) sim.update(0.05);
  let task = Game.floor.tasks.find(t => t.target === 'table0');
  assert.ok(!task || !['queued', 'walking', 'working', 'blocked'].includes(task.state), 'entre semana no hay tarea de limpieza');
  // sábado: sí limpia
  Game.day = 6;
  Game.tables[0].state = 'dirty'; Game.tables[0].dirtyT = 1;
  for (let i = 0; i < 40; i++) sim.update(0.05);
  task = Game.floor.tasks.find(t => t.target === 'table0');
  assert.ok(task && ['queued', 'walking', 'working', 'blocked'].includes(task.state), 'el sábado sí limpia');
});

// ---------- 4. Nombres de NPCs ----------

test('ningún NPC se llama Arona (es un municipio)', async () => {
  for (const pool of Object.values(cfg.NAMES)) {
    for (const entry of pool) {
      const nombre = entry.split(',')[0].trim();
      assert.notEqual(nombre, 'Arona', `Arona no es nombre de persona: ${entry}`);
    }
  }
});

test('los nombres de los pools son nombres reales de persona', async () => {
  for (const pool of Object.values(cfg.NAMES)) {
    for (const entry of pool) {
      const [nombre, lugar] = entry.split(',').map(x => x.trim());
      assert.ok(nombre && nombre.length >= 2, 'nombre de persona presente');
      assert.ok(lugar && lugar.length >= 3, 'lugar presente');
    }
  }
});
