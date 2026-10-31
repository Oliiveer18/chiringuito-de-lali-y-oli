/* Pruebas de regresión v29.2: rutas directas en la terraza.
   El bug: el rectángulo de bloqueo de cada mesa en la cuadrícula de
   navegación (144 px con mesas cada 148 px) dejaba huecos de 4 px
   impasables. El único pasillo vertical entre el pasillo central y el
   inferior era la columna izquierda (x≈555): ir de una mesa a su vecina
   obligaba a rodear toda la terraza.
   Uso: node nav-detour.test.mjs */
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

const v = readFileSync(new URL('./version.js', import.meta.url), 'utf8').match(/VERSION='(v[^']+)'/)[1];
const { Game } = await import(`./state.js?${v}`);
const { navRebuild, navFind, navFreeAt } = await import(`./nav.js?${v}`);

/* Terraza completa: 2 filas × 5 mesas, como buildTables() con las mejoras al máximo. */
Game.tables = [
  {x:600,y:528},{x:748,y:528},{x:896,y:528},{x:1044,y:528},{x:1192,y:528},
  {x:640,y:640},{x:788,y:640},{x:936,y:640},{x:1084,y:640},{x:1232,y:640},
].map(t=>({...t,state:'free'}));
navRebuild();

const endpoint = t => ({ x: t.x + (t.x > 1150 ? -46 : 46), y: t.y + 34 });
const pathLen = path => path.reduce((s, p, i) => i ? s + Math.hypot(p.x - path[i-1].x, p.y - path[i-1].y) : 0, 0);
const T = Game.tables;

test('los puntos de trabajo de las mesas son celdas libres',()=>{
  for(const t of T){
    const e = endpoint(t);
    assert.ok(navFreeAt(e.x, e.y), `endpoint de mesa (${t.x},${t.y}) bloqueado`);
  }
});

test('limpiar mesa arriba y luego la de abajo: ruta directa, sin rodear la terraza',()=>{
  // antes: mesa9-end → mesa4-end = 672 px dando toda la vuelta por la izquierda (D=119)
  for(const [i,j] of [[4,9],[9,4],[0,5],[5,0],[2,7],[7,2]]){
    const e1 = endpoint(T[i]), e2 = endpoint(T[j]);
    const path = navFind(e1.x, e1.y, e2.x, e2.y);
    const L = pathLen(path), D = Math.hypot(e2.x - e1.x, e2.y - e1.y);
    assert.ok(L <= D * 1.6, `mesa ${i}→${j}: ruta de ${Math.round(L)}px para ${Math.round(D)}px en línea recta (ratio ${(L/D).toFixed(2)})`);
    assert.ok(!path.some(p => p.x < 560), `mesa ${i}→${j}: la ruta se va a la columna izquierda (x<560)`);
  }
});

test('ir a la mesa vecina de la fila de abajo: sin excursión a la izquierda',()=>{
  for(const j of [6,7,8]){
    const e1 = {x:880,y:578}; // casa del limpiador
    const e2 = endpoint(T[j]);
    const path = navFind(e1.x, e1.y, e2.x, e2.y);
    const L = pathLen(path), D = Math.hypot(e2.x - e1.x, e2.y - e1.y);
    assert.ok(L <= D * 1.6, `casa→mesa ${j}: ${Math.round(L)}px para ${Math.round(D)}px (ratio ${(L/D).toFixed(2)})`);
  }
});

test('de mesa a mesa en pasillos distintos, la ruta no pasa por detrás de la barra',()=>{
  // el pasillo central y el inferior deben conectarse dentro de la terraza
  const e1 = endpoint(T[3]); // fila de arriba
  const e2 = endpoint(T[8]); // fila de abajo
  const path = navFind(e1.x, e1.y, e2.x, e2.y);
  assert.ok(path.length >= 1);
  assert.ok(!path.some(p => p.x < 560), 'la ruta rodea por la columna izquierda');
});

test('quedan huecos transitables entre mesas contiguas (calles de terraza)',()=>{
  // celda a mitad de camino entre mesa 0 y mesa 1, en el pasillo central
  assert.ok(navFreeAt(674, 562), 'la calle entre mesas contiguas está bloqueada');
  // calle vertical entre fila de arriba y fila de abajo (entre mesa 5 y 6)
  assert.ok(navFreeAt(714, 620), 'el pasillo vertical entre filas está bloqueado');
});
