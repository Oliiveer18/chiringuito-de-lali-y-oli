import { Game, Net, gameTimers, guestCust } from './state.js';
import { newSeason } from './sim.js';
import { showPlan, Plan } from './ui.js';
import { buildTables } from './world.js';
import { netDirty } from './net.js';
const KEY='lali-oli.library.v2';
const fields=['day','money','rep','stock','prices','enabled','upgrades','staff','forecast','season','lastDebt','starsLog','revUsed','revPrev','regulars','regVisited','buzz'];
const copy=x=>JSON.parse(JSON.stringify(x));
let active=null,pending=null,bypass=false,last='';
let library=[];
const style=document.createElement('style');
style.textContent=`.save-browser{position:fixed;inset:0;z-index:5000;background:rgba(3,29,32,.94);overflow:auto;padding:24px 16px;color:#173b3d;font:15px/1.5 system-ui}.save-browser[hidden]{display:none}.save-sheet{max-width:560px;margin:auto;background:#fffdf8;border-radius:22px;padding:22px}.save-sheet h2{font-size:25px;margin:0 0 8px}.save-sheet p{color:#536869}.save-row{background:#f2eee4;border:1px solid #d6d9cc;border-radius:14px;padding:14px;margin:12px 0}.save-row strong{display:block}.save-actions{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0}.save-action{background:#fffdf8!important;color:#12484c!important;border:1px solid #97b5b3!important;border-radius:12px;padding:12px 16px;font:700 15px system-ui;min-height:46px;cursor:pointer}.save-action.main{background:#0b676c!important;color:white!important;border-color:#0b676c!important}.save-browser small{color:#536869}.save-state{font:12px/1.5 system-ui;color:#315e5d;margin:10px 24px}.save-browser button:focus-visible{outline:3px solid #e8603c;outline-offset:3px}`;document.head.append(style);
const modal=document.createElement('section');modal.className='save-browser';modal.hidden=true;modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Tus partidas');document.body.append(modal);
const state=document.createElement('p');state.className='save-state';state.setAttribute('role','status');document.querySelector('#plan .sheet-foot').before(state);
function valid(s){return s&&s.data&&Number.isInteger(s.data.day)&&s.data.day>=1&&s.data.day<=30&&Number.isFinite(s.data.money)&&Number.isFinite(s.data.rep)&&['solo','coop'].includes(s.kind)&&Array.isArray(s.data.forecast)&&fields.filter(k=>['stock','prices','enabled','upgrades','staff','season','regulars'].includes(k)).every(k=>s.data[k]&&typeof s.data[k]==='object');}
function id(){return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);}
function persist(){localStorage.setItem(KEY,JSON.stringify(library));}
try{const raw=localStorage.getItem(KEY);if(raw){const a=JSON.parse(raw);if(!Array.isArray(a))throw Error();library=a.filter(valid);}else{for(const kind of ['solo','coop']){const s=JSON.parse(localStorage.getItem('lali-oli.save.v1.'+kind));if(valid(s))library.push({...s,id:id()});}if(library.length)persist();}}catch(e){state.textContent='No se pudieron leer los guardados. No se han borrado los datos anteriores.';}
function save(){
 if(Game.mode!=='plan'||Net.role==='guest'||pending)return;
 try{const kind=Net.role==='host'?'coop':'solo',data={};for(const k of fields)if(Game[k]!==undefined)data[k]=copy(Game[k]);
 const signature=JSON.stringify([kind,data,Net.names,Net.roles]);if(signature===last)return;
 const entry={id:active||id(),kind,data,names:copy(Net.names),roles:copy(Net.roles),date:new Date().toISOString()};
 const old=library;library=library.filter(s=>s.id!==entry.id).concat(entry);try{persist();}catch(e){library=old;throw e;}active=entry.id;last=signature;state.textContent='✓ Guardado automáticamente · Día '+Game.day+' · '+new Date().toLocaleTimeString('es-ES')+' · Puedes cerrar después de preparar el día.';
 }catch(e){state.textContent='No se pudo guardar en este navegador. No cierres la partida hasta resolver el almacenamiento.';}
}
function restore(s){
 if(!valid(s))return;newSeason();for(const k of fields)if(s.data[k]!==undefined)Game[k]=copy(s.data[k]);
 Object.assign(Game,{hour:10,speed:1,customers:[],slots:[],floaters:[],particles:[],dayStats:null,closing:false,closeT:0,spawnAcc:0,mods:{arr:1},dayEvent:null,eventDone:false});
 gameTimers.length=0;guestCust.clear();buildTables();Net.ready={p1:false,p2:false};Net.readySent=false;Net.pend.clear();Net.acks.length=0;Net.events.length=0;Net.ui=null;Net.lastMode=null;pending=null;active=s.id;last='';Plan.tab='compras';showPlan();netDirty();save();
}
function button(label,fn,primary=false){const b=document.createElement('button');b.type='button';b.className='save-action'+(primary?' main':'');b.textContent=label;b.addEventListener('click',fn);return b;}
function original(selector){bypass=true;try{document.querySelector(selector).click();}finally{bypass=false;}}
function resume(s){modal.hidden=true;if(s.kind==='solo'){Net.role='solo';Net.me='p1';restore(s);}else{pending=copy(s);original('#btn-coop');if(s.names?.p1)document.querySelector('#lobby-name').value=s.names.p1;if(s.roles)Object.assign(Net.roles,s.roles);document.querySelector('#lobby-status').textContent='Continuando día '+s.data.day+'. Crea una sala y comparte el código con '+(s.names?.p2||'tu pareja')+'.';}}
function screen(kind){
 modal.replaceChildren();const box=document.createElement('div');box.className='save-sheet';modal.append(box);
 const h=document.createElement('h2');h.textContent=kind==='solo'?'Tus partidas en solitario':'Vuestras partidas';box.append(h);
 const info=document.createElement('p');info.textContent=kind==='solo'?'Continúa una temporada o empieza otra sin perder las anteriores.':'Elige vuestra temporada. Para retomarla, crea una sala nueva e invita de nuevo a tu pareja con su código.';box.append(info);
 const actions=document.createElement('div');actions.className='save-actions';actions.append(button('Nueva partida',()=>{active=null;pending=null;last='';modal.hidden=true;original(kind==='solo'?'#btn-start':'#btn-coop');},true));
 if(kind==='coop')actions.append(button('Unirme con código',()=>{pending=null;active=null;last='';modal.hidden=true;original('#btn-coop');}));actions.append(button('Volver',()=>{modal.hidden=true;}));box.append(actions);
 const entries=library.filter(s=>s.kind===kind).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 if(!entries.length){const p=document.createElement('p');p.textContent='Todavía no hay partidas. La primera se guardará automáticamente al preparar el día.';box.append(p);}
 for(const s of entries){const row=document.createElement('div');row.className='save-row';const name=document.createElement('strong');name.textContent=kind==='coop'?(s.names?.p1||'Jugador 1')+' y '+(s.names?.p2||'Jugador 2'):'Temporada individual';const detail=document.createElement('p');detail.textContent='Día '+s.data.day+' · '+Math.round(s.data.money)+' € · '+s.data.rep.toFixed(1)+' ★';const date=document.createElement('small');const d=new Date(s.date);date.textContent=Number.isNaN(+d)?'Partida recuperada':'Último guardado: '+d.toLocaleString('es-ES');row.append(name,detail,date,document.createElement('br'),button('Continuar',()=>resume(s),true));box.append(row);}
 const note=document.createElement('small');note.textContent='Guardado en este móvil y navegador, entre jornadas. Si cierras durante el servicio, retomarás la última preparación guardada. En cooperativo guarda el anfitrión. No es una copia en la nube.';box.append(note);modal.hidden=false;actions.querySelector('button').focus();
}
for(const [selector,kind]of [['#btn-start','solo'],['#btn-coop','coop']])document.querySelector(selector).addEventListener('click',e=>{if(bypass)return;e.preventDefault();e.stopImmediatePropagation();screen(kind);},true);
document.querySelector('#btn-lobby-go').addEventListener('click',e=>{if(!Net.peer||Net.role!=='host')return;if(pending){e.preventDefault();e.stopImmediatePropagation();restore(pending);}else{active=null;last='';}},true);
document.querySelector('#btn-lobby-back').addEventListener('click',()=>{pending=null;},true);
document.addEventListener('click',e=>{if(e.target.closest?.('#btn-again')){active=null;last='';}},true);
document.querySelector('#btn-open').addEventListener('click',save,true);
setInterval(save,1000);window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')save();});
const badge=document.querySelector('#version-badge');if(badge)badge.textContent='v6 · biblioteca de partidas';
