/* Prueba de regresión v28.15.0: el plan de apertura no puede romperse aunque el
   pronóstico llegue vacío, corto o con claves retiradas (partida antigua o coop).
   Reproduce el TypeError "Cannot read properties of undefined (reading 'label')"
   de ui-plan.js:32 y verifica las defensas de state.js. Uso: node forecast-guard.test.mjs */
import assert from 'node:assert/strict';
import { register } from 'node:module';

const STUBS = {
  './ui.js': "export const Plan={tab:'compras'};export const toasts=[];export const toast=(t,x,k)=>{toasts.push([t,x,k]);};export const toastLocal=toast;export function renderTab(){};export function showPlan(){};export function hideAll(){};export function showFinal(){};export function updateReadyUI(){};export function refreshPlanMoney(){};",
  './net.js': "export const sent=[];export const netDirty=()=>{};export const netAct=o=>{sent.push(o);};",
  './sim.js': "export function buyStock(){};export function difficultyProfile(){return{arrivals:1,patience:1,peak:0,label:''};};export function difficultyRush(){return 1;};export function newSeason(){};export function startDay(){};",
  './icons.js': "export const ICON_URL={};export const EXTRA={};export function rr(){};",
  './render.js': "export function drawPerson(){};",
  './report.js': "export function advanceFromReport(){};",
  './audio.js': "export const Audio={good(){},_raw:{}};",
  './bookkeeping.js': "export function trackCost(){};",
};
const hook = 'const S=' + JSON.stringify(STUBS) + ';export async function resolve(s,c,n){const base=s.split("?")[0];const stub=S[s]||S[base];if(stub)return{url:"data:text/javascript,"+encodeURIComponent(stub),shortCircuit:true};return n(s,c);}';
register('data:text/javascript,' + encodeURIComponent(hook), import.meta.url);

// ---------- DOM mínimo (como smoke.test.mjs) ----------
const elements = {};
const canvas = () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }), toDataURL: () => 'data:x', addEventListener() {}, style: {}, classList: { add() {}, remove() {}, toggle() {} } });
const el = () => ({ dataset: {}, style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {} }, append() {}, appendChild() {}, remove() {}, querySelector: () => null, querySelectorAll: () => [], setAttribute() {}, addEventListener() {}, innerHTML: '', textContent: '', childElementCount: 0, children: [], getClientRects: () => [], getBoundingClientRect: () => ({ height: 0, top: 0, left: 0, width: 0 }) });
globalThis.window = globalThis;
globalThis.document = {
  querySelector: s => (elements[s] || (elements[s] = (s === '#game' ? canvas() : el()))),
  getElementById: id => (elements['#' + id] || (elements['#' + id] = (id === 'game' ? canvas() : el()))),
  createElement: t => (t === 'canvas' ? canvas() : el()),
  documentElement: el(), body: el(), head: el(), addEventListener() {},
};
globalThis.innerWidth = 1280; globalThis.innerHeight = 720;
globalThis.getComputedStyle = globalThis.getComputedStyle || (() => ({ getPropertyValue: () => '0' }));
globalThis.requestAnimationFrame = globalThis.requestAnimationFrame || (() => 0);
globalThis.addEventListener = globalThis.addEventListener || (() => {});
globalThis.MutationObserver = class { observe() {} };

// ---------- módulos reales ----------
const { Game, weatherToday, weatherAt, repairForecast } = await import('./state.js?v=28.15.0');
const plan = await import('./ui-plan.js?v=28.15.0');
const cfg = await import('./config.js?v=28.15.0');
const forecastEl = () => elements['#forecast'].innerHTML;

let ok = 0, ko = 0;
const check = (name, cond, extra) => { if (cond) { ok++; console.log('  ok  ' + name); } else { ko++; console.log('  FALLO  ' + name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); } };

// 1) Pronóstico vacío (partida antigua o invitado antes del primer snapshot):
//    antes del arreglo, WEATHER[undefined].label lanzaba TypeError en ui-plan.js:32.
Game.forecast = []; Game.day = 5; Game.mode = 'plan';
let threw = false;
try { plan.renderForecast(); } catch (e) { threw = true; console.log('   error: ' + e.message); }
check('renderForecast no lanza con pronóstico vacío', !threw);
check('weatherToday() cae a "sol" con pronóstico vacío', weatherToday() === 'sol');
check('la ficha de hoy pinta "Sol"', forecastEl().includes('Sol'));

// 2) Claves retiradas del juego (p. ej. guardadas por una versión anterior)
Game.forecast = ['nubes', 'lluvia']; Game.day = 2;
threw = false;
try { plan.renderForecast(); } catch (e) { threw = true; console.log('   error: ' + e.message); }
check('renderForecast no lanza con claves de tiempo desconocidas', !threw);
check('weatherToday() cae a "sol" con clave desconocida', weatherToday() === 'sol');

// 3) "Mañana" con hueco al final de una tabla corta (índice Game.day fuera del array)
Game.forecast = ['sol']; Game.day = 5;
threw = false;
try { plan.renderForecast(); } catch (e) { threw = true; console.log('   error: ' + e.message); }
check('renderForecast no lanza cuando falta el día siguiente', !threw);
check('weatherAt(6) cae a "sol" sin día siguiente', weatherAt(6) === 'sol');

// 4) repairForecast normaliza: claves válidas y temporada completa
const repaired = repairForecast(['nubes', 'sol', 'viento']);
check('repairForecast rellena la temporada entera', repaired.length === cfg.SEASON_DAYS + 1, repaired.length);
check('repairForecast usa solo claves válidas', repaired.every(w => cfg.WEATHER[w]));

// 5) Un pronóstico válido sigue intacto (sin regresión)
Game.forecast = repairForecast([]); Game.forecast[2] = 'calima'; Game.day = 3;
check('weatherToday() respeta un pronóstico válido', weatherToday() === 'calima');
threw = false;
try { plan.renderForecast(); } catch (e) { threw = true; console.log('   error: ' + e.message); }
check('renderForecast pinta el día válido sin errores', !threw && forecastEl().includes('Calima'));

if (ko) { console.log('forecast-guard FALLÓ: ' + ko + ' comprobaciones'); process.exit(1); }
console.log('forecast-guard OK (' + ok + ' comprobaciones)');
process.exit(0); // ui-polish deja un setInterval vivo: salida explícita como en smoke.test.mjs
