/* Enlace PeerJS, sala y paso a solitario. Lo importa net.js. */
import { $ } from './util.js?v=28.14.3';
import { Audio } from './audio.js?v=28.14.3';
import { Game, NET_SIM, Net } from './state.js?v=28.14.3';
import { pendingIdx, slotOf } from './sim.js?v=28.14.3';
import { showReportUI } from './report.js?v=28.14.3';
import { hideAll, setSpeed, showPlanUI, showServiceUI } from './ui.js?v=28.14.3';
import { onNet } from './net-sync.js?v=28.14.3';
import { lobbyError, lobbyStatus, renderLobby } from './net-lobby.js?v=28.14.3';
import { peerRtcConfig, peerErrorMessage } from './net-rtc.js?v=28.14.3';
export { peerRtcConfig, peerErrorMessage };
// ---------- Red: PeerJS (WebRTC) ----------
let peer = null, conn = null, joinGen = 0;
const PREFIX = 'chiringuito-lali-oli-';
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
function newCode(){ let c = ''; for (let i = 0; i < 4; i++) c += LETTERS[Math.floor(Math.random() * LETTERS.length)]; return c; }

const PEERJS_CLOUDS = [
  { host: '0.peerjs.com', port: 443, path: '/', secure: true },
  { host: 'peerjs-server.herokuapp.com', port: 443, path: '/', secure: true }
];
let cloudIdx = 0;

function peerOptions(id){
  const cloud = PEERJS_CLOUDS[cloudIdx] || PEERJS_CLOUDS[0];
  const opts = {
    debug: 0,
    ...cloud,
    config: peerRtcConfig()
  };
  if (id != null) opts.id = id;
  const custom = window.PEERJS_CONFIG;
  if (custom && typeof custom === 'object') Object.assign(opts, custom);
  return opts;
}

function connectOptions(extra = {}){
  return {
    reliable: true,
    config: peerRtcConfig(),
    ...extra
  };
}

function attachConn(c, { onOpen, onFail }){
  let opened = false;
  c.on('open', () => {
    opened = true;
    onOpen && onOpen();
  });
  c.on('data', d => { try { onNet(typeof d === 'string' ? JSON.parse(d) : d); } catch (e) {} });
  c.on('close', () => {
    conn = null;
    Net.peer = false;
    onNet({ t: 'peer', on: false });
  });
  c.on('failed', () => {
    if (!opened) onFail && onFail();
  });
}

function makePeer(id, handlers){
  if (peer) { try { peer.destroy(); } catch (e) {} peer = null; }
  peer = new Peer(peerOptions(id));
  if (handlers.open) peer.on('open', handlers.open);
  if (handlers.connection) peer.on('connection', handlers.connection);
  peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) {} });
  peer.on('error', e => {
    if (handlers.error) handlers.error(e);
    else lobbyError(peerErrorMessage(e, Net.role === 'host' ? 'host' : 'guest'));
  });
}

export function netOpen(onOpen){
  if (peer && !peer.destroyed) { onOpen(); return; }
  if (!window.Peer) { lobbyError('No se ha podido cargar el módulo de conexión (PeerJS). Recarga la página.'); return; }
  lobbyStatus('Conectando al servidor de señalización…');
  makePeer(null, {
    open: () => { lobbyStatus(''); onOpen(); },
    error: e => {
      if (cloudIdx + 1 < PEERJS_CLOUDS.length) {
        cloudIdx++;
        lobbyStatus('Reintentando con otro servidor…');
        makePeer(null, { open: () => { lobbyStatus(''); onOpen(); }, error: () => lobbyError(peerErrorMessage(e, 'guest')) });
        return;
      }
      lobbyError(peerErrorMessage(e, 'guest'));
    }
  });
}

