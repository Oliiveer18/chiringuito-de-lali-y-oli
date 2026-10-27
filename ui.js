/* =========================================================
   ui.js
   Pantallas y HUD: plan de apertura, servicio, urgente, avisos (toasts) y acciones del jugador.
   ========================================================= */
import { GOAL, HOUR_CURVE, ITEMS, ITEM_IDS, RENT, SEASON_DAYS, SPECIAL_DAYS, STAFF, STATION_COLOR, STATION_LABEL, UPGRADES, WEATHER, who } from './config.js?v=27.6';
import { $, clamp, escapeHtml, eur, eur2, hhmm, stars } from './util.js?v=27.6';
import { ICON_URL } from './icons.js?v=27.6';
import { Audio } from './audio.js?v=27.6';
import { Game, Net, activeItems, closeHour, dayName, hostLive, isCoop, isGuest, isWeekend, itemUnlocked, lvl, partner, wages, weatherToday } from './state.js?v=27.6';
import { buyStock, cleanTable, difficultyProfile, difficultyRush, newSeason, servable, startDay, tryServe } from './sim.js?v=27.6';
import { Rev, advanceFromReport, refreshReportUI, respondReview } from './report.js?v=27.6';
import { canvas, toWorld } from './canvas.js?v=27.6';
import { guestClean, guestServe, netAct, netDirty } from './net.js?v=27.6';
import { drawPerson } from './render.js?v=27.6';
import {
  hideAll, Plan, showPlan, showPlanUI, renderForecast, refreshPlanMoney, updateReadyUI,
  flashMoney, demandHint, renderTab, estimateCustomers, avatarCache, staffAvatar,
  applyPlanAction, pressReady, toggleReady,
} from './ui-plan.js?v=27.6';
import {
  showServiceUI, showFinal, showFinalUI, renderUrgent, applyUrgent,
  updateHud, updateStockbar, setSpeed, toastsEl, toast, toastLocal,
} from './ui-service.js?v=27.6';
export {
  hideAll, Plan, showPlan, showPlanUI, renderForecast, refreshPlanMoney, updateReadyUI,
  flashMoney, demandHint, renderTab, estimateCustomers, avatarCache, staffAvatar,
  applyPlanAction, pressReady, toggleReady,
};
export {
  showServiceUI, showFinal, showFinalUI, renderUrgent, applyUrgent,
  updateHud, updateStockbar, setSpeed, toastsEl, toast, toastLocal,
};
// respuestas del propietario y "Ver más reseñas": delegación en el informe
$('#rep-body').addEventListener('click',e=>{
  const b=(e.target && e.target.closest)? e.target.closest('button') : null;
  if(!b || b.disabled) return;
  if(b.dataset.revmore!=null){ Rev.expanded=true; refreshReportUI(); return; } // local: no afecta a la pareja
  if(b.dataset.vid!=null){ respondReview(+b.dataset.vid, b.dataset.kind); return; }
});
$('#tab-body').addEventListener('click',e=>{
  const t=e.target.closest('button'); if(!t || t.disabled) return;
  const d={...t.dataset}; Audio.click();
  if(isGuest()) netAct({a:'plan', d}); else applyPlanAction('p1', d);
});
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{ Plan.tab=t.dataset.tab; Audio.click(); renderTab(); }));
$('#btn-open').addEventListener('click',()=>{ Audio.init(); Audio.click();
  if(!isCoop()){ startDay(); return; }
  pressReady(); });
$('#btn-next').addEventListener('click',()=>{ Audio.click();
  if(!isCoop()){ advanceFromReport(); return; }
  pressReady(); });
$('#btn-start').addEventListener('click',()=>{ Audio.init(); Audio.good(); Net.role='solo'; Net.me='p1'; newSeason(); Plan.tab='compras'; showPlan(); });

// ---------- Urgente ----------
$('#btn-urgent').addEventListener('click',()=>{ if(Game.mode!=='service') return; Audio.click();
  if(!isCoop()){ prevSpeed=Game.speed; setSpeed(0); }
  $('#urg-note').textContent = isCoop() ? 'A mitad de jornada todo cuesta el doble. Ojo: el servicio sigue mientras pides.' : 'A mitad de jornada todo cuesta el doble. Llega al momento.';
  renderUrgent(); $('#urgent').classList.add('show'); });
export let prevSpeed=1;
$('#urg-body').addEventListener('click',e=>{ const t=e.target.closest('button'); if(!t||t.disabled) return; if(isGuest()){ Audio.click(); netAct({a:'urgent', id:t.dataset.ub}); } else applyUrgent(t.dataset.ub,'p1'); });
$('#btn-urg-close').addEventListener('click',()=>{ Audio.click(); $('#urgent').classList.remove('show'); if(!isCoop()) setSpeed(prevSpeed||1); });

document.querySelectorAll('.speed button').forEach(b=>b.addEventListener('click',()=>{ Audio.click(); b.blur();
  if(isGuest()) netAct({a:'speed', v:+b.dataset.speed}); else { setSpeed(+b.dataset.speed); netDirty(); } }));
$('#btn-sound').addEventListener('click',()=>{ Audio.init(); const on=Audio.toggle(); $('#btn-sound').textContent='Sonido: '+(on?'sí':'no'); });

canvas.addEventListener('pointerdown',e=>{
  if(Game.mode!=='service' || Game.speed===0) return;
  const p=toWorld(e.clientX,e.clientY);
  // clientes en cola
  let best=null, bd=1e9;
  for(const c of Game.customers){ if(!servable(c)) continue; const dx=p.x-c.x, dy=p.y-(c.y-45); const d=Math.hypot(dx*1.2,dy*0.8); if(d<75 && d<bd){bd=d;best=c;} }
  if(best){ if(isGuest()) guestServe(best); else tryServe(best,'p1'); return; }
  Game.tables.forEach((t,i)=>{ if(best) return; if(t.state==='dirty' && Math.hypot(p.x-t.x,p.y-t.y+10)<62){ best=t; if(isGuest()) guestClean(i); else cleanTable(t,false,'p1'); } });
});
addEventListener('keydown',e=>{
  if(Game.mode!=='service') return;
  if(e.code==='KeyP'){ const v=Game.speed?0:1; if(isGuest()) netAct({a:'speed',v}); else { setSpeed(v); netDirty(); } return; }
  if(Game.speed===0) return;
  const act=c=>{ if(!c) return; if(isGuest()) guestServe(c); else tryServe(c,'p1'); };
  if(e.code==='Space'||e.code==='Enter'){ e.preventDefault(); const q=Game.customers.filter(servable).sort((a,b)=>a.spot-b.spot); act(q[0]); }
  const n=parseInt(e.key); if(n>=1&&n<=6){ act(Game.customers.find(c=>servable(c)&&c.spot===n-1)); }
  if(e.code==='KeyL'){ const i=Game.tables.findIndex(t=>t.state==='dirty'); if(i>=0){ if(isGuest()) guestClean(i); else cleanTable(Game.tables[i],false,'p1'); } }
});
