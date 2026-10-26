/* =========================================================
   canvas.js
   Canvas principal: viewport, redimensionado y conversión de coordenadas.
   ========================================================= */
import { H, W } from './config.js?v=27.0';
import { $ } from './util.js?v=27.0';

// ---------- Entrada ----------
export const canvas=$('#game'), ctx=canvas.getContext('2d');
export let view={s:1,ox:0,oy:0,dpr:1};
export function resize(){
  const vp=window.visualViewport;
  const width=Math.max(1,vp?vp.width:innerWidth),height=Math.max(1,vp?vp.height:innerHeight);
  const root=document.documentElement;
  root.style.setProperty('--game-width',width+'px');
  root.style.setProperty('--game-height',height+'px');
  root.style.setProperty('--game-left',(vp?vp.offsetLeft:0)+'px');
  root.style.setProperty('--game-top',(vp?vp.offsetTop:0)+'px');
  const dpr=Math.min(window.devicePixelRatio||1,2);view.dpr=dpr;
  const cw=Math.max(1,Math.round(width*dpr)),ch=Math.max(1,Math.round(height*dpr));
  if(canvas.width!==cw)canvas.width=cw;
  if(canvas.height!==ch)canvas.height=ch;
  const hud=document.getElementById('hud'),stock=document.getElementById('stockbar');
  const top=hud&&hud.getClientRects().length?hud.getBoundingClientRect().height+4:0;
  const bottom=stock&&stock.getClientRects().length?stock.getBoundingClientRect().height+4:0;
  const styles=getComputedStyle(root);
  const left=parseFloat(styles.getPropertyValue('--game-safe-left'))||0;
  const right=parseFloat(styles.getPropertyValue('--game-safe-right'))||0;
  const availableW=Math.max(1,width-left-right),availableH=Math.max(1,height-top-bottom);
  view.s=Math.min(availableW/W,availableH/H)*dpr;
  view.ox=left*dpr+(availableW*dpr-W*view.s)/2;
  view.oy=top*dpr+(availableH*dpr-H*view.s)/2;
  document.body.classList.toggle('portrait',width<height);
}
export let viewportResizeFrame=0;
export function scheduleViewportResize(){
  cancelAnimationFrame(viewportResizeFrame);
  viewportResizeFrame=requestAnimationFrame(resize);
}
addEventListener('resize',scheduleViewportResize);
addEventListener('orientationchange',()=>{
  scheduleViewportResize();setTimeout(scheduleViewportResize,250);setTimeout(scheduleViewportResize,600);
});
if(window.visualViewport){
  window.visualViewport.addEventListener('resize',scheduleViewportResize);
  window.visualViewport.addEventListener('scroll',scheduleViewportResize);
}
if(window.ResizeObserver){
  const viewportObserver=new ResizeObserver(scheduleViewportResize);
  for(const id of ['hud','stockbar']){const el=document.getElementById(id);if(el)viewportObserver.observe(el);}
}
resize();
export function toWorld(cx,cy){
  const rect=canvas.getBoundingClientRect();
  return {x:((cx-rect.left)*canvas.width/rect.width-view.ox)/view.s,
          y:((cy-rect.top)*canvas.height/rect.height-view.oy)/view.s};
}
