/* Pruebas de regresión v29.5: parejas y plantilla con cansancio, ánimo y nivel.
   1. Las parejas llegan juntas, se sientan a la misma mesa solo si atienden
      a las dos y se van las dos si una pierde la paciencia.
   2. La mesa solo queda sucia si comieron comida.
   3. Los CV reparten los 4 puestos con frecuencia equilibrada (limpieza incluida).
   4. Contratación con huecos (máx. 3 por puesto, vestuarios), nivel 1-10,
      cansancio que penaliza el ritmo y felicidad que puede acabar en renuncia.
   Uso: node couples-workforce.test.mjs */
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

const V = (await import('node:fs')).readFileSync(new URL('./version.js', import.meta.url), 'utf8').match(/VERSION='(v[0-9.]+)'/)[1].replace('v', '');
const { Game, Net } = await import(`./state.js?v=${V}`);
const { tableStateAfterMeal } = await import(`./sim/lost.js?v=${V}`);
const { candidates, hireCandidate, dayEndEmployee, effMultiplier, expectedWage, xpForLevel, teamOf, MAX_LEVEL } = await import(`./management-model.mjs?v=${V}`);
const { spawnCustomer, coupleAbandon } = await import(`./sim/customers.js?v=${V}`);
const { completeOrder, payAndSeat } = await import(`./sim/service.js?v=${V}`);
const { QUEUE_POS } = await import(`./world.js?v=${V}`);
const { navRebuild } = await import(`./nav.js?v=${V}`);

/* ---------- 1. Mesas: solo la comida ensucia ---------- */
test('la mesa solo queda sucia si comieron comida', () => {
  assert.equal(tableStateAfterMeal({ served: ['papas'] }), 'dirty');
  assert.equal(tableStateAfterMeal({ served: ['cerveza'] }), 'free');
  assert.equal(tableStateAfterMeal({ served: ['cerveza', 'papas'] }), 'dirty');
  assert.equal(tableStateAfterMeal({ served: [] }), 'free');
});

/* ---------- 2. CVs: los cuatro puestos aparecen ---------- */
test('los CVs reparten los 4 puestos (limpieza incluida)', () => {
  const counts = { camarero: 0, cocinero: 0, limpiador: 0, terraza: 0 };
  let total = 0;
  for (let day = 4; day <= 30; day++) {
    for (const c of candidates('test-cv', day)) { counts[c.role]++; total++; }
  }
  assert.ok(total > 30, 'hay candidatos suficientes');
  for (const [role, n] of Object.entries(counts)) {
    assert.ok(n >= total * 0.12, `${role} aparece en los CVs (${n}/${total})`);
  }
});

/* ---------- 3. Contratación con huecos ---------- */
test('huecos por puesto: 1 gratis, más con vestuarios, nunca más de 3', () => {
  let team = {};
  const cv = candidates('test-hueco', 4);
  const cocineros = [];
  for (let b = 4; b <= 40; b += 3) for (const c of candidates('test-hueco', b)) if (c.role === 'cocinero') cocineros.push(c);
  assert.ok(cocineros.length >= 4, 'hay varios CVs de cocina');
  const hire=(cv,open)=>hireCandidate(team,[cv],cv.id,cv.received,open);
  // primer cocinero: hueco libre sin vestuarios
  let r = hire(cocineros[0],1); team = r.team;
  assert.equal(teamOf(team, 'cocinero').length, 1);
  // segundo sin vestuarios: rechazado
  assert.throws(()=>hire(cocineros[1],1), /hueco/);
  // con vestuarios (2 abiertos) entra el segundo
  r = hire(cocineros[1],2); team = r.team;
  assert.equal(teamOf(team, 'cocinero').length, 2);
  // máximo 3 aunque haya más huecos abiertos
  r = hire(cocineros[2],9); team = r.team;
  assert.equal(teamOf(team, 'cocinero').length, 3);
  assert.throws(()=>hire(cocineros[3],9), /hueco/);
  // no se puede contratar dos veces al mismo CV
  assert.throws(()=>hire(cocineros[0],9), /already/i);
});

/* ---------- 4. Nivel, cansancio y felicidad ---------- */
test('effMultiplier: nivel acelera, cansancio frena, ánimo modula', () => {
  const base = { workMultiplier: 1, level: 1, fatigue: 0, happiness: 0.7 };
  assert.ok(Math.abs(effMultiplier(base) - 1) < 0.01, 'nivel 1 fresco y neutro = ritmo base');
  const experto = effMultiplier({ ...base, level: 10 });
  assert.ok(experto < 0.8, `nivel 10 más rápido (${experto.toFixed(2)})`);
  const cansado = effMultiplier({ ...base, fatigue: 1 });
  assert.ok(cansado > 1.1, `cansancio máximo más lento (${cansado.toFixed(2)})`);
  const feliz = effMultiplier({ ...base, happiness: 1 });
  const triste = effMultiplier({ ...base, happiness: 0 });
  assert.ok(feliz < 1 && triste > 1, 'el ánimo modula el ritmo en ambos sentidos');
});

