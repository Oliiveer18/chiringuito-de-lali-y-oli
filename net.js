import {floorCommand} from './floor-service.js?v=29.3.0';
/* =========================================================
   net.js
   Red: WebRTC con PeerJS (sin servidor propio), sala compartida,
   sincronización anfitrión→invitado y acciones pendientes del invitado.
   ========================================================= */
import { STATION_LABEL, who } from './config.js?v=29.3.0';
import { $, clamp, escapeHtml } from './util.js?v=29.3.0';
import { Audio } from './audio.js?v=29.3.0';
import { Game, NET_SIM, Net, guestCust, hostLive, isGuest } from './state.js?v=29.3.0';
import { TABLE_POS } from './world.js?v=29.3.0';
import { cleanFx, cleanTable, hud, newSeason, pendingIdx, servable, slotOf, tryServe } from './sim.js?v=29.3.0';
import { applyRevResp, refreshReportUI, revSigOf, showReportUI } from './report.js?v=29.3.0';
import { Plan, applyPlanAction, applyUrgent, hideAll, refreshPlanMoney, renderForecast, renderTab, renderUrgent, setSpeed, showFinalUI, showPlan, showPlanUI, showServiceUI, toastLocal, toggleReady, updateHud, updateReadyUI, updateStockbar } from './ui.js?v=29.3.0';

import {
  REJECT_MSG, pendHas, guestServe, guestClean, guestPendTick,
} from './net-guest.js?v=29.3.0';
import {
  netOpen, netSimDelay, netSend, netAct, netDirty, leaveCoop, goSolo,
} from './net-link.js?v=29.3.0';
import {
  onNet, applyAct, pushAck, snapshot, netTick, applyState, guestTick,
} from './net-sync.js?v=29.3.0';
import {
  PINGS, sendPing, showPing, showLobby, lobbyStatus, lobbyError, myName, renderLobby, netLost, hideNetMsg,
} from './net-lobby.js?v=29.3.0';
export {
  REJECT_MSG, pendHas, guestServe, guestClean, guestPendTick,
  netOpen, netSimDelay, netSend, netAct, netDirty, leaveCoop, goSolo,
  onNet, applyAct, pushAck, snapshot, netTick, applyState, guestTick,
  PINGS, sendPing, showPing, showLobby, lobbyStatus, lobbyError, myName, renderLobby, netLost, hideNetMsg,
};
$('#btn-ping').addEventListener('click',e=>{ e.stopPropagation(); $('#ping-menu').classList.toggle('hidden'); });
document.querySelectorAll('#ping-menu button').forEach(b=>b.addEventListener('click',()=>sendPing(b.dataset.ping)));
$('#btn-coop').addEventListener('click',()=>{ Audio.init(); Audio.click(); showLobby(); setTimeout(()=>$('#lobby-name').focus(),50); });
$('#btn-create').addEventListener('click',()=>{ Audio.click(); Net.names.p1 = myName()||'Jugador 1'; netOpen(()=>netSend({t:'create'})); });
$('#btn-join').addEventListener('click',()=>{ Audio.click(); const code=($('#lobby-join-code').value||'').toUpperCase().replace(/[^A-Z]/g,'');
  if(code.length!==4){ lobbyError('El código tiene 4 letras.'); return; }
  Net.names.p2 = myName()||'Jugador 2'; netOpen(()=>netSend({t:'join', code})); });
$('#lobby-join-code').addEventListener('keydown',e=>{ if(e.key==='Enter') $('#btn-join').click(); });
$('#lobby-join-code').addEventListener('input',e=>{ e.target.value=e.target.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,4); });
document.querySelectorAll('#role-pick button').forEach(b=>b.addEventListener('click',()=>{ Audio.click(); Net.roles.p1=b.dataset.role; Net.roles.p2 = b.dataset.role==='barra'?'cocina':'barra'; renderLobby(); netDirty(); }));
$('#btn-lobby-go').addEventListener('click',()=>{ if(!Net.peer) return; Audio.good(); newSeason(); Plan.tab='compras'; showPlan(); });
$('#btn-lobby-back').addEventListener('click',()=>{ Audio.click(); leaveCoop(); });
$('#btn-net-home').addEventListener('click',()=>{ hideNetMsg(); location.reload(); });
$('#btn-net-solo').addEventListener('click',()=>{ hideNetMsg(); goSolo(); });
$('#btn-net-wait').addEventListener('click',()=>{ hideNetMsg(); });

document.addEventListener('floor-send',e=>{if(Net.role==='guest')netAct({a:'floor',command:e.detail});});
