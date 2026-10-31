/* Pruebas de las hamacas de alquiler (v29.4.2-3, contrato de juego):
   - el bañista decide alquilar y PAGA POR ADELANTADO precio × horas al
     tumbarse (no al irse, ni por sesiones sueltas);
   - se queda exactamente las horas pagadas (ni un segundo más) y se levanta;
   - al cierre, todo el mundo se levanta;
   - el ingreso y el alquiler quedan contabilizados.
   El modelo es puro (beach-model.mjs), así que se prueba sin DOM.
   Uso: node hamacas.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const v = readFileSync(new URL('./version.js', import.meta.url), 'utf8').match(/VERSION='v([^']+)'/)[1];
const bm = await import(`./beach-model.mjs?v=${v}`);

test('v29.4.3: con 20 minutos de playa nadie alquila (no pagan 3 h para quedarse 20 min)', () => {
  assert.equal(bm.decideSession(3, 20 / 60), null, 'quedan 20 minutos: no alquila');
  assert.equal(bm.decideSession(0.5, 0.3), null, 'aunque sea baratísimo, con 18 min no alquila');
  assert.equal(bm.decideSession(3, 0.9), null, 'con menos de una hora no alquila');
});

test('v29.4.3: la estancia va en medias horas y nunca supera el tiempo restante', () => {
  // con una hora justa de playa: media hora (lo único sensato que cabe)
  assert.equal(bm.decideSession(3, 1, () => 0.99), 0.5);
  // con el día entero por delante y precio de referencia: hasta 2,5 h
  assert.equal(bm.decideSession(3, 8, () => 0.99), 2);
  assert.equal(bm.decideSession(1, 8, () => 0.99), 3, 'con la hamaca barata, sí hay quien se queda 3 h');
  // invariante: para cualquier momento y precio, la sesión cabe entera antes del cierre
  for (let i = 0; i < 500; i++) {
    const price = 0.5 + Math.random() * 11.5;
    const remaining = 0.5 + Math.random() * 10;
    const h = bm.decideSession(price, remaining);
    if (h == null) continue;
    assert.ok(h >= bm.MIN_SESSION, 'mínimo media hora');
    assert.ok(Math.abs(h * 2 - Math.round(h * 2)) < 1e-9, `medias horas exactas (${h})`);
    assert.ok(h <= remaining - bm.WALK_TIME - bm.CLOSE_MARGIN + 1e-9,
      `la estancia (${h}) + paseo + margen cabe en lo que queda (${remaining})`);
    assert.ok(h <= bm.MAX_SESSION, 'máximo 3 h');
  }
});

test('v29.4.3: en la simulación, una hamaca libre no alquila a menos de una hora del cierre', () => {
  let s = bm.createBeach(1, 10);
  s.slots[0] = { ...s.slots[0], next: 10 }; // lista para alquilar ya
  // 20 minutos para el cierre (cierra a las 20, son las 19:40)
  for (let i = 0; i < 30; i++) {
    const out = bm.stepBeach(s, 19.67 + i / 3600, false, 'sol', 20, 1); // precio regalado
    s = out.state;
    assert.equal(s.slots[0].state, 'free', 'con 20 min de playa nadie se tumba');
  }
});

test('al tumbarse, el bañista paga por adelantado precio × horas exactas', () => {
  const price = 3.5;
  let s = bm.createBeach(1, 10);
  // bañista en camino que ha decidido 2 horas de estancia
  s.slots[0] = { ...s.slots[0], state: 'arriving', started: 10, end: 10.12, hours: 2,
    guest: { shirt: '#0f8b8d', skin: '#e0a97e', hair: '#2a211c', hat: null } };
  let out = bm.stepBeach(s, 10.13, false, 'sol', 20, price);
  assert.equal(out.state.slots[0].state, 'occupied', 'debe quedar tumbado');
  assert.equal(out.events.length, 1, 'un cobro exacto');
  const e = out.events[0];
  assert.equal(e.hours, 2, 'horas contratadas');
  assert.ok(Math.abs(e.amount - price * 2) < 1e-9, `ingreso = precio × horas (${e.amount} = ${price}×2)`);
  assert.equal(out.state.income, e.amount, 'el ingreso queda contabilizado');
  assert.equal(out.state.rentals, 1, 'el alquiler queda contabilizado');
});

test('se queda exactamente las horas pagadas y se levanta al terminar (ni un segundo más)', () => {
  let s = bm.createBeach(1, 10);
  s.slots[0] = { ...s.slots[0], state: 'occupied', started: 10, end: 12, hours: 2,
    guest: { shirt: '#0f8b8d', skin: '#e0a97e', hair: '#2a211c', hat: null } };
  // un segundo antes de las 12:00 sigue tumbado
  let out = bm.stepBeach(s, 12 - 1 / 3600, false, 'sol', 20, 3);
  assert.equal(out.state.slots[0].state, 'occupied', 'aún dentro del tiempo pagado sigue tumbado');
  // a las 12:00 en punto se levanta
  out = bm.stepBeach(out.state, 12, false, 'sol', 20, 3);
  assert.equal(out.state.slots[0].state, 'leaving', 'al agotarse las horas pagadas se levanta');
  // y termina yéndose (la hamaca queda libre)
  out = bm.stepBeach(out.state, 12.2, false, 'sol', 20, 3);
  assert.equal(out.state.slots[0].state, 'free', 'la hamaca vuelve a quedar libre');
});

test('al cierre, los bañistas se levantan aunque les quede tiempo pagado', () => {
  let s = bm.createBeach(1, 10);
  s.slots[0] = { ...s.slots[0], state: 'occupied', started: 10, end: 21, hours: 11,
    guest: { shirt: '#0f8b8d', skin: '#e0a97e', hair: '#2a211c', hat: null } };
  const out = bm.stepBeach(s, 20.1, true, 'sol', 20, 3);
  assert.equal(out.state.slots[0].state, 'leaving', 'al cierre se levanta aunque haya pagado más horas');
});

test('máximo 3 sesiones por hamaca y por día', () => {
  let s = bm.createBeach(1, 10);
  s.slots[0] = { ...s.slots[0], sessions: 3 };
  const out = bm.stepBeach(s, 11, false, 'sol', 20, 3);
  // con las 3 sesiones gastadas ya no admite a nadie más (next quedó tras el cierre)
  assert.ok(out.state.slots[0].state === 'free' && out.state.slots[0].sessions === 3,
    'no alquila más allá de 3 sesiones diarias');
});
