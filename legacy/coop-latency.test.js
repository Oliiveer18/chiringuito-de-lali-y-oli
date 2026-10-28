'use strict';
/* =========================================================
   Test de cooperativo con LATENCIA REAL de red.
   - Carga el juego como módulos ES (game.js → js/) en dos contextos
     vm (anfitrión e invitado), enlazando los imports con un enlazador
     local: así se ejercitan los módulos reales, no una concatenación.
   - Los conecta por un relay WebSocket de verdad (TCP en localhost)
     que retrasa cada mensaje un tiempo configurable: el modelo
     anfitrión-autoritativo se ejercita con red lenta, no con colas simuladas.
   - Comprueba: indicador "acción enviada", acks explícitos, rechazos,
     limpieza autoritativa (nada de limpiar en local), debounce,
     caducidad "Sin confirmación", latencia simulada NET_SIM y que el
     invitado sigue renderizando con un puesto ocupado (slot.items).

   EJECUCIÓN (desde la carpeta del proyecto):
     npm install ws            # única dependencia
     node test/coop-latency.test.js
   (el test se relanza solo con --experimental-vm-modules para usar
    vm.SourceTextModule; el aviso experimental de Node es normal)
   Sale con código 0 y "TODOS LOS TESTS OK" (28 checks).
   ========================================================= */
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { WebSocket, WebSocketServer } = require('ws');

// vm.SourceTextModule requiere el flag; relanzarse con él es transparente
if (!process.execArgv.includes('--experimental-vm-modules')) {
  const { spawnSync } = require('child_process');
  const r = spawnSync(process.execPath, [...process.execArgv, '--experimental-vm-modules', __filename], { stdio: 'inherit' });
  process.exit(r.status === null ? 1 : r.status);
}

const GAME = path.join(__dirname, '..', 'game.js');

