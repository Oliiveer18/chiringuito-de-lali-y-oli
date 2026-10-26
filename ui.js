/* =========================================================
   ui.js
   Pantallas y HUD: plan de apertura, servicio, urgente, avisos (toasts) y acciones del jugador.
   ========================================================= */
import { GOAL, HOUR_CURVE, ITEMS, ITEM_IDS, RENT, SEASON_DAYS, SPECIAL_DAYS, STAFF, STATION_COLOR, STATION_LABEL, UPGRADES, WEATHER, who } from './config.js?v=26.0';
import { $, clamp, escapeHtml, eur, eur2, hhmm, stars } from './util.js?v=26.0';
import { ICON_URL } from './icons.js?v=26.0';
import { Audio } from './audio.js?v=26.0';
import { Game, Net, activeItems, closeHour, dayName, hostLive, isCoop, isGuest, isWeekend, itemUnlocked, lvl, partner, wages, weatherToday } from './state.js?v=26.0';
import { buyStock, cleanTable, difficultyProfile, difficultyRush, newSeason, servable, startDay, tryServe } from './sim.js?v=26.0';
import { Rev, advanceFromReport, refreshReportUI, respondReview } from './report.js?v=26.0';
import { canvas, toWorld } from './canvas.js?v=26.0';
import { guestClean, guestServe, netAct, netDirty } from './net.js?v=26.0';
import { drawPerson } from './render.js?v=26.0';

export function showServiceUI(){
  hideAll(); $('#hud').classList.remove('hidden'); $('#stockbar').classList.remove('hidden');
  $('#hud-role').classList.toggle('hidden', !isCoop()); $('#btn-ping').classList.toggle('hidden', !isCoop());
  if(isCoop()){ const st=Net.roles[Net.me]; const el=$('#hud-role'); el.textContent='Tú: '+STATION_LABEL[st]; el.style.background=STATION_COLOR[st]; }
  const hint=$('#hint');
  hint.textContent = isCoop() ? `Tú preparas ${Net.roles[Net.me]==='barra'?'las bebidas':'los platos'} · Entregad a la vez los pedidos mixtos para cobrar propina`
                              : 'Toca a los clientes de la cola para servirles · Toca las mesas sucias para limpiarlas';
  if(Game.day<=2){ hint.classList.remove('hidden'); hint.style.opacity=1; setTimeout(()=>hint.style.opacity=0,14000);} else hint.classList.add('hidden');
  updateHud(); updateStockbar();
}

