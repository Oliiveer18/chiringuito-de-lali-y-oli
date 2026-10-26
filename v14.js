/* v14: clima cambiante, nuevos productos, reservas, misiones, Chiringo por stock real, shows con público e informe del día. */
import { Game, Net, hostLive, isCoop, lvl } from './state.js';
import { ITEMS, ITEM_IDS, UPGRADES, TYPES, DRINKS } from './config.js';
import { rnd, clamp } from './util.js';
import { Plan, toast, updateStockbar } from './ui.js';
import { netDirty } from './net.js';
import { spawnCustomer } from './sim.js';
import { POSTS, INFLU } from './v12.js?v=13';

/* --- Productos nuevos --- */
ITEMS.agua={name:'Agua fría',cost:0.3,ref:1.5,prep:0.2,spoil:0,spoilF:0,unlock:'refrescos'};
ITEMS.refresco={name:'Refresco',cost:0.5,ref:2.2,prep:0.3,spoil:0,spoilF:0,unlock:'refrescos'};
ITEMS.helado={name:'Helado',cost:0.8,ref:3,prep:0.5,spoil:0.5,spoilF:0.2,unlock:'heladera'};
ITEMS.gofre={name:'Gofre',cost:1.5,ref:6,prep:2,spoil:0.1,spoilF:0.05,unlock:'gofrera'};
ITEMS.coctel={name:'Cóctel tropical',cost:2,ref:9,prep:2.5,spoil:0,spoilF:0,unlock:'coctelera'};
ITEMS.churros={name:'Churros con chocolate',cost:1,ref:4.5,prep:1.5,spoil:0.3,spoilF:0.1,unlock:'churrera'};
for(const id of ['agua','refresco','cocktail'])if(!DRINKS.includes(id))DRINKS.push(id);
ITEM_IDS.push('agua','refresco','helado','gofre','cocktail','churros');
UPGRADES.push({id:'refrescos',name:'Barra de refrescos',desc:'Desbloquea agua y refrescos: rápidos y baratos.',levels:[300]});
UPGRADES.push({id:'heladera',name:'Heladera',desc:'Desbloquea helados. Se derriten si tardáis.',levels:[700]});
UPGRADES.push({id:'gofrera',name:'Plancha de gofres',desc:'Desbloquea gofres: dulces y rentables.',levels:[900]});
UPGRADES.push({id:'coctelera',name:'Barra de cócteles',desc:'Desbloquea cócteles tropicales: alto margen, preparación larga.',levels:[1200]});
UPGRADES.push({id:'churrera',name:'Churrera',desc:'Desbloquea churros con chocolate para la tarde.',levels:[800]});
const NEWP={agua:[0.8,0.6,0.9],refresco:[0.7,0.5,0.8],helado:[1.4,0.6,0.8],gofre:[0.9,0.7,0.9],cocktail:[1.5,0.4,0.7],churros:[1.1,0.9,0.6]};
for(const t of ['turista','local','surfista']){const p=TYPES[t].pref;let i=0;for(const id of Object.keys(NEWP)){p[id]=NEWP[id][i];i++;}}
/* iconos simples */
const ICON_COLORS={agua:['#7fd4f2','#bfefff'],refresco:['#e8603c','#ffd0a8'],helado:['#f7a8c4','#ffe1ef'],gofre:['#d9a24a','#f6e2b8'],cocktail:['#5fd4d6','#d6fff4'],churros:['#b8792f','#f0c98a']};
function mkIcon(id){const cv=document.createElement('canvas');cv.width=cv.height=88;const c=cv.getContext('2d');const [a,b]=ICON_COLORS[id];c.fillStyle=b;c.beginPath();c.arc(44,44,30,0,7);c.fill();c.fillStyle=a;c.beginPath();c.arc(44,40,18,0,7);c.fill();return cv.toDataURL();}
import { ICON_URL } from './icons.js';
for(const id of Object.keys(ICON_COLORS))ICON_URL[id]=mkIcon(id);

