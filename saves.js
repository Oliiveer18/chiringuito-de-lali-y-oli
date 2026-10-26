import { Game, Net, gameTimers, guestCust } from './state.js';
import { newSeason } from './sim.js';
import { showPlan, Plan } from './ui.js';
import { buildTables } from './world.js';
import { netDirty } from './net.js';

const FIELDS = ['day','money','rep','stock','prices','enabled','upgrades','staff','forecast','season','lastDebt','starsLog','revUsed','revPrev','regulars','regVisited','buzz'];
const key = mode => 'lali-oli.save.v1.' + mode;
const clone = x => JSON.parse(JSON.stringify(x));
let pending = null, last = '', blocked = false;
function valid(s){
  return s && s.version === 1 && ['solo','coop'].includes(s.kind) && s.data && Number.isInteger(s.data.day) && s.data.day >= 1 && s.data.day <= 30 && Number.isFinite(s.data.money) && Number.isFinite(s.data.rep) && Array.isArray(s.data.forecast) && s.data.forecast.length >= 30 && ['stock','prices','enabled','upgrades','staff','season','regulars'].every(k => s.data[k] && typeof s.data[k] === 'object' && !Array.isArray(s.data[k]));
}
function read(mode){ try { const s = JSON.parse(localStorage.getItem(key(mode))); return valid(s) ? s : null; } catch(e){ return null; } }
function say(text){ status.textContent = text; }
function save(){
  if(Game.mode !== 'plan' || Net.role === 'guest' || pending || blocked) return false;
  const kind = Net.role === 'host' ? 'coop' : 'solo';
  try {
    const data = {}; for(const k of FIELDS) if(Game[k] !== undefined) data[k] = clone(Game[k]);
    const signature = JSON.stringify([kind,data,Net.names,Net.roles]);
    if(signature === last) return true;
    const s = {version:1,kind,date:new Date().toISOString(),data,names:clone(Net.names),roles:clone(Net.roles)};
    localStorage.setItem(key(kind),JSON.stringify(s)); last = signature;
    say('Guardado: día ' + data.day + ' · ' + new Date().toLocaleTimeString('es-ES')); refresh(); return true;
  } catch(e){ blocked = true; say('No se pudo guardar. Comprueba el almacenamiento del navegador.'); return false; }
}
function restore(s){
  if(!valid(s)) throw new Error('Partida no compatible');
  newSeason();
  for(const k of FIELDS) if(s.data[k] !== undefined) Game[k] = clone(s.data[k]);
  Object.assign(Game,{hour:10,speed:1,customers:[],slots:[],floaters:[],particles:[],dayStats:null,closing:false,closeT:0,spawnAcc:0,mods:{arr:1},dayEvent:null,eventDone:false});
  gameTimers.length = 0; guestCust.clear(); buildTables();
  Net.ready = {p1:false,p2:false}; Net.readySent = false; Net.pend.clear(); Net.acks.length = 0; Net.events.length = 0; Net.ui = null; Net.lastMode = null;
  pending = null; last = ''; blocked = false; Plan.tab = 'compras'; showPlan(); netDirty(); save();
}
function button(text, fn){ const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = text; b.addEventListener('click',fn); return b; }
const panel = document.createElement('div'); panel.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:12px 0';
const status = document.createElement('p'); status.setAttribute('role','status'); status.style.cssText = 'font:500 12px system-ui;text-align:center;margin:8px;color:inherit';
const solo = button('Continuar en solitario',()=>{ const s = read('solo'); if(!s) return; Net.role = 'solo'; Net.me = 'p1'; restore(s); });
const coop = button('Continuar cooperativo',()=>{ const s = read('coop'); if(!s) return; pending = s; document.querySelector('#btn-coop').click(); say('Crea una sala nueva y espera a tu pareja. Al empezar se cargará el día ' + s.data.day + '.'); });
function refresh(){ for(const [b,m] of [[solo,'solo'],[coop,'coop']]){ const s = read(m); b.disabled = !s; b.textContent = (m === 'solo' ? 'Continuar en solitario' : 'Continuar cooperativo') + (s ? ' · día ' + s.data.day : ' · sin partida'); } }
panel.append(solo,coop);
const title = document.querySelector('.title-card'); title.append(panel,status);
const foot = document.querySelector('#plan .sheet-foot');
const manual = button('Guardar partida',()=>{ last = ''; blocked = false; if(save()) alert('Partida guardada en este navegador. Puedes continuar desde la portada.'); });
foot.prepend(manual);
const note = document.createElement('p'); note.textContent = 'Autoguardado antes de abrir. Si cierras durante el servicio, volverás a la preparación del último día guardado. En cooperativo guarda el anfitrión.'; note.style.cssText = 'font:500 12px system-ui;margin:10px 24px;color:#6b5c48'; foot.before(note);
const exportButton = button('Exportar copia',()=>{
  save(); const mode = Game.mode === 'title' ? (read('solo') ? 'solo' : 'coop') : (Net.role === 'host' ? 'coop' : 'solo');
  const s = read(mode); if(!s) return alert('No hay partida guardada para exportar.');
  const url = URL.createObjectURL(new Blob([JSON.stringify(s,null,2)],{type:'application/json'}));
  const a = document.createElement('a'); a.href = url; a.download = 'lali-oli-' + mode + '-dia-' + s.data.day + '.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),30000);
});
const importButton = button('Importar copia',()=>input.click());
const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json'; input.hidden = true;
input.addEventListener('change',async()=>{
  try { const f = input.files[0]; if(!f) return; if(f.size > 2000000) throw new Error(); const s = JSON.parse(await f.text()); if(!valid(s)) throw new Error();
    if(!confirm('Importar y sustituir el guardado ' + s.kind + ' del día ' + s.data.day + '?')) return;
    localStorage.setItem(key(s.kind),JSON.stringify(s)); refresh(); say('Copia importada. Pulsa Continuar.');
  } catch(e){ alert('No se pudo importar: archivo incompatible o almacenamiento no disponible.'); } finally { input.value = ''; }
});
panel.append(exportButton,importButton,input);
const pick = document.createElement('select'); pick.setAttribute('aria-label','Partida para exportar'); pick.innerHTML = '<option value=solo>Solitario</option><option value=coop>Cooperativo</option>'; panel.append(pick);
exportButton.replaceWith(button('Exportar copia',()=>{ const s = read(pick.value); if(!s) return alert('No hay guardado en ese modo.'); const url = URL.createObjectURL(new Blob([JSON.stringify(s,null,2)],{type:'application/json'})); const a = document.createElement('a'); a.href = url; a.download = 'lali-oli-' + s.kind + '.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),30000); }));
document.querySelector('#btn-lobby-go').addEventListener('click',e=>{
  if(!pending || !Net.peer || Net.role !== 'host') return;
  e.preventDefault(); e.stopImmediatePropagation(); restore(pending);
},true);
document.querySelector('#btn-lobby-back').addEventListener('click',()=>{ pending = null; },true);
document.querySelector('#btn-start').addEventListener('click',e=>{
  if(read('solo') && !confirm('Empezar una temporada nueva sustituirá el guardado individual. ¿Continuar?')){ e.stopImmediatePropagation(); return; }
  pending = null; last = ''; blocked = false;
},true);
document.querySelector('#btn-lobby-go').addEventListener('click',e=>{
  if(!pending && Net.peer && read('coop') && !confirm('Empezar otra temporada sustituirá el guardado cooperativo. ¿Continuar?')) e.stopImmediatePropagation();
},true);
setInterval(()=>{ manual.hidden = Net.role === 'guest'; if(Game.mode === 'plan') save(); },1000);
document.querySelector('#btn-open').addEventListener('click',()=>save(),true);
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState === 'hidden') save(); });
window.addEventListener('pagehide',save);
const badge = document.querySelector('#version-badge'); if(badge) badge.textContent = 'v5 · guardado entre jornadas';
refresh();