// ---------- Pantallas ----------
export function hideAll(){ document.querySelectorAll('.overlay').forEach(o=>o.classList.remove('show')); }
export const Plan={tab:'compras'}; let planPurchases=0;
export function showPlan(){
  Game.mode='plan'; planPurchases=0; Net.ready={p1:false,p2:false};
  showPlanUI(); netDirty();
}
export function showPlanUI(){
  hideAll(); $('#hud').classList.add('hidden'); $('#stockbar').classList.add('hidden'); $('#hint').classList.add('hidden');
  $('#plan').classList.add('show');
  $('#plan-eyebrow').textContent = `Día ${Game.day} de ${SEASON_DAYS} · ${dayName(Game.day)} · 8:30`;
  const greet = ['Buenos días','Arriba, que hay playa','A por otro día','Huele a salitre','Otra mañana en la costa'];
  $('#plan-title').textContent = Game.day===1 ? 'Tu primer día' : greet[Game.day%greet.length];
  renderForecast(); renderTab(); refreshPlanMoney(); updateReadyUI();
}
export function renderForecast(){
  const w=weatherToday(), tw=Game.forecast[Game.day];
  const ev=SPECIAL_DAYS[Game.day];
  let html = `<div class="fc"><div class="k">Hoy</div><div class="v">${WEATHER[w].label}</div><div class="d">${WEATHER[w].desc}${isWeekend(Game.day)?' Fin de semana: más gente del pueblo.':''}</div></div>`;
  if(ev) html += `<div class="fc event"><div class="k">Evento</div><div class="v">${ev.title}</div><div class="d">${ev.desc}</div></div>`;
  if(Game.day<SEASON_DAYS) html += `<div class="fc"><div class="k">Mañana</div><div class="v">${WEATHER[tw].label}</div><div class="d">${SPECIAL_DAYS[Game.day+1]?SPECIAL_DAYS[Game.day+1].title:dayName(Game.day+1)}</div></div>`;
  html += `<div class="fc"><div class="k">Objetivo</div><div class="v">${eur(GOAL)}</div><div class="d">Quedan ${SEASON_DAYS-Game.day+1} días · valoración ${Game.rep.toFixed(1)}/5</div></div>`;
  const difficulty=difficultyProfile();
  html += `<div class="fc"><div class="k">Dificultad progresiva</div><div class="v">${difficulty.label}</div><div class="d">Afluencia ${Math.round(difficulty.arrivals*100)}% · paciencia ${Math.round(difficulty.patience*100)}%. ${difficulty.peak>0?'Pico gradual de 12:00 a 15:00'+(closeHour()>20?' y de 19:30 a 21:30':'')+'.':'Inicio suave para organizaros.'}${Game.day>=9?' Pueden llegar pedidos de tres productos.':''}</div></div>`;
  if(Game.buzz>0.03) html += `<div class="fc"><div class="k">Boca a boca</div><div class="v">+${Math.round(Game.buzz*12)}%</div><div class="d">Recomendaciones de habituales contentos: más afluencia hoy.</div></div>`;
  $('#forecast').innerHTML=html;
}
export function refreshPlanMoney(){
  $('#plan-money').textContent = eur(Game.money);
  let h = `Al cierre pagarás <b>${eur(RENT+wages())}</b> (licencia${wages()?' y sueldos':''}).`;
  if(isCoop()){ const pn=partner(); h += `<br><span class="mate-status ${Net.ready[pn]?'ok':''}">${escapeHtml(Net.names[pn])}: ${Net.ready[pn]?'todo listo':'preparando el día…'}</span>`; }
  $('#plan-costs').innerHTML = h;
}
export function updateReadyUI(){
  const pn=partner(), me=Net.me;
  if(Game.mode==='plan'){
    refreshPlanMoney();
    const waiting = isCoop() && (Net.ready[me] || Net.readySent);
    $('#btn-open').textContent = !isCoop() ? 'Abrir el chiringuito' : waiting ? 'Esperando…' : 'Estoy listo';
    $('#btn-open').classList.toggle('waiting', waiting);
  }
  if(Game.mode==='report' && Net.ui){
    const waiting = isCoop() && (Net.ready[me] || Net.readySent);
    $('#btn-next').textContent = !isCoop() ? Net.ui.btn : waiting ? 'Esperando…' : Net.ui.btn;
    $('#btn-next').classList.toggle('waiting', waiting);
    $('#rep-status').innerHTML = isCoop() ? `<span class="mate-status ${Net.ready[pn]?'ok':''}">${escapeHtml(Net.names[pn])}: ${Net.ready[pn]?'ha terminado':'leyendo el balance…'}</span>` : '';
  }
}
export function flashMoney(){ const el = Game.mode==='plan'? $('#plan-money') : $('#urg-money'); if(!el) return; el.style.color='#c73e2a'; setTimeout(()=>el.style.color='',400); }
export function demandHint(id){
  const ratio=Game.prices[id]/ITEMS[id].ref;
  if(ratio<0.85) return '<span class="tag good">Barato: vuela</span>';
  if(ratio<=1.12) return '<span class="tag">Precio justo</span>';
  if(ratio<=1.4) return '<span class="tag mid">Caro para los locales</span>';
  if(ratio<=2.0) return '<span class="tag bad">Solo turistas</span>';
  return '<span class="tag bad">Nadie lo pide</span>';
}
export function renderTab(){
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t.dataset.tab===Plan.tab));
  const b=$('#tab-body'); let h=''; if(Plan.tab==='personal'){document.dispatchEvent(new Event('workforce-paint'));return;}
  // Pestanas de otros modulos (p. ej. Carrera) pintan su propio contenido: no se borra en cada actualizacion de dinero o cooperativo.
  if(!['compras','carta','mejoras','personal'].includes(Plan.tab)){ document.dispatchEvent(new Event('plan-tab-repaint')); return; }
  if(Plan.tab==='compras'){
    h += `<p class="muted" style="margin:0 0 6px">Calcula unas ${Math.round(estimateCustomers())} visitas hoy. Lo fresco se estropea por la noche${lvl('nevera')?' (poco, gracias a la nevera)':''}.</p>`;
    for(const id of ITEM_IDS){
      const it=ITEMS[id], un=itemUnlocked(id);
      const sp = lvl('nevera')?it.spoilF:it.spoil;
      h += `<div class="row ${un?'':'locked'}"><img src="${ICON_URL[id]}" alt=""><div><div class="name">${it.name}</div><div class="sub">${un?`Coste ${eur2(it.cost)} · en almacén <b>${Game.stock[id]}</b> · merma ${Math.round(sp*100)}%`:`Necesitas: ${UPGRADES.find(u=>u.id===it.unlock).name}`}</div></div>
      <div class="ctrl">${un?[10,25,50].map(n=>`<button class="btn sm" data-buy="${id}" data-n="${n}" ${Game.money<it.cost*n?'disabled':''}>+${n} · ${eur(it.cost*n)}</button>`).join(''):''}</div></div>`;
    }
  } else if(Plan.tab==='carta'){
    h += `<p class="muted" style="margin:0 0 6px">Los turistas pagan casi cualquier cosa; la gente del pueblo conoce los precios. Fíjate en el precio de referencia.</p>`;
    for(const id of ITEM_IDS){
      const it=ITEMS[id], un=itemUnlocked(id);
      if(!un){ h+=`<div class="row locked"><img src="${ICON_URL[id]}" alt=""><div><div class="name">${it.name}</div><div class="sub">Bloqueado</div></div></div>`; continue; }
      const margin = Game.prices[id]-it.cost;
      h += `<div class="row"><img src="${ICON_URL[id]}" alt=""><div><div class="name">${it.name}</div><div class="sub">Referencia ${eur2(it.ref)} · margen ${eur2(margin)} ${demandHint(id)}</div></div>
      <div class="ctrl"><div class="price"><button data-price="${id}" data-d="-0.1" aria-label="Bajar precio">−</button><span class="val">${eur2(Game.prices[id])}</span><button data-price="${id}" data-d="0.1" aria-label="Subir precio">+</button></div>
      <button class="btn sm ${Game.enabled[id]?'teal':''}" data-toggle="${id}">${Game.enabled[id]?'En carta':'Fuera'}</button></div></div>`;
    }
  } else if(Plan.tab==='mejoras'){
    h += '<div class="up-grid">';
    for(const u of UPGRADES){
      const l=lvl(u.id), max=u.levels.length, owned=l>=max, cost=u.levels[l], locked = u.req && !lvl(u.req);
      h += `<div class="up ${owned?'owned':''}"><h4>${u.name}<span class="pips">${u.levels.map((_,i)=>`<i class="${i<l?'on':''}"></i>`).join('')}</span></h4><p>${u.desc}</p>
      <div class="foot">${owned?'<span class="tag good">Instalado</span>':locked?`<span class="tag">Requiere ${UPGRADES.find(x=>x.id===u.req).name.toLowerCase()}</span>`:`<span class="tag">${eur(cost)}</span><button class="btn sm primary" data-up="${u.id}" ${Game.money<cost?'disabled':''}>Comprar</button>`}</div></div>`;
    }
    h += '</div>';
  } else if(Plan.tab==='personal'){
    h += `<p class="muted" style="margin:0 0 6px">El sueldo se paga cada día al cerrar. Puedes contratar o despedir cada mañana.</p>`;
    for(const st of STAFF){
      const hired=!!Game.staff[st.id];
      h += `<div class="row"><img src="${staffAvatar(st.id)}" alt=""><div><div class="name">${st.name}</div><div class="sub">${st.desc} · ${eur(st.wage)}/día</div></div>
      <div class="ctrl"><button class="btn sm ${hired?'':'primary'}" data-staff="${st.id}">${hired?'Despedir':'Contratar'}</button></div></div>`;
    }
  }
  b.innerHTML=h;
}
export function estimateCustomers(){
  const w=WEATHER[weatherToday()]; let tot=0;
  for(let h=10;h<closeHour();h++) tot+=8*(HOUR_CURVE[h]||0.6)*((difficultyRush(h+0.25)+difficultyRush(h+0.75))/2);
  tot*= w.arr*(0.35+Game.rep/5*0.95)*(lvl('redes')?1.15:1)*(isWeekend(Game.day)?1.25:1)*(SPECIAL_DAYS[Game.day]?SPECIAL_DAYS[Game.day].arr:1)*difficultyProfile().arrivals;
  if(lvl('sombrillas') && (weatherToday()==='sol'||weatherToday()==='calima')) tot*=1.15;
  if(isCoop()) tot*=1.4;
  return tot;
}
export const avatarCache={};
export function staffAvatar(id){
  if(avatarCache[id]) return avatarCache[id];
  const cv=document.createElement('canvas'); cv.width=cv.height=88; const c=cv.getContext('2d');
  c.fillStyle='#f6e8cf'; c.beginPath(); c.arc(44,44,42,0,7); c.fill();
  const shirt={camarero:'#0f8b8d',cocinero:'#ffffff',limpiador:'#f5b82e'}[id];
  const skin={camarero:'#c58a5c',cocinero:'#e0a97e',limpiador:'#8d5a3b'}[id];
  drawPerson(c,44,140,{shirt,skin,hat:id==='cocinero'?'chef':id==='camarero'?null:'gorra',look:{hair:{style:id==='limpiador'?'flequillo':'corto',color:'#d9b35a'},build:1,height:1,walk:{},acc:[]},type:'staff',scale:1.35});
  avatarCache[id]=cv.toDataURL(); return avatarCache[id];
}

