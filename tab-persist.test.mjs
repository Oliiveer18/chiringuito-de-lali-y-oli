import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const ui = readFileSync('ui.js','utf8'), cr = readFileSync('career-ui.js','utf8');
assert.ok(ui.includes("plan-tab-repaint"), 'renderTab debe respetar pestanas de otros modulos');
assert.ok(cr.includes("addEventListener('plan-tab-repaint'"), 'Carrera debe repintarse al recibir el aviso');
const body = ui.slice(ui.indexOf('export function renderTab'), ui.indexOf('export function estimateCustomers'));
assert.ok(body.indexOf('plan-tab-repaint') < body.indexOf("if(Plan.tab==='compras')"), 'la guarda debe ir antes de pintar pestanas propias');
console.log('tab-persist OK');
