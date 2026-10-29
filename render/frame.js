/* Mechanical extraction from render.js; declaration bodies are unchanged. */
import { H } from "../config.js?v=28.11";
import { W } from "../config.js?v=28.11";
import { WHO_COLOR } from "../config.js?v=28.11";
import { clamp } from "../util.js?v=28.11";
import { lerp } from "../util.js?v=28.11";
import { mixColor } from "../util.js?v=28.11";
import { rr } from "../icons.js?v=28.11";
import { Game } from "../state.js?v=28.11";
import { closeHour } from "../state.js?v=28.11";
import { hamacaCount } from "../state.js?v=28.11";
import { lvl } from "../state.js?v=28.11";
import { weatherToday } from "../state.js?v=28.11";
import { whoName } from "../state.js?v=28.11";
import { HAMACA_POS } from "../world.js?v=28.11";
import { canvas } from "../canvas.js?v=28.11";
import { ctx } from "../canvas.js?v=28.11";
import { view } from "../canvas.js?v=28.11";
import { drawPurchasedProps } from "../scene-extras.js?v=28.11";
import { drawBubble } from "./identity.js?v=28.11";
import { drawClouds } from "./scene.js?v=28.11";
import { drawCustomer } from "./characters.js?v=28.11";
import { drawFloorWorker } from "./characters.js?v=28.11";
import { drawHamaca } from "./tables.js?v=28.11";
import { drawHut } from "./scene.js?v=28.11";
import { drawLights } from "./effects.js?v=28.11";
import { drawNetStatus } from "./hud.js?v=28.11";
import { drawPalm } from "./scene.js?v=28.11";
import { drawPendingBadges } from "./hud.js?v=28.11";
import { drawSea } from "./scene.js?v=28.11";
import { drawStationLabels } from "./identity.js?v=28.11";
import { drawTable } from "./tables.js?v=28.11";
import { drawTeide } from "./scene.js?v=28.11";
import { nightness } from "./scene.js?v=28.11";
import { skyAt } from "./scene.js?v=28.11";

