/* v13: incidentes, grupos, repartidor y Chiringo ampliado (perfil, tendencias, influencers, reseñas y respuestas). v19: seguidores con modelo (social-model.js). */
import { Game, Net, hostLive, isCoop, itemUnlocked, lvl, setTimeoutGame } from './state.js';
import { ITEMS } from './config.js';
import { rnd, clamp } from './util.js';
import { Plan, toast, updateStockbar } from './ui.js';
import { netDirty } from './net.js';
import { spawnCustomer } from './sim.js';
import { guestSend, onGuestAction } from './coopbridge.js';
import { postEffect, influEffect, settle } from './social-model.js';

const FOL='socialFollowers', RAT='socialRating';
let lastDay=Game.day, puntaEnd=0, vipIds=[], vipBase=0, vipDone=false, lastT=null;
export const POSTS={
 atardecer:{name:'Atardecer en el chiringuito',cost:0,arr:0.05,followers:2,desc:'Foto del atardecer. Gratis y siempre funciona.'},
 papas:{name:'Papas con mojo',cost:20,arr:0.08,followers:3,req:()=>Game.stock.papas>0,reqTxt:'Necesitáis papas en stock.',desc:'Atrae locales con hambre.'},
 barraquito:{name:'Barraquito',cost:25,arr:0.08,followers:3,req:()=>Game.stock.barraquito>0,reqTxt:'Necesitáis barraquitos en stock.',desc:'Atrae clientes de barra.'},
 algodon:{name:'Algodón de azúcar',cost:30,arr:0.15,followers:5,req:()=>lvl('algodonera')>0,reqTxt:'Necesitáis la algodonera.',desc:'Atrae familias. Riesgo si no queda algodón.'},
 show:{name:'Show esta tarde',cost:40,arr:0.20,followers:5,req:()=>!!Game.upgrades.showHoy,reqTxt:'Contrata primero un show.',desc:'Promociona el show de hoy.'},
 viral:{name:'Vídeo viral',cost:80,arr:0.25,followers:8,req:()=>Game.upgrades[RAT]>=3.5&&(Game.upgrades[FOL]||0)>=250,reqTxt:'Necesitáis 3,5 de valoración pública y 250 seguidores.',desc:'Gran alcance si la valoración acompaña.'},
 encuesta:{name:'Encuesta: ¿papas o pescado?',cost:0,arr:0.06,followers:3,desc:'La gente vota y llega más gente. Si vendes 3 del elegido, bonus de seguidores.'},
 concurso:{name:'Sorteo de un barraquito',cost:35,arr:0.12,followers:6,req:()=>Game.stock.barraquito>0,reqTxt:'Necesitáis barraquitos en stock.',desc:'Comentario + sorteo: buena afluencia.'}
};
export const INFLU={micro:{name:'Microinfluencer',cost:100,arr:0.10,followers:20,req:()=>true,reqTxt:''},medio:{name:'Influencer mediano',cost:250,arr:0.20,followers:50,req:()=>Game.upgrades[RAT]>=3&&(Game.upgrades[FOL]||0)>=100,reqTxt:'Necesitáis 3,0 de valoración pública y 100 seguidores.'},grande:{name:'Influencer grande',cost:600,arr:0.35,followers:120,req:()=>Game.upgrades[RAT]>=3.5&&(Game.upgrades[FOL]||0)>=500,reqTxt:'Necesitáis 3,5 de valoración pública y 500 seguidores.'}};
const TRENDS=['papas','batido','cerveza','algodon','pescado'];
function migrate(){if(Game.upgrades[FOL]==null)Game.upgrades[FOL]=50;if(Game.upgrades[RAT]==null)Game.upgrades[RAT]=3;if(!Array.isArray(Game.upgrades.socialComments))Game.upgrades.socialComments=[];if(!Array.isArray(Game.upgrades.socialPend))Game.upgrades.socialPend=[];}
function addPend(k,n,o){const U=Game.upgrades;if(!Array.isArray(U.socialPend))U.socialPend=[];U.socialPend.push({k,n,...(o||{})});}
function newDay(){
 lastDay=Game.day;puntaEnd=0;vipIds=[];vipDone=false;
 const U=Game.upgrades,ayer=Game.day-1,s=Game.day>1?Game.dayStats:null,sold=(s&&s.sold)||{},outs=(s&&s.stockOuts)||{};
 const sinResp=U.socialNegativo===1&&!U.socialRespondido;
 delete U.incidentTipo;delete U.incidentHora;delete U.socialAplicado;delete U.batidoraQuitada;delete U.socialRespondido;delete U.socialInfluContratado;delete U.socialArr;delete U.socialInfluArr;
 const rep=Game.rep,f=U[FOL]||0;const extra=[];let postOk=true;const neg=[],pos=[];
 const p=(U.socialPostDia===ayer)?U.socialPost:null;
 // publicación de ayer: ¿se cumplió lo prometido?
 if(s&&p==='algodon'&&(outs.algodon||0)>0){postOk=false;neg.push('Pusisteis algodón en la red y no quedaba ninguno…');}
 if(s&&p==='show'){if(U.showDia!==ayer){postOk=false;neg.push('Anunciasteis show y no vimos nada.');}else if(U.showFlojoDia===ayer){postOk=false;neg.push('El show anunciado fue un chasco: casi no había ambiente.');}}
 if(s&&p==='encuesta'){const t=U.socialPoll;if(t&&ITEMS[t]&&(sold[t]||0)>=3){extra.push({k:'Encuesta acertada',n:4});pos.push('La encuesta acertó: había ganas de '+ITEMS[t].name.toLowerCase()+'.');}}
 delete U.socialPoll;
 // tendencia de ayer
 if(s&&U.socialTrendDia===ayer&&U.socialTrend&&ITEMS[U.socialTrend]){const t=U.socialTrend;if((sold[t]||0)>=3){extra.push({k:'Tendencia acertada',n:6});Game.rep=clamp(Game.rep+0.1,0,5);pos.push('Justo lo que buscaba hoy: '+ITEMS[t].name.toLowerCase()+'.');}}
 let tier;
 if(rep>=4){extra.push({k:'Boca a boca',n:2+Math.floor(rnd()*4)});tier=['¡El mejor chiringuito de la zona!','Todo buenísimo, volvemos seguro.','Mesas limpias y trato de diez.'];}
 else if(rep>=3){const b=Math.floor(rnd()*3);if(b>0)extra.push({k:'Boca a boca',n:b});tier=['Correcto, aunque estuvo bastante lleno.','Sitio agradable junto a la playa.','Buen sitio, aunque esperé un poco.'];}
 else{tier=['Tardaron muchísimo en servirnos.','Faltaba medio menú… decepción.','Caro para lo que es.'];}
 const picks=tier.slice().sort(()=>rnd()-0.5).slice(0,2);
 // balance de seguidores: ganados menos perdidos (social-model.js)
 const idle=p?0:(U.socialIdle||0)+1;
 const S=settle({f,rep,pend:U.socialPend||[],postOk,extra,sinResp,idle,prestados:U.socialPrestados});
 U[FOL]=S.total;U.socialIdle=idle;
 U.socialReport={dia:ayer,gains:S.gains,losses:S.losses,gainSum:S.gainSum,lossSum:S.lossSum,net:S.net};
 let pr=U.socialPrestados;if(pr){pr.dias-=1;if(pr.dias<=0)pr=null;}
 const add=(U.socialPend||[]).filter(e=>e.prest).reduce((a,e)=>a+(e.n||0),0);if(add>0)pr={n:(pr?pr.n:0)+add,dias:7};
 if(pr)U.socialPrestados=pr;else delete U.socialPrestados;
 U.socialPend=[];
 if(Game.day>1)toast('Chiringo · balance de ayer',(S.net>=0?'+':'')+S.net+' seguidores ('+S.gainSum+' ganados, '+S.lossSum+' perdidos).',S.net>=0?'good':'bad');
 U.socialComments=[...neg,...pos,...picks,...(U.socialComments||[])].slice(0,6);
 U.socialNegativo=(neg.length||(!pos.length&&rep<3))?1:0;
 // valoración pública
 let r=U[RAT]||3;r+=(rep-r)*0.15;if(p)r+=postOk?0.05:-0.2;U[RAT]=clamp(r,1,5);
 // tendencia e influencer
 delete U.socialTrend;delete U.socialTrendDia;delete U.socialInflu;delete U.socialInfluDia;
 if(rnd()<0.45){const t=TRENDS[Math.floor(rnd()*TRENDS.length)];U.socialTrend=t;U.socialTrendDia=Game.day;}
 if(rnd()<0.25){const ks=Object.keys(INFLU);U.socialInflu=ks[Math.floor(rnd()*ks.length)];U.socialInfluDia=Game.day;}
 // incidente
 if(isCoop()){const pr2=0.25+(Game.day/30)*0.45;if(rnd()<pr2){const tipos=['batidora','vip','punta','inspeccion','grupo'];U.incidentTipo=tipos[Math.floor(rnd()*tipos.length)];U.incidentHora=Math.round((11.5+rnd()*7)*10)/10;}}
 if(!U.batidoraRota)Game.enabled.batido=true;
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
function publish(id){const P=POSTS[id],U=Game.upgrades;if(!P||U.socialPostDia===Game.day)return;if(Game.money<P.cost){toast('Sin caja','No llega para publicar.','bad');return;}if(P.req&&!P.req()){toast('No disponible',P.reqTxt||'No cumples el requisito.','bad');return;}
 const trendId=(U.socialTrendDia===Game.day)?U.socialTrend:null,prevId=(U.socialPostDia===Game.day-1)?U.socialPost:null;
 const fx=postEffect({id,P,f:U[FOL]||0,rating:U[RAT]||3,trendId,prevId});
 Game.money-=P.cost;U.socialPost=id;U.socialPostDia=Game.day;delete U.socialAplicado;U.socialArr=fx.arr;addPend(P.name,fx.followers,{post:true});
 toast('Publicado en Chiringo',P.name+' · +'+fx.followers+' seguidores al cierre · +'+Math.round(fx.arr*100)+'% de afluencia.'+(fx.fat<1?' Repetir la publicación de ayer reduce el efecto.':''),'good');
 if(id==='encuesta'){const w=rnd()<0.5?'papas':'pescado';U.socialPoll=w;toast('Encuesta cerrada','La gente ha votado: '+ITEMS[w].name+'. Vended 3 o más hoy.','');}netDirty();}
function hireInflu(){const U=Game.upgrades,k=U.socialInflu;if(!k||U.socialInfluContratado)return;const I=INFLU[k];if(Game.money<I.cost){toast('Sin caja','No llega para el influencer.','bad');return;}if(!I.req()){toast('No disponible',I.reqTxt,'bad');return;}const ie=influEffect({I,f:U[FOL]||0,rating:U[RAT]||3});Game.money-=I.cost;addPend(I.name,ie.followers,{prest:true});U.socialInfluArr=ie.arr;U.socialInfluContratado=1;toast('Colaboración cerrada',I.name+' visitará el chiringuito hoy: +'+Math.round(ie.arr*100)+'% de afluencia y +'+ie.followers+' seguidores al cierre (muchos son prestados y se irán antes).','good');netDirty();}
function respond(kind){if(Game.upgrades.socialRespondido)return;const last=(Game.upgrades.socialComments||[])[0];if(!last)return;if(kind==='disculpa'){addPend('Respuesta',1);Game.upgrades[RAT]=clamp(Game.upgrades[RAT]+0.05,1,5);}else{if(Game.money<50){toast('Sin caja','El descuento cuesta 50 €.','bad');return;}Game.money-=50;addPend('Respuesta',3);Game.upgrades[RAT]=clamp(Game.upgrades[RAT]+0.15,1,5);}Game.upgrades.socialRespondido=1;toast('Respuesta publicada',kind==='disculpa'?'Habéis respondido con una disculpa.':'Habéis ofrecido un descuento.', 'good');netDirty();}
function orderDelivery(id,qty){const it=ITEMS[id];if(!it||Game.upgrades.deliveryItem)return;if(!itemUnlocked(id)){toast('No disponible','Ese producto aún no está desbloqueado.','bad');return;}if(Game.money<it.cost*qty){toast('Sin caja','No llega para ese pedido.','bad');return;}Game.money-=it.cost*qty;Game.upgrades.deliveryItem=id;Game.upgrades.deliveryQty=qty;Game.upgrades.deliveryT=10+rnd()*5;toast('Repartidor en camino',qty+' × '+it.name+' llegarán en '+Math.round(Game.upgrades.deliveryT)+' segundos.','');netDirty();}
// acciones que la invitada envía al anfitrión (se validan igual que si las pulsara él)
onGuestAction('post',v=>{if(typeof v==='string')publish(v);});
onGuestAction('influ',()=>hireInflu());
onGuestAction('resp',v=>{if(v==='disculpa'||v==='descuento')respond(v);});
onGuestAction('fix',()=>repairBatidora());
onGuestAction('quit',()=>quitBatidos());
onGuestAction('delivery',v=>{if(v&&typeof v.id==='string')orderDelivery(v.id,Math.min(20,Math.max(1,Math.floor(Number(v.qty))||1)));});
function tick(){
 migrate();
 if(Game.mode==='title'){lastDay=Game.day;lastT=null;return;}
 if(Game.mode==='plan'&&Game.day!==lastDay)newDay();
 if(Game.mode!=='service'){lastT=null;return;}
 if(lastT==null)lastT=Game.t;const gdt=Math.max(0,Game.t-lastT);lastT=Game.t;
 if(Game.upgrades.showHoy){Game.upgrades.showDia=Game.day;if(Game.upgrades.showFlojo)Game.upgrades.showFlojoDia=Game.day;}
 if(Net.role!=='guest'&&lvl('terraza')&&Game.upgrades.terrazaDia!==Game.day){Game.mods.arr*=1.1;Game.upgrades.terrazaDia=Game.day;}
 const it=Game.upgrades.incidentTipo;
 if(it&&Game.upgrades.incidentHora&&Game.hour>=Game.upgrades.incidentHora)runIncident();
 if(puntaEnd&&Game.t>=puntaEnd){Game.mods.arr/=1.45;puntaEnd=0;toast('Fin de la hora punta','La marea baja un poco.','');}
 if(Game.upgrades.batidoraReparaT!=null){Game.upgrades.batidoraReparaT-=gdt;if(Game.upgrades.batidoraReparaT<=0){delete Game.upgrades.batidoraReparaT;Game.enabled.batido=true;toast('Batidora reparada','Vuelven los batidos.','good');updateStockbar();netDirty();}}
 if(Game.upgrades.deliveryItem){Game.upgrades.deliveryT-=gdt;if(Game.upgrades.deliveryT<=0){const id=Game.upgrades.deliveryItem,q=Game.upgrades.deliveryQty;Game.stock[id]=(Game.stock[id]||0)+q;delete Game.upgrades.deliveryItem;delete Game.upgrades.deliveryQty;delete Game.upgrades.deliveryT;toast('Repartidor en el chiringuito','+'+q+' × '+ITEMS[id].name,'good');updateStockbar();netDirty();}}
 if(vipIds.length&&!vipDone){const alive=vipIds.filter(id=>Game.customers.some(c=>c.id===id));if(!alive.length){vipDone=true;const served=Game.dayStats?Game.dayStats.served-vipBase:0;if(served>=2){Game.money+=60;Game.rep=clamp(Game.rep+0.2,0,5);toast('VIP atendido','Gran servicio: +60 € y +0,2 de valoración.','good');}else{Game.rep=clamp(Game.rep-0.15,0,5);toast('VIP decepcionado','No le atendisteis como merecía.','bad');}vipIds=[];netDirty();}}
 if(!Game.upgrades.socialAplicado){const posted=Game.upgrades.socialPostDia===Game.day,P=posted?POSTS[Game.upgrades.socialPost]:null;let arr=P?(Game.upgrades.socialArr!=null?Game.upgrades.socialArr:P.arr):0;const inf=Game.upgrades.socialInfluContratado?INFLU[Game.upgrades.socialInflu]:null;if(inf)arr+=(Game.upgrades.socialInfluArr!=null?Game.upgrades.socialInfluArr:inf.arr);if(arr>0){Game.mods.arr*=1+arr;toast('Chiringo','La red social atrae más gente hoy (+'+Math.round(arr*100)+'%).','good');}if(posted||inf)Game.upgrades.socialAplicado=1;}
 updateChip();
}
function updateChip(){let chip=document.getElementById('v12-delivery');if(Game.upgrades.deliveryItem){if(!chip){chip=document.createElement('div');chip.id='v12-delivery';chip.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:86px;z-index:60;background:#0b4f54;color:#fff;padding:8px 14px;border-radius:999px;font:600 13px Satoshi,system-ui;box-shadow:0 6px 18px rgba(0,0,0,.35)';document.body.append(chip);}chip.textContent='🛵 Repartidor: '+Math.max(0,Math.ceil(Game.upgrades.deliveryT))+' s';}else if(chip)chip.remove();}
setInterval(tick,250);
setInterval(updateChip,500);

/* UI */
function banner(){let b=document.getElementById('v12-banner');if(Game.upgrades.batidoraRota&&Game.mode==='service'){if(!b){b=document.createElement('div');b.id='v12-banner';b.style.cssText='position:fixed;left:50%;transform:translateX(-50%);top:64px;z-index:70;background:#7a1f1f;color:#fff;padding:10px 14px;border-radius:12px;font:600 13px Satoshi,system-ui;box-shadow:0 6px 18px rgba(0,0,0,.4);display:flex;gap:8px;align-items:center';document.body.append(b);}b.innerHTML='<span>🛑 Batidora rota · sin batidos</span><button id="v12-fix" style="background:#ffd36b;border:0;border-radius:8px;padding:6px 10px;font-weight:700">Reparar 120 €</button><button id="v12-quit" style="background:transparent;border:1px solid #fff;color:#fff;border-radius:8px;padding:6px 10px">Quitar hoy</button>';}else if(b)b.remove();}
setInterval(banner,400);
document.addEventListener('click',e=>{const id=e.target.id;if(id!=='v12-fix'&&id!=='v12-quit')return;if(Net.role==='guest'){guestSend(id==='v12-fix'?'fix':'quit');return;}if(id==='v12-fix')repairBatidora();else quitBatidos();});
const tabs=document.querySelector('#plan .tabs');
if(tabs&&!tabs.querySelector('[data-tab="red"]')){const b=document.createElement('button');b.className='tab';b.dataset.tab='red';b.setAttribute('role','tab');b.textContent='Red';tabs.append(b);}
function stars(r){const n=Math.round(r);return '★'.repeat(n)+'☆'.repeat(5-n);}
function renderRed(){const b=document.querySelector('#tab-body');if(!b||Plan.tab!=='red')return;const f=Game.upgrades[FOL]||0,r=Game.upgrades[RAT]||3;const posted=Game.upgrades.socialPostDia===Game.day;let h='<p class="muted" style="margin:0 0 6px"><b>Chiringo</b> · '+f+' seguidores · valoración pública '+stars(r)+' ('+r.toFixed(1)+')</p>';
 const tr=Game.upgrades.socialTrend;if(tr&&ITEMS[tr]&&Game.upgrades.socialTrendDia===Game.day)h+='<p class="muted">📈 Tendencia hoy: <b>'+ITEMS[tr].name+'</b>. Vende 3 o más y publicadlo para ganar seguidores.</p>';
 const inf=Game.upgrades.socialInflu;if(inf&&Game.upgrades.socialInfluDia===Game.day&&!Game.upgrades.socialInfluContratado){const I=INFLU[inf];h+='<div class="row"><div><div class="name">Colaboración: '+I.name+'</div><div class="sub">'+I.cost+' € · +'+Math.round(I.arr*100)+'% afluencia · +'+I.followers+' seguidores. '+I.reqTxt+'</div></div><div class="ctrl"><button class="btn sm primary" data-influ="1" '+(Game.money<I.cost||!I.req()?'disabled':'')+'>Contratar</button></div></div>';}
 if(posted)h+='<p class="muted">Publicado hoy: <b>'+(POSTS[Game.upgrades.socialPost]||{}).name+'</b>.</p>';
 if(posted&&Game.upgrades.socialPost==='encuesta'&&ITEMS[Game.upgrades.socialPoll])h+='<p class="muted">🗳️ Ha ganado: <b>'+ITEMS[Game.upgrades.socialPoll].name+'</b>.</p>';
 for(const [id,P] of Object.entries(POSTS)){const ok=P.req?P.req():true;h+='<div class="row"><div><div class="name">'+P.name+'</div><div class="sub">'+P.desc+' Coste: '+P.cost+' € · +'+Math.round(P.arr*100)+'% afluencia · +'+P.followers+' seguidores.</div></div><div class="ctrl"><button class="btn sm primary" data-post="'+id+'" '+(posted||!ok||Game.money<P.cost?'disabled':'')+'>'+(posted?'Publicado':'Publicar')+'</button></div></div>';}
 const cms=Game.upgrades.socialComments||[];if(cms.length){h+='<p class="eyebrow small">Comentarios</p>'+cms.map(c=>'<p class="muted" style="margin:4px 0">“'+c+'”</p>').join('');const last=cms[0];const neg=Game.upgrades.socialNegativo!=null?Game.upgrades.socialNegativo===1:/tard|falt|caro|decep/i.test(last);if(neg&&!Game.upgrades.socialRespondido)h+='<div class="row"><div><div class="name">Responder a “'+last.slice(0,28)+'…”</div><div class="sub">Disculparos (gratis) u ofrecer un descuento (50 €).</div></div><div class="ctrl"><button class="btn sm teal" data-resp="disculpa">Disculpar</button><button class="btn sm primary" data-resp="descuento" '+(Game.money<50?'disabled':'')+'>Descuento</button></div></div>';}
 b.innerHTML=h;}
new MutationObserver(renderRed).observe(document.getElementById('tab-body'),{childList:true,subtree:true});
document.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('[data-post],[data-influ],[data-resp]');if(!t||t.disabled)return;const k=t.dataset.post?'post':t.dataset.influ?'influ':'resp',v=t.dataset.post||t.dataset.resp||'1';if(Net.role==='guest'){guestSend(k,v);return;}if(!(hostLive()||Net.role==='solo'))return;if(k==='post')publish(v);else if(k==='influ')hireInflu();else respond(v);},true);
setInterval(renderRed,500);
function deliveryBtn(){let b=document.getElementById('v12-order');if(Game.mode==='service'){if(!b){b=document.createElement('button');b.id='v12-order';b.textContent='🛵 Reparto';b.style.cssText='position:fixed;right:12px;bottom:86px;z-index:60;background:#0f8b8d;color:#fff;border:0;padding:10px 14px;border-radius:999px;font:700 13px Satoshi,system-ui;box-shadow:0 6px 18px rgba(0,0,0,.35)';document.body.append(b);}}else if(b)b.remove();}
setInterval(deliveryBtn,400);
document.addEventListener('click',e=>{if(e.target.id!=='v12-order')return;if(Game.upgrades.deliveryItem){toast('Repartidor en camino','Esperad al pedido actual.','');return;}const id=prompt('Producto (cerveza, barraquito, batido, papas, queso, pescado):','cerveza');if(!id||!ITEMS[id])return;const q=parseInt(prompt('¿Cuántas unidades?','5'),10);if(!q||q<1)return;const n=Math.min(20,q);if(Net.role==='guest'){guestSend('delivery',{id,qty:n});return;}orderDelivery(id,n);});