/* --- Estado --- */nconst FOL='socialFollowers';
let lastDay=Game.day, weatherHora=0, reservaHora=0, reservaSize=0, showLastSpawn=0, lastT=null;
const MISSIONS=[{id:'rep4',txt:'Alcanza 4,0 de valoración hoy',check:s=>(Game.rep>=4),reward:200},{id:'rev1500',txt:'Gana 1.500 € hoy',check:s=>s.revenue>=1500,reward:250},{id:'served40',txt:'Sirve 40 clientes hoy',check:s=>s.served>=40,reward:200}];
function migrate(){if(!Game.upgrades.lastReport)Game.upgrades.lastReport='';}
function setMission(){const idx=Math.floor((Game.day-1)/5)%MISSIONS.length;const m=MISSIONS[idx];Game.upgrades.mision=m.id;Game.upgrades.misionTxt=m.txt;Game.upgrades.misionReward=m.reward;Game.upgrades.misionHecha=0;}
function newDay(){
 lastDay=Game.day;
 // informe del día anterior
 if(Game.dayStats){const s=Game.dayStats;const rep={day:Game.day-1,revenue:s.revenue,served:s.served,lost:s.lost,tips:s.tips,fines:s.fines,hamacas:s.hamacas,top:topProduct(s),mission:Game.upgrades.misionTxt||'',missionOk:Game.upgrades.misionHecha===1};Game.upgrades.lastReport=JSON.stringify(rep);}
 // misión
 if(Game.dayStats&&Game.upgrades.mision){const m=MISSIONS.find(x=>x.id===Game.upgrades.mision);if(m&&m.check(Game.dayStats)){Game.upgrades.misionHecha=1;Game.money+=m.reward;Game.upgrades[FOL]=(Game.upgrades[FOL]||0)+10;toast('Misión cumplida',m.txt+' · +'+m.reward+' € y +10 seguidores.','good');}else if(Game.upgrades.mision){toast('Misión','No cumplisteis: '+Game.upgrades.misionTxt,'');}}
 if(Game.day%5===1)setMission();
 // clima cambiante
 delete Game.upgrades.weatherHora;if(rnd()<0.5){Game.upgrades.weatherHora=Math.round((14+rnd()*4)*10)/10;}
 // reserva
 delete Game.upgrades.reservaHora;if(rnd()<0.35){Game.upgrades.reservaHora=Math.round((17+rnd()*2)*10)/10;reservaSize=3+Math.floor(rnd()*3);}
 // fallo de publicación por stock real
 const p=Game.upgrades.socialPost;const sold=Game.dayStats?(Game.dayStats.sold||{}):{};
 if(p&&p!=='atardecer'&&p!=='viral'&&p!=='encuesta'&&p!=='concurso'){if((sold[p]||0)===0){Game.upgrades[FOL]=Math.max(0,(Game.upgrades[FOL]||0)-3);Game.upgrades.socialComments=['Promocionasteis '+(ITEMS[p]?ITEMS[p].name.toLowerCase():'eso')+' y no había…',...(Game.upgrades.socialComments||[])].slice(0,6);Game.upgrades[RAT]=clamp((Game.upgrades[RAT]||3)-0.1,1,5);}}
 // reseña de grupo
 if(Game.upgrades.grupoDia===Game.day){if((Game.dayStats?.served||0)>=10){Game.upgrades.socialComments=['Fuimos en grupo y nos atendieron genial.',''.concat('')].slice(0,6);Game.upgrades[FOL]+=3;}else{Game.upgrades.socialComments=['Vinimos en grupo y tardaron muchísimo.',''.concat('')].slice(0,6);Game.upgrades[FOL]=Math.max(0,(Game.upgrades[FOL]||0)-2);}}
 delete Game.upgrades.grupoDia;
 netDirty();
}
function topProduct(s){let best='',n=0;for(const k in (s.sold||{})){if(s.sold[k]>n){n=s.sold[k];best=k;}}return best?ITEMS[best].name+' ×'+n:'—';}
function runWeather(){const cur=Game.forecast[Game.day-1];const opts=['sol','panza','calima','viento'].filter(w=>w!==cur);const w=opts[Math.floor(rnd()*opts.length)];Game.forecast[Game.day-1]=w;toast('Cambia el tiempo','Entra '+w+'. Adaptad compras y carta.','');netDirty();}
function runReserva(){const free=Game.tables.filter(t=>t.state==='free').length;const n=reservaSize;for(let i=0;i<n;i++)setTimeoutGame(()=>{if(Game.mode==='service')spawnCustomer(rnd()<0.6?'turista':'local');},i*1.2);if(free>=1){Game.money+=30;Game.rep=clamp(Game.rep+0.1,0,5);toast('Reserva atendida','Grupo de '+n+' con mesa libre: +30 € de propina.','good');}else{Game.rep=clamp(Game.rep-0.15,0,5);toast('Reserva perdida','No había mesa para el grupo de '+n+'.','bad');}Game.upgrades.grupoDia=Game.day;netDirty();}
function tick(){
 migrate();
 if(Game.mode==='title'){lastDay=Game.day;lastT=null;return;}
 if(Game.mode==='plan'&&Game.day!==lastDay)newDay();
 if(Game.mode!=='service'){lastT=null;return;}
 if(lastT==null)lastT=Game.t;const gdt=Math.max(0,Game.t-lastT);lastT=Game.t;
 if(Game.upgrades.weatherHora&&Game.hour>=Game.upgrades.weatherHora){delete Game.upgrades.weatherHora;runWeather();}
 if(Game.upgrades.reservaHora&&Game.hour>=Game.upgrades.reservaHora){delete Game.upgrades.reservaHora;runReserva();}
 // shows atraen público distinto
 const sh=Game.upgrades.showHoy;if(sh&&Game.hour>=Game.upgrades.showHora&&Game.hour<Game.upgrades.showHora+2){if(Game.t-showLastSpawn>15){showLastSpawn=Game.t;const tipo=Game.upgrades.showTipo;const who=tipo==='musica'?'local':'turista';spawnCustomer(who);}}
 updateChip();
}
function updateChip(){let chip=document.getElementById('v12-delivery');if(Game.upgrades.deliveryItem){if(!chip){chip=document.createElement('div');chip.id='v12-delivery';chip.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:86px;z-index:60;background:#0b4f54;color:#fff;padding:8px 14px;border-radius:999px;font:600 13px Satoshi,system-ui;box-shadow:0 6px 18px rgba(0,0,0,.35)';document.body.append(chip);}chip.textContent='🛵 Repartidor: '+Math.max(0,Math.ceil(Game.upgrades.deliveryT))+' s';}else if(chip)chip.remove();}
setInterval(tick,250);

/* Informe del día */
const tabs=document.querySelector('#plan .tabs');
if(tabs&&!tabs.querySelector('[data-tab="informe"]')){const b=document.createElement('button');b.className='tab';b.dataset.tab='informe';b.setAttribute('role','tab');b.textContent='Informe';tabs.append(b);}
function renderInforme(){const b=document.querySelector('#tab-body');if(!b||Plan.tab!=='informe')return;let rep=null;try{rep=JSON.parse(Game.upgrades.lastReport||'null');}catch(e){}
 if(!rep){b.innerHTML='<p class="muted">Aún no hay un informe del día anterior.</p>';return;}
 b.innerHTML='<h3 style="margin:4px 0">Día '+rep.day+'</h3>'+
 '<div class="row"><div class="name">Caja</div><div class="sub">Ingresos: '+rep.revenue.toFixed(2)+' € · Propinas: '+rep.tips.toFixed(2)+' € · Multas: '+rep.fines+' € · Hamacas: '+rep.hamacas.toFixed(2)+' €</div></div>'+
 '<div class="row"><div class="name">Clientes</div><div class="sub">Servidos: '+rep.served+' · Perdidos: '+rep.lost+'</div></div>'+
 '<div class="row"><div class="name">Producto estrella</div><div class="sub">'+rep.top+'</div></div>'+
 '<div class="row"><div class="name">Misión</div><div class="sub">'+rep.mission+' · '+(rep.missionOk?'Cumplida':'No cumplida')+'</div></div>';
}
new MutationObserver(renderInforme).observe(document.getElementById('tab-body'),{childList:true,subtree:true});
setInterval(renderInforme,500);