test('dayEndEmployee: XP sube nivel, la carga moldea el ánimo y la renuncia llega', () => {
  const e = { workMultiplier: 1, level: 1, xp: 0, wage: 110, happiness: 0.7, lowDays: 0 };
  // jornada cómoda y bien pagada: sube el ánimo
  let r = dayEndEmployee(e, 110, { items: 30, load: 0.8 });
  assert.ok(r.employee.happiness > 0.7, 'jornada cómoda mejora el ánimo');
  assert.ok(r.employee.xp > 0, 'gana experiencia por lo producido');
  assert.ok(!r.quit);
  // muchísima producción: sube de nivel
  r = dayEndEmployee(r.employee, 110, { items: 500, clean: 100, load: 0.8 });
  assert.ok(r.employee.level > 1, 'la producción sube el nivel');
  assert.ok(r.employee.leveledUp);
  // sobrecarga sostenida + sueldo injusto: ánima al suelo
  let bad = { ...e, wage: 40, happiness: 0.7, lowDays: 0 };
  for (let i = 0; i < 8; i++) bad = dayEndEmployee(bad, 110, { load: 2 }).employee;
  assert.ok(bad.happiness < 0.36, 'la sobrecarga y el sueldo hunden el ánimo');
  // poco trabajo: se aburre (el ánimo baja sin castigo de ritmo)
  let bored = { ...e, happiness: 0.7 };
  for (let i = 0; i < 5; i++) bored = dayEndEmployee(bored, 110, { load: 0.1 }).employee;
  assert.ok(bored.happiness < 0.7, 'trabajar de menos también aburre');
  // renuncia tras 3 días muy descontento
  let quitter = { ...e, wage: 30, happiness: 0.2, lowDays: 2 };
  r = dayEndEmployee(quitter, 110, { load: 2 });
  assert.ok(r.quit, 'tres días descontento = renuncia');
});

test('xpForLevel: curva creciente hasta nivel 10', () => {
  for (let l = 2; l <= 10; l++) assert.ok(xpForLevel(l) > xpForLevel(l - 1));
  assert.equal(MAX_LEVEL, 10);
});

test('expectedWage: un experto de nivel 10 espera cobrar más', () => {
  const novato = expectedWage({ workMultiplier: 1, level: 1, availability: 'Jornada completa' }, 110);
  const experto = expectedWage({ workMultiplier: 1, level: 10, availability: 'Jornada completa' }, 110);
  assert.ok(experto > novato * 1.5, 'el talento cuesta: el experto espera bastante más');
});

/* ---------- 5. Parejas: regla de oro (barra clásica) ---------- */
function freshCoupleDay() {
  Game.mode = 'service';
  Game.floor = null;
  Game.floaters = [];
  Game.t = 10;
  Game.hour = 12;
  Game.closing = false;
  Game.closeT = 0;
  Game.day = 6;
  Game.spawnAcc = 0;
  Game.staff = {};
  Game.upgrades = { ...Game.upgrades, workforce: { team: {}, batch: -1, applicants: [], priority: {} } };
  Game.dayStats = { revenue: 0, served: 0, lost: 0, lostPrice: 0, lostQueue: 0, lostPatience: 0, lostStock: 0, lostClose: 0, partial: 0, noTable: 0, satSum: 0, satN: 0, sold: {}, stockOuts: {}, tips: 0, combos: 0, tipsP: 0, regVisits: 0, visits: [], usedNames: new Set(), staffWork: {}, by: {} };
  Game.stock = { papas: 50, cerveza: 50, barraquito: 50, batido: 50, queso: 50, pescado: 50 };
  Game.prices = { papas: 4, cerveza: 3, barraquito: 3, batido: 4, queso: 5, pescado: 7 };
  Game.enabled = { papas: true, cerveza: true, barraquito: true, batido: true, queso: true, pescado: true };
  Game.slots = [{ who: 'p1', station: 'all', cust: null, items: [], t: 0, total: 0, think: 0 }];
  Game.customers = [];
  Game.tables = [
    { x: 600, y: 528 }, { x: 748, y: 528 }, { x: 896, y: 528 },
  ].map(t => ({ ...t, state: 'free', cust: null }));
  Game.mods = {};
  Game.regulars = {}; Game.regVisited = {};
  Net.role = 'solo'; Net.peer = null;
}

