/* Servicio, cierre, urgente y avisos. Lo importa ui.js. */
import { GOAL, ITEMS, STATION_COLOR, STATION_LABEL, WEATHER } from './config.js?v=27.82';
import { $, eur, hhmm, stars } from './util.js?v=27.82';
import { ICON_URL } from './icons.js?v=27.82';
import { Audio } from './audio.js?v=27.82';
import { Game, Net, activeItems, dayName, hostLive, isCoop, isGuest, weatherToday } from './state.js?v=27.82';
import { buyStock, newSeason } from './sim.js?v=27.82';
import { hideAll, Plan, showPlan } from './ui-plan.js?v=27.82';
import { netAct, netDirty } from './net.js?v=27.82';
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

export function renderUrgent(){
  $('#urg-money').textContent=eur(Game.money);
  $('#urg-body').innerHTML = activeItems().map(id=>`<div class="row"><img src="${ICON_URL[id]}" alt=""><div><div class="name">${ITEMS[id].name}</div><div class="sub">Quedan <b>${Game.stock[id]}</b></div></div>
   <div class="ctrl"><button class="btn sm" data-ub="${id}" ${Game.money<ITEMS[id].cost*20?'disabled':''}>+10 · ${eur(ITEMS[id].cost*20)}</button></div></div>`).join('');
}
export function applyUrgent(id){ if(Game.mode!=='service') return; const c=buyStock(id,10,2); if(c!==false){ Game.dayStats.urgent+=c; if(isCoop()) toast('Pedido urgente', `${Net.names[arguments[1]||'p1']} ha pedido 10 × ${ITEMS[id].name.toLowerCase()}.`, ''); } renderUrgent(); updateStockbar(); updateHud(); }

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

export const toastsEl=$('#toasts');
export function toast(title,text,kind){ if(hostLive()) Net.events.push({e:'toast',title,text,kind}); toastLocal(title,text,kind); }
export function toastLocal(title,text,kind){
  const d=document.createElement('div'); d.className='toast '+(kind||''); d.innerHTML=`<b>${title}</b><br>${text}`; toastsEl.appendChild(d);
  while(toastsEl.children.length>3) toastsEl.firstChild.remove();
  setTimeout(()=>{ d.classList.add('out'); setTimeout(()=>d.remove(),450); }, 4200);
}