// ---------- stub de DOM/canvas ----------
const noop = () => {};
function makeEl(tag) {
  const el = {
    tagName: String(tag || 'div').toUpperCase(),
    dataset: {}, disabled: false, value: '', textContent: '', innerHTML: '',
    scrollTop: 0, scrollHeight: 0, onclick: null,
    style: { setProperty: noop, removeProperty: noop },
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    _h: {}, children: [],
    addEventListener(t, f) { (this._h[t] = this._h[t] || []).push(f); },
    removeEventListener: noop,
    dispatch(t, ev) { (this._h[t] || []).forEach(f => f(Object.assign({ target: this, preventDefault: noop, stopPropagation: noop }, ev))); },
    appendChild(ch) { ch._parent = this; this.children.push(ch); return ch; },
    removeChild(ch) { const i = this.children.indexOf(ch); if (i >= 0) this.children.splice(i, 1); return ch; },
    remove() { if (this._parent) this._parent.removeChild(this); },
    get firstChild() { return this.children[0] || null; },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
    getClientRects: () => [{ left: 0, top: 0, width: 1280, height: 720 }],
    closest() { return el; },
    focus: noop, blur: noop, click: noop,
  };
  return el;
}
const ctxStub = (() => {
  const t = {};
  return new Proxy(t, {
    get(trg, k) {
      if (typeof k === 'symbol') return undefined;
      if (k === 'measureText') return () => ({ width: 42 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern') return () => ({ addColorStop: noop });
      if (k === 'canvas') return {};
      if (!(k in trg)) trg[k] = noop;
      return trg[k];
    },
    set() { return true; },
  });
})();
function makeCanvas() {
  const c = makeEl('canvas'); c.width = 1280; c.height = 720;
  c.getContext = () => ctxStub;
  c.toDataURL = () => 'data:image/png;base64,TEST';
  return c;
}
function makeDocument() {
  const els = {};
  const get = id => els[id] || (els[id] = makeEl('div'));
  const doc = {
    _els: els,
    querySelector(s) { const m = /^#([\w-]+)$/.exec(s); if (m) return m[1] === 'game' ? makeCanvas() : get(m[1]); return makeEl('div'); },
    querySelectorAll: () => [],
    getElementById: id => get(id),
    createElement(tag) { if (String(tag).toLowerCase() === 'canvas') return makeCanvas(); return makeEl(tag); },
    addEventListener: noop, removeEventListener: noop,
    body: makeEl('body'), documentElement: makeEl('html'),
    fonts: { ready: Promise.resolve() },
  };
  return doc;
}
function makeSandbox() {
  const sb = {
    console, performance, setTimeout, clearTimeout, setInterval, clearInterval,
    WebSocket, URL, TextEncoder, TextDecoder, crypto,
    location: { hostname: 'localhost', href: 'http://localhost/' },
    navigator: {}, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
    addEventListener: noop, removeEventListener: noop,
    getComputedStyle: () => ({ getPropertyValue: () => '0' }),
    requestAnimationFrame(cb) { sb.__raf = cb; return 1; },
    cancelAnimationFrame: noop,
  };
  sb.window = sb; sb.self = sb;
  sb.document = makeDocument();
  return sb;
}

// ---------- relay WebSocket real con retardo configurable ----------
function startRelay(port) {
  return new Promise((resolve, reject) => {
    const wss = new WebSocketServer({ port });
    const state = { delay: 0, drop: false };
    let a = null, b = null;
    const sendTo = (ws, msg) => {
      if (state.drop) return;
      const s = JSON.stringify(msg);
      const fire = () => { if (ws.readyState === WebSocket.OPEN) ws.send(s); };
      if (state.delay > 0) setTimeout(fire, state.delay); else fire();
    };
    wss.on('listening', () => resolve({
      set: o => Object.assign(state, o),
      close: () => new Promise(r => {
        for (const c of wss.clients) try { c.terminate(); } catch (e) {}
        wss.close(() => r());
      }),
    }));
    wss.on('error', reject);
    wss.on('connection', ws => {
      if (!a) a = ws; else if (!b) b = ws; else { ws.close(); return; }
      ws.on('message', data => {
        let m; try { m = JSON.parse(data.toString()); } catch (e) { return; }
        const other = ws === a ? b : a;
        if (m.t === 'create') sendTo(ws, { t: 'created', code: 'TEST' });
        else if (m.t === 'join') {
          sendTo(ws, { t: 'joined', code: 'TEST' });
          if (a && b) { sendTo(a, { t: 'peer', on: true }); sendTo(b, { t: 'peer', on: true }); }
        } else if (other && other.readyState === WebSocket.OPEN) sendTo(other, m);
      });
      ws.on('close', () => { if (ws === a) a = null; if (ws === b) b = null; });
    });
  });
}

// ---------- utilidades del test ----------
const sleep = ms => new Promise(r => setTimeout(r, ms));
const errors = [];
async function pump(sb, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (sb.__raf) { try { sb.__raf(performance.now()); } catch (e) { errors.push(e); } }
    await sleep(5);
  }
}
async function pumpBoth(sbH, sbG, ms) { await Promise.all([pump(sbH, ms), pump(sbG, ms)]); }
// bombea ambos hasta que la condición se cumple (o agota el plazo)
async function pumpUntil(sbH, sbG, cond, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (cond()) return true;
    await Promise.all([pump(sbH, 30), pump(sbG, 30)]);
  }
  return cond();
}
let failed = 0, passed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('  FALLO  ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}

// ---------- carga de los dos clientes (módulos ES enlazados de verdad) ----------
async function loadClient() {
  const sb = makeSandbox();
  const context = vm.createContext(sb);
  const cache = new Map();
  const loadModule = file => {
    if (!cache.has(file)) {
      cache.set(file, new vm.SourceTextModule(fs.readFileSync(file, 'utf8'), { identifier: file, context }));
    }
    return cache.get(file);
  };
  const entry = loadModule(GAME);
  // enlazador local: resuelve './js/xxx.js' relativos a cada archivo
  await entry.link(async (specifier, ref) => loadModule(path.resolve(path.dirname(ref.identifier), specifier)));
  await entry.evaluate({ timeout: 30000 });
  if (!sb.__api) throw new Error('game.js no expuso window.__api tras el arranque');
  if (!sb.__test) throw new Error('game.js no expuso window.__test tras el arranque');
  return sb;
}

(async () => {
  const PORT = 8919;
  const relay = await startRelay(PORT);
  const sbH = await loadClient(), sbG = await loadClient();
  sbH.__WS_BASE__ = sbG.__WS_BASE__ = 'ws://127.0.0.1:' + PORT;
  relay.set({ delay: 120 }); // 120 ms por sentido → RTT ≈ 240 ms

  // 1) conexión por el camino real: create/join/peer
  sbH.__test.netOpen(() => sbH.__test.netSend({ t: 'create' }));
  sbG.__test.netOpen(() => sbG.__test.netSend({ t: 'join', code: 'TEST' }));
  const linked = await pumpUntil(sbH, sbG,
    () => sbH.Net.role === 'host' && sbH.Net.peer === true && sbG.Net.role === 'guest', 3000);
  check('anfitrión e invitado conectados por el relay', linked,
    { hRole: sbH.Net.role, hPeer: sbH.Net.peer, gRole: sbG.Net.role });

  // 2) empezar temporada y pasar plan → servicio con listos reales por red
  sbH.__test.newSeason(); sbH.__test.setPlanTab('compras'); sbH.__test.showPlan();
  await pumpUntil(sbH, sbG, () => sbG.Game.mode === 'plan', 2000);
  check('invitado ve la pantalla de plan', sbG.Game.mode === 'plan');
  sbH.__test.toggleReady('p1');            // anfitrión se prepara (local)
  sbG.__test.pressReady();               // invitado: mensaje real por el relay
  await pumpUntil(sbH, sbG, () => sbH.Game.mode === 'service' && sbG.Game.mode === 'service', 3000);
  check('ambos en servicio tras los listos', sbH.Game.mode === 'service' && sbG.Game.mode === 'service');
  check('botón del invitado salió de "enviado"', sbG.Net.readySent === false);

  // 3) generar clientes en el anfitrión y replicarlos
  sbH.advanceTime(20000);                // tiempo de juego: llegan clientes a la cola
  await pumpUntil(sbH, sbG, () => sbG.Game.customers.some(c => c.state === 'queue'), 2000);
  const servableOn = sb => sb.Game.customers.filter(c => c.state === 'queue' && (!c.itemSt || c.itemSt.every(s => s === 0)));
  check('hay clientes en la cola del anfitrión', servableOn(sbH).length > 0, servableOn(sbH).length);
  check('el invitado recibe los clientes', sbG.Game.customers.length > 0 && servableOn(sbG).length > 0, sbG.Game.customers.length);

  // 4) SERVE del invitado con latencia real: indicador + ack explícito
  const target = servableOn(sbG)[0];
  const gcust = target && sbG.Game.customers.find(c => c.id === target.id);
  const seq0 = sbG.Net.seq;
  if (gcust) {
    sbG.__test.guestServe(gcust);
    check('acción registrada como pendiente', sbG.Net.pend.size === 1 && sbG.Net.seq === seq0 + 1);
    await pump(sbG, 60);                  // RTT 240 ms: aún no puede haber llegado el ack
    check('indicador visible mientras viaja la acción', sbG.Net.pend.size === 1);
    await pumpUntil(sbH, sbG, () => sbG.Net.pend.size === 0, 2000);
    check('ack del anfitrión quita el pendiente', sbG.Net.pend.size === 0);
    check('latencia de acción medida (≥ 200 ms con RTT 240)', sbG.Net.confMs != null && sbG.Net.confMs >= 200, sbG.Net.confMs);
    const hostCust = sbH.Game.customers.find(c => c.id === target.id);
    check('el anfitrión aplicó la acción', hostCust && hostCust.itemSt && hostCust.itemSt.some(s => s === 1 || s === 2));
    check('el invitado sigue renderizando con puesto ocupado (arreglo slot.items)',
      sbG.Game.slots.every(s => Array.isArray(s.items)) && errors.length === 0, errors[0] && String(errors[0]));
  } else check('acción registrada como pendiente (sin cliente)', false);

  // 5) debounce: no se reenvía la misma acción mientras espera
  const t2 = servableOn(sbG)[0];
  if (t2) {
    const seq1 = sbG.Net.seq;
    sbG.__test.guestServe(sbG.Game.customers.find(c => c.id === t2.id));
    sbG.__test.guestServe(sbG.Game.customers.find(c => c.id === t2.id)); // repetido: debe ignorarse
    check('toques repetidos no duplican el envío', sbG.Net.seq === seq1 + 1 && [...sbG.Net.pend.values()].filter(p => p.key === t2.id).length === 1);
    await pumpUntil(sbH, sbG, () => sbG.Net.pend.size === 0, 2000);
  } else check('toques repetidos no duplican el envío (sin cliente)', false);

  // 6) rechazo explícito: puesto del invitado ocupado → ack ok:false + aviso
  const p2slot = sbH.Game.slots.find(s => s.who === 'p2');
  if (!p2slot.cust) {
    const o = servableOn(sbH)[0];
    if (o) sbH.__test.tryServe(sbH.Game.customers.find(c => c.id === o.id), 'p2');
  }
  const toastsEl = sbG.document._els['toasts'];
  const toasts0 = toastsEl ? toastsEl.children.length : 0;
  const t3 = servableOn(sbG).find(c => !p2slot.cust || c.id !== p2slot.cust.id);
  if (t3) {
    sbG.__test.guestServe(sbG.Game.customers.find(c => c.id === t3.id));
    await pumpUntil(sbH, sbG, () => sbG.Net.pend.size === 0, 2000);
    check('rechazo con ack (pendiente fuera)', sbG.Net.pend.size === 0);
    check('rechazo avisado al jugador', toastsEl && toastsEl.children.length > toasts0 && /no aceptada/i.test(String(toastsEl.children[toastsEl.children.length - 1].innerHTML)));
    check('el anfitrión no sirvió al cliente rechazado',
      !(sbH.Game.customers.find(c => c.id === t3.id) || { itemSt: [] }).itemSt.some(s => s === 1));
  } else check('rechazo con ack (sin cliente disponible para probar)', false);

  // 7) CLEAN del invitado: la mesa NO se limpia en local, manda el anfitrión
  sbH.Game.tables[0].state = 'dirty';
  await pumpUntil(sbH, sbG, () => sbG.Game.tables[0].state === 'dirty', 2000);
  check('invitado ve la mesa sucia', sbG.Game.tables[0].state === 'dirty');
  sbG.__test.guestClean(0);
  check('limpieza registrada como pendiente', sbG.Net.pend.size === 1);
  await pump(sbG, 60);
  check('la mesa sigue sucia en el invitado mientras espera (autoritativo)', sbG.Game.tables[0].state === 'dirty');
  await pumpUntil(sbH, sbG, () => sbG.Game.tables[0].state === 'free', 2000);
  check('el anfitrión limpió y el estado llegó', sbG.Game.tables[0].state === 'free' && sbH.Game.dayStats.cleaned >= 1);
  check('sin errores de render durante todo el flujo', errors.length === 0, errors.map(String).slice(0, 3));

  // 8) caducidad: sin respuesta del anfitrión → "Sin confirmación", no desaparece
  relay.set({ drop: true });
  sbG.__api.setPendTimeouts(300, 60000);
  const t4 = servableOn(sbG)[0];
  if (t4) {
    sbG.__test.guestServe(sbG.Game.customers.find(c => c.id === t4.id));
    await pump(sbG, 120);
    check('pendiente mientras no hay respuesta', sbG.Net.pend.size === 1);
    await pump(sbG, 400); // supera el plazo de 300 ms
    const st = sbG.__api.netStats();
    check('caduca marcada "Sin confirmación" (visible, no oculta)', st.pend.length === 1 && st.pend[0].expired === true, st.pend);
  } else check('caducidad (sin cliente disponible para probar)', false);
  sbG.__api.setPendTimeouts(2500, 10000);
  relay.set({ drop: false, delay: 120 });
  // limpiar el pendiente caducado para no interferir en el bloque siguiente
  sbG.Net.pend.clear();

  // 9) NET_SIM: latencia simulada en el propio cliente sobre la ruta real de envío
  sbG.__api.setNetLatency(150, 150, 20);
  // cliente fresco y con paciencia: se elige desde el ANFITRIÓN (autoridad),
  // que los anteriores ya han podido perder la paciencia en su simulación
  try { sbH.__test.spawnCustomer(); } catch (e) { /* sin hueco: se usa la cola actual */ }
  sbH.advanceTime(12000); // el nuevo cliente camina desde fuera de pantalla hasta la cola
  let t5 = null;
  for (let i = 0; i < 3 && !t5; i++) {
    const best = servableOn(sbH).sort((a, b) => b.patience - a.patience)[0];
    if (best) {
      await pumpUntil(sbH, sbG, () => sbG.Game.customers.some(c => c.id === best.id && c.state === 'queue'), 2500);
      t5 = sbG.Game.customers.find(c => c.id === best.id && c.state === 'queue');
    }
    if (!t5) { sbH.advanceTime(8000); await pumpBoth(sbH, sbG, 400); }
  }
  if (t5) {
    const q5 = sbG.Net.seq + 1;   // id de la acción que se va a enviar
    const tSend = performance.now();
    sbG.__test.guestServe(sbG.Game.customers.find(c => c.id === t5.id));
    await pump(sbG, 100); // 150 ms de subida: el mensaje aún no llegó al anfitrión
    check('con NET_SIM el envío tarda (sigue pendiente)', sbG.Net.pend.has(q5));
    // ack EXPLÍCITO de esa acción: no basta con que el pendiente desaparezca
    // (nada de inferir por el estado recibido)
    const acked = await pumpUntil(sbH, sbG,
      () => sbG.__api.netStats().ackLog.some(a => a.q === q5), 3000);
    const ack = sbG.__api.netStats().ackLog.find(a => a.q === q5);
    const ms5 = ack ? ack.at - tSend : -1;
    check('ack explícito de esa acción recibido y aceptado', acked && !!ack && ack.ok === true, ack);
    check('tardó RTT real + latencia simulada (≥ 450 ms)', !!ack && ms5 >= 450, Math.round(ms5));
    check('el pendiente se fue por el ack (no por inferencia)', acked && !sbG.Net.pend.has(q5));
    const st = sbG.__api.netStats();
    check('NET_SIM activa en las estadísticas', st.sim && st.sim.up === 150 && st.sim.down === 150, st.sim);
  } else check('NET_SIM (sin cliente disponible para probar)', false);
  sbG.__api.clearNetLatency();

  // resumen
  await Promise.race([relay.close(), sleep(2000)]);
  console.log('\n' + (failed ? `FALLOS: ${failed}` : 'TODOS LOS TESTS OK') + ` · superados: ${passed}`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('ERROR DEL TEST:', e); process.exit(1); });