export function render(){
  const c=ctx; const h = Game.mode==='service'? Game.hour : (Game.mode==='report'? closeHour() : 11);
  const weather = Game.forecast.length? weatherToday() : 'sol';
  c.setTransform(1,0,0,1,0,0);
  // fondo de relleno a pantalla completa (sin bandas negras en ningún recorte)
  const sky=skyAt(h);
  const nt=nightness(h);
  let g=c.createLinearGradient(0,0,0,view.oy+330*view.s); g.addColorStop(0,sky.top); g.addColorStop(1,sky.bot);
  c.fillStyle=g; c.fillRect(0,0,canvas.width,view.oy+332*view.s);
  // banda de mar a todo el ancho con el mismo gradiente que drawSea
  let gs=c.createLinearGradient(0,view.oy+330*view.s,0,view.oy+425*view.s);
  gs.addColorStop(0,mixColor('#1f8fb0','#2b2f5a',nt)); gs.addColorStop(1,mixColor('#2ec2c4','#2b4a6a',nt));
  c.fillStyle=gs; c.fillRect(0,view.oy+330*view.s,canvas.width,(425-330)*view.s);
  // arena a todo el ancho con el mismo gradiente que la arena del mundo
  let ga=c.createLinearGradient(0,view.oy+420*view.s,0,view.oy+H*view.s);
  ga.addColorStop(0,mixColor('#5a4e48','#2a2430',nt)); ga.addColorStop(1,mixColor('#2e2826','#1a1618',nt));
  c.fillStyle=ga; c.fillRect(0,view.oy+420*view.s,canvas.width,Math.max(0,canvas.height-(view.oy+420*view.s)));
  c.setTransform(view.s,0,0,view.s,view.ox,view.oy);
  const T=Game.t;
  const wind = weather==='viento'?2.2:1;
  // sol
  const sunP = clamp((h-10)/(20.8-10),0,1.1);
  const sunX = lerp(380,140,sunP), sunY = lerp(70,330,Math.pow(sunP,1.6));
  if(weather!=='panza'){
    c.fillStyle= h>18.5?'rgba(255,170,90,.35)':'rgba(255,240,180,.35)'; c.beginPath(); c.arc(sunX,sunY,70,0,7); c.fill();
    c.fillStyle= h>18.5? '#ffb062':'#fff3c4'; c.beginPath(); c.arc(sunX,sunY,34,0,7); c.fill();
  }
  // estrellas
  if(nt>0.2){ c.fillStyle=`rgba(255,255,255,${(nt-0.2)*1.2})`; for(let i=0;i<40;i++){ const x=(i*137)%W, y=(i*71)%260; c.fillRect(x,y,2,2);} }
  // La Gomera al fondo (silueta)
  c.fillStyle=mixColor('#7fa6bf','#3a3557',nt); c.beginPath(); c.moveTo(-20,332); c.quadraticCurveTo(80,290,180,300); c.quadraticCurveTo(260,286,330,332); c.fill();
  // Teide
  drawTeide(c,h,nt);
  // nubes
  drawClouds(c,T,weather,nt,wind);
  // mar
  drawSea(c,T,h,nt,wind,sunX);
  // arena
  g=c.createLinearGradient(0,420,0,H); g.addColorStop(0,mixColor('#5a4e48','#2a2430',nt)); g.addColorStop(1,mixColor('#2e2826','#1a1618',nt));
  c.fillStyle=g; c.fillRect(-400,420,W+800,H-420+300);
  c.fillStyle='rgba(255,255,255,.06)'; for(let i=0;i<120;i++){ const x=(i*97.3)%W, y=430+((i*53.7)%290); c.fillRect(x,y,2,1); }
  // espuma de orilla
  c.strokeStyle='rgba(255,255,255,.75)'; c.lineWidth=4; c.beginPath();
  for(let x=-400;x<=W+400;x+=20){ const y=422+Math.sin(x*0.02+T*1.4*wind)*4+Math.sin(T*0.7)*3; x===-400?c.moveTo(x,y):c.lineTo(x,y);} c.stroke();
  // palmeras traseras
  drawPalm(c,520,430,1.0,T,wind,nt); drawPalm(c,1235,445,1.15,T+1.3,wind,nt);
  // hamacas
  const ham=hamacaCount();
  for(let i=0;i<ham;i++) drawHamaca(c,HAMACA_POS[i].x,HAMACA_POS[i].y,i,T,weather,nt);
  // chiringuito
  drawHut(c,T,h,nt,wind);
  drawPurchasedProps(c,T,nt);
  // entidades ordenadas por y
  const ents=[];
  for(const t of Game.tables) ents.push({y:t.y,draw:()=>drawTable(c,t,T)});
  if(Game.mode==='service') for(const cu of Game.customers) ents.push({y:cu.y,draw:()=>drawCustomer(c,cu,T)});
  if(Game.mode==='service'&&Game.floor)for(const a of Game.floor.actors)if(!(a.player&&!a.task&&!a.returning&&Math.hypot(a.x-a.home.x,a.y-a.home.y)<5))ents.push({y:a.y,draw:()=>drawFloorWorker(c,a,T)});
  ents.sort((a,b)=>a.y-b.y).forEach(e=>e.draw());
  // indicadores de cola por encima
  if(Game.mode==='service') for(const cu of Game.customers) drawBubble(c,cu,T);
  if(Game.mode==='service')for(const cu of Game.customers){
    if(cu.state!=='floorWaitEscort')continue;
    const task=Game.floor?.tasks.find(t=>t.kind==='escort'&&t.customer===cu.id&&['queued','blocked'].includes(t.state));
    if(!task)continue;
    c.save();c.font='700 12px system-ui';c.textAlign='center';c.lineWidth=3;c.strokeStyle='#083f43';c.fillStyle='#fffdf8';
    const escortY=cu.y-((cu.mood&&cu.moodT>0)?168:152);
    c.strokeText('Esperando camarero',cu.x,escortY);c.fillText('Esperando camarero',cu.x,escortY);c.restore();
  }
  // etiquetas de puesto por encima de clientes y burbujas: siempre legibles
  drawStationLabels(c);
  // barras de preparación: fila fija sobre la zona de burbujas (una por slot; dos slots pueden repartirse un pedido mixto)
  if(Game.mode==='service'){
    const prepBaseY=Game.slots.some(s=>s.cust)?302:314;
    // 1) medir la etiqueta completa a 10px y dimensionar la píldora con su ancho real + padding
    const items=[];
    for(const s of Game.slots){
      if(!s.cust) continue;
      const cu=s.cust;
      const lab=whoName(s.who)+(s.cover?' (cubriendo)':'');
      c.font='700 10px Satoshi, sans-serif';
      const tw=c.measureText(lab).width;
      const pw=Math.max(76,tw+14);
      items.push({s,cu,lab,pw,p:clamp(s.t/s.total,0,1),x0:cu.x+6,x1:cu.x+6+pw});
    }
    // 2) filas sin colisión: si el intervalo horizontal choca con otra píldora de esa fila, baja una fila (24px)
    const rows=[];
    for(const it of items.sort((a,b)=>a.x0-b.x0)){
      let r=0;
      while(rows[r] && rows[r].some(iv=>it.x0<iv[1] && it.x1>iv[0])) r++;
      (rows[r]=rows[r]||[]).push([it.x0,it.x1]);
      it.row=r;
    }
    // 3) dibujar: texto centrado en el rectángulo real (x-4+pw/2)
    for(const it of items){
      const x=it.cu.x+10, y=prepBaseY-it.row*24;
      c.fillStyle='rgba(42,33,28,.85)'; rr(c,x-4,y-4,it.pw,18,9); c.fill();
      c.fillStyle=WHO_COLOR[it.s.who]||'#ffd36b'; rr(c,x,y,(it.pw-8)*it.p,10,5); c.fill();
      c.font='700 10px Satoshi, sans-serif'; c.textAlign='center'; c.lineWidth=2.5;
      c.strokeStyle='rgba(42,33,28,.85)'; c.strokeText(it.lab,x-4+it.pw/2,y+10); c.fillStyle='#fff6e6'; c.fillText(it.lab,x-4+it.pw/2,y+10);
    } }
  // partículas
  for(const p of Game.particles){ c.globalAlpha=1-p.t/p.life; c.fillStyle=p.color; c.beginPath(); c.arc(p.x,p.y,4,0,7); c.fill(); } c.globalAlpha=1;
  // latencia visible: acciones enviadas que esperan al anfitrión (invitado)
  if(Game.mode==='service') drawPendingBadges(c,T);
  drawNetStatus(c);
  // textos flotantes
  c.textAlign='center';
  for(const f of Game.floaters){ c.globalAlpha=1-f.t/1.4; c.font='700 22px Chillax, sans-serif'; const fw=c.measureText(f.text).width; const fx=clamp(f.x,fw/2+10,W-fw/2-10); c.lineWidth=5; c.strokeStyle='rgba(42,33,28,.8)'; c.strokeText(f.text,fx,f.y-f.t*40); c.fillStyle=f.color; c.fillText(f.text,fx,f.y-f.t*40); } c.globalAlpha=1;
  // efectos de clima / noche
  c.setTransform(1,0,0,1,0,0);
  if(weather==='calima'){ c.fillStyle='rgba(222,160,90,.28)'; c.fillRect(0,0,canvas.width,canvas.height); }
  if(weather==='panza'){ c.fillStyle='rgba(120,130,140,.18)'; c.fillRect(0,0,canvas.width,canvas.height); }
  if(nt>0){ c.fillStyle=`rgba(20,16,50,${nt*0.45})`; c.fillRect(0,0,canvas.width,canvas.height); }
  // luces nocturnas (aditivas)
  if(lvl('luces') && h>18.8){ c.setTransform(view.s,0,0,view.s,view.ox,view.oy); drawLights(c,T,clamp((h-18.8)/1.2,0,1)); }
}
