/* Plan de apertura: compras, carta, mejoras y listo. Lo importa ui.js. */
import { trackCost } from './bookkeeping.js?v=27.6';
import { GOAL, HOUR_CURVE, ITEMS, ITEM_IDS, RENT, SEASON_DAYS, SPECIAL_DAYS, STAFF, UPGRADES, WEATHER } from './config.js?v=27.6';
import { $, clamp, escapeHtml, eur, eur2 } from './util.js?v=27.6';
import { ICON_URL } from './icons.js?v=27.6';
import { Audio } from './audio.js?v=27.6';
import { Game, Net, activeItems, closeHour, dayName, isCoop, isGuest, isWeekend, itemUnlocked, lvl, partner, wages, weatherToday } from './state.js?v=27.6';
import { buyStock, difficultyProfile, difficultyRush, newSeason, startDay } from './sim.js?v=27.6';
import { advanceFromReport } from './report.js?v=27.6';
import { netAct, netDirty } from './net.js?v=27.6';
import { drawPerson } from './render.js?v=27.6';
// ---------- Pantallas ----------
export function hideAll(){ document.querySelectorAll('.overlay').forEach(o=>o.classList.remove('show')); }
export const Plan={tab:'compras'};
export function showPlan(){
  Game.mode='plan'; Net.ready={p1:false,p2:false};
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
  const shirt={camarero:'#0f8b8d',cocinero:'#ffffff',limpiador:'#f5b82e',terraza:'#237d85'}[id];
  const skin={camarero:'#c58a5c',cocinero:'#e0a97e',limpiador:'#8d5a3b',terraza:'#c58a5c'}[id];
  drawPerson(c,44,140,{shirt,skin,hat:id==='cocinero'?'chef':id==='camarero'?null:'gorra',look:{hair:{style:id==='limpiador'?'flequillo':'corto',color:'#d9b35a'},build:1,height:1,walk:{},acc:[]},type:'staff',scale:1.35});
  avatarCache[id]=cv.toDataURL(); return avatarCache[id];
}

export function applyPlanAction(who, d){
  if(Game.mode!=='plan') return;
  const by = isCoop() ? Net.names[who] : null;
  if(d.buy){ buyStock(d.buy,+d.n); }
  else if(d.price){ const id=d.price; Game.prices[id]=Math.round(clamp(Game.prices[id]+ (+d.d)*(ITEMS[id].ref>8?5:1), 0.5, ITEMS[id].ref*3)*10)/10; }
  else if(d.toggle){ const id=d.toggle; Game.enabled[id]=!Game.enabled[id]; if(!activeItems().length) Game.enabled[id]=true; }
  else if(d.up){ const u=UPGRADES.find(x=>x.id===d.up), l=lvl(u.id), cost=u.levels[l]; const locked=u.req && !lvl(u.req);
    if(cost!=null && !locked && Game.money>=cost){ Game.money-=cost;trackCost(cost,'upgrades',true); Game.upgrades[u.id]=l+1; Audio.good(); toast(u.name,(by?by+' lo ha instalado. ':'Instalado. ')+u.desc,'good'); } }
  else if(d.staff){ const id=d.staff; Game.staff[id]=!Game.staff[id]; if(by) toast(STAFF.find(x=>x.id===id).name, `${by} ${Game.staff[id]?'lo ha contratado':'lo ha despedido'}.`, ''); }
  if(Net.ready.p1||Net.ready.p2){ if(d.up||d.staff||d.buy){ /* cambios: se mantiene el listo */ } }
  renderTab(); refreshPlanMoney(); netDirty();
}

export function pressReady(){ if(isGuest()){ Net.readySent=true; updateReadyUI(); netAct({a:'ready'}); } else toggleReady('p1'); }
export function toggleReady(who){
  if(Game.mode!=='plan' && Game.mode!=='report') return;
  Net.ready[who]=!Net.ready[who];
  if(Net.ready.p1 && Net.ready.p2){
    Net.ready={p1:false,p2:false};
    if(Game.mode==='plan'){ startDay(); }
    else advanceFromReport();
  } else updateReadyUI();
  netDirty();
}
