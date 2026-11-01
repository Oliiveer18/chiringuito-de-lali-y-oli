/* v29.5.2: pruebas del relé público de respaldo (MQTT sobre WebSocket).
   Sin red real: el códec se prueba con frames sintéticos y openRelay() se
   ejercita con un WebSocket falso que simula el broker (CONNACK → SUBACK →
   PUBLISH de la pareja). También se comprueba el cableado en net-link.js. */
import { readFileSync } from 'node:fs';

globalThis.window = globalThis;
const memStore = new Map();
globalThis.sessionStorage = {
  getItem: k => (memStore.has(k) ? memStore.get(k) : null),
  setItem: (k, v) => { memStore.set(k, String(v)); },
  removeItem: k => { memStore.delete(k); }
};

const { parseMqtt, RELAY_BROKERS, openRelay } = await import('./net-relay.js?v=29.5.4');

let ok = 0, ko = 0;
const check = (name, cond, extra) => {
  if (cond) { ok++; console.log('  ok  ' + name); }
  else { ko++; console.log('  FALLO  ' + name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); }
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- códec MQTT (constructores locales, igual que el módulo) ---------- */
const mstr = s => { const b = new TextEncoder().encode(s); const out = new Uint8Array(2 + b.length); out[0] = b.length >> 8; out[1] = b.length & 255; out.set(b, 2); return out; };
const mlen = n => { const out = []; do { let b = n % 128; n = Math.floor(n / 128); if (n) b |= 128; out.push(b); } while (n); return new Uint8Array(out); };
const mpkt = (type, flags, body) => { const u8 = body instanceof Uint8Array ? body : new Uint8Array(body); const out = new Uint8Array(1 + mlen(u8.length).length + u8.length); out[0] = (type << 4) | flags; out.set(mlen(u8.length), 1); out.set(u8, 1 + mlen(u8.length).length); return out; };
const PUBLISH = (topic, payload) => mpkt(3, 0, [...mstr(topic), ...new TextEncoder().encode(payload)]);
const PINGREQ = () => mpkt(12, 0, new Uint8Array(0));

console.log('códec MQTT 3.1.1');
{
  const frames = parseMqtt(PUBLISH('chiringuito29/AB12/h2g', '{"t":"hello"}'));
  check('PUBLISH se parsea con topic y payload', frames.length === 1 && frames[0].type === 'publish' && frames[0].topic === 'chiringuito29/AB12/h2g' && frames[0].payload === '{"t":"hello"}', frames[0]);
  const two = new Uint8Array([...PUBLISH('a/b', 'x'), ...PUBLISH('c/d', 'yy')]);
  const frames2 = parseMqtt(two);
  check('varios paquetes en un mismo frame WebSocket', frames2.length === 2 && frames2[0].topic === 'a/b' && frames2[1].payload === 'yy', frames2);
  const big = PUBLISH('a/b', 'z'.repeat(300)); // longitud > 127: varint de 2 bytes
  const frames3 = parseMqtt(big);
  check('cuerpo largo (varint de longitud)', frames3.length === 1 && frames3[0].payload.length === 300);
  check('PINGREQ genera paquete de 2 bytes', PINGREQ().length === 2);
  check('paquetes de control sin cuerpo se parsean', parseMqtt(PINGREQ())[0].type === 12);
}

/* ---------- WebSocket falso que hace de broker ---------- */
class FakeWS {
  constructor(url, proto){
    this.url = url; this.protocol = proto; this.readyState = 0;
    this.binaryType = ''; this.sent = []; this.bufferedAmount = 0;
    this._listeners = {}; this._alive = true;
  }
  addEventListener(ev, fn){ (this._listeners[ev] ??= []).push(fn); }
  _fire(ev){ for (const fn of this._listeners[ev] || []) fn(); }
  connect(){ if (this.readyState === 0 && this._alive){ this.readyState = 1; this.onopen && this.onopen(); this._fire('open'); } }
  send(data){ if (this.readyState === 1 && this._alive) this.sent.push(new Uint8Array(data)); }
  deliver(u8){ if (this._alive) this.onmessage && this.onmessage({ data: u8.buffer ? u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) : u8 }); }
  close(){ this._alive = false; this.readyState = 3; const s = this; queueMicrotask(() => { s.onclose && s.onclose(); s._fire('close'); }); }
  fail(){ this._alive = false; this.readyState = 3; const s = this; queueMicrotask(() => { s.onerror && s.onerror(); s.onclose && s.onclose(); s._fire('close'); }); }
}
const pktType = u8 => u8[0] >> 4;

