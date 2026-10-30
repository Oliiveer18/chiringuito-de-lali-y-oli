/* Enlace PeerJS, sala y paso a solitario. Lo importa net.js. */
import { $ } from './util.js?v=28.14.10';
import { Audio } from './audio.js?v=28.14.10';
import { Game, NET_SIM, Net } from './state.js?v=28.14.10';
import { pendingIdx, slotOf } from './sim.js?v=28.14.10';
import { showReportUI } from './report.js?v=28.14.10';
import { hideAll, setSpeed, showPlanUI, showServiceUI } from './ui.js?v=28.14.10';
import { onNet } from './net-sync.js?v=28.14.10';
import { lobbyError, lobbyStatus, renderLobby } from './net-lobby.js?v=28.14.10';
import {
  peerRtcConfig, peerErrorMessage, hostPeerId, isTransientJoinPeerError, guestSearchStatus,
  GUEST_RETRY, nextGuestRetryMs, visibilityRecovery
} from './net-rtc.js?v=28.14.10';
export { peerRtcConfig, peerErrorMessage, hostPeerId };

// ---------- Red: PeerJS (WebRTC) ----------
let peer = null, conn = null, joinGen = 0, searchTimer = null;
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
function newCode(){ let c = ''; for (let i = 0; i < 4; i++) c += LETTERS[Math.floor(Math.random() * LETTERS.length)]; return c; }

const PEERJS_CLOUDS = [
  { host: '0.peerjs.com', port: 443, path: '/', secure: true }
];
const CLOUD_KEY = 'lali-oli.peerjs-cloud';
let cloudIdx = 0;
try {
  const saved = parseInt(sessionStorage.getItem(CLOUD_KEY), 10);
  if (saved >= 0 && saved < PEERJS_CLOUDS.length) cloudIdx = saved;
} catch (e) {}

function saveCloudIdx(){
  try { sessionStorage.setItem(CLOUD_KEY, String(cloudIdx)); } catch (e) {}
}

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

function clearGuestSearch(){
  if (searchTimer) { clearInterval(searchTimer); searchTimer = null; }
}

function startGuestSearch(cloudTry){
  clearGuestSearch();
  const started = Date.now();
  const tick = () => {
    const sec = Math.floor((Date.now() - started) / 1000);
    lobbyStatus(guestSearchStatus(cloudTry, PEERJS_CLOUDS.length, sec));
  };
  tick();
  searchTimer = setInterval(tick, 2000);
}

function attachConn(c, { onOpen, onFail }){
  let opened = false;
  c.on('open', () => {
    opened = true;
    clearGuestSearch();
    onOpen && onOpen();
  });
  c.on('data', d => { try { onNet(typeof d === 'string' ? JSON.parse(d) : d); } catch (e) {} });
  c.on('close', () => {
    conn = null;
    Net.peer = false;
    onNet({ t: 'peer', on: false });
  });
  // v28.14.10: PeerJS no emite 'failed' en DataConnection; sin esto el reintento
  // entre servidores y la recuperación del invitado nunca se disparaban.
  c.on('error', () => { if (!opened) onFail && onFail(); });
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
    open: () => { saveCloudIdx(); lobbyStatus(''); onOpen(); },
    error: e => {
      if (cloudIdx + 1 < PEERJS_CLOUDS.length && (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error')) {
        cloudIdx++;
        saveCloudIdx();
        lobbyStatus('Reintentando con otro servidor…');
        makePeer(null, {
          open: () => { saveCloudIdx(); lobbyStatus(''); onOpen(); },
          error: e2 => lobbyError(peerErrorMessage(e2, 'guest'))
        });
        return;
      }
      lobbyError(peerErrorMessage(e, 'guest'));
    }
  });
}

function hostStart(attempt = 0){
  const code = newCode();
  Net.role = 'host'; Net.me = 'p1'; Net.code = code; Net.signalingReady = false;
  lobbyStatus('Creando sala…');
  hostListen(code);
}

/** v28.14.10: la sala del anfitrión se reconstruye sola con el MISMO código si el
    servidor de señalización suelta la conexión (típico al pasar el juego a
    segundo plano en el móvil para mandar el código). Así el invitado no
    necesita que se genere una sala nueva. */
function hostListen(code, attempt = 0){
  makePeer(hostPeerId(code), {
    open: () => {
      Net.signalingReady = true;
      saveCloudIdx();
      renderLobby();
      lobbyStatus('');
    },
    connection: c => {
      conn = c;
      attachConn(c, {
        onOpen: () => { Net.peer = true; onNet({ t: 'peer', on: true }); },
        onFail: () => {}
      });
    },
    error: e => {
      if (e && e.type === 'unavailable-id' && attempt < 6) {
        // el registro anterior puede tardar unos segundos en expirar en el servidor
        lobbyStatus('Código ocupado, reactivando sala…');
        setTimeout(() => { if (Net.role === 'host' && Net.code === code) hostListen(code, attempt + 1); }, 1500);
        return;
      }
      Net.signalingReady = false;
      lobbyError(peerErrorMessage(e, 'host'));
    }
  });
  const thisPeer = peer;
  peer.on('close', () => {
    // solo si este peer seguía siendo el actual: makePeer destruye los anteriores a propósito
    if (peer !== thisPeer || Net.role !== 'host' || Net.code !== code) return;
    setTimeout(() => { if (Net.role === 'host' && Net.code === code) hostListen(code); }, 1500);
  });
}

