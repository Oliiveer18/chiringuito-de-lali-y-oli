/* v29.5.2: relé público de respaldo. Si la conexión directa WebRTC no
   consigue abrirse (dos móviles en redes distintas con NAT estricto, el
   caso que ningún STUN resuelve y los TURN gratuitos han muerto), la
   partida viaja por un broker MQTT público anónimo: gratis, sin cuentas
   y sin configurar nada. Solo viaja estado del juego (nada personal) por
   un topic derivado del código de la sala, y el relé se usa ÚNICAMENTE
   cuando la directa no llega: si la directa funciona, el relé se apaga.

   Protocolo: MQTT 3.1.1 mínimo (CONNECT/SUBSCRIBE/PUBLISH QoS0/PINGREQ)
   sobre WebSocket binario — implementado a mano, sin dependencias. */
import { Net } from './state.js?v=29.5.3';

/* ---------- códec MQTT 3.1.1 (probado contra broker.emqx.io en vivo) ---------- */
const mstr = s => { const b = new TextEncoder().encode(s); const out = new Uint8Array(2 + b.length); out[0] = b.length >> 8; out[1] = b.length & 255; out.set(b, 2); return out; };
const mlen = n => { const out = []; do { let b = n % 128; n = Math.floor(n / 128); if (n) b |= 128; out.push(b); } while (n); return new Uint8Array(out); };
const mpkt = (type, flags, body) => { const u8 = body instanceof Uint8Array ? body : new Uint8Array(body); const out = new Uint8Array(1 + mlen(u8.length).length + u8.length); out[0] = (type << 4) | flags; out.set(mlen(u8.length), 1); out.set(u8, 1 + mlen(u8.length).length); return out; };
const enc = { CONNECT: (id, keep = 60) => mpkt(1, 0, [0, 4, 77, 81, 84, 84, 4, 2, keep >> 8, keep & 255, ...mstr(id)]), SUBSCRIBE: (pid, topic) => mpkt(8, 2, [pid >> 8, pid & 255, ...mstr(topic), 0]), PUBLISH: (topic, payload) => mpkt(3, 0, [...mstr(topic), ...new TextEncoder().encode(payload)]), PINGREQ: () => mpkt(12, 0, new Uint8Array(0)) };

/** Parser de tramas MQTT: acepta varios paquetes en un mismo frame WebSocket. */
export function parseMqtt(buf){
  const u8 = buf instanceof Uint8Array ? new Uint8Array(buf) : new Uint8Array(buf);
  const out = []; let i = 0;
  const dec = new TextDecoder();
  while (i < u8.length){
    const type = u8[i] >> 4;
    let mult = 1, len = 0, j = i + 1;
    for (;;){ const b = u8[j++]; len += (b & 127) * mult; mult *= 128; if (!(b & 128)) break; }
    const body = u8.subarray(j, j + len);
    if (type === 3){ const tl = body[0] << 8 | body[1]; out.push({ type:'publish', topic: dec.decode(body.subarray(2, 2 + tl)), payload: dec.decode(body.subarray(2 + tl)) }); }
    else out.push({ type });
    i = j + len;
  }
  return out;
}

/* ---------- conjunto de brokers públicos (respaldo en cascada) ----------
   Verificados vivos al publicar esta versión; el canal prueba en orden y
   recuerda en sessionStorage el último que funcionó. */
export const RELAY_BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.connectmq.com:8084/mqtt',
  'wss://broker.freemqtt.com:8084/mqtt',
];
const RELAY_KEY = 'lali-oli.relay-broker';
function brokerStartIdx(){
  try { const v = parseInt(sessionStorage.getItem(RELAY_KEY), 10); if (v >= 0 && v < RELAY_BROKERS.length) return v; } catch (e) {}
  return 0;
}
function saveBrokerIdx(i){ try { sessionStorage.setItem(RELAY_KEY, String(i)); } catch (e) {} }

/* ---------- canal de relé: misma forma que el enlace directo ----------
   Eventos: 'open' (la pareja está al otro lado), 'data' (mensaje JSON),
   'close' (pérdida definitiva) y 'failed' (ningún broker responde).
   send() omite los snapshots periódicos si el canal va saturado. */
