/* Prueba de regresión v29.1: la franja de inventario vive dentro del HUD.
   Comprueba el marcado de los chips (icono + contador), los estados bajo/agotado,
   el plegado a un solo botón "Inventario" con badge de alertas, el despliegue
   automático cuando algo pasa a bajo/agotado y que el diseño aguanta los 13
   productos que define el juego (6 base + algodón, agua, refresco, helado,
   gofre, cóctel y churros). Uso: node hud-stockbar.test.mjs */
import { register } from 'node:module';
import assert from 'node:assert/strict';

const STUBS = {
  './ui.js': "export const Plan={tab:'compras'};export const toasts=[];export const toast=(t,x,k)=>{toasts.push([t,x,k]);};export const toastLocal=toast;export const updateStockbar=()=>{};export const refreshPlanMoney=()=>{};export const staffAvatar=()=>'data:x';export function renderTab(){};export function showPlan(){};export function hideAll(){};export function showFinal(){};export function updateReadyUI(){};",
  './net.js': "export const netDirty=()=>{};export const netAct=()=>{};",
  './sim.js': "export function buyStock(){};export function spawnCustomer(){};export function newSeason(){};export function startDay(){};",
  './audio.js': "export const Audio={click(){}};",
  './ui-plan.js': "export const Plan={tab:'compras'};export function hideAll(){};export function showPlan(){};",
  './icons.js': "export const ICON_URL={};export const EXTRA={};export function rr(){};",
};
const hook = 'const S=' + JSON.stringify(STUBS) + ';export async function resolve(s,c,n){const base=s.split("?")[0];const stub=S[s]||S[base];if(stub)return{url:"data:text/javascript,"+encodeURIComponent(stub),shortCircuit:true};return n(s,c);}';
register('data:text/javascript,' + encodeURIComponent(hook), import.meta.url);

// ---------- DOM mínimo ----------
globalThis.window = globalThis;
globalThis.setInterval = () => 1;
globalThis.MutationObserver = class { observe() {} };
globalThis.ResizeObserver = undefined;
const stored = {};
globalThis.localStorage = { getItem: k => stored[k] ?? null, setItem: (k, v) => { stored[k] = v; } };

function mkEl() {
  const cls = new Set();
  return {
    style: { setProperty() {} }, dataset: {}, handlers: {}, innerHTML: '', textContent: '',
    classList: {
      add: c => cls.add(c), remove: c => cls.delete(c),
      toggle: (c, f) => { const on = f === undefined ? !cls.has(c) : !!f; on ? cls.add(c) : cls.delete(c); return on; },
      contains: c => cls.has(c),
    },
    _cls: cls,
    addEventListener(t, f) { this.handlers[t] = f; },
    append() {}, remove() {}, setAttribute() {}, getClientRects: () => [], getBoundingClientRect: () => ({ height: 0 }),
  };
}
const canvas = () => ({
  width: 0, height: 0, style: {},
  getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }),
  toDataURL: () => 'data:x', addEventListener() {},
});
const els = {};
const el = id => els[id] || (els[id] = mkEl());
const bySel = {
  '#stockbar .stock-list': () => el('stock-list'),
  '#stock-toggle': () => el('stock-toggle'),
  '#stockbar': () => el('stockbar'),
  '#toasts': () => el('toasts'),
  '#hud': () => el('hud'),
  '#hint': () => el('hint'),
};
const clickHandlers = [];
globalThis.document = {
  querySelector: s => (bySel[s] ? bySel[s]() : null),
  getElementById: id => el(id),
  createElement: t => (t === 'canvas' ? canvas() : mkEl()),
  documentElement: el('root'),
  body: el('body'),
  addEventListener: (t, f) => { if (t === 'click') clickHandlers.push(f); },
  querySelectorAll: () => [],
};
el('stockbar').append = () => {}; // contenedor estático

// ---------- carga de módulos ----------
const { Game } = await import('./state.js?v=29.1.0');
const us = await import('./ui-service.js?v=29.1.0');
const { ITEMS } = await import('./config.js?v=29.1.0');
await import('./features.js?v=29.1.0'); // añade algodón
await import('./v14.js?v=29.1.0');      // añade agua, refresco, helado, gofre, cóctel, churros

// ---------- 1. chips con icono + contador y estados con color ----------
Game.mode = 'service'; Game.upgrades = {}; Game.enabled = {}; Game.stock = {};
for (const id of Object.keys(ITEMS)) { Game.enabled[id] = true; Game.stock[id] = 20; }
Game.stock.papas = 3;   // bajo
Game.stock.queso = 0;   // agotado (requiere plancha: se desbloquea abajo)
Game.upgrades.plancha = 1;
us.updateStockbar();
let html = el('stock-list').innerHTML;
assert.ok(html.includes('<b class="n">20</b>'), 'el contador debe ir en un b.n');
assert.ok(/class="stock low"/.test(html), 'el producto bajo debe marcarse con la clase low');
assert.ok(/class="stock out"/.test(html), 'el producto agotado debe marcarse con la clase out');
assert.equal((html.match(/class="stock[ "]/g) || []).length, 5, '5 chips base (plancha desbloquea queso)');

// ---------- 2. plegado a un solo botón "Inventario" con badge ----------
const clickToggle = () => { for (const h of clickHandlers) h({ target: { closest: s => (s === '#stock-toggle' ? {} : null) } }); };
clickToggle(); // pliega
assert.ok(el('stockbar')._cls.has('mini'), 'la franja debe quedar en modo mini');
let tg = el('stock-toggle').innerHTML;
assert.ok(tg.includes('Inventario'), 'plegado debe verse el botón Inventario');
assert.ok(tg.includes('mini-badge'), 'el botón plegado debe llevar badge de alertas');
assert.ok(tg.includes('>2<'), 'el badge debe contar 2 productos en alerta (bajo + agotado)');
assert.equal(stored['lalioli-stockmini'], '1', 'la preferencia plegada se recuerda');

// ---------- 3. despliegue automático cuando algo nuevo pasa a bajo ----------
Game.stock.cerveza = 2; // nuevo producto en estado bajo
us.updateStockbar();
assert.ok(!el('stockbar')._cls.has('mini'), 'una alerta nueva debe desplegar la franja sola');
assert.ok(el('stock-toggle').innerHTML.includes('svg'), 'desplegada, el botón vuelve a ser flecha');
assert.equal(stored['lalioli-stockmini'], '0', 'el despliegue automático actualiza la preferencia');

// ---------- 4. preparado para los 13 productos del juego ----------
Game.upgrades = { plancha: 1, cocina: 1, refrescos: 1, heladera: 1, gofrera: 1, coctelera: 1, churrera: 1, algodonera: 1 };
for (const id of Object.keys(ITEMS)) { Game.enabled[id] = true; Game.stock[id] = 20; }
us.updateStockbar();
html = el('stock-list').innerHTML;
const total = Object.keys(ITEMS).length;
assert.ok(total >= 13, 'el juego debe definir al menos 13 productos');
assert.equal((html.match(/class="stock[ "]/g) || []).length, total,
  'la franja debe renderizar un chip por cada producto activo (hoy ' + total + ')');

// ---------- 5. plegado sin alertas: badge ausente ----------
clickToggle(); // pliega de nuevo (todo con stock)
tg = el('stock-toggle').innerHTML;
assert.ok(tg.includes('Inventario'), 'plegado sin alertas sigue mostrando el botón Inventario');
assert.ok(!tg.includes('mini-badge'), 'sin productos en alerta no hay badge');

console.log('hud-stockbar: OK (chips, estados, plegado con badge, despliegue automático y ' + total + ' productos)');