function hostStart(attempt = 0){
  const code = newCode();
  Net.role = 'host'; Net.me = 'p1'; Net.code = code;
  lobbyStatus('Creando sala…');
  makePeer(PREFIX + code, {
    open: () => { renderLobby(); lobbyStatus(''); },
    connection: c => {
      conn = c;
      attachConn(c, {
        onOpen: () => { Net.peer = true; onNet({ t: 'peer', on: true }); },
        onFail: () => {}
      });
    },
    error: e => {
      if (e && e.type === 'unavailable-id' && attempt < 6) {
        lobbyStatus('Código ocupado, generando otro…');
        hostStart(attempt + 1);
        return;
      }
      lobbyError(peerErrorMessage(e, 'host'));
    }
  });
}

function guestJoin(code){
  Net.role = 'guest'; Net.me = 'p2'; Net.code = code;
  const gen = ++joinGen;
  lobbyStatus('Preparando conexión…');
  makePeer(null, {
    open: () => {
      if (gen !== joinGen) return;
      lobbyStatus('Uniendo a la partida… (entre redes distintas puede tardar hasta un minuto)');
      conn = peer.connect(PREFIX + code, connectOptions());
      attachConn(conn, {
        onOpen: () => {
          Net.peer = true;
          renderLobby();
          lobbyStatus('');
          netSend({ t: 'hello', name: Net.names.p2 });
          onNet({ t: 'peer', on: true });
        },
        onFail: err => {
          if (gen !== joinGen) return;
          lobbyError(peerErrorMessage(err || { type: 'connection-error' }, 'guest'));
        }
      });
    },
    error: e => {
      if (gen !== joinGen) return;
      if (cloudIdx + 1 < PEERJS_CLOUDS.length && (e.type === 'network' || e.type === 'server-error')) {
        cloudIdx++;
        lobbyStatus('Reintentando servidor…');
        guestJoin(code);
        return;
      }
      lobbyError(peerErrorMessage(e, 'guest'));
    }
  });
}

export function netSimDelay(dir){
  if (!NET_SIM.on) return 0;
  const base = dir === 'up' ? NET_SIM.up : NET_SIM.down;
  const jit = NET_SIM.jitter ? (Math.random() * 2 - 1) * NET_SIM.jitter : 0;
  const now = performance.now();
  const lastAt = dir === 'up' ? NET_SIM._upAt : NET_SIM._dnAt;
  const at = Math.max(now + Math.max(0, base + jit), lastAt + 1);
  if (dir === 'up') NET_SIM._upAt = at; else NET_SIM._dnAt = at;
  return at - now;
}
export function netSend(o){
  if (o.t === 'create') { hostStart(); return; }
  if (o.t === 'join') { guestJoin(o.code); return; }
  const fire = () => { if (conn && conn.open) conn.send(o); };
  const d = netSimDelay('up');
  if (d > 0) setTimeout(fire, d); else fire();
}
export function netAct(o){ netSend({ t: 'act', ...o }); }
export function netDirty(){ Net.sendT = 1e9; Net.revDirty = true; }

export function leaveCoop(){
  joinGen++;
  if (conn) { try { conn.close(); } catch (e) {} conn = null; }
  if (peer) { try { peer.destroy(); } catch (e) {} peer = null; }
  Net.role = 'solo'; Net.me = 'p1'; Net.code = null; Net.peer = false; Net.lastMode = null;
  hideAll(); Game.mode = 'title'; $('#title').classList.add('show');
}
export function goSolo(){
  joinGen++;
  if (conn) { try { conn.close(); } catch (e) {} conn = null; }
  if (peer) { try { peer.destroy(); } catch (e) {} peer = null; }
  Net.role = 'solo'; Net.me = 'p1'; Net.peer = false;
  if (Game.mode === 'service') {
    Game.slots = Game.slots.filter(s => s.who !== 'p2');
    const p1 = slotOf('p1'); if (p1) p1.station = 'all';
    Game.slots.forEach(s => { if (s.cust && s.who === 'p2') s.cust = null; });
    for (const c of Game.customers) if (c.state === 'prep' && !c.inPrep && pendingIdx(c).length) {}
    setSpeed(1); showServiceUI();
  } else if (Game.mode === 'plan') showPlanUI();
  else if (Game.mode === 'report') showReportUI();
  else if (Game.mode === 'lobby') { hideAll(); Game.mode = 'title'; $('#title').classList.add('show'); }
}
