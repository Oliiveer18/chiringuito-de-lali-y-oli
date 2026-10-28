import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const ui = readFileSync('ui.js','utf8'), cr = readFileSync('career-ui.js','utf8'), pg = readFileSync('progression-ui.js','utf8');
assert.ok(ui.includes("plan-tab-repaint"), 'renderTab debe respetar pestanas de otros modulos');
// v28: Progreso/Agenda (incluida la Carrera via tabHtml) la pinta progression-ui, unico dueno del panel
assert.ok(pg.includes("addEventListener('plan-tab-repaint'"), 'Progreso/Agenda debe repintarse al recibir el aviso');
assert.ok(cr.includes('export function tabHtml'), 'Carrera debe exportar tabHtml para la pestaña Progreso');
assert.ok(pg.includes('careerTabHtml'), 'Progreso debe renderizar la seccion de Carrera');
const body = ui.slice(ui.indexOf('export function renderTab'), ui.indexOf('export function estimateCustomers'));
assert.ok(body.indexOf('plan-tab-repaint') < body.indexOf("if(Plan.tab==='compras')"), 'la guarda debe ir antes de pintar pestanas propias');
// v28: normalizacion de la pestaña antigua "carta" hacia compras
assert.ok(body.includes("if(Plan.tab==='carta')Plan.tab='compras'"), 'renderTab debe normalizar carta a compras');
console.log('tab-persist OK');
