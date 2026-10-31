/* v29.0.0: tests de geometría de la cámara unificada (camera.js).
   Reglas de oro que este archivo protege:
   1. El mundo no crece, crece el kiosco: el encuadre nunca recorta más de
      MAX_SKY_CROP de cielo ni invade la banda jugable protegida (rótulo y≈186
      → suelo y=720) por debajo del HUD.
   2. En horizontal, el kiosco (parcela x 40–540) no queda pegado al borde
      izquierdo: hay margen de playa a ambos lados.
   3. En vertical, modo 'todo': comportamiento histórico exacto (encaja ancho).
   4. Los modos barra/mesas funcionan en AMBAS orientaciones y centran su eje.
   Uso: node camera.test.mjs */
import assert from 'node:assert/strict';
import { computeView, setCamMode, camMode, GEO, CAM_MODES } from './camera.js?v=29.1.0';

const { W, H } = GEO;
const ok = (name, fn) => { try { fn(); console.log('ok -', name); } catch (e) { console.error('FAIL:', name, '\n', e.message); process.exitCode = 1; } };

/* helper: rectángulo del mundo visible a partir del encuadre (px CSS).
   Devuelve las coordenadas de mundo en los bordes del viewport. */
function worldRect(v, vw, vh){
  return { x0: -v.ox / v.s, x1: (vw - v.ox) / v.s, y0: -v.oy / v.s, y1: (vh - v.oy) / v.s };
}

/* ---------- 1. Vertical 'todo': comportamiento histórico ---------- */
ok('vertical todo: encaja exactamente el ancho del mundo', () => {
  setCamMode('todo');
  const v = computeView({ width: 390, height: 844, top: 40, bottom: 60, portrait: true });
  assert.ok(Math.abs(v.s - 390 / W) < 1e-9, `s esperado 390/W, got ${v.s}`);
});
ok('vertical todo: el mundo entero es visible horizontalmente', () => {
  const v = computeView({ width: 390, height: 844, top: 40, bottom: 60, portrait: true });
  const r = worldRect(v, 390, 844);
  assert.ok(Math.abs(r.x0) < 1e-6 && Math.abs(r.x1 - W) < 1e-6, `x visible [${r.x0}, ${r.x1}]`);
});
ok('vertical todo: sin HUD el encuadre no desplaza el mundo verticalmente', () => {
  const v = computeView({ width: 390, height: 844, portrait: true });
  const r = worldRect(v, 390, 844);
  // el mundo cabe entero (arriba/abajo se extiende cielo y arena)
  assert.ok(r.y0 <= 1e-6 && r.y1 >= H - 1e-6, `y visible [${r.y0}, ${r.y1}]`);
});

/* ---------- 2. Horizontal: margen a ambos lados, kiosco no pegado ---------- */
ok('horizontal todo: el kiosco no queda pegado al borde izquierdo (móvil)', () => {
  setCamMode('todo');
  // iPhone-ish en horizontal: 844×390, HUD 40px
  const v = computeView({ width: 844, height: 390, top: 40, portrait: false });
  const r = worldRect(v, 844, 390);
  // px desde el borde izquierdo de pantalla hasta la parcela del kiosco
  const parcelLeftPx = (GEO.PARCEL.x0 - r.x0) * v.s;
  const parcelRightPx = (r.x1 - GEO.PARCEL.x1) * v.s;
  assert.ok(parcelLeftPx >= 24, `margen izquierdo ${parcelLeftPx.toFixed(1)}px < 24px`);
  assert.ok(parcelRightPx >= 24, `margen derecho ${parcelRightPx.toFixed(1)}px < 24px`);
});
ok('horizontal todo: el mundo completo sigue visible (no se recorta contenido)', () => {
  const v = computeView({ width: 844, height: 390, top: 40, portrait: false });
  const r = worldRect(v, 844, 390);
  assert.ok(r.x0 <= 0 + 1e-6, `se recorta la izquierda del mundo: x0=${r.x0}`);
  assert.ok(r.x1 >= W - 1e-6, `se recorta la derecha del mundo: x1=${r.x1}`);
});
ok('horizontal todo: nunca se recorta más cielo del máximo', () => {
  const v = computeView({ width: 844, height: 390, top: 40, portrait: false });
  const r = worldRect(v, 844, 390);
  assert.ok(r.y0 >= -GEO.MAX_SKY_CROP - 1e-6, `cielo recortado ${-r.y0.toFixed(1)} > ${GEO.MAX_SKY_CROP}`);
});
ok('horizontal todo: la banda protegida cabe bajo el HUD', () => {
  // altura ajustada para forzar el límite: si el HUD come la banda, salta
  const v = computeView({ width: 844, height: 300, top: 80, portrait: false });
  const r = worldRect(v, 844, 300);
  assert.ok(r.y1 >= H - 1e-6, `el suelo del mundo no es visible: y1=${r.y1}`);
  assert.ok(r.y0 <= GEO.BAND_TOP + 1e-6, `el rótulo queda fuera: y0=${r.y0}`);
});
ok('horizontal todo: escritorio muy ancho, mundo centrado con playa extra', () => {
  const v = computeView({ width: 1600, height: 900, portrait: false });
  const r = worldRect(v, 1600, 900);
  assert.ok(r.x0 < 0 && r.x1 > W, `se esperaba playa a ambos lados, x=[${r.x0}, ${r.x1}]`);
  assert.ok(Math.abs(r.x0 + r.x1 - W) < 1e-6, `mundo no centrado: x=[${r.x0}, ${r.x1}]`);
});