export function applyPlanAction(who, d){
  if(Game.mode!=='plan') return;
  const by = isCoop() ? Net.names[who] : null;
  if(d.buy){ const c=buyStock(d.buy,+d.n); if(c!==false){ planPurchases+=c; } }
  else if(d.price){ const id=d.price; Game.prices[id]=Math.round(clamp(Game.prices[id]+ (+d.d)*(ITEMS[id].ref>8?5:1), 0.5, ITEMS[id].ref*3)*10)/10; }
  else if(d.toggle){ const id=d.toggle; Game.enabled[id]=!Game.enabled[id]; if(!activeItems().length) Game.enabled[id]=true; }
  else if(d.up){ const u=UPGRADES.find(x=>x.id===d.up), l=lvl(u.id), cost=u.levels[l]; const locked=u.req && !lvl(u.req);
    if(cost!=null && !locked && Game.money>=cost){ Game.money-=cost; Game.upgrades[u.id]=l+1; Audio.good(); toast(u.name,(by?by+' lo ha instalado. ':'Instalado. ')+u.desc,'good'); } }
  else if(d.staff){ const id=d.staff; Game.staff[id]=!Game.staff[id]; if(by) toast(STAFF.find(x=>x.id===id).name, `${by} ${Game.staff[id]?'lo ha contratado':'lo ha despedido'}.`, ''); }
  if(Net.ready.p1||Net.ready.p2){ if(d.up||d.staff||d.buy){ /* cambios: se mantiene el listo */ } }
  renderTab(); refreshPlanMoney(); netDirty();
}
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
  if(!isCoop()){ startDay(); Game.dayStats.purchases=planPurchases; return; }
  pressReady(); });
