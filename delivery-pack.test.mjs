/* Prueba de regresión v29.1: el reparto durante la jornada ofrece SOLO el pack
   medio (10 unidades por producto). Los packs de 5 y 20 desaparecen del panel
   para que comprar stock con clientes esperando sea una decisión rápida,
   y el aviso de "precio doble del almacén" sigue bien visible.
   Uso: node delivery-pack.test.mjs */
import { register } from 'node:module';
import assert from 'node:assert/strict';

const STUBS = {
  './ui.js': "export const Plan={tab:'compras'};export const toasts=[];export const toast=(t,x,k)=>{toasts.push([t,x,k]);};export const toastLocal=toast;export const updateStockbar=()=>{};export const refreshPlanMoney=()=>{};export const staffAvatar=()=>'data:x';export function renderTab(){};export function showPlan(){};export function hideAll(){};export function showFinal(){};export function updateReadyUI(){};",
  './net.js': "export const sent=[];export const netDirty=()=>{};export const netAct=o=>{sent.push(o);};",
  './sim.js': "export function buyStock(){};export function spawnCustomer(){};",
  './icons.js': "export const ICON_URL={};export const EXTRA={};export function rr(){};",
};
const hook = 'const S=' + JSON.stringify(STUBS) + ';export async function resolve(s,c,n){const base=s.split("?")[0];const stub=S[s]||S[base];if(stub)return{url:"data:text/javascript,"+encodeURIComponent(stub),shortCircuit:true};return n(s,c);}';
register('data:text/javascript,' + encodeURIComponent(hook), import.meta.url);

// ---------- DOM mínimo ----------
globalThis.window = globalThis;
const intervals = [];
globalThis.setInterval = fn => { intervals.push(fn); return 1; };
const panels = [];
globalThis.document = {
  createElement: () => { const p = mkPanel(); panels.push(p); return p; },
  body: { append() {} },
  addEventListener() {},
  querySelector: () => null,
  getElementById: () => null,
};
function mkPanel() {
  return {
    style: {}, dataset: {}, handlers: {}, innerHTML: '',
    addEventListener(t, f) { this.handlers[t] = f; },
    append() {}, remove() {}, setAttribute() {},
  };
}

// ---------- carga de módulos ----------
const { Game, Net } = await import('./state.js?v=29.4.2');
const dp = await import('./delivery-panel.js?v=29.4.2');
const { ITEMS } = await import('./config.js?v=29.4.2');

// ---------- estado de partida en servicio ----------
Game.mode = 'service'; Game.money = 100; Game.upgrades = {}; Game.enabled = {}; Game.stock = {};
for (const id of Object.keys(ITEMS)) { Game.enabled[id] = true; Game.stock[id] = 8; }
Net.role = 'solo';

// ---------- 1. el pack medio es el único de la jornada ----------
assert.deepEqual(dp.SERVICE_PACKS, [10], 'SERVICE_PACKS debe ser exactamente [10]');

const calls = [];
dp.openDelivery((id, q) => calls.push([id, q]));
const panel = panels[panels.length - 1];
const html = panel.innerHTML;

assert.ok(html.includes('data-del-q="10"'), 'el panel debe ofrecer el pack de 10');
assert.ok(!html.includes('data-del-q="5"'), 'el pack de 5 no debe aparecer en jornada');
assert.ok(!html.includes('data-del-q="20"'), 'el pack de 20 no debe aparecer en jornada');
assert.ok(!html.includes('data-del-q="2"'), 'no debe haber otros packs');
const n10 = (html.match(/data-del-q="10"/g) || []).length;
const unlocked = Object.keys(ITEMS).filter(id => !ITEMS[id].unlock).length;
assert.equal(n10, unlocked, 'un botón de pack 10 por producto desbloqueado (base), sin packs extra');

// ---------- 2. el aviso de precio doble se mantiene claro ----------
assert.ok(html.includes('precio doble del almacén'), 'el aviso de precio doble del almacén debe verse');
assert.ok(html.includes('pack único de 10 unidades'), 'debe indicar que el pack es único de 10 unidades');

// ---------- 3. comprar con el pack medio funciona (anfitriona) ----------
const btn10 = { dataset: { delId: 'cerveza', delQ: '10' }, disabled: false };
panel.handlers.click({ target: { closest: sel => (sel === 'button' ? btn10 : null) } });
assert.deepEqual(calls, [['cerveza', 10]], 'pulsar el pack medio debe pedir (cerveza, 10)');

// ---------- 4. un pack retirado (5 o 20) se rechaza aunque llegue por consola ----------
for (const q of ['5', '20']) {
  const btn = { dataset: { delId: 'cerveza', delQ: q }, disabled: false };
  panel.handlers.click({ target: { closest: sel => (sel === 'button' ? btn : null) } });
}
assert.equal(calls.length, 1, 'los packs de 5 y 20 deben ignorarse');

// ---------- 5. sin caja, el botón del pack queda deshabilitado ----------
Game.money = 5;
for (const fn of intervals) fn(); // repintado del panel
const htmlPoor = panel.innerHTML;
assert.ok(/data-del-id="cerveza" data-del-q="10" disabled/.test(htmlPoor), 'sin caja suficiente el pack medio debe deshabilitarse');
Game.money = 100;

// ---------- 6. la invitada también pide por el pack medio ----------
Net.role = 'guest';
const { sent } = await import('./net.js?v=29.4.2');
panel.handlers.click({ target: { closest: sel => (sel === 'button' ? btn10 : null) } });
const last = sent[sent.length - 1];
assert.ok(last && last.a === 'mod' && last.k === 'delivery' && last.p.id === 'cerveza' && last.p.qty === 10,
  'la invitada debe enviar el pedido del pack medio (10 uds)');
Net.role = 'solo';

console.log('delivery-pack: OK (' + [1,2,3,4,5,6].length + ' comprobaciones del pack medio en jornada)');