/* ---------- 3. Modos barra/mesas en ambas orientaciones ---------- */
ok('barra: el eje del kiosco queda en el centro de la pantalla (vertical)', () => {
  setCamMode('barra');
  const v = computeView({ width: 390, height: 844, top: 40, bottom: 60, portrait: true });
  const r = worldRect(v, 390, 844);
  assert.ok(Math.abs((r.x0 + r.x1) / 2 - CAM_MODES.barra.cx) < 1e-6, `centro x=${(r.x0 + r.x1) / 2}`);
});
ok('barra: el eje del kiosco queda en el centro de la pantalla (horizontal)', () => {
  const v = computeView({ width: 844, height: 390, top: 40, portrait: false });
  const r = worldRect(v, 844, 390);
  assert.ok(Math.abs((r.x0 + r.x1) / 2 - CAM_MODES.barra.cx) < 1e-6, `centro x=${(r.x0 + r.x1) / 2}`);
});
ok('mesas: el eje de las mesas queda en el centro (horizontal)', () => {
  setCamMode('mesas');
  const v = computeView({ width: 844, height: 390, top: 40, portrait: false });
  const r = worldRect(v, 844, 390);
  assert.ok(Math.abs((r.x0 + r.x1) / 2 - CAM_MODES.mesas.cx) < 1e-6);
});
ok('mesas: el mundo visible cabe entero en vertical dentro del span', () => {
  const v = computeView({ width: 390, height: 844, top: 40, bottom: 60, portrait: true });
  const r = worldRect(v, 390, 844);
  assert.ok(r.y0 <= 1e-6 && r.y1 >= H - 1e-6, `y=[${r.y0}, ${r.y1}]`);
});
ok('zoom: la parcela del kiosco no se sale por la izquierda en horizontal', () => {
  setCamMode('barra');
  const v = computeView({ width: 844, height: 390, top: 40, portrait: false });
  const r = worldRect(v, 844, 390);
  assert.ok(r.x0 <= GEO.PARCEL.x0 - 20, `parcela cortada: x0=${r.x0}`);
});

/* ---------- 4. Estado y constantes ---------- */
ok('setCamMode/camMode: cambia y valida el modo', () => {
  setCamMode('barra'); assert.equal(camMode(), 'barra');
  setCamMode('nonsense'); assert.equal(camMode(), 'barra'); // ignora modos inválidos
  setCamMode('todo'); assert.equal(camMode(), 'todo');
});
ok('geometría protegida: valores del mundo intactos', () => {
  assert.equal(GEO.W, 1280); assert.equal(GEO.H, 720);
  assert.equal(GEO.BAND_TOP, 186); assert.equal(GEO.MAX_SKY_CROP, 140);
  assert.deepEqual(GEO.PARCEL, { x0: 40, x1: 540 });
});
ok('safe areas laterales: se respetan y no rompen los márgenes', () => {
  setCamMode('todo');
  const v = computeView({ width: 844, height: 390, top: 40, portrait: false, safeL: 20, safeR: 20 });
  const r = worldRect(v, 844, 390);
  const parcelLeftPx = (GEO.PARCEL.x0 - r.x0) * v.s;
  assert.ok(parcelLeftPx >= 20, `margen izquierdo ${parcelLeftPx.toFixed(1)}px`);
  assert.ok(r.x0 <= 0 + 1e-6 && r.x1 >= W - 1e-6, 'mundo completo visible');
});

setCamMode('todo');
console.log(process.exitCode ? 'camera.test FALLÓ' : 'camera.test OK');
