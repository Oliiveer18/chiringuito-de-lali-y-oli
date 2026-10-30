/* Pruebas de regresión v28.22: informe con el personal en solitario y
   trabajadores fuera de turno ocultos.
   1. En solitario el informe muestra «El equipo» con tu fila y la de cada contratado.
   2. Cada rol muestra sus métricas (preparados, mesas, terraza) y hay resumen general.
   3. Sin personal contratado también se muestra tu fila con nota.
   4. Un contratado fuera de turno (disponibilidad) queda oculto, no parado en el kiosco.
   5. Las tareas de terraza completadas se contabilizan por trabajador.
   Uso: node solo-staff.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
globalThis.setInterval = fn => 1;
const canvas = () => ({ width: 1280, height: 720, getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }), toDataURL: () => 'data:x', addEventListener() {}, style: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } });
const el = () => ({ dataset: {}, style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, append() {}, appendChild() {}, remove() {}, querySelector: () => null, querySelectorAll: () => [], setAttribute() {}, addEventListener() {}, innerHTML: '', textContent: '', childElementCount: 0, children: [], getClientRects: () => [], getBoundingClientRect: () => ({ height: 0, top: 0, left: 0, width: 0 }), scrollTop: 0 });
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
try { globalThis.crypto.randomUUID(); } catch { /* node ya trae crypto */ }

/* v29: la versión se lee de version.js para que los tests nunca queden en una
   versión distinta a la del juego (dos copias de módulo = estado duplicado). */
const V = (await import('node:fs')).readFileSync(new URL('./version.js', import.meta.url), 'utf8').match(/VERSION='(v[0-9.]+)'/)[1].replace('v', '');
const { Game, Net } = await import(`./state.js?v=${V}`);
await import(`./coopbridge.js?v=${V}`);
const { teamPanelHtml } = await import(`./report-render.js?v=${V}`);
const { updateFloor } = await import(`./floor-service.js?v=${V}`);

function freshStats() {
  return { revenue: 0, served: 0, lost: 0, lostPrice: 0, lostQueue: 0, lostPatience: 0, lostStock: 0, lostClose: 0, partial: 0, noTable: 0, satSum: 0, satN: 0, sold: {}, stockOuts: {}, tips: 0, tipsP: 0, combos: 0, purchases: 0, fines: 0, urgent: 0, courtesies: 0, hamacas: 0, beachRentals: 0, regVisits: 0, visits: [], usedNames: new Set(), repStart: 3.5, staffClients: 3,
    by: { p1: { items: 9, rev: 120, clean: 1 }, yeray: { items: 4, rev: 55, clean: 0 }, carmela: { items: 6, rev: 70, clean: 0 }, acaymo: { items: 0, rev: 0, clean: 5 }, terraza: { items: 0, rev: 0, clean: 0, escort: 3, orders: 3, delivered: 3 } } };
}

function setupSolo(staff, team) {
  Game.mode = 'report'; Game.day = 3; Game.hour = 12;
  Game.staff = staff;
  Game.upgrades = Object.assign({}, Game.upgrades, { workforce: { team } });
  Net.role = 'solo'; Net.peer = null;
}

test('en solitario el informe muestra el equipo con tu fila y la del personal', () => {
  setupSolo(
    { camarero: true, cocinero: true, limpiador: true, terraza: true },
    {
      camarero: { name: 'Yurena', availability: 'Jornada completa', training: 0, workMultiplier: 1 },
      cocinero: { name: 'Rosana', availability: 'Jornada completa', training: 0, workMultiplier: 1 },
      limpiador: { name: 'Aitor', availability: 'Jornada completa', training: 0, workMultiplier: 1 },
      terraza: { name: 'Nira', availability: 'Jornada completa', training: 0, workMultiplier: 1 },
    }
  );
  const s = freshStats();
  const html = teamPanelHtml(s, { acc: { wage: 180 } });
  assert.ok(html.includes('El equipo'), 'sección de equipo');
  assert.ok(html.includes('<b>Tú</b>'), 'fila del jugador');
  for (const name of ['Yurena', 'Rosana', 'Aitor', 'Nira']) assert.ok(html.includes(name), `falta ${name}`);
  for (const tag of ['Atención de cola', 'Preparación', 'Limpieza', 'Servicio de terraza']) assert.ok(html.includes(tag), `falta etiqueta ${tag}`);
  assert.ok(html.includes('Resumen del personal'), 'resumen general del personal');
  assert.ok(html.includes('<b>4</b> contratados'), 'cuenta los contratados');
  assert.ok(html.includes('sueldos'), 'menciona sueldos');
  assert.ok(html.includes('4</b> de turno'), 'cuenta los de turno');
});