$('#btn-next').addEventListener('click',()=>{ Audio.click();
  if(!isCoop()){ advanceFromReport(); return; }
  pressReady(); });
export function pressReady(){ if(isGuest()){ Net.readySent=true; updateReadyUI(); netAct({a:'ready'}); } else toggleReady('p1'); }
export function toggleReady(who){
  if(Game.mode!=='plan' && Game.mode!=='report') return;
  Net.ready[who]=!Net.ready[who];
  if(Net.ready.p1 && Net.ready.p2){
    Net.ready={p1:false,p2:false};
    if(Game.mode==='plan'){ const pp=planPurchases; startDay(); Game.dayStats.purchases=pp; }
    else advanceFromReport();
  } else updateReadyUI();
  netDirty();
}
$('#btn-start').addEventListener('click',()=>{ Audio.init(); Audio.good(); Net.role='solo'; Net.me='p1'; newSeason(); Plan.tab='compras'; showPlan(); });

export function showFinal(bankrupt){
  Game.mode='final';
  let title, text;
  if(bankrupt){ title='Cierre por deudas'; text='El banco ha dicho basta. El chiringuito baja la persiana antes de tiempo, pero la arena negra seguirá ahí para el próximo intento.'; }
  else if(Game.money>=GOAL*2){ title='Leyenda del sur'; text='Has comprado la concesión y te sobra para abrir otro en El Médano. Te conocen hasta en La Gomera.'; }
  else if(Game.money>=GOAL){ title='¡El chiringuito es tuyo!'; text='Has ahorrado lo suficiente para comprar la concesión. El año que viene, la temporada empieza con tu nombre en el cartel.'; }
  else if(Game.money>=GOAL*0.5){ title='Temporada decente'; text=`Te faltaron ${eur(GOAL-Game.money)} para comprar la concesión. Te renuevan el contrato de alquiler un año más.`; }
  else { title='Verano para olvidar'; text='Has sobrevivido, pero lejos del objetivo. Toca repensar la carta, los precios y el personal.'; }
  $('#final-card').innerHTML = `<p class="eyebrow">Fin de la temporada · día ${Game.day}</p><h1>${title}</h1><p class="lead">${text}</p>
   <div class="final-stats">
    <div><div class="k">En caja</div><div class="v">${eur(Game.money)}</div></div>
    <div><div class="k">Valoración</div><div class="v">${Game.rep.toFixed(1)} / 5</div></div>
    <div><div class="k">Clientes atendidos</div><div class="v">${Game.season.served}</div></div>
    <div><div class="k">Mejor día</div><div class="v">${eur(Game.season.bestDay)}</div></div>
   </div>
   <button class="btn primary big" id="btn-again">Jugar otra temporada</button>`;
  Net.ui={kind:'final', card:$('#final-card').innerHTML};
  showFinalUI(); netDirty();
}
export function showFinalUI(){
  hideAll(); $('#hud').classList.add('hidden'); $('#stockbar').classList.add('hidden');
  $('#final-card').innerHTML = Net.ui.card;
  $('#final').classList.add('show');
  $('#btn-again').onclick=()=>{ Audio.click(); if(isGuest()) netAct({a:'again'}); else { newSeason(); Plan.tab='compras'; showPlan(); } };
}

