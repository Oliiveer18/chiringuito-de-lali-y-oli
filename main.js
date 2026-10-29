/* =========================================================
   main.js
   Arranque: bucle principal, exposición de pruebas (window.__api/__test) y arranque inicial.
   ========================================================= */
import { ITEMS, UPGRADES } from './config.js?v=28.14.5';
import { buildIcons } from './icons.js?v=28.14.5';
import { Game, NET_SIM, Net, isGuest, weatherToday } from './state.js?v=28.14.5';
import { buyStock, cleanTable, newSeason, spawnCustomer, startDay, tryServe, update } from './sim.js?v=28.14.5';
import { endDay } from './report.js?v=28.14.5';
import { Plan, pressReady, showPlan, toggleReady } from './ui.js?v=28.14.5';
import { applyState, guestClean, guestServe, guestTick, netOpen, netSend, netTick } from './net.js?v=28.14.5';
import { render } from './render.js?v=28.14.5';
import { ctx } from './canvas.js?v=28.14.5';
import './variety.js?v=28.14.5';

// ---------- Bucle ----------
let last=performance.now(), acc=0; const STEP=1/60;
function frame(now){
  const dt=Math.min(0.1,(now-last)/1000); last=now;
  if(isGuest()) guestTick(dt);
  else if(!manualTime){ acc+=dt*(Game.mode==='service'?Game.speed:1); while(acc>=STEP){ update(STEP); acc-=STEP; } }
  netTick(dt);
  render();
  if(window.__betaDraw){ try{ window.__betaDraw(ctx); }catch(e){ console.error('betaDraw', e); } }
  requestAnimationFrame(frame);
}
let manualTime=false;
window.advanceTime = ms => { manualTime=true; const n=Math.round(ms/1000/STEP); for(let i=0;i<n;i++) update(STEP*(Game.mode==='service'?Math.max(1,Game.speed):1)); render(); manualTime=false; };
window.render_game_to_text = ()=> JSON.stringify({
  mode:Game.mode, day:Game.day, hour:+Game.hour.toFixed(2), money:Math.round(Game.money), rep:+Game.rep.toFixed(2), weather:Game.forecast.length?weatherToday():null,
  stock:Game.stock, queue:Game.customers.filter(c=>c.state==='queue').map(c=>({spot:c.spot,type:c.type,order:c.order,patience:+c.patience.toFixed(1)})),
  tables:Game.tables.map(t=>t.state), slots:Game.slots.map(s=>!!s.cust), stats:Game.dayStats && {served:Game.dayStats.served,lost:Game.dayStats.lost,revenue:Math.round(Game.dayStats.revenue)}
});
window.__api = {serve:(c)=>tryServe(c), clean:t=>cleanTable(t,false), startDay, endDay, showPlan, newSeason, buyStock, ITEMS, UPGRADES,
  setNetLatency(up=80, down=80, jitter=20){ Object.assign(NET_SIM,{on:true,up,down,jitter}); },
  clearNetLatency(){ NET_SIM.on=false; },
  setPendTimeouts(timeoutMs, dropMs){ if(timeoutMs!=null) Net.pendTimeout=timeoutMs; if(dropMs!=null) Net.pendDrop=dropMs; },
  netStats(){ return { confMs:Net.confMs!=null?Math.round(Net.confMs):null,
    pend:[...Net.pend.values()].map(p=>({kind:p.kind,key:p.key,ageMs:Math.round(performance.now()-p.t0),expired:!!p.expired})),
    ackLog:Net.ackLog.slice(-5),
    sim:NET_SIM.on?{up:NET_SIM.up,down:NET_SIM.down,jitter:NET_SIM.jitter}:null }; } };

buildIcons();
document.fonts && document.fonts.ready.then(()=>render());
requestAnimationFrame(frame);

window.__test = { netOpen, netSend, newSeason, showPlan, toggleReady, pressReady,
  guestServe, guestClean, tryServe, spawnCustomer, applyState,
  setPlanTab: v => Plan.tab = v };
