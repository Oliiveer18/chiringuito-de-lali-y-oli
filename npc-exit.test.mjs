/* Pruebas de regresión v29.4.1: los clientes se van de verdad.
   El bug: los objetivos de salida (x=W+60 / x=-60) caían fuera de la cuadrícula
   de navegación (que solo existe hasta x=1280). navStep jamás alcanzaba el
   objetivo y los clientes que se iban quedaban vibrando pegados al borde del
   mundo — a veces toda la jornada — empujándose entre ellos y solapándose.
   Además, la cámara horizontal puede mostrar la playa hasta W+64: despawnear al
   llegar a W+60 se veía como un "pop" delante del jugador.
   La corrección: navExit (el exterior del mundo es libre, se despawnea fuera de
   encuadre) y puntos de salida más allá de la playa visible (world.js EXIT_X_*).
   Uso: node npc-exit.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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

const v = readFileSync(new URL('./version.js', import.meta.url), 'utf8').match(/VERSION='v([^']+)'/)[1];
const { W } = await import(`./config.js?v=${v}`);
const { Game } = await import(`./state.js?v=${v}`);
const { navRebuild, navSetTarget, navStep, navFreeAt, EXIT_MARGIN } = await import(`./nav.js?v=${v}`);
const { EXIT_X_R, EXIT_X_L } = await import(`./world.js?v=${v}`);
const { GEO } = await import(`./camera.js?v=${v}`);

/* Terraza completa como buildTables() con las mejoras al máximo. */
Game.tables = [
  {x:600,y:528},{x:748,y:528},{x:896,y:528},{x:1044,y:528},{x:1192,y:528},
  {x:640,y:640},{x:788,y:640},{x:936,y:640},{x:1084,y:640},{x:1232,y:640},
].map(t=>({...t,state:'free'}));
navRebuild();

const mk = (x, y) => ({ id: 1, x, y, speed: 110, tx: 0, ty: 0, path: null, navIdx: 0,
  bob: 0, moodT: 0, actT: 0, waited: 0, stridePh: 0, movingSpd: 0, dir: 1 });
const walk = (c, maxSec = 30) => {
  let t = 0;
  while (t < maxSec) {
    if (navStep(c, 1 / 60, 1)) return t;
    t += 1 / 60;
  }
  return null;
};

test('los puntos de salida quedan más allá del margen de despawn y de la playa visible', () => {
  assert.ok(EXIT_X_R > W + EXIT_MARGIN, `EXIT_X_R=${EXIT_X_R} debe superar W+margen=${W + EXIT_MARGIN}`);
  assert.ok(EXIT_X_L < -EXIT_MARGIN, `EXIT_X_L=${EXIT_X_L} debe quedar más allá de -${EXIT_MARGIN}`);
  assert.ok(EXIT_X_R > W + GEO.LAND_MARGIN, 'la salida derecha no debe verse en pantalla (playa visible hasta W+LAND_MARGIN)');
  assert.ok(EXIT_X_L < -GEO.LAND_MARGIN, 'la salida izquierda no debe verse en pantalla');
});

test('un cliente que se va por la derecha despawnea (antes se quedaba vibrando en el borde)', () => {
  const c = mk(1000, 690);
  navSetTarget(c, EXIT_X_R, 690);
  const t = walk(c, 30);
  assert.ok(t != null, 'navStep debe terminar (done) al salir del mundo');
  assert.ok(c.x > W + EXIT_MARGIN, `despawn fuera de encuadre: x=${Math.round(c.x)} debe superar ${W + EXIT_MARGIN}`);
});

test('un cliente que se va por la izquierda también despawnea', () => {
  const c = mk(300, 680);
  navSetTarget(c, EXIT_X_L, 680);
  const t = walk(c, 30);
  assert.ok(t != null, 'navStep debe terminar (done) al salir por la izquierda');
  assert.ok(c.x < -EXIT_MARGIN, `despawn fuera de encuadre: x=${Math.round(c.x)}`);
});

test('no hay muro invisible en el borde: el cliente cruza la columna exterior sin deslizarse', () => {
  // antes: un walkby en x≈1281 (fuera de la cuadrícula) resbalaba verticalmente
  // contra una rendija de 1 px y se quedaba subiendo pegado al borde minutos enteros
  const c = mk(1281, 545);
  navSetTarget(c, EXIT_X_L, 690);
  let steps = 0;
  while (steps < 120 && c.x > 1270) { navStep(c, 1 / 60, 1); steps++; }
  assert.ok(c.x <= 1270, `el cliente debe poder cruzar el borde hacia el interior (x=${Math.round(c.x)} tras ${steps} pasos)`);
});

test('mientras camina hacia la salida no atraviesa ninguna mesa', () => {
  const c = mk(900, 580); // pasillo entre las dos filas de mesas
  navSetTarget(c, EXIT_X_R, 690);
  let t = 0;
  while (t < 30) {
    const done = navStep(c, 1 / 60, 1);
    assert.ok(navFreeAt(c.x, c.y) || c.x >= W || c.x < 0 || c.y < 0 || c.y >= 720,
      `posición ilegal dentro de una mesa o del quiosco: (${Math.round(c.x)},${Math.round(c.y)})`);
    if (done) return;
    t += 1 / 60;
  }
  assert.fail('no llegó a salir');
});