export function openRelay(code, role, opts = {}){
  const Socket = opts.socketFactory || ((u, p) => new globalThis.WebSocket(u, p));
  const base = 'chiringuito29/' + String(code || '').toUpperCase();
  const myTopic = role === 'host' ? base + '/h2g' : base + '/g2h';
  const theirTopic = role === 'host' ? base + '/g2h' : base + '/h2g';
  const handlers = {};
  const on = (ev, fn) => { (handlers[ev] ??= []).push(fn); };
  const emit = (ev, ...a) => { for (const fn of handlers[ev] || []) fn(...a); };

  let ws = null, brokerIdx = brokerStartIdx(), opened = false, done = false;
  let heartbeat = null, watchdog = null, helloTimer = null, lastMsg = 0, retryTimer = null, tries = 0;

  const cleanup = () => { clearInterval(heartbeat); clearInterval(watchdog); clearInterval(helloTimer); clearTimeout(retryTimer); };
  const close = () => { if (done) return; done = true; cleanup(); try { ws && ws.close(); } catch (e) {} emit('close'); };
  const send = o => {
    if (done) return;
    if (o && o.t === 'state' && ws && ws.bufferedAmount > 65536) return; // saturado: el snapshot siguiente llega en 150 ms
    if (ws && ws.readyState === 1) ws.send(enc.PUBLISH(myTopic, typeof o === 'string' ? o : JSON.stringify(o)));
  };

  const bind = sock => {
    ws = sock;
    sock.binaryType = 'arraybuffer';
    sock.onopen = () => { try { sock.send(enc.CONNECT('lalioli-' + role + '-' + Math.random().toString(36).slice(2, 10))); } catch (e) { failBroker(); } };
    sock.onerror = () => { if (!done && ws === sock) failBroker(); };
    sock.onclose = () => { if (done || ws !== sock) return; scheduleReconnect(); };
    sock.onmessage = ev => {
      lastMsg = Date.now();
      for (const p of parseMqtt(ev.data)){
        if (p.type === 2){ sock.send(enc.SUBSCRIBE(1, theirTopic)); }                    // CONNACK → suscribo
        else if (p.type === 9){                                                          // SUBACK → canal listo
          saveBrokerIdx(brokerIdx); tries = 0;
          /* latidos: los brokers públicos sueltan a los clientes callados;
             PINGREQ cada 25 s y vigilancia de silencio de 75 s */
          clearInterval(heartbeat);
          heartbeat = setInterval(() => { if (ws === sock && ws.readyState === 1) { try { ws.send(enc.PINGREQ()); } catch (e) {} } }, 25000);
          clearInterval(watchdog);
          watchdog = setInterval(() => { if (ws === sock && lastMsg && Date.now() - lastMsg > 75000) scheduleReconnect(); }, 30000);
          if (role === 'guest' && !opened){ helloTimer = setInterval(() => { if (!opened) send({ t: 'hello', name: Net.names.p2 }); }, 2000); send({ t: 'hello', name: Net.names.p2 }); }
        }
        else if (p.type === 'publish' && p.topic === theirTopic && p.payload){            // mensaje de la pareja
          if (!opened){ opened = true; clearInterval(helloTimer); emit('open'); }
          let m; try { m = JSON.parse(p.payload); } catch (e) { continue; }
          emit('data', m);
        }
      }
    };
  };

  const failBroker = () => {
    if (done) return;
    const old = ws; ws = null;
    try { old && old.close(); } catch (e) {}
    cleanup();
    const next = (brokerIdx + 1) % RELAY_BROKERS.length;
    if (next === brokerStartIdx()){ emit('failed'); done = true; return; } // vuelta completa: ninguno vivo
    brokerIdx = next;
    dial(600);
  };
  const scheduleReconnect = () => {
    cleanup();
    if (done) return;
    tries++;
    const delay = Math.min(8000, 800 * 2 ** Math.min(tries, 4));
    retryTimer = setTimeout(dial, delay);
  };
  const dial = (delay = 0) => {
    if (done) return;
    retryTimer = setTimeout(() => {
      if (done) return;
      let sock;
      try { sock = Socket(RELAY_BROKERS[brokerIdx], 'mqtt'); } catch (e) { failBroker(); return; }
      const kill = setTimeout(() => { if (ws !== sock) { try { sock.close(); } catch (e) {} } else failBroker(); }, 6000);
      sock.addEventListener('open', () => clearTimeout(kill), { once: true });
      bind(sock);
    }, delay);
  };
  dial();

  return { on, send, close, get open(){ return opened; }, get relay(){ return true; } };
}
