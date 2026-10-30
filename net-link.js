/* Enlace PeerJS, sala y paso a solitario. Lo importa net.js. */
import { $ } from './util.js?v=28.15.0';
import { Audio } from './audio.js?v=28.15.0';
import { Game, NET_SIM, Net } from './state.js?v=28.15.0';
import { pendingIdx, slotOf } from './sim.js?v=28.15.0';
import { showReportUI } from './report.js?v=28.15.0';
import { hideAll, setSpeed, showPlanUI, showServiceUI } from './ui.js?v=28.15.0';
import { onNet } from './net-sync.js?v=28.15.0';
import { lobbyError, lobbyStatus, renderLobby } from './net-lobby.js?v=28.15.0';
import {
  peerRtcConfig, peerErrorMessage, hostPeerId, isTransientJoinPeerError, guestSearchStatus,
  GUEST_RETRY, nextGuestRetryMs, visibilityRecovery, restartBackoffMs
} from './net-rtc.js?v=28.15.0';
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
    // v28.15: si el enlace del invitado muere del todo (la capa de reintentos de
    // reliability.js agotó su ventana de 45 s), se reconstruye con el mismo código:
    // cuando la pareja vuelva, la partida se re-sincroniza completa desde el anfitrión.
    // El guard de generación evita resurrectos tras "seguir solo" o salir del coop.
    if (Net.role === 'guest' && Net.code) {
      const gen = joinGen;
      guestRestarts++;
      const delay = restartBackoffMs(guestRestarts);
      setTimeout(() => { if (gen === joinGen && Net.role === 'guest' && Net.code && !conn) guestJoin(Net.code); }, delay);
    }
  });
  // v28.15.0: PeerJS no emite 'failed' en DataConnection; sin esto el reintento
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

/** v28.15.0: la sala del anfitrión se reconstruye sola con el MISMO código si el
    servidor de señalización suelta la conexión (típico al pasar el juego a
    segundo plano en el móvil para mandar el código). Así el invitado no
    necesita que se genere una sala nueva. */
/** v28.15.0: retroceso exponencial para las reconstrucciones de enlace. Si la sala
    muere en cuanto se registra (red inestable, servidor saturado), reintentar cada
    1.5s para siempre martillea el servidor. Cada muerte consecutiva dobla la espera
    (1.5s → 3s → 6s → … → 30s); si el enlace aguanta 20s seguidos, el contador se
    reinicia y el siguiente problema volverá a responder rápido. */
let hostRestarts = 0, hostStableTimer = null;
function markHostStable(){
  clearTimeout(hostStableTimer);
  hostStableTimer = setTimeout(() => { hostRestarts = 0; }, 20000);
}

function hostListen(code, attempt = 0){
  makePeer(hostPeerId(code), {
    open: () => {
      Net.signalingReady = true;
      markHostStable();
      saveCloudIdx();
      renderLobby();
      lobbyStatus('');
    },
    connection: c => {
      conn = c;
      attachConn(c, {
        onOpen: () => { hostRestarts = 0; Net.peer = true; onNet({ t: 'peer', on: true }); },
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
    // v28.15.0: retroceso exponencial — una muerte tras otra no debe martillear el servidor
    clearTimeout(hostStableTimer);
    hostRestarts++;
    const delay = restartBackoffMs(hostRestarts);
    setTimeout(() => { if (Net.role === 'host' && Net.code === code) hostListen(code); }, delay);
  });
}

/** v28.15.0: el invitado reintenta la conexión mientras espera. Antes, un único
    peer.connect fallido (anfitrión aún no registrado, o su sala reactivándose
    tras pasar el juego a segundo plano) dejaba el "Buscando anfitrión…"
    para siempre sin volver a intentarlo. */
let guestRetryTimer = null, guestRetries = 0, guestRestarts = 0;
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
        guestRestarts = 0; // enlace sano: el retroceso vuelve a empezar desde 1.5s
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
    // v28.15.0: retroceso exponencial, igual que la sala del anfitrión
    guestRestarts++;
    const delay = restartBackoffMs(guestRestarts);
    setTimeout(() => { if (gen === joinGen && Net.role === 'guest' && Net.code === code) guestJoin(code, cloudTry); }, delay);
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

// v28.15.0: al volver a primer plano (móvil en segundo plano), reanimar el enlace.
// Si no hay partida en marcha y el peer de señalización no está sano (murió o quedó
// desconectado al fondo), se reconstruye el enlace completo con el MISMO código:
// el anfitrión re-registra su sala y el invitado reanuda la búsqueda. Con la
// partida ya en marcha solo se reanima la señalización (reconnect), porque
// destruir el peer mataría el enlace de datos WebRTC.
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
