/* =========================================================
   canvas.js
   Canvas principal: viewport, redimensionado y conversión de coordenadas.
   v29: el cálculo del encuadre vive en camera.js (cámara unificada); aquí
   solo se mide el viewport, se escribe `view` (con transición suave) y se
   convierten coordenadas pantalla↔mundo.
   ========================================================= */
import { H, W } from './config.js?v=29.2.0';
import { $ } from './util.js?v=29.2.0';
import { computeView, camMode } from './camera.js?v=29.2.0';

// ---------- Entrada ----------
export const canvas=$('#game'), ctx=canvas.getContext('2d');
export let view={s:1,ox:0,oy:0,dpr:1};

/* ---------- Transición suave del encuadre (v29) ----------
   Los cambios de modo de vista (todo/barra/mesas) y de orientación animan en
   ~200 ms en vez de saltar. La escritura directa de view queda aquí: un único
   escritor, sin condiciones de carrera con layout.js. */
let viewTarget=null, viewAnimating=false, viewFirst=true;
export function setViewTarget(s, ox, oy, instant){
  viewTarget={s,ox,oy};
  if(instant||viewFirst){
    view.s=s; view.ox=ox; view.oy=oy;
    viewFirst=false;
    viewAnimating=false;
  } else {
    viewAnimating=true;
  }
}
export function tickView(dt){
  if(!viewAnimating||!viewTarget)return;
  const k=1-Math.exp(-dt*12); // ~200 ms hasta el 95 %
  view.s+=(viewTarget.s-view.s)*k;
  view.ox+=(viewTarget.ox-view.ox)*k;
  view.oy+=(viewTarget.oy-view.oy)*k;
  const close=Math.abs(viewTarget.s-view.s)<0.01
    &&Math.abs(viewTarget.ox-view.ox)<1
    &&Math.abs(viewTarget.oy-view.oy)<1;
  if(close){ view.s=viewTarget.s; view.ox=viewTarget.ox; view.oy=viewTarget.oy; viewAnimating=false; }
}

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
  const hud=document.getElementById('hud');
  /* v29.2: el inventario es un raíl lateral flotante: la cámara ya no
     reserva margen inferior, solo el superior del HUD. */
  const top=hud&&hud.getClientRects().length?hud.getBoundingClientRect().height+4:0;
  const bottom=0;
  root.style.setProperty('--top-ui',top+'px');
  root.style.setProperty('--bottom-ui',bottom+'px');
  const styles=getComputedStyle(root);
  const left=parseFloat(styles.getPropertyValue('--game-safe-left'))||0;
  const right=parseFloat(styles.getPropertyValue('--game-safe-right'))||0;
  view.dpr=dpr;
  const portrait=width<height;
  /* Los modos de zoom solo aplican en partida; fuera de ella siempre 'todo'. */
  const playing=document.body.classList.contains('playing');
  const v=computeView({width,height,top,bottom,safeL:left,safeR:right,portrait,mode:playing?camMode():'todo'});
  setViewTarget(v.s*dpr, v.ox*dpr, v.oy*dpr, viewFirst);
  document.body.classList.toggle('portrait',portrait);
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