console.log('openRelay: flujo completo con broker simulado (invitada)');
{
  const sockets = [];
  const relay = openRelay('AB12', 'guest', { socketFactory: (u, p) => { const s = new FakeWS(u, p); sockets.push(s); return s; } });
  const got = { open: 0, data: [], close: 0, failed: 0 };
  relay.on('open', () => got.open++);
  relay.on('data', m => got.data.push(m));
  relay.on('close', () => got.close++);
  relay.on('failed', () => got.failed++);
  await sleep(15);
  check('abre socket al primer broker', sockets.length === 1 && sockets[0].url === RELAY_BROKERS[0], sockets.map(s => s.url));
  const s = sockets[0];
  s.connect();
  check('envía CONNECT al abrir', s.sent.length === 1 && pktType(s.sent[0]) === 1);
  s.deliver(mpkt(2, 0, [0, 0])); // CONNACK
  check('CONNACK provoca SUBSCRIBE', s.sent.length === 2 && pktType(s.sent[1]) === 8);
  s.deliver(mpkt(9, 0, [0, 1, 0])); // SUBACK
  check('SUBACK → la invitada saluda al instante', s.sent.length === 3 && pktType(s.sent[2]) === 3);
  check('el saludo va al topic de invitada→anfitrión', parseMqtt(s.sent[2])[0].topic === 'chiringuito29/AB12/g2h', parseMqtt(s.sent[2])[0].topic);
  check('recuerda el broker que funcionó (sessionStorage)', memStore.get('lali-oli.relay-broker') === '0');
  check('sin mensajes de la pareja aún no hay "open"', got.open === 0);
  s.deliver(PUBLISH('chiringuito29/AB12/h2g', '{"t":"hello","name":"p2"}'));
  check('primer mensaje de la pareja dispara "open"', got.open === 1);
  check('el mensaje llega como objeto JSON', got.data.length === 1 && got.data[0].t === 'hello' && got.data[0].name === 'p2', got.data);
  check('los topicos de la propia pareja se ignoran', (() => { const n = got.data.length; s.deliver(PUBLISH('chiringuito29/AB12/g2h', '{"t":"eco"}')); return got.data.length === n; })());
  // congestión: con el canal saturado se omite el snapshot periódico pero no los eventos
  s.bufferedAmount = 100000;
  relay.send({ t: 'state', snap: 1 });
  check('snapshot omitido con canal saturado', s.sent.length === 3, s.sent.length);
  relay.send({ t: 'event', kind: 'buy' });
  check('evento urgente enviado aun saturado', s.sent.length === 4 && parseMqtt(s.sent[3])[0].payload.includes('"event"'));
  relay.close();
  check('close() avisa una sola vez y no reintenta', got.close === 1);
  await sleep(30);
  check('tras close definitivo no se reabre el socket', sockets.length === 1);
}

console.log('openRelay: fallo de broker → cascada al siguiente');
{
  const sockets = [];
  const relay = openRelay('ZZ99', 'guest', { socketFactory: (u, p) => { const s = new FakeWS(u, p); sockets.push(s); return s; } });
  const failed = []; relay.on('failed', () => failed.push(1));
  await sleep(15);
  sockets[0].connect();
  sockets[0].fail(); // broker 1 muerto
  await sleep(700);  // el relevo marca 600 ms
  check('prueba el segundo broker de la lista', sockets.length === 2 && sockets[1].url === RELAY_BROKERS[1], sockets.map(s => s.url));
  check('no declara "failed" si queda cascada', failed.length === 0);
  sockets[1].connect();
  sockets[1].fail();
  await sleep(700);
  check('tercer broker tras el segundo fallo', sockets.length === 3 && sockets[2].url === RELAY_BROKERS[2]);
  sockets[2].connect();
  sockets[2].fail();
  await sleep(700);
  check('vuelta completa: no repite el primer broker, declara fin', sockets.length === 3 && sockets[2].url === RELAY_BROKERS[2], sockets.map(s => s.url));
  check('declara "failed" cuando ningún broker responde', failed.length === 1, failed);
  relay.close();
}

