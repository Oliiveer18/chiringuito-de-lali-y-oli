import './tabguard.js';
import { EXTRA } from './icons.js';
import './main.js';
import './saves.js?v=9';
import './layout.js?v=11';
import './reliability.js?v=9';
import './coopbridge.js';
import './camera-beta.js';
import './gamefeel.js';
import './player.js';
import './netplayer.js';
import './balance.js';
Object.assign(EXTRA,{algodon:['#ffb7d5','#fff0f6'],agua:['#7fd4f2','#bfefff'],refresco:['#e8603c','#ffd0a8'],helado:['#f7a8c4','#ffe1ef'],gofre:['#d9a24a','#f6e2b8'],cocktail:['#5fd4d6','#d6fff4'],churros:['#b8792f','#f0c98a']});
const loaded=[],failed=[],nativeInterval=window.setInterval;
window.setInterval=(fn,ms,...args)=>nativeInterval(typeof fn==='function'&&fn.name==='tick'?function(){if(window.Net&&window.Net.role==='guest')return;fn();}:fn,...args);
try{
  for(const [name,url] of [['v11','./features.js?v=17'],['v12','./v12.js?v=27'],['v14','./v14.js?v=17'],['v19','./chiringo-ui.js?v=4'],['cierre','./cierre-ui.js?v=3'],['carrera','./career-ui.js?v=3'],['progreso','./progression-ui.js?v=25'],['mercado','./market-ui.js?v=25']]){
    try{await import(url);loaded.push(name);}
    catch(e){failed.push(name);console.error('Módulo '+name+' no cargó',e);
      const b=document.getElementById('errbox');if(b){b.style.display='block';b.textContent+='['+name+'] '+(e&&e.message||e)+'\n';}}
  }
}finally{window.setInterval=nativeInterval;}
const title=document.getElementById('ver-title');
if(title)title.textContent='camera-beta · activas: '+(loaded.join(', ')||'ninguna')+(failed.length?' · con error: '+failed.join(', '):'');
