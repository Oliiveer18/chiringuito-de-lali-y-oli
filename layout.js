import { scheduleViewportResize, view, setViewTarget } from './canvas.js?v=29.0.0';
import { computeView, camMode, setCamMode } from './camera.js?v=29.0.0';
import { W, H } from './config.js?v=29.0.0';
import { Game } from './state.js?v=29.0.0';
const root=document.documentElement;
let uiTop=0,uiBottom=0;
/* v29.0.0: la cámara está unificada en camera.js. Los modos barra/mesas ya no
   son solo para vertical: el encuadre (span, eje y límites) lo calcula
   computeView para ambas orientaciones. El eje del kiosco sigue siendo x=270
   (pico del tejado y rótulo), decidido en v28.16.0. */
let camInputsKey='';
function camInputsKeyNow(){
  const b=document.body,vp=window.visualViewport;
  return [
    camMode(),
    b.classList.contains('portrait')?1:0,
    b.classList.contains('playing')?1:0,
    uiTop,
    uiBottom,
    view.dpr||1,
    vp?vp.width:innerWidth,
    vp?vp.height:innerHeight,
    Game.mode||'',
  ].join('|');
}
function applyCam(force){
  const key=camInputsKeyNow();
  if(!force&&key===camInputsKey)return;
  camInputsKey=key;
  const b=document.body;
  if(!(b.classList.contains('playing')&&camMode()!=='todo'))return;
  const vp=window.visualViewport,width=vp?vp.width:innerWidth,height=vp?vp.height:innerHeight,dpr=view.dpr||1;
  const top=uiTop?uiTop+4:0,bottom=uiBottom?uiBottom+4:0;
  const styles=getComputedStyle(root);
  const safeL=parseFloat(styles.getPropertyValue('--game-safe-left'))||0;
  const safeR=parseFloat(styles.getPropertyValue('--game-safe-right'))||0;
  const portrait=width<height;
  const v=computeView({width,height,top,bottom,safeL,safeR,portrait});
  setViewTarget(v.s*dpr,v.ox*dpr,v.oy*dpr,false);
}
let lastScene='';
function place(){
  const d=view.dpr||1,s=view.s/d,top=view.oy/d,sw=Math.min(W*s,window.innerWidth),k=[top,H*s,sw].map(v=>Math.round(v)).join('|');
  if(k===lastScene)return;lastScene=k;
  root.style.setProperty('--scene-top',top+'px');root.style.setProperty('--scene-bottom',(top+H*s)+'px');root.style.setProperty('--scene-w',sw+'px');
}
function refresh(){scheduleViewportResize();requestAnimationFrame(()=>{applyCam(true);place();});}
function measure(){
  for(const [id,key]of [['hud','--top-ui'],['stockbar','--bottom-ui']]){
    const e=document.getElementById(id),v=e&&e.getClientRects().length?e.getBoundingClientRect().height:0;
    root.style.setProperty(key,v+'px');if(id==='hud')uiTop=v;else uiBottom=v;
  }
  refresh();
}
const bar=document.createElement('div');
bar.id='cam-bar';bar.className='cam-bar';bar.setAttribute('role','group');bar.setAttribute('aria-label','Vista del chiringuito');
for(const [k,t]of [['todo','Todo'],['barra','Barra y cola'],['mesas','Mesas']]){
  const b=document.createElement('button');b.type='button';b.dataset.cam=k;b.textContent=t;
  if(k==='mesas'){const s=document.createElement('span');s.className='cam-badge';b.append(s);}
  bar.append(b);
}
document.body.append(bar);
function setCam(m){
  setCamMode(m);try{sessionStorage.setItem('lali-oli.cam',m);}catch(e){}
  document.body.classList.toggle('cam-zoom',m!=='todo');
  bar.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.cam===m));
  refresh();
}
bar.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('button');if(b)setCam(b.dataset.cam);});
try{const m=sessionStorage.getItem('lali-oli.cam');if(m==='barra'||m==='mesas')setCamMode(m);}catch(e){}
setCam(camMode());
if(window.ResizeObserver){const observer=new ResizeObserver(measure);for(const id of ['hud','stockbar'])observer.observe(document.getElementById(id));}
window.addEventListener('resize',measure);window.addEventListener('orientationchange',measure);
measure();
if(window.visualViewport)visualViewport.addEventListener('resize',()=>{applyCam(true);place();});
setInterval(()=>{
  applyCam();
  place();
  const n=(Game.tables||[]).filter(t=>t.state==='dirty').length,el=bar.querySelector('.cam-badge');
  if(el){const v=camMode()==='mesas'||!n?'':String(n);if(el.textContent!==v)el.textContent=v;}
},400);
const hud=document.getElementById('hud');
if(hud){const sync=()=>{document.body.classList.toggle('playing',!hud.classList.contains('hidden'));refresh();};new MutationObserver(sync).observe(hud,{attributes:true,attributeFilter:['class']});sync();}
const eb=document.getElementById('errbox');
if(eb)eb.addEventListener('click',()=>{eb.style.display='none';eb.textContent='';});
const snd=document.getElementById('btn-sound');
if(snd){
  const upd=()=>{const on=snd.dataset.sound!=='off';if(!snd.dataset.sound){const lbl=snd.querySelector('.snd-lbl');on=!/no\s*$/i.test((lbl&&lbl.textContent||snd.textContent||'').trim());snd.dataset.sound=on?'on':'off';}snd.setAttribute('aria-label',on?'Sonido activado':'Sonido desactivado');};
  new MutationObserver(upd).observe(snd,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['data-sound']});upd();
}

/* v28: pantalla completa en escritorio (Mac). En iPhone el navegador no
   lo permite y los botones no aparecen: la PWA ya va a pantalla completa. */
const FS_ON='<svg viewBox="0 0 20 20"><path d="M3 8V3h5M12 3h5v5M17 12v5h-5M8 17H3v-5"/></svg>';
const FS_OFF='<svg viewBox="0 0 20 20"><path d="M8 3H3v5M12 3h5v5M17 12v5h-5M8 17H3v-5M3 3l5 5M17 3l-5 5M17 17l-5-5M3 17l5-5"/></svg>';
if(document.fullscreenEnabled||document.documentElement.requestFullscreen){
  const syncFs=()=>{const on=!!document.fullscreenElement;for(const b of [document.getElementById('btn-full'),document.getElementById('btn-full-page')]){if(!b)continue;b.innerHTML=on?FS_OFF:FS_ON;b.setAttribute('aria-label',on?'Salir de pantalla completa':'Pantalla completa');b.title=on?'Salir de pantalla completa (F)':'Pantalla completa (F)';}};
  const toggleFs=()=>{if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});else document.documentElement.requestFullscreen().catch(()=>{});};
  const hudBtn=document.getElementById('btn-full');
  if(hudBtn){hudBtn.type='button';hudBtn.hidden=true;hudBtn.innerHTML=FS_ON;hudBtn.addEventListener('click',toggleFs);}
  const pageBtn=document.createElement('button');pageBtn.id='btn-full-page';pageBtn.type='button';pageBtn.className='hud-btn';pageBtn.setAttribute('aria-label','Pantalla completa');pageBtn.innerHTML=FS_ON;pageBtn.addEventListener('click',toggleFs);document.body.append(pageBtn);
  document.addEventListener('fullscreenchange',syncFs);syncFs();
  document.addEventListener('keydown',e=>{if(e.key!=='f'&&e.key!=='F')return;if(e.metaKey||e.ctrlKey||e.altKey)return;const t=e.target;if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable))return;e.preventDefault();toggleFs();});
}