/* ---------- v29.5.4: detección de interrupción y recuperación ---------- */
console.log('v29.5.4: corte de red en plena partida → aviso y recuperación');
{
  const sockets = [];
  const relay = openRelay('ST01', 'guest', {
    pingMs: 40, stallMs: 150,
    socketFactory: (u, p) => { const s = new FakeWS(u, p); sockets.push(s); return s; }
  });
  const evts = { stalled: 0, recovered: 0, data: 0 };
  relay.on('stalled', () => evts.stalled++);
  relay.on('recovered', () => evts.recovered++);
  relay.on('data', () => evts.data++);
  await sleep(15);
  sockets[0].connect();
  sockets[0].deliver(mpkt(2, 0, [0, 0])); // CONNACK
  sockets[0].deliver(mpkt(9, 0, [0, 1, 0])); // SUBACK
  await sleep(60);
  const sentPub = () => sockets.flatMap(s => s.sent.map(u8 => parseMqtt(u8)[0])).filter(p => p && p.type === 'publish');
  check('envía pings de aplicación por el topic propio', sentPub().some(p => p.topic === 'chiringuito29/ST01/g2h' && p.payload.includes('__laliNet')));
  sockets[0].deliver(PUBLISH('chiringuito29/ST01/h2g', '{"t":"hello","name":"p2"}'));
  await sleep(20);
  check('recibe datos de la pareja', evts.data === 1);
  check('con flujo normal no hay aviso de corte', evts.stalled === 0);
  // la red se corta: la pareja deja de llegar (socket ciego/negro)
  await sleep(300); // > stallMs (150 ms)
  check('silencio de red → aviso de interrupción (stalled)', evts.stalled === 1, evts);
  // el socket muerto se cierra y se reintenta con retroceso
  await sleep(1800); // primer reintento: 1,6 s
  check('reintenta con un socket nuevo', sockets.length === 2, sockets.length);
  sockets[1].connect();
  sockets[1].deliver(mpkt(2, 0, [0, 0])); // CONNACK
  sockets[1].deliver(mpkt(9, 0, [0, 1, 0])); // SUBACK
  sockets[1].deliver(PUBLISH('chiringuito29/ST01/h2g', '{"t":"hello","name":"p2"}'));
  await sleep(30);
  check('al volver el flujo de datos → recovered', evts.recovered === 1, evts);
  check('el aviso no se repite en cada tick', evts.stalled === 1, evts);
  // los pings de la pareja no llegan al juego y se responden con pong
  const dataBefore = evts.data;
  sockets[1].deliver(PUBLISH('chiringuito29/ST01/h2g', '{"__laliNet":"ping"}'));
  await sleep(20);
  check('los pings de la pareja no llegan al juego', evts.data === dataBefore);
  const pong = sockets[1].sent.map(u8 => parseMqtt(u8)[0]).filter(p => p && p.type === 'publish' && p.payload.includes('"__laliNet":"pong"'));
  check('responde a los pings con pong', pong.length >= 1);
  relay.close();
}

/* ---------- cableado del relé en el juego ---------- */
console.log('cableado en net-link.js / net-sync.js / state.js');
{
  const netLinkSrc = readFileSync('net-link.js', 'utf8');
  const netSyncSrc = readFileSync('net-sync.js', 'utf8');
  const stateSrc = readFileSync('state.js', 'utf8');
  check('importa openRelay desde net-relay', /import \{ openRelay \} from '\.\/net-relay\.js\?v=/.test(netLinkSrc));
  check('hostListen arranca el relé de la sala', /hostRelayStart\(code\)/.test(netLinkSrc));
  check('guestJoin programa el respaldo a los 6 s', /relayFallbackTimer = setTimeout/.test(netLinkSrc) && /\}, 6000\);/.test(netLinkSrc));
  check('leaveCoop y goSolo apagan el relé', (netLinkSrc.match(/stopRelay\(\);/g) || []).length >= 3);
  check('la directa ganadora cierra el relé', /if \(c !== relayLink\) stopRelay\(\);/.test(netLinkSrc));
  check('el close del enlace directo respeta al relé', /if \(conn !== c\) return;/.test(netLinkSrc));
  // v29.5.3: la invitada debe ENRUTAR los datos del relé a onNet (sin esto se
  // conectaba pero nunca recibía los snapshots: se quedaba en "esperando…")
  check('la invitada enruta los datos del relé a onNet', (netLinkSrc.match(/rl\.on\('data', d => \{ if \(conn === rl\) \{ try \{ onNet\(d\); \} catch \(e\) \{\} \} \}\);/g) || []).length >= 2, 'host y guest deben tenerlo');
  check('la invitada no reintenta la directa si el relé ya ganó', /if \(relayLink && relayLink\.open\) return;/.test(netLinkSrc));
  // v29.5.4: el corte de red por relé se avisa y se recupera como en la directa
  check('el relé cortado avisa y pausa (relayStall)', /rl\.on\('stalled', \(\) => \{ if \(conn === rl\) relayStall\(true\); \}\);/.test(netLinkSrc));
  check('el relé recuperado reanuda la partida', /rl\.on\('recovered', \(\) => \{ if \(conn === rl\) relayStall\(false\); \}\);/.test(netLinkSrc));
  check('relayStall pausa y avisa', /function relayStall\(on\)/.test(netLinkSrc) && /netLostInfo\('Conexión interrumpida/.test(netLinkSrc));
  check('conn solo se asigna cuando el enlace directo abre de verdad', !/conn = peer\.connect/.test(netLinkSrc) && !/connection: c => \{\s*\n\s*conn = c;/.test(netLinkSrc));
  check('snapshots por relé a 6,7 Hz en servicio', /Net\.relay\?0\.15:0\.08/.test(netSyncSrc));
  check('state.js marca Net.relay', /relay:false/.test(stateSrc));
}

console.log('\nRelé público: ' + ok + ' ok, ' + ko + ' fallos');
if (ko > 0) process.exit(1);
