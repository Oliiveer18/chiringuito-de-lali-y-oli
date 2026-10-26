import './tabguard.js';
import { EXTRA } from '../icons.js';
import '../main.js';
import '../saves.js?v=9';
import '../layout.js?v=11';
import '../reliability.js?v=9';
import '../coopbridge.js';
import { initCamBeta, applyCamBeta, camTick } from './camera-beta.js';
import { fxTick, fxServe, fxClean } from './gamefeel.js';
import { playerTick, playerGo } from './player.js';
import { netPlayerTick, guestMove } from './netplayer.js';
import { applyBalance } from './balance.js';
import { view } from '../canvas.js';
import { Game, Net } from '../state.js';
Object.assign(EXTRA,{algodon:['#ffb7d5','#fff0f6'],agua:['#7fd4f2','#bfefff'],refresco:['#e8603c','#ffd0a8'],helado:['#f7a8c4','#ffe1ef'],gofre:['#d9a24a','#f6e2b8'],cocktail:['#5fd4d6','#d6fff4'],churros:['#b8792f','#f0c98a']});
const loaded=[],failed=[],nativeInterval=window.setInterval;
window.setInterval=(fn,ms,...args)=>nativeInterval(typeof fn==='function'&&fn.name==='tick'?function(){if(window.Net&&window.Net.role==='guest')return;fn();}:fn,...args);
try{
  for(const [name,url] of [['v11','../features.js?v=17'],['v12','../v12.js?v=27'],['v14','../v14.js?v=17'],['v19','../chiringo-ui.js?v=4'],['cierre','../cierre-ui.js?v=3'],['carrera','../career-ui.js?v=3'],['progreso','../progression-ui.js?v=25'],['mercado','../market-ui.js?v=25']]){
    try{await import(url);loaded.push(name);}
    catch(e){failed.push(name);console.error('Módulo '+name+' no cargó',e);
      const b=document.getElementById('errbox');if(b){b.style.display='block';b.textContent+='['+name+'] '+(e&&e.message||e)+'\n';}}
  }
}finally{window.setInterval=nativeInterval;}
const title=document.getElementById('ver-title');
if(title)title.textContent='camera-beta · activas: '+(loaded.join(', ')||'ninguna')+(failed.length?' · con error: '+failed.join(', '):'');
initCamBeta();
let lastT=performance.now();
function betaLoop(now){
  const dt=Math.min(0.05,(now-lastT)/1000);lastT=now;
  camTick(dt);applyCamBeta();
  playerTick(dt);netPlayerTick(dt);fxTick(dt);
  requestAnimationFrame(betaLoop);
}
requestAnimationFrame(betaLoop);
const canvas=document.getElementById('game');
if(canvas){
  canvas.addEventListener('pointerdown',e=>{
    if(Game.mode!=='service')return;
    const rect=canvas.getBoundingClientRect();
    const x=((e.clientX-rect.left)*canvas.width/rect.width-view.ox)/view.s;
    const y=((e.clientY-rect.top)*canvas.height/rect.height-view.oy)/view.s;
    playerGo(x,y);
    if(Net.role==='guest'){const m=guestMove(x,y);if(m)netSend(m);}
  });
}
const origTryServe=window.tryServe;
if(origTryServe)window.tryServe=function(c,who){const ok=origTryServe(c,who);if(ok)fxServe(c);return ok;};
const origCleanTable=window.cleanTable;
if(origCleanTable)window.cleanTable=function(t,auto,who){const ok=origCleanTable(t,auto,who);if(ok!==false)fxClean(t);return ok;};
const origStartDay=window.startDay;
if(origStartDay)window.startDay=function(){applyBalance();return origStartDay();};
