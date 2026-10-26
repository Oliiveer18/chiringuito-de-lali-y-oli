/* v12: incidentes cooperativos, grupos, entregas con repartidor y red social Chiringo. */
import { Game, Net, hostLive, isCoop, lvl } from './state.js';
import { ITEMS } from './config.js';
import { rnd, clamp } from './util.js';
import { Plan, toast, updateStockbar } from './ui.js';
import { netDirty } from './net.js';
import { spawnCustomer } from './sim.js';

const FOL='socialFollowers';
let lastDay=Game.day, puntaEnd=0, vipIds=[], vipBase=0, vipDone=false, lastT=null;
export const POSTS={
 atardecer:{name:'Atardecer en el chiringuito',cost:0,arr:0.05,followers:2,desc:'Foto del atardecer. Gratis y siempre funciona.'},
 papas:{name:'Papas con mojo',cost:20,arr:0.08,followers:3,req:()=>Game.stock.papas>0,reqTxt:'Necesitáis papas en stock.',desc:'Atrae locales con hambre.'},
 barraquito:{name:'Barraquito',cost:25,arr:0.08,followers:3,req:()=>Game.stock.barraquito>0,desc:'Atrae clientes de barra.'},
 algodon:{name:'Algodón de azúcar',cost:30,arr:0.15,followers:5,req:()=>lvl('algodonera')>0,reqTxt:'Necesitáis la algodonera.',desc:'Atrae familias. Riesgo si no queda algodón.'},
 show:{name:'Show esta tarde',cost:40,arr:0.20,followers:5,req:()=>!!Game.upgrades.showHoy,reqTxt:'Contrata primero un show.',desc:'Promociona el show de hoy.'},
 viral:{name:'Vídeo viral',cost:80,arr:0.25,followers:8,req:()=>Game.rep>=3.5,reqTxt:'Necesitáis 3,5 de valoración o más.',desc:'Gran alcance si la valoración acompaña.'}
};
function migrate(){if(Game.upgrades[FOL]==null)Game.upgrades[FOL]=50;if(!Array.isArray(Game.upgrades.socialComments))Game.upgrades.socialComments=[];}
function newDay(){
 lastDay=Game.day;delete Game.upgrades.incidentTipo;delete Game.upgrades.incidentHora;delete Game.upgrades.socialAplicado;delete Game.upgrades.batidoraQuitada;
 const rep=Game.rep,f=Game.upgrades[FOL];let delta=0,comentarios=[];
 if(rep>=4){delta=2+Math.floor(rnd()*4);comentarios=['¡El mejor chiringuito de la zona!','Todo buenísimo, volvemos seguro.'];}
 else if(rep>=3){delta=Math.floor(rnd()*3);comentarios=['Correcto, aunque estaba lleno.','Sitio agradable junto a la playa.'];}
 else{delta=-(1+Math.floor(rnd()*4));comentarios=['Tardaron muchísimo en servirnos.','Faltaba medio menú… decepción.'];}
 const p=Game.upgrades.socialPost;
 if(p==='algodon'&&(Game.stock.algodon||0)<=0){delta-=3;comentarios.unshift('Pusisteis algodón en la red y no quedaba ninguno…');}
 if(p==='show'&&!Game.upgrades.showHoy){delta-=3;comentarios.unshift('Anunciasteis show y no vimos nada.');}
 Game.upgrades[FOL]=clamp(f+delta,0,99999);
 Game.upgrades.socialComments=[...comentarios,...(Game.upgrades.socialComments||[])].slice(0,4);
 if(isCoop()){const pr=0.25+(Game.day/30)*0.45;if(rnd()<pr){const tipos=['batidora','vip','punta','inspeccion','grupo'];Game.upgrades.incidentTipo=tipos[Math.floor(rnd()*tipos.length)];Game.upgrades.incidentHora=Math.round((11.5+rnd()*7)*10)/10;}}
 if(!Game.upgrades.batidoraRota)Game.enabled.batido=true;
 netDirty();
}
function runIncident(){
 const t=Game.upgrades.incidentTipo;delete Game.upgrades.incidentHora;if(!t)return;
 if(t==='batidora'){Game.upgrades.batidoraRota=1;Game.enabled.batido=false;toast('Se rompe la batidora','Los batidos quedan bloqueados. Reparadla (120 €) o quitadlos hoy.','bad');}
 else if(t==='vip'){vipBase=Game.dayStats?Game.dayStats.served:0;vipDone=false;vipIds=[];for(let i=0;i<2;i++)setTimeoutGame(()=>{if(Game.mode!=='service')return;spawnCustomer('turista');const c=Game.customers[Game.customers.length-1];if(c){c.vip=true;vipIds.push(c.id);}},i*0.8);toast('Cliente VIP','Ha llegado un cliente importante con acompañante. Atendedlo rápido: gran propina y reputación.','good');}
 else if(t==='punta'){puntaEnd=Game.t+120;Game.mods.arr*=1.45;toast('Hora punta doble','Llegan turistas y locales a la vez. ¡Repartíos las colas!','bad');}
 else if(t==='inspeccion'){const dirty=Game.tables.filter(x=>x.state==='dirty').length;if(dirty>=1){const fine=100*Math.min(4,dirty);Game.money-=fine;Game.rep=clamp(Game.rep-0.15,0,5);toast('Inspección de Sanidad',dirty+' mesa(s) sucia(s). Multa: '+fine+' €.','bad');}else{Game.rep=clamp(Game.rep+0.15,0,5);toast('Inspección de Sanidad','Todo limpio. +0,15 de valoración.','good');}}
 else if(t==='grupo'){const n=3+Math.floor(rnd()*4);for(let i=0;i<n;i++)setTimeoutGame(()=>{if(Game.mode==='service')spawnCustomer(rnd()<0.6?'turista':'local');},i*1.2);toast('Grupo en el kiosco','Ha llegado un grupo de '+n+' personas. Muchos pedidos y pocas mesas.','bad');}
 netDirty();
}
function repairBatidora(){if(!Game.upgrades.batidoraRota)return;if(Game.money<120){toast('Sin caja','La reparación cuesta 120 €.','bad');return;}Game.money-=120;Game.upgrades.batidoraReparaT=20;delete Game.upgrades.batidoraRota;toast('Reparando batidora','El técnico llega en 20 segundos.','');netDirty();}
function quitBatidos(){if(!Game.upgrades.batidoraRota)return;Game.upgrades.batidoraQuitada=1;delete Game.upgrades.batidoraRota;toast('Batidos fuera del menú','Hoy no habrá batidos.','');netDirty();}
function publish(id){const P=POSTS[id];if(!P||Game.upgrades.socialPostDia===Game.day)return;if(Game.money<P.cost){toast('Sin caja','No llega para publicar.','bad');return;}if(P.req&&!P.req()){toast('No disponible',P.reqTxt||'No cumples el requisito.','bad');return;}Game.money-=P.cost;Game.upgrades.socialPost=id;Game.upgrades.socialPostDia=Game.day;delete Game.upgrades.socialAplicado;toast('Publicado en Chiringo',P.name+' publicado. Seguidores: '+Game.upgrades[FOL]+'.','good');netDirty();}
function orderDelivery(id,qty){const it=ITEMS[id];if(!it||Game.upgrades.deliveryItem)return;if(Game.money<it.cost*qty){toast('Sin caja','No llega para ese pedido.','bad');return;}Game.money-=it.cost*qty;Game.upgrades.deliveryItem=id;Game.upgrades.deliveryQty=qty;Game.upgrades.deliveryT=10+rnd()*5;toast('Repartidor en camino',qty+' × '+it.name+' llegarán en '+Math.round(Game.upgrades.deliveryT)+' segundos.','');netDirty();}
function tick(){
 migrate();
 if(Game.mode==='title'){lastDay=Game.day;lastT=null;return;}
 if(Game.mode==='plan'&&Game.day!==lastDay)newDay();
 if(Game.mode!=='service'){lastT=null;return;}
 if(lastT==null)lastT=Game.t;const gdt=Math.max(0,Game.t-lastT);lastT=Game.t;
 const it=Game.upgrades.incidentTipo;
 if(it&&Game.upgrades.incidentHora&&Game.hour>=Game.upgrades.incidentHora)runIncident();
 if(puntaEnd&&Game.t>=puntaEnd){Game.mods.arr/=1.45;puntaEnd=0;toast('Fin de la hora punta','La marea baja un poco.','');}
 if(Game.upgrades.batidoraReparaT!=null){Game.upgrades.batidoraReparaT-=gdt;if(Game.upgrades.batidoraReparaT<=0){delete Game.upgrades.batidoraReparaT;Game.enabled.batido=true;toast('Batidora reparada','Vuelven los batidos.','good');updateStockbar();netDirty();}}
 if(Game.upgrades.deliveryItem){Game.upgrades.deliveryT-=gdt;const chip=document.getElementById('v12-delivery');if(chip)chip.textContent='🛵 Repartidor: '+Math.max(0,Math.ceil(Game.upgrades.deliveryT))+' s';if(Game.upgrades.deliveryT<=0){const id=Game.upgrades.deliveryItem,q=Game.upgrades.deliveryQty;Game.stock[id]=(Game.stock[id]||0)+q;delete Game.upgrades.deliveryItem;delete Game.upgrades.deliveryQty;delete Game.upgrades.deliveryT;toast('Repartidor en el chiringuito','+'+q+' × '+ITEMS[id].name,'good');updateStockbar();netDirty();}}
 if(vipIds.length&&!vipDone){const alive=vipIds.filter(id=>Game.customers.some(c=>c.id===id));if(!alive.length){vipDone=true;const served=Game.dayStats?Game.dayStats.served-vipBase:0;if(served>=2){Game.money+=60;Game.rep=clamp(Game.rep+0.2,0,5);toast('VIP atendido','Gran servicio: +60 € y +0,2 de valoración.','good');}else{Game.rep=clamp(Game.rep-0.15,0,5);toast('VIP decepcionado','No le atendisteis como merecía.','bad');}vipIds=[];netDirty();}}
 const sp=Game.upgrades.socialPost;if(sp&&Game.upgrades.socialPostDia===Game.day&&!Game.upgrades.socialAplicado){const P=POSTS[sp];if(P){Game.mods.arr*=1+P.arr;Game.upgrades.socialAplicado=1;toast('Chiringo','La publicación atrae más gente hoy (+'+Math.round(P.arr*100)+'%).','good');}}
 updateChip();
}
function updateChip(){let chip=document.getElementById('v12-delivery');if(Game.upgrades.deliveryItem){if(!chip){chip=document.createElement('div');chip.id='v12-delivery';chip.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:86px;z-index:60;background:#0b4f54;color:#fff;padding:8px 14px;border-radius:999px;font:600 13px Satoshi,system-ui;box-shadow:0 6px 18px rgba(0,0,0,.35)';document.body.append(chip);}chip.textContent='🛵 Repartidor: '+Math.max(0,Math.ceil(Game.upgrades.deliveryT))+' s';}else if(chip)chip.remove();}
setInterval(tick,250);

/* UI: aviso batidora, pestaña Red y botón Reparto */
function banner(){let b=document.getElementById('v12-banner');if(Game.upgrades.batidoraRota&&Game.mode==='service'){if(!b){b=document.createElement('div');b.id='v12-banner';b.style.cssText='position:fixed;left:50%;transform:translateX(-50%);top:64px;z-index:70;background:#7a1f1f;color:#fff;padding:10px 14px;border-radius:12px;font:600 13px Satoshi,system-ui;box-shadow:0 6px 18px rgba(0,0,0,.4);display:flex;gap:8px;align-items:center';document.body.append(b);}b.innerHTML='<span>🛑 Batidora rota · sin batidos</span>'+(hostLive()||Net.role==='solo'?'<button id="v12-fix" style="background:#ffd36b;border:0;border-radius:8px;padding:6px 10px;font-weight:700">Reparar 120 €</button><button id="v12-quit" style="background:transparent;border:1px solid #fff;color:#fff;border-radius:8px;padding:6px 10px">Quitar hoy</button>':'<span style="opacity:.8">El anfitrión decide</span>');}else if(b)b.remove();}
setInterval(banner,400);
document.addEventListener('click',e=>{if(e.target.id==='v12-fix')repairBatidora();if(e.target.id==='v12-quit')quitBatidos();});
const tabs=document.querySelector('#plan .tabs');
if(tabs&&!tabs.querySelector('[data-tab="red"]')){const b=document.createElement('button');b.className='tab';b.dataset.tab='red';b.setAttribute('role','tab');b.textContent='Red';tabs.append(b);}
function renderRed(){const b=document.querySelector('#tab-body');if(!b||Plan.tab!=='red')return;const f=Game.upgrades[FOL]||0;const posted=Game.upgrades.socialPostDia===Game.day;let h='<p class="muted" style="margin:0 0 6px"><b>Chiringo</b> · '+f+' seguidores. La gente comenta según cómo va el local: valoración alta atrae seguidores; las quejas los alejan.</p>';
 if(posted)h+='<p class="muted">Ya habéis publicado hoy: <b>'+(POSTS[Game.upgrades.socialPost]||{}).name+'</b>.</p>';
 if(!(hostLive()||Net.role==='solo'))h+='<p class="muted">Solo el anfitrión puede publicar.</p>';
 for(const [id,P] of Object.entries(POSTS)){const ok=P.req?P.req():true;h+='<div class="row"><div><div class="name">'+P.name+'</div><div class="sub">'+P.desc+' Coste: '+P.cost+' € · +'+Math.round(P.arr*100)+'% de afluencia hoy · +'+P.followers+' seguidores.</div></div><div class="ctrl"><button class="btn sm primary" data-post="'+id+'" '+(posted||!ok||Game.money<P.cost?'disabled':'')+'>'+(posted?'Publicado':'Publicar')+'</button></div></div>';}
 const cms=Game.upgrades.socialComments||[];if(cms.length)h+='<p class="eyebrow small">Últimos comentarios</p>'+cms.map(c=>'<p class="muted" style="margin:4px 0">“'+c+'”</p>').join('');
 b.innerHTML=h;}
new MutationObserver(renderRed).observe(document.getElementById('tab-body'),{childList:true,subtree:true});
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('[data-post]');if(!t||t.disabled)return;if(hostLive()||Net.role==='solo')publish(t.dataset.post);},true);
setInterval(renderRed,500);
function deliveryBtn(){let b=document.getElementById('v12-order');if(Game.mode==='service'){if(!b){b=document.createElement('button');b.id='v12-order';b.textContent='🛵 Reparto';b.style.cssText='position:fixed;right:12px;bottom:86px;z-index:60;background:#0f8b8d;color:#fff;border:0;padding:10px 14px;border-radius:999px;font:700 13px Satoshi,system-ui;box-shadow:0 6px 18px rgba(0,0,0,.35)';document.body.append(b);}}else if(b)b.remove();}
setInterval(deliveryBtn,400);
document.addEventListener('click',e=>{if(e.target.id!=='v12-order')return;if(Game.upgrades.deliveryItem){toast('Repartidor en camino','Esperad a que llegue el pedido actual.','');return;}const id=prompt('Producto a pedir (cerveza, barraquito, batido, papas, queso, pescado):','cerveza');if(!id||!ITEMS[id])return;const q=parseInt(prompt('¿Cuántas unidades?','5'),10);if(!q||q<1)return;orderDelivery(id,Math.min(20,q));});
