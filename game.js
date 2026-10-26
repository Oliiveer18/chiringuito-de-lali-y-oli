import './tabguard.js';
import './main.js';
import './saves.js?v=8';
import './layout.js?v=10';
import './reliability.js?v=8';
const loaded=[],failed=[];
for(const [name,url] of [['v11','./features.js?v=15'],['v12','./v12.js?v=15'],['v14','./v14.js?v=15']]){
  try{await import(url);loaded.push(name);}
  catch(e){failed.push(name);console.error('Módulo '+name+' no cargó',e);
    const b=document.getElementById('errbox');if(b){b.style.display='block';b.textContent+='['+name+'] '+(e&&e.message||e)+'\n';}}
}
const title=document.getElementById('ver-title');
if(title)title.textContent='v15 · activas: '+(loaded.join(', ')||'ninguna')+(failed.length?' · con error: '+failed.join(', '):'');
