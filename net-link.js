/* Enlace PeerJS, sala y paso a solitario. Lo importa net.js. */
import { $ } from './util.js?v=27.6';
import { Audio } from './audio.js?v=27.6';
import { Game, NET_SIM, Net } from './state.js?v=27.6';
import { pendingIdx, slotOf } from './sim.js?v=27.6';
import { showReportUI } from './report.js?v=27.6';
import { hideAll, setSpeed, showPlanUI, showServiceUI } from './ui.js?v=27.6';
import { onNet } from './net-sync.js?v=27.6';
import { lobbyError, lobbyStatus, renderLobby } from './net-lobby.js?v=27.6';
// ---------- Red: PeerJS (WebRTC) ----------
let peer=null, conn=null;
const PREFIX='chiringuito-lali-oli-';
const LETTERS='ABCDEFGHJKLMNPQRSTUVWXYZ';
function newCode(){ let c=''; for(let i=0;i<4;i++) c+=LETTERS[Math.floor(Math.random()*LETTERS.length)]; return c; }
// STUN + TURN público (Open Relay de Metered). Si falla o se agota, se puede
// sustituir por credenciales propias definiendo window.TURN_CONFIG antes de cargar net.js.
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
];
function peerOptions(){
  const ice = ICE_SERVERS.slice();
  const t = window.TURN_CONFIG;
  if (t && t.urls) ice.push({ urls: t.urls, username: t.username, credential: t.credential });
  return { config: { iceServers: ice, iceCandidatePoolSize: 10 } };
}
export function netOpen(onOpen){
  if(peer && !peer.destroyed){ onOpen(); return; }
  if(!window.Peer){ lobbyError('No se ha podido cargar el módulo de conexión.'); return; }
  lobbyStatus('Conectando…');
  peer=new Peer(peerOptions());
  peer.on('open',()=>{ onOpen(); });
  peer.on('error',e=>{ lobbyError('No se ha podido conectar ('+((e&&e.type)||'error')+'). Inténtalo de nuevo.'); });
  peer.on('disconnected',()=>{ try{peer.reconnect();}catch(e){} });
}
function hostStart(){
  const code=newCode();
  Net.role='host'; Net.me='p1'; Net.code=code;
  if(peer) peer.destroy();
  peer=new Peer(PREFIX+code, peerOptions());
  peer.on('open',()=>{ renderLobby(); lobbyStatus(''); });
  peer.on('connection',c=>{
    conn=c;
    c.on('open',()=>{ Net.peer=true; onNet({t:'peer',on:true}); });
    c.on('data',d=>{ try{ onNet(typeof d==='string'?JSON.parse(d):d); }catch(e){} });
    c.on('close',()=>{ conn=null; Net.peer=false; onNet({t:'peer',on:false}); });
  });
  peer.on('error',e=>{ lobbyError('No se ha podido crear la sala ('+((e&&e.type)||'error')+').'); });
}
function guestJoin(code){
  Net.role='guest'; Net.me='p2'; Net.code=code;
  if(peer) peer.destroy();
  peer=new Peer(peerOptions());
  peer.on('open',()=>{
    conn=peer.connect(PREFIX+code);
    conn.on('open',()=>{ Net.peer=true; renderLobby(); lobbyStatus(''); netSend({t:'hello', name:Net.names.p2}); onNet({t:'peer',on:true}); });
    conn.on('data',d=>{ try{ onNet(typeof d==='string'?JSON.parse(d):d); }catch(e){} });
    conn.on('close',()=>{ conn=null; Net.peer=false; onNet({t:'peer',on:false}); });
  });
  peer.on('error',e=>{ lobbyError('No existe ninguna partida con ese código ('+((e&&e.type)||'error')+').'); });
}
export function netSimDelay(dir){
  if(!NET_SIM.on) return 0;
  const base = dir==='up' ? NET_SIM.up : NET_SIM.down;
  const jit  = NET_SIM.jitter ? (Math.random()*2-1)*NET_SIM.jitter : 0;
  const now  = performance.now();
  const lastAt = dir==='up' ? NET_SIM._upAt : NET_SIM._dnAt;
  const at = Math.max(now + Math.max(0, base + jit), lastAt + 1);
  if(dir==='up') NET_SIM._upAt=at; else NET_SIM._dnAt=at;
  return at - now;
}
export function netSend(o){
  if(o.t==='create'){ hostStart(); return; }
  if(o.t==='join'){ guestJoin(o.code); return; }
  const fire=()=>{ if(conn && conn.open) conn.send(o); };
  const d=netSimDelay('up');
  if(d>0) setTimeout(fire, d); else fire();
}
export function netAct(o){ netSend({t:'act', ...o}); }
export function netDirty(){ Net.sendT=1e9; Net.revDirty=true; }

export function leaveCoop(){ if(conn){ try{conn.close();}catch(e){} conn=null; } if(peer){ try{peer.destroy();}catch(e){} peer=null; }
  Net.role='solo'; Net.me='p1'; Net.code=null; Net.peer=false; Net.lastMode=null;
  hideAll(); Game.mode='title'; $('#title').classList.add('show'); }
export function goSolo(){
  if(conn){ try{conn.close();}catch(e){} conn=null; } if(peer){ try{peer.destroy();}catch(e){} peer=null; }
  Net.role='solo'; Net.me='p1'; Net.peer=false;
  if(Game.mode==='service'){ Game.slots = Game.slots.filter(s=>s.who!=='p2'); const p1=slotOf('p1'); if(p1) p1.station='all'; Game.slots.forEach(s=>{ if(s.cust && s.who==='p2') s.cust=null; }); for(const c of Game.customers) if(c.state==='prep' && !c.inPrep && pendingIdx(c).length) {} setSpeed(1); showServiceUI(); }
  else if(Game.mode==='plan') showPlanUI();
  else if(Game.mode==='report') showReportUI();
  else if(Game.mode==='lobby'){ hideAll(); Game.mode='title'; $('#title').classList.add('show'); }
}