/** v28.14.10: el invitado reintenta la conexión mientras espera. Antes, un único
    peer.connect fallido (anfitrión aún no registrado, o su sala reactivándose
    tras pasar el juego a segundo plano) dejaba el "Buscando anfitrión…"
    para siempre sin volver a intentarlo. */
let guestRetryTimer = null, guestRetries = 0;
function stopGuestRetry(){
  if (guestRetryTimer) { clearTimeout(guestRetryTimer); guestRetryTimer = null; }
}

function guestJoin(code, cloudTry = 0){
  Net.role = 'guest'; Net.me = 'p2'; Net.code = code;
  cloudIdx = cloudTry;
  const gen = ++joinGen;
  clearGuestSearch();
  stopGuestRetry();
  guestRetries = 0;
  lobbyStatus('Preparando conexión…');
  const targetId = hostPeerId(code);
  const connectGuest = () => {
    if (gen !== joinGen || !peer || peer.destroyed) return;
    conn = peer.connect(targetId, connectOptions());
    attachConn(conn, {
      onOpen: () => {
        if (gen !== joinGen) return;
        stopGuestRetry();
        Net.peer = true;
        renderLobby();
        lobbyStatus('');
        netSend({ t: 'hello', name: Net.names.p2 });
        onNet({ t: 'peer', on: true });
      },
      onFail: () => {
        if (gen !== joinGen) return;
        clearGuestSearch();
        if (cloudTry + 1 < PEERJS_CLOUDS.length) {
          lobbyStatus('No encontrado en este servidor, probando otro…');
          guestJoin(code, cloudTry + 1);
          return;
        }
        scheduleGuestRetry();
      }
    });
  };
  const scheduleGuestRetry = () => {
    if (gen !== joinGen) return;
    if (guestRetries >= GUEST_RETRY.maxAttempts) {
      clearGuestSearch();
      lobbyError(peerErrorMessage({ type: 'peer-unavailable' }, 'guest'));
      return;
    }
    stopGuestRetry();
    const delay = nextGuestRetryMs(guestRetries);
    guestRetryTimer = setTimeout(() => {
      if (gen !== joinGen || Net.role !== 'guest') return;
      guestRetries++;
      connectGuest();
    }, delay);
  };
  makePeer(null, {
    open: () => {
      if (gen !== joinGen) return;
      saveCloudIdx();
      startGuestSearch(cloudTry);
      connectGuest();
    },
    error: e => {
      if (gen !== joinGen) return;
      if (isTransientJoinPeerError(e)) {
        // el anfitrión puede (re)registrarse en cualquier momento: seguir buscando
        startGuestSearch(cloudTry);
        scheduleGuestRetry();
        return;
      }
      if (cloudIdx + 1 < PEERJS_CLOUDS.length && (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error')) {
        cloudIdx++;
        saveCloudIdx();
        lobbyStatus('Reintentando servidor…');
        guestJoin(code, cloudTry);
        return;
      }
      clearGuestSearch();
      stopGuestRetry();
      lobbyError(peerErrorMessage(e, 'guest'));
    }
  });
  const thisPeer = peer;
  peer.on('close', () => {
    // solo si este peer seguía siendo el actual: reconstruir el enlace del invitado
    if (peer !== thisPeer || gen !== joinGen) return;
    setTimeout(() => { if (gen === joinGen && Net.role === 'guest' && Net.code === code) guestJoin(code, cloudTry); }, 1500);
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
  clearGuestSearch();
  stopGuestRetry();
  Net.signalingReady = false;
  if (conn) { try { conn.close(); } catch (e) {} conn = null; }
  if (peer) { try { peer.destroy(); } catch (e) {} peer = null; }
  Net.role = 'solo'; Net.me = 'p1'; Net.code = null; Net.peer = false; Net.lastMode = null;
  hideAll(); Game.mode = 'title'; $('#title').classList.add('show');
}
export function goSolo(){
  joinGen++;
  clearGuestSearch();
  stopGuestRetry();
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

// v28.14.10: al volver a primer plano (móvil en segundo plano), reanimar el enlace.
// Caso 1: el peer sigue vivo pero desconectado → reconnect al mismo servidor.
// Caso 2: el peer MURIÓ del todo (el servidor soltó el registro de la sala mientras
// la pestaña estaba dormida) → ni reconnect ni el evento 'close' pueden revivirlo.
// Ahí se reconstruye el enlace completo con el MISMO código: el anfitrión re-registra
// su sala y el invitado reanuda la búsqueda donde la dejó.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const action = visibilityRecovery({
    peerAlive: !!(peer && !peer.destroyed),
    peerDisconnected: !!(peer && !peer.destroyed && peer.disconnected),
    role: Net.role, code: Net.code, hasConn: !!conn
  });
  if (action === 'reconnect') { try { peer.reconnect(); } catch (e) {} }
  else if (action === 'host-relisten') hostListen(Net.code);
  else if (action === 'guest-rejoin') guestJoin(Net.code);
});