test('cada rol muestra sus métricas propias', () => {
  setupSolo(
    { camarero: true, cocinero: true, limpiador: true, terraza: true },
    {
      camarero: { name: 'Yurena', availability: 'Jornada completa' },
      cocinero: { name: 'Rosana', availability: 'Jornada completa' },
      limpiador: { name: 'Aitor', availability: 'Jornada completa' },
      terraza: { name: 'Nira', availability: 'Jornada completa' },
    }
  );
  const s = freshStats();
  const html = teamPanelHtml(s, { acc: { wage: 180 } });
  assert.ok(html.includes('<b>3</b> acompañados'), 'terraza: clientes acompañados');
  assert.ok(html.includes('<b>3</b> comandas'), 'terraza: comandas tomadas');
  assert.ok(html.includes('<b>3</b> servidos'), 'terraza: pedidos servidos');
  assert.ok(html.includes('<b>5</b> mesas limpiadas'), 'limpiador: mesas');
  assert.ok(html.includes('<b>4</b> preparados'), 'camarero: preparados');
  assert.ok(html.includes('<b>3</b> clientes'), 'camarero: clientes atendidos');
  assert.ok(html.includes('<b>6</b> preparados'), 'cocinero: preparados');
});

test('sin personal contratado también se muestra tu fila con nota', () => {
  setupSolo({}, {});
  const s = freshStats();
  const html = teamPanelHtml(s, { acc: { wage: 0 } });
  assert.ok(html.includes('El equipo'), 'sección de equipo');
  assert.ok(html.includes('<b>Tú</b>'), 'fila del jugador');
  assert.ok(html.includes('Sin personal contratado'), 'nota de plantilla vacía');
  assert.ok(html.includes('<b>9</b> preparados'), 'tus preparados');
});

test('un contratado fuera de turno queda oculto, no parado en el kiosco', () => {
  Game.mode = 'service'; Game.closing = false; Game.hour = 12; Game.day = 3;
  Game.staff = { cocinero: true };
  Game.upgrades = Object.assign({}, Game.upgrades, { workforce: { team: { cocinero: { name: 'Rosana', availability: 'Fines de semana', training: 0, workMultiplier: 1 } } } });
  Game.tables = []; Game.customers = []; Game.slots = []; Game.floaters = [];
  const carmela = { id: 'carmela', role: 'cocinero', player: false, x: 95, y: 560, home: { x: 95, y: 560 }, phase: 0, dir: 1, speed: 110, auto: [], task: null, returning: false };
  Game.floor = { actors: [carmela], tasks: [], events: [], time: 0, tables: [] };
  updateFloor(0.1);
  assert.equal(carmela.offDuty, true, 'la cocinera queda marcada fuera de turno');
  // con jornada completa sí está de turno
  Game.upgrades.workforce.team.cocinero.availability = 'Jornada completa';
  updateFloor(0.1);
  assert.equal(carmela.offDuty, false, 'con jornada completa está de turno');
  Game.floor = null;
});

test('las tareas de terraza completadas se contabilizan por trabajador', () => {
  Game.mode = 'service'; Game.closing = false; Game.hour = 12; Game.day = 3;
  Game.staff = { terraza: true };
  Game.upgrades = Object.assign({}, Game.upgrades, { workforce: { team: { terraza: { name: 'Nira', availability: 'Jornada completa' } } } });
  Game.tables = []; Game.customers = []; Game.slots = []; Game.floaters = [];
  Game.dayStats = { by: {} };
  const terraza = { id: 'terraza', role: 'terraza', player: false, x: 550, y: 560, home: { x: 550, y: 560 }, phase: 0, dir: 1, speed: 110, auto: [], task: null, returning: false };
  Game.floor = {
    actors: [terraza], time: 0, tables: [], events: [
      { type: 'completed', task: 't1' },
      { type: 'completed', task: 't2' },
    ],
    tasks: [
      { id: 't1', kind: 'escort', actor: 'terraza', customer: null, state: 'done', target: 'table0' },
      { id: 't2', kind: 'takeOrder', actor: 'terraza', customer: null, state: 'done', target: '99' },
    ],
  };
  updateFloor(0.1);
  const b = Game.dayStats.by.terraza;
  assert.ok(b, 'contador del actor terraza');
  assert.equal(b.escort, 1, 'un acompañamiento contado');
  assert.equal(b.orders, 1, 'una comanda contada');
  Game.floor = null;
});