// ---------- Urgente ----------
$('#btn-urgent').addEventListener('click',()=>{ if(Game.mode!=='service') return; Audio.click();
  if(!isCoop()){ prevSpeed=Game.speed; setSpeed(0); }
  $('#urg-note').textContent = isCoop() ? 'A mitad de jornada todo cuesta el doble. Ojo: el servicio sigue mientras pides.' : 'A mitad de jornada todo cuesta el doble. Llega al momento.';
  renderUrgent(); $('#urgent').classList.add('show'); });
export let prevSpeed=1;
export function renderUrgent(){
  $('#urg-money').textContent=eur(Game.money);
  $('#urg-body').innerHTML = activeItems().map(id=>`<div class="row"><img src="${ICON_URL[id]}" alt=""><div><div class="name">${ITEMS[id].name}</div><div class="sub">Quedan <b>${Game.stock[id]}</b></div></div>
   <div class="ctrl"><button class="btn sm" data-ub="${id}" ${Game.money<ITEMS[id].cost*20?'disabled':''}>+10 · ${eur(ITEMS[id].cost*20)}</button></div></div>`).join('');
}
export function applyUrgent(id){ if(Game.mode!=='service') return; const c=buyStock(id,10,2); if(c!==false){ Game.dayStats.urgent+=c; if(isCoop()) toast('Pedido urgente', `${Net.names[arguments[1]||'p1']} ha pedido 10 × ${ITEMS[id].name.toLowerCase()}.`, ''); } renderUrgent(); updateStockbar(); updateHud(); }
$('#urg-body').addEventListener('click',e=>{ const t=e.target.closest('button'); if(!t||t.disabled) return; if(isGuest()){ Audio.click(); netAct({a:'urgent', id:t.dataset.ub}); } else applyUrgent(t.dataset.ub,'p1'); });
$('#btn-urg-close').addEventListener('click',()=>{ Audio.click(); $('#urgent').classList.remove('show'); if(!isCoop()) setSpeed(prevSpeed||1); });

// ---------- HUD ----------
export function updateHud(){
  if(!Game.dayStats) return;
  $('#hud-day').textContent=`Día ${Game.day} · ${dayName(Game.day)}`;
  $('#hud-clock').textContent=hhmm(Game.hour);
  $('#hud-weather').textContent=WEATHER[weatherToday()].label;
  $('#hud-money').textContent=eur(Game.money);
  $('#hud-rep').textContent=stars(Game.rep);
}
export function updateStockbar(){
  $('#stockbar').innerHTML = activeItems().map(id=>{ const n=Game.stock[id]; return `<div class="stock ${n===0?'out':n<6?'low':''}" title="${ITEMS[id].name}"><img src="${ICON_URL[id]}" alt="${ITEMS[id].name}">${n}</div>`; }).join('');
}
export function setSpeed(s){ Game.speed=s; document.querySelectorAll('.speed button').forEach(b=>b.classList.toggle('on', +b.dataset.speed===s)); }
document.querySelectorAll('.speed button').forEach(b=>b.addEventListener('click',()=>{ Audio.click(); b.blur();
  if(isGuest()) netAct({a:'speed', v:+b.dataset.speed}); else { setSpeed(+b.dataset.speed); netDirty(); } }));
$('#btn-sound').addEventListener('click',()=>{ Audio.init(); const on=Audio.toggle(); $('#btn-sound').textContent='Sonido: '+(on?'sí':'no'); });

export const toastsEl=$('#toasts');
export function toast(title,text,kind){ if(hostLive()) Net.events.push({e:'toast',title,text,kind}); toastLocal(title,text,kind); }
export function toastLocal(title,text,kind){
  const d=document.createElement('div'); d.className='toast '+(kind||''); d.innerHTML=`<b>${title}</b><br>${text}`; toastsEl.appendChild(d);
  while(toastsEl.children.length>3) toastsEl.firstChild.remove();
  setTimeout(()=>{ d.classList.add('out'); setTimeout(()=>d.remove(),450); }, 4200);
}

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