test('las parejas llegan juntas y ocupan dos puestos contiguos', () => {
  freshCoupleDay();
  let couple = null;
  for (let i = 0; i < 200 && !couple; i++) {
    const before = Game.customers.length;
    const c = spawnCustomer();
    if (c && c.partnerId != null && Game.customers.length > before && c.spot >= 0) {
      const mate = Game.customers.find(x => x.id === c.partnerId);
      if (mate) { couple = [c, mate]; break; }
    }
    if (Game.customers.filter(x => x.spot >= 0).length >= 5) Game.customers = [];
  }
  assert.ok(couple, 'en 200 intentos llega alguna pareja');
  const [a, b] = couple;
  assert.equal(a.partnerId, b.id);
  assert.equal(b.partnerId, a.id);
  assert.ok(Math.abs(a.spot - b.spot) === 1, `puestos contiguos (${a.spot}, ${b.spot})`);
  assert.ok(a.order.length >= 1 && b.order.length >= 1, 'cada una pide lo suyo');
});

test('si una de la pareja se harta, se van las dos', () => {
  freshCoupleDay();
  let couple = null;
  for (let i = 0; i < 200 && !couple; i++) {
    const c = spawnCustomer();
    if (c && c.partnerId != null && c.spot >= 0) {
      const mate = Game.customers.find(x => x.id === c.partnerId);
      if (mate && mate.spot >= 0) { couple = [c, mate]; break; }
    }
    if (Game.customers.filter(x => x.spot >= 0).length >= 5) Game.customers = [];
  }
  const [a, b] = couple;
  // a pierde toda la paciencia en la cola
  a.patience = 0; a.graceT = 0; a.anger = 3;
  const pulled = coupleAbandon(a);
  assert.equal(pulled, true, 'la pareja se va con quien se hartó');
  assert.equal(b.state, 'leave');
  assert.equal(b.coupleGone, true);
});

test('para ir a la mesa, atienden a las dos: la primera espera a su pareja', () => {
  freshCoupleDay();
  let couple = null;
  for (let i = 0; i < 200 && !couple; i++) {
    const c = spawnCustomer();
    if (c && c.partnerId != null && c.spot >= 0) {
      const mate = Game.customers.find(x => x.id === c.partnerId);
      if (mate && mate.spot >= 0) { couple = [c, mate]; break; }
    }
    if (Game.customers.filter(x => x.spot >= 0).length >= 5) Game.customers = [];
  }
  const [a, b] = couple;
  // sirven a "a" por completo (con mesa libre) pero "b" sigue en cola
  a.state = 'prep'; a.inPrep = 0; a.missing = 0;
  a.order = ['cerveza']; a.itemSt = [2]; a.served = ['cerveza']; a.asked = ['cerveza'];
  a.floorTableId = null; a.floorPrices = null; a.partT = {}; a.personality = 'tranquilo';
  completeOrder(a);
  assert.equal(a.state, 'waitPartner', 'la atendida espera a su pareja');
  // ahora sirven a "b": las dos van a la mesa (la misma)
  b.state = 'prep'; b.inPrep = 0; b.missing = 0;
  b.order = ['cerveza']; b.itemSt = [2]; b.served = ['cerveza']; b.asked = ['cerveza'];
  b.floorTableId = null; b.floorPrices = null; b.partT = {}; b.personality = 'tranquilo';
  completeOrder(b);
  assert.ok(['toTable', 'eat', 'waitTable'].includes(b.state), 'la segunda ya avanza');
  assert.ok(a.state === 'toTable' || a.state === 'eat', `la primera ya no espera (${a.state})`);
  if (a.table && b.table) assert.equal(a.table, b.table, 'comparten la misma mesa');
});

test('payAndSeat sienta a la pareja en lados opuestos de la misma mesa', () => {
  freshCoupleDay();
  const t = Game.tables[0];
  const a = { id: 101, partnerId: 102, served: ['cerveza'], sat: 0.9, subs: {}, order: ['cerveza'] };
  const b = { id: 102, partnerId: 101, served: ['cerveza'], sat: 0.9, subs: {}, order: ['cerveza'] };
  payAndSeat(a, 3, 0.9, t);
  assert.equal(t.cust, a);
  payAndSeat(b, 3, 0.9, t);
  assert.equal(t.cust2, b, 'la pareja ocupa el segundo lado de la mesa');
  assert.ok(Math.abs(a.tx - b.tx) > 50, 'se sientan en lados opuestos');
});
