/* =========================================================
   net.js
   Red: WebSocket, sala compartida, sincronización anfitrión→invitado y acciones pendientes del invitado.
   ========================================================= */
import { STATION_LABEL, who } from './config.js';
import { $, clamp, escapeHtml } from './util.js';
import { Audio } from './audio.js';
import { Game, NET_SIM, Net, guestCust, hostLive, isGuest } from './state.js';
import { TABLE_POS } from './world.js';
import { cleanFx, cleanTable, hud, newSeason, pendingIdx, servable, slotOf, tryServe } from './sim.js';
import { applyRevResp, refreshReportUI, revSigOf, showReportUI } from './report.js';
import { Plan, applyPlanAction, applyUrgent, hideAll, refreshPlanMoney, renderForecast, renderTab, renderUrgent, setSpeed, showFinalUI, showPlan, showPlanUI, showServiceUI, toastLocal, toggleReady, updateHud, updateReadyUI, updateStockbar } from './ui.js';

// --- Acciones del invitado: se envían al anfitrión y quedan marcadas hasta su confirmación ---
// El anfitrión responde con un ack explícito (ok/rechazo) en la siguiente instantánea;
// nada se deduce del estado: la mesa no se limpia ni el pedido empieza en local.
export const REJECT_MSG = {
  busy:'Tu puesto ya estaba ocupado con otro pedido.',
  gone:'Ese cliente ya no esperaba el pedido.',
  clean:'Esa mesa ya estaba limpia.',
};
export function pendHas(kind,key){ for(const p of Net.pend.values()) if(p.kind===kind && p.key===key) return true; return false; }
export function guestServe(cu){
  if(!cu || pendHas('serve', cu.id)) return; // ya enviada: no se reenvía mientras espera confirmación
  const q=++Net.seq;
  netAct({a:'serve', id:cu.id, q});
  Net.pend.set(q, {kind:'serve', key:cu.id, t0:performance.now(), expired:false});
}
export function guestClean(i){
  if(i==null || i<0 || pendHas('clean', i)) return;
  const q=++Net.seq;
  netAct({a:'clean', i, q});
  Net.pend.set(q, {kind:'clean', key:i, t0:performance.now(), expired:false});
}
// caducidad y limpieza de pendientes (en el invitado, cada fotograma)
export function guestPendTick(){
  const now=performance.now();
  for(const [q,p] of Net.pend){
    const age=now-p.t0;
    if(!p.expired && age>Net.pendTimeout) p.expired=true;   // sin confirmación: se avisa, no se esconde
    if(age>Net.pendDrop) Net.pend.delete(q);                // demasiado vieja: manda el estado recibido
  }
  // el pendiente solo lo quita el ack explícito del anfitrión (o la caducidad):
  // nada de inferir por el estado recibido, o un rechazo tardío se perdería.
}
// ---------- Red: conexión, sala y sincronización ----------
export function wsURL(){
  const raw = window.__WS_BASE__ || 'port/8000';
  const local = ['localhost','127.0.0.1','[::1]'].includes(location.hostname);
  if(raw.startsWith('__PORT_')){ if(!local) throw new Error('Proxy sin configurar'); return 'ws://'+location.hostname+':8000/ws'; }
  const pageDir = location.href.split('#')[0].split('?')[0].replace(/\/[^/]*$/,'/');
  const u = /^https?:/.test(raw) ? new URL(raw.replace(/\/$/,'')+'/ws') : new URL(raw.replace(/^\//,'').replace(/\/$/,'')+'/ws', pageDir);
  return u.href.replace(/^http/,'ws');
}
export function netOpen(onOpen){
  if(Net.ws && Net.ws.readyState<=1){ onOpen(); return; }
  let ws; try{ ws=new WebSocket(wsURL()); }catch(e){ lobbyError('No se puede conectar con el servidor de partidas.'); return; }
  Net.ws=ws; lobbyStatus('Conectando…');
  const to=setTimeout(()=>{ if(ws.readyState!==1){ try{ws.close();}catch(e){} lobbyError('El servidor de partidas no responde. Inténtalo de nuevo en unos segundos.'); } }, 9000);
  ws.onopen=()=>{ clearTimeout(to); onOpen(); };
  ws.onmessage=e=>{ let m; try{ m=JSON.parse(e.data); }catch(_){ return; }
    const d=netSimDelay('down'); // recepción retrasada: el estado llega tarde, como en la red real
    if(d>0) setTimeout(()=>onNet(m), d); else onNet(m); };
  ws.onclose=()=>{ clearTimeout(to); if(Net.ws!==ws) return; Net.ws=null;
    if(Net.role==='guest' && Net.code) netLost('Se ha perdido la conexión con la partida.');
    else if(Net.role==='host') netLost('Se ha cortado la conexión con el servidor. Podéis seguir en solitario o crear otra partida.', true);
  };
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
  const s=JSON.stringify(o), sock=Net.ws;
  const fire=()=>{ if(sock && sock.readyState===1 && Net.ws===sock) sock.send(s); };
  const d=netSimDelay('up');
  if(d>0) setTimeout(fire, d); else fire();
}
export function netAct(o){ netSend({t:'act', ...o}); }
export function netDirty(){ Net.sendT=1e9; Net.revDirty=true; }
export function onNet(m){
  switch(m.t){
    case 'created': Net.role='host'; Net.me='p1'; Net.code=m.code; renderLobby(); break;
    case 'joined': Net.role='guest'; Net.me='p2'; Net.code=m.code; netSend({t:'hello', name:Net.names.p2}); renderLobby(); break;
    case 'error': lobbyError(m.msg); break;
    case 'peer':
      Net.peer=m.on;
      if(m.on){ toastLocal('Conectado', 'Tu pareja ya está en la partida.', 'good'); hideNetMsg(); if(Game.mode==='service' && Net.pausedByDrop){ Net.pausedByDrop=false; setSpeed(1); } }
      else { if(Game.mode==='service' && Game.speed){ setSpeed(0); Net.pausedByDrop=true; } netLost(`${escapeHtml(Net.names.p2)} se ha desconectado. Puede volver a entrar con el código <b>${Net.code}</b>.`, true); }
      renderLobby(); netDirty(); break;
    case 'closed': netLost('Tu pareja ha cerrado la partida.'); break;
    case 'hello': if(Net.role==='host'){ Net.names.p2 = String(m.name||'Jugador 2').slice(0,14); renderLobby(); netDirty(); } break;
    case 'act': if(Net.role==='host') applyAct(m); break;
    case 'state': if(Net.role==='guest') applyState(m); break;
  }
}
export function applyAct(m){
  const who='p2';
  switch(m.a){
    case 'serve': { // confirma al invitado si su acción se aceptó o por qué no
      const c=Game.customers.find(o=>o.id===m.id);
      const slot=slotOf(who);
      let ok=false, why='gone';
      if(Game.mode==='service' && Game.speed){
        if(c && servable(c)){
          if(slot && slot.cust) why='busy';
          else { ok=tryServe(c,who); if(!ok) why=(slot&&slot.cust)?'busy':'gone'; }
        }
      }
      pushAck(m.q, ok, why);
      break;
    }
    case 'clean': {
      let ok=false, why='gone';
      if(Game.mode==='service'){
        const t=Game.tables[m.i];
        if(t && t.state==='dirty'){ cleanTable(t,false,who); ok=true; }
        else why='clean';
      }
      pushAck(m.q, ok, why);
      break;
    }
    case 'plan': applyPlanAction(who, m.d||{}); break;
    case 'ready': toggleReady(who); break;
    case 'speed': if(Game.mode==='service'){ setSpeed(clamp(m.v|0,0,3)); if(m.v===0) toastLocal('Pausa', `${escapeHtml(Net.names.p2)} ha pausado el juego.`, ''); } break;
    case 'urgent': applyUrgent(m.id, who); break;
    case 'revresp': applyRevResp(m.vid|0, m.kind, who, m.day|0); break;
    case 'ping': showPing(who, m.k); break;
    case 'again': if(Game.mode==='final'){ newSeason(); Plan.tab='compras'; showPlan(); } break;
    case 'name': Net.names.p2=String(m.name||'').slice(0,14)||'Jugador 2'; renderLobby(); break;
  }
  netDirty();
}
// el anfitrión acusa recibo de cada acción del invitado: viaja en la siguiente instantánea
export function pushAck(q, ok, why){ if(q==null) return; Net.acks.push({q, ok:!!ok, why:why||''}); }
// --- Instantánea que envía el anfitrión ---
export function snapshot(){
  const o = { t:'state', mode:Game.mode, day:Game.day, money:Game.money, rep:Game.rep, hour:Game.hour, speed:Game.speed, closing:Game.closing,
    stock:Game.stock, prices:Game.prices, enabled:Game.enabled, upgrades:Game.upgrades, staff:Game.staff, forecast:Game.forecast, season:Game.season, buzz:Game.buzz,
    names:Net.names, roles:Net.roles, ready:Net.ready, ev:Net.events.splice(0), acks:Net.acks.splice(0) };
  if(Game.mode==='service'){
    o.cu = Game.customers.map(c=>({i:c.id,x:Math.round(c.x),y:Math.round(c.y),s:c.state,o:c.order,st:c.itemSt,p:+(c.patience/(c.maxPatience||1)).toFixed(3),sp:c.spot,
      m:c.mood,mt:+(c.moodT||0).toFixed(2),mx:c.moodTxt,sh:c.shirt,sk:c.skin,h:c.hat,ty:c.type,d:c.dir||1,sv:c.served,ip:c.inPrep,
      pn:c.personality,lk:c.look,rg:c.regular?c.regular.id:null,nm:c.regular?c.regular.name:null,ly:c.regLoyalty,
      an:c.act,at:+(c.actT||0).toFixed(2),ag:c.anger,sb:Object.keys(c.subs||{}).length?c.subs:null,wt:c.waitT,sat:c.sat}));
    o.tb = Game.tables.map(t=>({s:t.state, e: t.cust && t.cust.state==='eat' ? t.cust.served : null}));
    o.sl = Game.slots.map(s=>({w:s.who, c:s.cust?s.cust.id:null, p:s.cust? +(s.t/s.total).toFixed(3):0, cv:!!s.cover, it:s.items||[]}));
    o.fl = Game.floaters.map(f=>({x:Math.round(f.x),y:Math.round(f.y),text:f.text,t:+f.t.toFixed(2),color:f.color}));
  }
  if(Game.mode==='report'||Game.mode==='final') o.ui=Net.ui;
  if(Game.mode==='report'){
    o.revSig=revSigOf(Game.revModel);
    // el modelo solo viaja cuando cambia (respuestas): las reseñas se pintan en local
    if(Net.revDirty){ o.rev=Game.revModel; o.log=Game.starsLog; Net.revDirty=false; }
  }
  if(Game.mode==='lobby') o.lobby=true;
  return o;
}
export function netTick(dt){
  if(isGuest()) guestPendTick();
  if(!hostLive()) { Net.events.length=0; return; }
  Net.sendT += dt;
  const every = Game.mode==='service' ? 0.08 : 0.6;
  if(Net.sendT>=every){ Net.sendT=0; netSend(snapshot()); }
}
export function applyState(m){
  const prevMode = Net.lastMode;
  Object.assign(Game,{day:m.day, money:m.money, rep:m.rep, hour:m.hour, speed:m.speed, closing:m.closing, stock:m.stock, prices:m.prices, enabled:m.enabled,
    upgrades:m.upgrades, staff:m.staff, forecast:m.forecast, season:m.season, buzz:m.buzz});
  Net.names=m.names; Net.roles=m.roles; Net.ready=m.ready;
  // confirmaciones del anfitrión: quitan el indicador y miden la latencia real de la acción
  for(const a of (m.acks||[])){
    const p=Net.pend.get(a.q);
    if(!p) continue;
    Net.pend.delete(a.q);
    const ms=performance.now()-p.t0;
    Net.confMs = Net.confMs==null? ms : Net.confMs*0.7+ms*0.3;
    Net.ackLog.push({q:a.q, ok:!!a.ok, at:performance.now()});
    if(Net.ackLog.length>20) Net.ackLog.shift();
    if(!a.ok) toastLocal('Acción no aceptada', REJECT_MSG[a.why]||'El anfitrión no ha podido aplicarla.', 'bad');
  }
  if(m.ready && m.ready[Net.me]) Net.readySent=false;
  Game.mode = m.mode;
  if(m.mode==='service'){
    const seen=new Set();
    for(const sc of m.cu){ seen.add(sc.i); let c=guestCust.get(sc.i);
      if(!c){ c={id:sc.i,x:sc.x,y:sc.y,bob:Math.random()*6}; guestCust.set(sc.i,c); }
      Object.assign(c,{gx:sc.x,gy:sc.y,state:sc.s,order:sc.o,itemSt:sc.st,patience:sc.p,maxPatience:1,spot:sc.sp,mood:sc.m,moodT:sc.mt,moodTxt:sc.mx,shirt:sc.sh,skin:sc.sk,hat:sc.h,type:sc.ty,dir:sc.d,served:sc.sv,inPrep:sc.ip,
        personality:sc.pn,look:sc.lk,regular:sc.rg?{id:sc.rg,name:sc.nm}:null,regLoyalty:sc.ly,act:sc.an,actT:sc.at,anger:sc.ag,subs:sc.sb||{},waitT:sc.wt,sat:sc.sat});
    }
    for(const k of [...guestCust.keys()]) if(!seen.has(k)) guestCust.delete(k);
    Game.customers=[...guestCust.values()];
    const n=m.tb.length;
    if(Game.tables.length!==n){ Game.tables=[]; for(let i=0;i<n;i++){ const p=TABLE_POS[i]; Game.tables.push({x:p.x,y:p.y,state:'free',cust:null,color:['#e8603c','#f5b82e','#0f8b8d','#3f8a3a'][i%4]}); } }
    m.tb.forEach((t,i)=>{ Game.tables[i].state=t.s; Game.tables[i].cust = t.e? {state:'eat',served:t.e} : null; });
    Game.slots = m.sl.map(s=>({who:s.w, cust:s.c!=null? guestCust.get(s.c)||null : null, t:s.p, total:1, cover:s.cv, items:s.it||[]}));
    Game.floaters = m.fl;
  }
  for(const e of (m.ev||[])){
    if(e.e==='sfx' && Audio._raw[e.n]) Audio._raw[e.n]();
    else if(e.e==='toast') toastLocal(e.title,e.text,e.kind);
    else if(e.e==='clean'){ const t=Game.tables[e.i]; if(t) cleanFx(t); if(e.snd) Audio._raw.clean(); }
    else if(e.e==='ping') showPing(e.from, e.k);
  }
  if(m.ui) Net.ui=m.ui;
  if(m.rev) Game.revModel=m.rev;    // modelo del informe: el invitado pinta las reseñas en local
  if(m.log) Game.starsLog=m.log;    // tendencia semanal sincronizada
  // cambios de pantalla
  if(m.mode!==prevMode){
    Net.lastMode=m.mode; Net.planSig='';
    Net.pend.clear(); Net.readySent=false;
    if(m.mode==='plan'){ Plan.tab=Plan.tab||'compras'; showPlanUI(); }
    else if(m.mode==='service'){ Game.customers=[]; guestCust.clear(); applyState({...m, mode:'service', ev:[]}); showServiceUI(); setSpeed(m.speed); }
    else if(m.mode==='report') showReportUI();
    else if(m.mode==='final') showFinalUI();
    else if(m.mode==='lobby') { renderLobby(); }
  }
  if(m.mode==='plan'){
    const sig = JSON.stringify([m.money,m.stock,m.prices,m.enabled,m.upgrades,m.staff,m.ready,Game.buzz]);
    if(sig!==Net.planSig){ Net.planSig=sig; renderTab(); refreshPlanMoney(); renderForecast(); updateReadyUI(); }
  }
  if(m.mode==='report'){
    // el informe se actualiza en caliente (respuestas del propietario): repintar
    // sin perder scroll ni "Ver más", si cambió el cuerpo o alguna reseña fue respondida
    if(m.ui && (m.ui.body!==Net.lastBody || (m.revSig||'')!==Net.lastRevSig)) refreshReportUI();
    else updateReadyUI();
  }
  if(m.mode==='service'){ document.querySelectorAll('.speed button').forEach(b=>b.classList.toggle('on', +b.dataset.speed===m.speed)); updateStockbar(); if($('#urgent').classList.contains('show')) renderUrgent(); }
}
export function guestTick(dt){
  Game.t += dt;
  const k = Math.min(1, dt*12);
  for(const c of Game.customers){
    if(c.gx==null) continue;
    const dx=c.gx-c.x, dy=c.gy-c.y; const moving = Math.abs(dx)+Math.abs(dy) > 1.5;
    c.x += dx*k; c.y += dy*k;
    // las animaciones avanzan con el tiempo escalado del anfitrión (nada aleatorio local)
    if(moving){ c.bob += dt*8; c.stridePh=(c.stridePh||0)+dt*10*(c.look&&c.look.walk?c.look.walk.stride||1:1); }
    c.actT=(c.actT||0)+dt*(Game.speed||0);
    if(c.moodT>0) c.moodT-=dt;
  }
  for(const f of Game.floaters) f.t+=dt;
  for(const p of Game.particles){ p.t+=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=200*dt; } Game.particles=Game.particles.filter(p=>p.t<p.life);
  hud.tick+=dt; if(Game.mode==='service' && hud.tick>0.25){ hud.tick=0; updateHud(); }
}
// --- Avisos rápidos entre jugadores ---
export const PINGS = { ayuda:'¡Échame una mano!', mesas:'Hay mesas sucias', genero:'Se acaba el género', bien:'¡Buen trabajo!' };
export function sendPing(k){
  $('#ping-menu').classList.add('hidden');
  if(isGuest()) netAct({a:'ping',k}); else if(hostLive()) Net.events.push({e:'ping',from:'p1',k});
  toastLocal('Aviso enviado', PINGS[k], '');
}
export function showPing(from,k){ toastLocal(escapeHtml(Net.names[from]||'Tu pareja'), PINGS[k]||'', k==='bien'?'good':'bad'); Audio._raw.start(); if(navigator.vibrate) try{ navigator.vibrate(120); }catch(e){} }
$('#btn-ping').addEventListener('click',e=>{ e.stopPropagation(); $('#ping-menu').classList.toggle('hidden'); });
document.querySelectorAll('#ping-menu button').forEach(b=>b.addEventListener('click',()=>sendPing(b.dataset.ping)));
// --- Sala ---
export function showLobby(){
  Game.mode='lobby'; hideAll(); $('#lobby').classList.add('show'); renderLobby();
}
export function lobbyStatus(t){ const el=$('#lobby-status'); if(el){ el.textContent=t; el.classList.remove('err'); } }
export function lobbyError(t){ const el=$('#lobby-status'); if(el){ el.textContent=t; el.classList.add('err'); } }
export function myName(){ const v=($('#lobby-name').value||'').trim().slice(0,14); return v; }
export function renderLobby(){
  const step = Net.role==='host' ? 'host' : Net.role==='guest' ? 'guest' : 'choose';
  ['choose','host','guest'].forEach(k=>$('#lobby-'+k).classList.toggle('hidden', k!==step));
  $('#lobby-name').closest('.field').classList.toggle('hidden', step!=='choose');
  $('#btn-lobby-go').classList.toggle('hidden', step!=='host');
  if(step==='host'){
    $('#lobby-code').textContent = Net.code||'····';
    $('#btn-lobby-go').disabled = !Net.peer;
    $('#lobby-peer').innerHTML = Net.peer ? `<span class="dot on"></span><span><b>${escapeHtml(Net.names.p2)}</b> se ha unido a la partida</span>` : '<span class="dot"></span>Esperando a que tu pareja se una…';
    document.querySelectorAll('#role-pick button').forEach(b=>b.classList.toggle('on', b.dataset.role===Net.roles.p1));
    $('#role-note').textContent = `${Net.names.p1}: ${STATION_LABEL[Net.roles.p1]} · ${Net.peer?Net.names.p2:'Tu pareja'}: ${STATION_LABEL[Net.roles.p2]}`;
    lobbyStatus('');
  }
  if(step==='guest'){
    $('#guest-info').innerHTML = `Estás en la partida <b>${Net.code}</b> de <b>${escapeHtml(Net.names.p1)}</b>. Llevarás <b>${STATION_LABEL[Net.roles.p2].toLowerCase()}</b>.<br>Esperando a que empiece la temporada…`;
    lobbyStatus('');
  }
}
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
export function leaveCoop(){ const ws=Net.ws; Net.ws=null; Net.role='solo'; Net.me='p1'; Net.code=null; Net.peer=false; Net.lastMode=null; if(ws) try{ ws.close(); }catch(e){}
  hideAll(); Game.mode='title'; $('#title').classList.add('show'); }
export function netLost(html, canSolo){
  $('#netmsg-text').innerHTML = html;
  $('#btn-net-solo').classList.toggle('hidden', !canSolo || Game.mode==='lobby');
  $('#netmsg').classList.add('show');
}
export function hideNetMsg(){ $('#netmsg').classList.remove('show'); }
$('#btn-net-home').addEventListener('click',()=>{ hideNetMsg(); location.reload(); });
$('#btn-net-solo').addEventListener('click',()=>{ hideNetMsg(); goSolo(); });
$('#btn-net-wait').addEventListener('click',()=>{ hideNetMsg(); });
export function goSolo(){
  const ws=Net.ws; Net.ws=null; if(ws) try{ ws.close(); }catch(e){}
  Net.role='solo'; Net.me='p1'; Net.peer=false;
  if(Game.mode==='service'){ Game.slots = Game.slots.filter(s=>s.who!=='p2'); const p1=slotOf('p1'); if(p1) p1.station='all'; Game.slots.forEach(s=>{ if(s.cust && s.who==='p2') s.cust=null; }); for(const c of Game.customers) if(c.state==='prep' && !c.inPrep && pendingIdx(c).length) {} setSpeed(1); showServiceUI(); }
  else if(Game.mode==='plan') showPlanUI();
  else if(Game.mode==='report') showReportUI();
  else if(Game.mode==='lobby'){ hideAll(); Game.mode='title'; $('#title').classList.add('show'); }
}
