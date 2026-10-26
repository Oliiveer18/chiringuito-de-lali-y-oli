/* =========================================================
   render.js
   Dibujo de la escena: cielo, kiosco, clientes, burbujas e indicadores de red.
   ========================================================= */
import { H, PERSONALITIES, STATION_COLOR, STATION_LABEL, W, WHO_COLOR, stationOf } from './config.js?v=26.1';
import { $, clamp, lerp, mixColor } from './util.js?v=26.1';
import { drawIcon, rr } from './icons.js?v=26.1';
import { Game, Net, closeHour, guestCust, hamacaCount, isCoop, isGuest, lvl, weatherToday, whoName } from './state.js?v=26.1';
import { COUNTER, HAMACA_POS, SKINS } from './world.js?v=26.1';
import { canvas, ctx, view } from './canvas.js?v=26.1';
import { drawBeachGuest, drawPurchasedProps } from './scene-extras.js?v=26.1';

// ---------- Dibujo ----------
export const SKY_KEYS=[
  {h:9, top:'#7cc7ea',bot:'#d9f1fb'},
  {h:15,top:'#4fb3e3',bot:'#c9ecfa'},
  {h:18,top:'#6aa6d6',bot:'#ffe2a8'},
  {h:19.6,top:'#e28a6c',bot:'#ffc684'},
  {h:20.6,top:'#5a4f86',bot:'#f19a6e'},
  {h:22.2,top:'#1c2148',bot:'#5a3e63'},
];
export function skyAt(h){
  let a=SKY_KEYS[0], b=SKY_KEYS[SKY_KEYS.length-1];
  for(let i=0;i<SKY_KEYS.length-1;i++){ if(h>=SKY_KEYS[i].h && h<=SKY_KEYS[i+1].h){ a=SKY_KEYS[i]; b=SKY_KEYS[i+1]; break; } }
  if(h<SKY_KEYS[0].h) b=a; if(h>b.h) a=b;
  const t = a===b?0: (h-a.h)/(b.h-a.h);
  return {top:mixColor(a.top,b.top,t), bot:mixColor(a.bot,b.bot,t)};
}
export function nightness(h){ return clamp((h-19.8)/2,0,0.75); }

export function render(){
  const c=ctx; const h = Game.mode==='service'? Game.hour : (Game.mode==='report'? closeHour() : 11);
  const weather = Game.forecast.length? weatherToday() : 'sol';
  c.setTransform(1,0,0,1,0,0);
  // fondo de relleno a pantalla completa
  const sky=skyAt(h);
  let g=c.createLinearGradient(0,0,0,view.oy+330*view.s); g.addColorStop(0,sky.top); g.addColorStop(1,sky.bot);
  c.fillStyle=g; c.fillRect(0,0,canvas.width,view.oy+332*view.s);
  c.fillStyle='#2e2826'; c.fillRect(0,view.oy+420*view.s,canvas.width,canvas.height);
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
  const nt=nightness(h); if(nt>0.2){ c.fillStyle=`rgba(255,255,255,${(nt-0.2)*1.2})`; for(let i=0;i<40;i++){ const x=(i*137)%W, y=(i*71)%260; c.fillRect(x,y,2,2);} }
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
  ents.sort((a,b)=>a.y-b.y).forEach(e=>e.draw());
  // indicadores de cola por encima
  if(Game.mode==='service') for(const cu of Game.customers) drawBubble(c,cu,T);
  // etiquetas de puesto por encima de clientes y burbujas: siempre legibles
  drawStationLabels(c);
  // barras de preparación: fila fija sobre la zona de burbujas (una por slot; dos slots pueden repartirse un pedido mixto)
  if(Game.mode==='service'){
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
      const x=it.cu.x+10, y=314-it.row*24;
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

export function drawTeide(c,h,nt){
  const base = mixColor('#8fa0c0','#3b3560',nt), shade=mixColor('#7486ab','#2d2850',nt);
  c.fillStyle=mixColor('#a7b7d2','#433d6a',nt);
  c.beginPath(); c.moveTo(560,332); c.quadraticCurveTo(700,250,820,220); c.lineTo(900,150); c.lineTo(960,140); c.lineTo(1020,205); c.quadraticCurveTo(1150,250,1320,300); c.lineTo(1320,332); c.fill();
  c.fillStyle=base; c.beginPath(); c.moveTo(640,332); c.quadraticCurveTo(780,270,860,215); c.lineTo(905,152); c.lineTo(955,146); c.lineTo(1000,210); c.quadraticCurveTo(1100,270,1230,332); c.fill();
  c.fillStyle=shade; c.beginPath(); c.moveTo(955,146); c.lineTo(1000,210); c.quadraticCurveTo(1100,270,1230,332); c.lineTo(1040,332); c.quadraticCurveTo(990,250,955,146); c.fill();
  const tint = h>18.3? mixColor('#ffffff','#ffc7a1',clamp((h-18.3)/1.5,0,1)) : '#f3f6fb';
  c.fillStyle=nt>0.4? mixColor(tint,'#6c6590',nt) : tint;
  c.beginPath(); c.moveTo(888,172); c.lineTo(905,152); c.lineTo(955,146); c.lineTo(978,178); c.lineTo(960,170); c.lineTo(945,184); c.lineTo(930,170); c.lineTo(912,182); c.closePath(); c.fill();
  // pueblo costero
  c.fillStyle=mixColor('#f5efe4','#6b5f78',nt);
  for(let i=0;i<22;i++){ const x=600+i*28+(i%3)*5, y=318-(i%4)*4; c.fillRect(x,y,16,12-(i%2)*3); }
  if(nt>0.3){ c.fillStyle=`rgba(255,210,120,${nt})`; for(let i=0;i<22;i+=2) c.fillRect(604+i*28,321-(i%4)*4,3,3); }
}
export function drawClouds(c,T,weather,nt,wind){
  const n = weather==='panza'?9:weather==='calima'?2:4;
  const col = weather==='panza'? mixColor('#c9ced6','#4b4767',nt) : mixColor('#ffffff','#a67b95',nt);
  for(let i=0;i<n;i++){
    const sp = 6*wind+(i%3)*3; const x=((i*260 + T*sp)%(W+400))-200; const y = weather==='panza'? 60+(i%3)*45 : 60+(i%3)*50;
    c.fillStyle=col; c.globalAlpha= weather==='panza'?0.95:0.85;
    c.beginPath(); c.ellipse(x,y,90,24,0,0,7); c.ellipse(x+50,y-16,60,26,0,0,7); c.ellipse(x-50,y-8,50,20,0,0,7); c.fill();
  }
  c.globalAlpha=1;
  if(weather==='panza'){ c.fillStyle=mixColor('#b9bfc9','#3f3b5a',nt); c.fillRect(-400,-200,W+800,240); c.beginPath(); for(let x=-400;x<=W+400;x+=60){ c.ellipse(x,40,50,22,0,0,7);} c.fill(); }
}
export function drawSea(c,T,h,nt,wind,sunX){
  const g=c.createLinearGradient(0,330,0,425);
  g.addColorStop(0,mixColor('#1f8fb0','#2b2f5a',nt)); g.addColorStop(1,mixColor('#2ec2c4','#2b4a6a',nt));
  c.fillStyle=g; c.fillRect(-400,330,W+800,95);
  c.strokeStyle='rgba(255,255,255,.35)'; c.lineWidth=2;
  for(let r=0;r<5;r++){ const y=345+r*17; c.beginPath(); for(let x=-400;x<=W+400;x+=16){ const yy=y+Math.sin(x*0.03+T*(1+r*0.2)*wind+r)*2*(1+r*0.3)*wind; x===-400?c.moveTo(x,yy):c.lineTo(x,yy);} c.stroke(); }
  // reflejo del sol
  if(h>17.5){ const a=clamp((h-17.5)/2,0,0.6)*(1-nt); c.fillStyle=`rgba(255,200,120,${a})`; for(let i=0;i<7;i++){ const w=60-i*6+Math.sin(T*2+i)*8; c.fillRect(sunX-w/2,336+i*12,w,4);} }
  // surfistas en el agua con viento
  if(wind>1){ for(let i=0;i<3;i++){ const x=(700+i*180+Math.sin(T*0.5+i)*60), y=372+i*10+Math.sin(T*2+i)*3; c.fillStyle='#f5b82e'; c.fillRect(x-14,y,28,4); c.fillStyle='#2a211c'; c.fillRect(x-3,y-12,6,12); c.beginPath(); c.arc(x,y-15,4,0,7); c.fill(); } }
}
export function drawPalm(c,x,y,s,T,wind,nt){
  c.save(); c.translate(x,y); c.scale(s,s);
  const sway=Math.sin(T*1.2*wind)*0.05*wind;
  c.strokeStyle=mixColor('#8a6a45','#3d3040',nt); c.lineWidth=12; c.lineCap='round';
  c.beginPath(); c.moveTo(0,0); c.quadraticCurveTo(-20,-90,10+sway*100,-190); c.stroke();
  c.strokeStyle='rgba(0,0,0,.15)'; c.lineWidth=2; for(let i=1;i<9;i++){ const t=i/9; const px=lerp(0,10,t)-20*Math.sin(t*Math.PI)*0.8, py=-190*t; c.beginPath(); c.moveTo(px-6,py); c.lineTo(px+6,py-3); c.stroke(); }
  c.translate(10+sway*100,-190);
  c.fillStyle=mixColor('#2f7a3a','#1d3a32',nt);
  for(let i=0;i<7;i++){ const a=-Math.PI+i*(Math.PI/6)+sway*3+Math.sin(T*2*wind+i)*0.04*wind; c.save(); c.rotate(a); c.beginPath(); c.moveTo(0,0); c.quadraticCurveTo(50,-22,100,18); c.quadraticCurveTo(50,0,0,6); c.fill(); c.restore(); }
  c.fillStyle='#5a3b1f'; c.beginPath(); c.arc(-4,6,6,0,7); c.arc(6,8,6,0,7); c.fill();
  c.restore();
}
export function drawHamaca(c,x,y,i,T,weather,nt){
  // sombrilla
  c.strokeStyle='#e9e1d2'; c.lineWidth=3; c.beginPath(); c.moveTo(x+18,y+8); c.lineTo(x+18,y-50); c.stroke();
  const cols=['#e8603c','#f5b82e','#0f8b8d','#fff6e6'];
  c.fillStyle=mixColor(cols[i%4],'#3a3557',nt*0.6); c.beginPath(); c.moveTo(x-18,y-42); c.quadraticCurveTo(x+18,y-76,x+54,y-42); c.closePath(); c.fill();
  // tumbona
  c.fillStyle=mixColor('#fff6e6','#706a86',nt); c.beginPath(); c.moveTo(x-22,y+8); c.lineTo(x+20,y+8); c.lineTo(x+32,y-8); c.lineTo(x+28,y-10); c.lineTo(x+16,y+2); c.lineTo(x-22,y+2); c.closePath(); c.fill();
  // bañista si hace buen tiempo
  drawBeachGuest(c,x,y,i,T);
}
// ---------- Puestos del kiosco: barra vs cocina, bien diferenciados ----------
// Zonas de trabajo absolutas, fuera del alcance de burbujas e insignias:
// bandas libres a la altura del personal: L=88-153, M=245-313, R=405-481.
// La cocinera va en M (270) con su plancha delante; el camarero en R (435).
export const STATION_ZONE = { cocina:248, barra:410 };
export function drawStationProps(c, station, zx){
  if(station==='cocina'){ // plancha sobre la madera de la barra
    c.fillStyle='#2f333a'; rr(c,zx,COUNTER.y-6,60,10,3); c.fill();
    c.fillStyle='#565c66'; rr(c,zx,COUNTER.y-6,60,4,2); c.fill();
    c.fillStyle='#2f333a'; c.fillRect(zx+60,COUNTER.y-3,12,4); // asa a la derecha
  } else { // bandeja con vasos y cocktelera
    c.fillStyle='#0d6d6f'; rr(c,zx,COUNTER.y-5,66,5,2); c.fill();
    c.fillStyle='rgba(255,255,255,.5)'; rr(c,zx+6,COUNTER.y-16,10,12,2); c.fill(); rr(c,zx+20,COUNTER.y-16,10,12,2); c.fill();
    c.fillStyle='#c0c4c8'; rr(c,zx+36,COUNTER.y-20,11,18,3); c.fill(); c.fillStyle='#8b9198'; rr(c,zx+36,COUNTER.y-20,11,5,2); c.fill();
  }
}
export function drawStationWork(c, station, zx, T, slot){
  const prog = slot && slot.total>0 ? clamp(slot.t/slot.total,0,1) : 0;
  if(station==='cocina'){
    // calor sobre la plancha
    c.strokeStyle='rgba(255,255,255,.35)'; c.lineWidth=1.4;
    for(let i=0;i<3;i++){ const yy=COUNTER.y-16-i*7; c.beginPath(); c.moveTo(zx+8+i*14,yy+Math.sin(T*6+i)*1.5); c.quadraticCurveTo(zx+14+i*14,yy-3+Math.sin(T*6+i)*1.5,zx+20+i*14,yy+Math.sin(T*6+i)*1.5); c.stroke(); }
    // papas saltando en la plancha (ciclo 1,6 s) y dorándose con el progreso
    const ph=(T%1.6)/1.6, air=ph<0.38, k=air?Math.sin((ph/0.38)*Math.PI):0;
    for(let i=0;i<3;i++){
      const bx=zx+28+i*15, by=COUNTER.y-6-(air?k*(30+i*7):0);
      c.fillStyle=mixColor('#f2cc6d','#c98a3b',prog);
      c.beginPath(); c.ellipse(bx,by,6,4,0,0,7); c.fill();
    }
    // humillo
    c.fillStyle='rgba(255,255,255,.3)';
    for(let i=0;i<2;i++){ c.beginPath(); c.arc(zx+32+i*22+Math.sin(T*1.5+i*2)*4, COUNTER.y-30-((T*14+i*18)%34), 4+i, 0,7); c.fill(); }
  } else {
    // vaso llenándose según el progreso real del pedido
    const gx=zx+50, gy=COUNTER.y-19;
    c.fillStyle='rgba(255,255,255,.55)'; rr(c,gx,gy,12,17,2); c.fill();
    const lvl=3+prog*11;
    c.fillStyle='#f2b01e'; rr(c,gx+1,gy+16-lvl,10,lvl,1); c.fill();
    if(prog>0.8){ c.fillStyle='#fff'; rr(c,gx+1,gy+16-lvl-3,10,3,1); c.fill(); }
  }
}
export function drawHut(c,T,h,nt,wind){
  const wood=mixColor('#8a5a36','#3d2a26',nt*0.7), woodD=mixColor('#6b4226','#2d1f1c',nt*0.7);
  // trasera
  c.fillStyle=mixColor('#a77b52','#4b3530',nt*0.7); c.fillRect(60,250,420,200);
  // estanterías con botellas
  c.fillStyle=woodD; c.fillRect(80,300,240,8); c.fillRect(80,350,240,8);
  for(let i=0;i<10;i++){ const bx=90+i*23; c.fillStyle=['#3f8a3a','#7a3b1f','#f5b82e','#e9e1d2','#2a6b8a'][i%5]; rr(c,bx,272,12,28,3); c.fill(); rr(c,bx+3,264,6,10,2); c.fill(); }
  for(let i=0;i<8;i++){ const bx=94+i*28; c.fillStyle=['#f5b82e','#d9633f','#fff6e6'][i%3]; rr(c,bx,326,18,24,4); c.fill(); }
  // ventana con plátanos y cafetera
  c.fillStyle=mixColor('#2a211c','#141012',nt); c.fillRect(340,270,120,80);
  c.fillStyle='#c0c4c8'; rr(c,355,300,40,48,6); c.fill(); c.fillStyle='#2a211c'; c.fillRect(366,318,18,6);
  c.fillStyle='#f4d03f'; for(let i=0;i<4;i++){ c.beginPath(); c.ellipse(420+i*7,320,4,14,0.4,0,7); c.fill(); }
  // postes
  c.fillStyle=wood; c.fillRect(56,220,16,320); c.fillRect(470,220,16,320);
  // tejado de palma
  const sway=Math.sin(T*1.5*wind)*1.5*wind;
  c.fillStyle=mixColor('#c79a55','#5a4535',nt*0.7);
  c.beginPath(); c.moveTo(20,250); c.lineTo(270,150); c.lineTo(520,250); c.closePath(); c.fill();
  c.strokeStyle=mixColor('#a77b3c','#45362c',nt*0.7); c.lineWidth=3;
  for(let i=0;i<34;i++){ const x=24+i*14.5; c.beginPath(); c.moveTo(x,248); c.lineTo(x+sway+(i%2?4:-2),268+(i%3)*4); c.stroke(); }
  c.fillStyle=mixColor('#b2864a','#4b3a2e',nt*0.7); for(let i=0;i<34;i++){ const x=22+i*14.5; c.beginPath(); c.moveTo(x,246); c.lineTo(x+7+sway,266+(i%3)*5); c.lineTo(x+14,246); c.fill(); }
  // cartel: la fuente se ajusta al ancho del tablero con margen interior
  c.fillStyle=woodD; rr(c,150,186,240,48,8); c.fill(); c.fillStyle=mixColor('#f1d9a8','#806a56',nt*0.5); rr(c,156,192,228,36,6); c.fill();
  c.fillStyle='#2a211c'; c.textAlign='center';
  { const txt='EL CHARCO AZUL', maxW=196; // 228 - 2·16 de margen interior
    let fs=26; c.font='700 '+fs+'px Chillax, sans-serif';
    const wTxt=c.measureText(txt).width;
    if(wTxt>maxW){ fs=Math.max(14,Math.floor(fs*maxW/wTxt)); c.font='700 '+fs+'px Chillax, sans-serif'; }
    c.fillText(txt,270,210+fs*0.35); }
  // personal detrás de la barra: cada puesto con su aspecto y su faena
  const sb = w=> Game.mode==='service' && Game.slots.some(s=>s.who===w && s.cust);
  const coop = isCoop();
  const wslot = w => Game.slots.find(s=>s.who===w);
  const cookingNow = s => s && s.cust && (s.items||[]).some(i=>stationOf(s.cust.order[i])==='cocina');
  // una única fuente de verdad para la faena: los artículos que realmente se preparan
  const actOf = s => (s && s.cust) ? (cookingNow(s) ? 'cocina' : 'barra') : null;
  const poseOf = w => { const a=actOf(wslot(w)); return a==='cocina'?'cook': a==='barra'?'shake':'idle'; };
  const p1x = coop ? (Net.roles.p1==='barra'?435:265) : 265;
  const p2x = coop ? (Net.roles.p2==='barra'?435:265) : -1;
  const SKIN = w => w==='p2'?'#f2c9a5':'#e0a97e';
  const HAIR = w => w==='p2'?{style:'largo',color:'#b8321f'}:{style:'corto',color:'#2a211c'};
  const lookOf = (w, st) => coop
    ? {shirt: st==='cocina' ? '#f4efe6' : '#0f8b8d', skin:SKIN(w), hat: st==='cocina'?'chef':'pañuelo', look:{hair:HAIR(w),walk:{},acc:[]}, type:'staff'}
    : {shirt:'#e8603c', skin:'#e0a97e', hat:'pañuelo', look:{hair:{style:'corto',color:'#2a211c'},walk:{},acc:[]}, type:'staff'};
  const px = p1x;
  drawPerson(c,px,470,{...lookOf('p1', coop?Net.roles.p1:'all'), pose:poseOf('p1'), t:T, bob:sb('p1')?Math.sin(T*18)*2:0});
  if(coop){ drawPerson(c,p2x,470,{...lookOf('p2',Net.roles.p2), pose:poseOf('p2'), t:T+0.7, bob:sb('p2')?Math.sin(T*18+1)*2:0}); }
  if(coop){ /* etiquetas de puesto: ahora se dibujan al final de render()
               (drawStationLabels) para que clientes y burbujas no las tapen */ }
  if(Game.staff.camarero){ const s=Game.slots.find(s=>s.who==='yeray'); const b=s&&s.cust; drawPerson(c, b?360+Math.sin(T*8)*24:380, 470, {shirt:'#0f8b8d',skin:'#c58a5c',look:{hair:{style:'rastas',color:'#2a211c'},walk:{},acc:[]},type:'staff',bob:b?Math.sin(T*16)*2:0}); }
  if(Game.staff.cocinero){ drawPerson(c,95+Math.sin(T*2)*8,470,{shirt:'#ffffff',skin:'#e0a97e',hat:'chef',type:'staff'}); if(Game.mode==='service'&&Game.slots.some(s=>s.cust)){ c.fillStyle='rgba(255,255,255,.4)'; for(let i=0;i<3;i++){ c.beginPath(); c.arc(130+i*10+Math.sin(T*3+i)*6, 380-((T*30+i*20)%50), 6,0,7); c.fill(); } } }
  // barra
  c.fillStyle=mixColor('#0f8b8d','#123b44',nt*0.7); c.fillRect(COUNTER.x,COUNTER.y,COUNTER.w,COUNTER.h);
  c.fillStyle='rgba(255,255,255,.12)'; for(let i=0;i<11;i++) c.fillRect(COUNTER.x+i*40+4,COUNTER.y+12,30,COUNTER.h-12);
  c.fillStyle=wood; c.fillRect(COUNTER.x-10,COUNTER.y-10,COUNTER.w+20,14);
  // cosas en la barra
  if(Game.stock.papas>0) drawIcon(c,'papas',70,COUNTER.y-6,24);
  if(Game.stock.cerveza>0){ drawIcon(c,'cerveza',102,COUNTER.y-22,28); drawIcon(c,'cerveza',130,COUNTER.y-22,28); }
  // utillaje y faena: la zona es del puesto asignado, el tipo sigue la actividad real
  // (en solitario, ambas zonas comparten la banda M, junto al jugador)
  if(coop){
    const a1=actOf(wslot('p1')), a2=actOf(wslot('p2'));
    const z1=Net.roles.p1==='cocina'?STATION_ZONE.cocina:STATION_ZONE.barra;
    const z2=Net.roles.p2==='cocina'?STATION_ZONE.cocina:STATION_ZONE.barra;
    drawStationProps(c, a1||Net.roles.p1, z1);
    drawStationProps(c, a2||Net.roles.p2, z2);
    if(a1) drawStationWork(c, a1, z1, T, wslot('p1'));
    if(a2) drawStationWork(c, a2, z2, T, wslot('p2'));
  } else {
    const a1=actOf(wslot('p1'));
    if(a1){ drawStationProps(c, a1, 248); drawStationWork(c, a1, 248, T, wslot('p1')); }
  }
  // taburetes
  for(let i=0;i<4;i++){ const x=110+i*100; c.fillStyle=['#e8603c','#f5b82e','#0f8b8d','#e8603c'][i]; rr(c,x-18,520,36,9,4); c.fill(); c.fillRect(x-14,528,5,40); c.fillRect(x+9,528,5,40); }
}
export function drawLights(c,T,a){
  c.save(); c.globalCompositeOperation='lighter';
  const pts=[]; for(let i=0;i<=16;i++){ const t=i/16; pts.push({x:lerp(486,1260,t), y:lerp(250,380,t)+Math.sin(t*Math.PI)*-40+ Math.sin(t*Math.PI*4)*12}); }
  c.strokeStyle=`rgba(40,30,20,${a})`; c.lineWidth=2; c.beginPath(); pts.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y)); c.stroke();
  pts.forEach((p,i)=>{ const fl=0.75+Math.sin(T*3+i)*0.25; const col=['255,200,90','255,120,90','120,220,220'][i%3]; const g=c.createRadialGradient(p.x,p.y+6,0,p.x,p.y+6,26); g.addColorStop(0,`rgba(${col},${0.9*a*fl})`); g.addColorStop(1,`rgba(${col},0)`); c.fillStyle=g; c.beginPath(); c.arc(p.x,p.y+6,26,0,7); c.fill(); });
  c.restore();
}
export function drawTable(c,t,T){
  // sombra
  c.fillStyle='rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(t.x,t.y+16,56,12,0,0,7); c.fill();
  // sillas
  c.fillStyle=t.color; rr(c,t.x-62,t.y-26,22,40,6); c.fill(); rr(c,t.x+40,t.y-26,22,40,6); c.fill();
  // mesa
  c.fillStyle='#8a5a36'; c.fillRect(t.x-4,t.y-14,8,30);
  c.fillStyle='#c79a55'; c.beginPath(); c.ellipse(t.x,t.y-16,38,12,0,0,7); c.fill(); c.strokeStyle='#8a5a36'; c.lineWidth=2; c.stroke();
  if(t.state==='busy' && t.cust && t.cust.state==='eat'){ t.cust.served.forEach((id,i)=>drawIcon(c,id,t.x-10+i*20,t.y-24,22)); }
  if(t.state==='dirty'){
    c.fillStyle='#e9e1d2'; c.beginPath(); c.ellipse(t.x-10,t.y-18,9,4,0,0,7); c.fill(); c.fillStyle='rgba(184,50,31,.8)'; c.beginPath(); c.arc(t.x-8,t.y-19,2.5,0,7); c.fill();
    c.fillStyle='rgba(242,176,30,.6)'; rr(c,t.x+6,t.y-30,8,12,2); c.fill();
    // moscas
    for(let i=0;i<2;i++){ c.fillStyle='#2a211c'; c.beginPath(); c.arc(t.x+Math.sin(T*6+i*2)*18, t.y-40+Math.cos(T*7+i)*8,1.8,0,7); c.fill(); }
    // aviso
    const pulse = 1+Math.sin(T*6)*0.08;
    c.save(); c.translate(t.x,t.y-62); c.scale(pulse,pulse);
    c.fillStyle='#fff6e6'; rr(c,-34,-14,68,26,13); c.fill(); c.strokeStyle='#2a211c'; c.lineWidth=2; c.stroke();
    c.fillStyle='#2a211c'; c.font='700 13px Satoshi, sans-serif'; c.textAlign='center'; c.fillText('Limpiar',0,4);
    c.restore();
  }
}
export function drawPerson(c,x,y,o){
  const look=o.look||{};
  const hair=look.hair||{style:'corto',color:'#d9b35a'};
  const build=look.build||1, height=look.height||1;
  const wk=look.walk||{};
  const s=(o.scale||1)*height;
  const pose=o.pose||((o.walk||0)!==0?'walk':'idle');
  const t=o.t||0, ph=o.ph||o.walk||0;
  const moving=(o.moving!==undefined)?o.moving:(pose==='walk');
  c.save(); c.translate(x+(wk.sway&&moving?Math.sin(ph)*2.5:0), y+(o.bob||0));
  c.scale(s*(o.dir||1),s);
  const swing = moving?Math.sin(ph)*6:0;
  // piernas
  c.strokeStyle=o.skin; c.lineWidth=7; c.lineCap='round';
  c.beginPath(); c.moveTo(-6,-26); c.lineTo(-6+swing,0); c.moveTo(6,-26); c.lineTo(6-swing,0); c.stroke();
  // bañador/shorts
  c.fillStyle=o.shorts||'#2a3f6b'; rr(c,-13*build,-36,26*build,14,4); c.fill();
  // mochila (detrás del torso)
  if((look.acc||[]).includes('mochila')){ c.fillStyle='#8a5a36'; rr(c,-24*build,-64,10,22,4); c.fill(); }
  // torso
  c.fillStyle=o.shirt; rr(c,-15*build,-68,30*build,36,10); c.fill();
  // brazos según la actividad (mejora 2)
  c.strokeStyle=o.skin; c.lineWidth=6; c.lineCap='round';
  const shL=-14*build, shR=14*build;
  const arm=(x0,y0,x1,y1)=>{ c.beginPath(); c.moveTo(x0,y0); c.lineTo(x1,y1); c.stroke(); };
  switch(pose){
    case 'walk': arm(shL,-62,-19,-40+Math.cos(ph)*3); arm(shR,-62,19,-40-Math.cos(ph)*3); break;
    case 'menu': arm(shL,-62,-7,-48); arm(shR,-62,7,-48); break;
    case 'order': arm(shL,-62,-18,-40); arm(shR,-62,22,-84+Math.sin(t*8)*2); break;
    case 'lookAround': arm(shL,-62,-11,-44); arm(shR,-62,11,-44); break;
    case 'watch': arm(shL,-62,-2,-70); arm(shR,-62,19,-40); break;
    case 'protest': arm(shL,-62,-16,-48); arm(shR,-62,20,-90+Math.sin(t*10)*2); break;
    case 'drink': arm(shL,-62,-18,-40); arm(shR,-62,6,-76); break;
    case 'eat': arm(shL,-62,-18,-40); arm(shR,-62,6,-76+Math.sin(t*5)*3); break;
    case 'bye': arm(shL,-62,-18,-40); arm(shR,-62,20,-86+Math.sin(t*7)*3); break;
    case 'angry': arm(shL,-62,4,-52); arm(shR,-62,-4,-52); break;
    case 'shake': arm(shL,-62,-8,-58); arm(shR,-62,8,-58); break;   // barra: agita la cocktelera
    case 'cook':  arm(shL,-62,-14,-46); arm(shR,-62,26,-54); break; // cocina: espátula sobre la plancha
    default: arm(shL,-62,-18,-42+Math.sin(t*1.6)*1); arm(shR,-62,18,-42-Math.sin(t*1.6)*1); // idle / wait
  }
  // cabeza
  const hd = pose==='lookAround'?Math.sin(t*2.2)*3 : pose==='watch'?-3 : pose==='cook'?2.5 : 0;
  c.fillStyle=o.skin; c.beginPath(); c.arc(0,-80,12,0,7); c.fill();
  // pelo (mejora 7): parte trasera antes de la cabeza
  c.fillStyle=hair.color;
  if(hair.style==='coleta'){ c.beginPath(); c.arc(-13,-77,5,0,7); c.fill(); }
  if(hair.style==='rastas'){ c.fillRect(-17,-80,4,15); c.fillRect(-12,-77,4,18); c.fillRect(-19,-74,4,12); }
  if(hair.style==='largo'){ c.fillRect(-17,-84,5,28); c.fillRect(11,-84,4,22); }
  if(hair.style!=='calvo'){ c.beginPath(); c.arc(0,-82,13,Math.PI*0.92,Math.PI*2.08); c.fill(); }
  if(hair.style==='flequillo'){ c.fillRect(-4,-87,15,6); }
  if(hair.style==='moño'){ c.beginPath(); c.arc(0,-95,5,0,7); c.fill(); }
  // ojo + ceja
  c.fillStyle='#2a211c'; c.beginPath(); c.arc(4+hd,-81,1.6,0,7); c.fill();
  if(pose==='protest'||pose==='angry'){ c.strokeStyle='#2a211c'; c.lineWidth=1.4; c.beginPath(); c.moveTo(1+hd,-86); c.lineTo(7+hd,-84); c.stroke(); }
  // sombrero y complementos
  switch(o.hat){
    case 'sombrero': c.fillStyle='#f1d9a8'; c.beginPath(); c.ellipse(0,-88,20,5,0,0,7); c.fill(); rr(c,-10,-100,20,12,5); c.fill(); c.fillStyle='#e8603c'; c.fillRect(-10,-91,20,3); break;
    case 'gafas': c.fillStyle='#3b2a1e'; c.beginPath(); c.arc(0,-84,12,Math.PI,0); c.fill(); c.fillStyle='#111'; rr(c,-2,-84,14,5,2); c.fill(); break;
    case 'gorra': c.fillStyle='#0f8b8d'; c.beginPath(); c.arc(0,-84,12,Math.PI,0); c.fill(); c.fillRect(0,-86,18,4); break;
    case 'pañuelo': c.fillStyle='#f5b82e'; c.beginPath(); c.arc(0,-84,12.5,Math.PI,0); c.fill(); c.fillRect(-14,-86,6,10); break;
    case 'chef': c.fillStyle='#fff'; rr(c,-10,-106,20,18,6); c.fill(); c.beginPath(); c.arc(-6,-104,7,0,7); c.arc(6,-104,7,0,7); c.fill(); break;
  }
  if((look.acc||[]).includes('gafasSol')){ c.fillStyle='#111'; rr(c,-2,-85,15,5,2); c.fill(); }
  if((look.acc||[]).includes('pendiente')){ c.fillStyle='#f4d03f'; c.beginPath(); c.arc(-11,-75,1.5,0,7); c.fill(); }
  if((look.acc||[]).includes('collar')){ c.strokeStyle='#f4d03f'; c.lineWidth=1.4; c.beginPath(); c.arc(0,-66,5,0.15*Math.PI,0.85*Math.PI); c.stroke(); }
  // atrezzo de la actividad
  if(pose==='menu'){ c.fillStyle='#fff6e6'; rr(c,-9,-54,18,15,2); c.fill(); c.strokeStyle='#2a211c'; c.lineWidth=1; c.stroke(); c.strokeStyle='#b8a98f'; c.beginPath(); c.moveTo(-6,-49); c.lineTo(6,-49); c.moveTo(-6,-45); c.lineTo(3,-45); c.stroke(); }
  if(pose==='watch'){ c.fillStyle='#2a211c'; c.beginPath(); c.arc(-2,-70,2.2,0,7); c.fill(); c.strokeStyle='#f4d03f'; c.lineWidth=1.4; c.beginPath(); c.moveTo(-2,-70); c.lineTo(-2,-73); c.moveTo(-2,-70); c.lineTo(0,-69); c.stroke(); }
  if(pose==='drink'){ c.fillStyle='#f2b01e'; rr(c,2,-84,9,10,2); c.fill(); c.strokeStyle='#2a211c'; c.lineWidth=1; c.stroke(); c.fillStyle='#fff'; c.fillRect(3,-86,7,2); }
  if(pose==='eat'){ c.fillStyle='#c9a266'; c.beginPath(); c.ellipse(9,-70+Math.sin(t*5)*3,3,2,0,0,7); c.fill(); }
  if(pose==='shake'){ // cocktelera entre las manos, agitándose
    const sh=Math.sin(t*16)*2.5;
    c.fillStyle='#c0c4c8'; rr(c,-6,-74+sh,12,16,3); c.fill();
    c.fillStyle='#8b9198'; rr(c,-6,-74+sh,12,5,2); c.fill();
    c.fillStyle='#e8edf0'; rr(c,-7,-75+sh,14,3,1); c.fill();
  }
  if(pose==='cook'){ // espátula en la mano derecha
    c.strokeStyle='#565c66'; c.lineWidth=3; c.beginPath(); c.moveTo(22,-54); c.lineTo(34,-63); c.stroke();
    c.fillStyle='#c9cdd2'; rr(c,32,-67,11,7,2); c.fill();
  }
  if(o.type==='surfista' && o.board){ c.fillStyle='#f5b82e'; c.save(); c.rotate(-0.15); rr(c,18,-100,12,90,6); c.fill(); c.fillStyle='#e8603c'; c.fillRect(22,-100,4,90); c.restore(); }
  if(o.type==='turista' && o.camera){ c.fillStyle='#2a211c'; rr(c,-6,-60,12,9,2); c.fill(); }
  c.restore();
}
// pose según lo que hace el cliente (mejora 2 + 4)
export function customerPose(cu){
  switch(cu.state){
    case 'arrive': case 'walkby': case 'toTable': return 'walk';
    case 'leave': return cu.act==='bye'?'bye':(cu.mood==='enfado'?'angry':'walk');
    case 'queue': case 'prep': {
      if(cu.patience<=0 || cu.anger===3) return 'protest';
      if(cu.anger===2) return 'watch';
      if(cu.anger===1 && (cu.act==='wait'||cu.act==='lookAround')) return 'lookAround';
      return cu.act||'wait';
    }
    case 'eat': return cu.act==='drink'?'drink':'eat';
    case 'waitTable': return 'watch';
  }
  return 'idle';
}
export function drawCustomer(c,cu,T){
  const pose=customerPose(cu);
  const look=cu.look||{};
  const wk=look.walk||{};
  const moving=(cu.movingSpd||0)>8;
  const sit = cu.state==='eat';
  const bobAmt = moving ? Math.abs(Math.sin(cu.stridePh||cu.bob))*-3*(wk.bob||1) : Math.sin(T*1.5+(cu.id%6))*0.8;
  c.fillStyle='rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(cu.x,cu.y+2,16,5,0,0,7); c.fill();
  drawPerson(c,cu.x,cu.y-(sit?6:0),{shirt:cu.shirt,skin:cu.skin,hat:cu.hat,type:cu.type,look,
    board:cu.type==='surfista'&&!sit, camera:cu.id%2===0,
    pose, t:(cu.actT!=null&&cu.actT<50)?cu.actT:T, ph:cu.stridePh||0, moving, bob:bobAmt, dir:cu.dir||1,
    shorts: cu.type==='surfista'?'#e8603c':'#2a3f6b'});
}
export function drawOrderIcons(c,cu,x,y){
  const coop=isCoop(), mine = Net.roles[Net.me];
  cu.order.forEach((id,i)=>{
    const ix=x+24+i*34, st = cu.itemSt? cu.itemSt[i] : 0;
    c.globalAlpha = st===2||st===3 ? 0.45 : 1;
    drawIcon(c,id,ix,y+20,30); c.globalAlpha=1;
    // aviso visible de sustitución aceptada (mejora 6)
    if(cu.subs && cu.subs[i] && st===0){
      c.fillStyle='#ffd36b'; c.beginPath(); c.arc(ix+10,y+2,7,0,7); c.fill(); c.strokeStyle='#2a211c'; c.lineWidth=1.4; c.stroke();
      c.strokeStyle='#2a211c'; c.lineWidth=1.8; c.beginPath(); c.moveTo(ix+6,y+1); c.lineTo(ix+14,y+1); c.moveTo(ix+6,y+4); c.lineTo(ix+14,y+4); c.stroke();
      c.beginPath(); c.moveTo(ix+6,y+1); c.lineTo(ix+8,y-1); c.moveTo(ix+6,y+1); c.lineTo(ix+8,y+3); c.moveTo(ix+14,y+4); c.lineTo(ix+12,y+2); c.moveTo(ix+14,y+4); c.lineTo(ix+12,y+6); c.stroke();
    }
    if(coop && st===0){ c.fillStyle=STATION_COLOR[stationOf(id)]; rr(c,ix-11,y+33,22,4,2); c.fill(); if(stationOf(id)===mine){ c.strokeStyle=STATION_COLOR[mine]; c.lineWidth=2; rr(c,ix-16,y+3,32,34,8); c.stroke(); } }
    if(st===1){ c.strokeStyle='#2a211c'; c.lineWidth=2; c.beginPath(); c.arc(ix+10,y+8,6,0,7); c.fillStyle='#fff6e6'; c.fill(); c.stroke(); c.beginPath(); c.moveTo(ix+10,y+8); c.lineTo(ix+10,y+4); c.moveTo(ix+10,y+8); c.lineTo(ix+13,y+9); c.stroke(); }
    if(st===2){ c.fillStyle='#3f8a3a'; c.beginPath(); c.arc(ix+10,y+8,7,0,7); c.fill(); c.strokeStyle='#fff'; c.lineWidth=2.4; c.beginPath(); c.moveTo(ix+6.5,y+8); c.lineTo(ix+9,y+10.5); c.lineTo(ix+13.5,y+5.5); c.stroke(); }
    if(st===3 || (st===0 && Game.stock[id]<=0)){ c.strokeStyle='#c73e2a'; c.lineWidth=3; c.beginPath(); c.moveTo(ix-12,y+8); c.lineTo(ix+12,y+32); c.stroke(); }
  });
}
export const MOODS = {caro:'¡Qué caro!', lleno:'Mucha cola…', nohay:'¿No queda?', enfado:'¡Me voy!', llevar:'Para llevar', feliz:'¡Riquísimo!', meh:'Bueno…', cambio:'Cambio', mesa:'¿Mesa?'};
// placa de personalidad (mejora 3): pictograma + explicación del comportamiento
export const PCOLORS = {tranquilo:'#2a7d4f', impaciente:'#c25b2a', exigente:'#6b5bd6', generoso:'#c94f7c'};
export function drawPictogram(c,key,x,y){
  c.save(); c.translate(x,y); c.strokeStyle='#fff6e6'; c.fillStyle='#fff6e6'; c.lineWidth=1.6;
  if(key==='tranquilo'){ // palmera
    c.beginPath(); c.moveTo(0,6); c.lineTo(0,-2); c.stroke();
    for(const a of [-2.4,-1.6,-0.8,0,0.8]){ c.beginPath(); c.moveTo(0,-2); c.lineTo(Math.sin(a)*5,-2-Math.cos(a)*4.5); c.stroke(); }
  } else if(key==='impaciente'){ // reloj
    c.beginPath(); c.arc(0,0,5,0,7); c.stroke(); c.beginPath(); c.moveTo(0,0); c.lineTo(0,-3); c.moveTo(0,0); c.lineTo(2.5,1); c.stroke();
  } else if(key==='exigente'){ // estrella
    c.beginPath(); for(let i=0;i<10;i++){ const a=-Math.PI/2+i*Math.PI/5, r=i%2?2.4:5.6; c.lineTo(Math.cos(a)*r,Math.sin(a)*r); } c.closePath(); c.fill();
  } else if(key==='generoso'){ // corazón
    c.beginPath(); c.moveTo(0,5); c.lineTo(-5,0); c.arc(-2.5,-1,2.5,Math.PI,0,false); c.arc(2.5,-1,2.5,Math.PI,0,false); c.lineTo(5,0); c.closePath(); c.fill();
  }
  c.restore();
}
export function drawPersonalityBadge(c,cu,bx,by,bw){
  const P=PERSONALITIES[cu.personality]; if(!P) return;
  c.font='700 9px Satoshi, sans-serif';
  // dos líneas para que quepa sin invadir al vecino de la fila
  const parts=P.hint.split('·').map(s=>s.trim());
  const tw=Math.max(c.measureText(parts[0]).width, parts[1]?c.measureText(parts[1]).width:0);
  const w=tw+26;
  // junto a la burbuja, anclado al borde derecho (espacio libre hacia las mesas); a la izquierda si no cabe
  let x=bx+bw/2+6; if(x+w>W-4) x=bx-bw/2+2-w;
  const y=by-30;
  c.fillStyle=PCOLORS[cu.personality]||'#555'; rr(c,x,y,w,28,9); c.fill();
  c.strokeStyle='rgba(42,33,28,.7)'; c.lineWidth=1.2; c.stroke();
  drawPictogram(c,cu.personality,x+11,y+14);
  c.fillStyle='#fff6e6'; c.textAlign='left';
  c.fillText(parts[0],x+20,y+12);
  if(parts[1]) c.fillText(parts[1],x+20,y+22.5);
  c.textAlign='center';
}
export function drawNameplate(c,cu,bx,by){
  const ly = cu.regLoyalty!=null?cu.regLoyalty:(Game.regulars&&cu.regular&&Game.regulars[cu.regular.id]?Game.regulars[cu.regular.id].loyalty:1);
  c.font='700 10px Satoshi, sans-serif';
  const txt=cu.regular.name+' '+'★'.repeat(ly);
  const tw=c.measureText(txt).width+16;
  // no invade la burbuja triple del vecino de la izquierda
  const x0=Math.max(bx-tw/2,bx-20), cx=x0+tw/2;
  c.fillStyle='rgba(42,33,28,.85)'; rr(c,x0,by-22,tw,15,7); c.fill();
  c.fillStyle='#ffd36b'; c.textAlign='center'; c.fillText(txt,cx,by-11);
}
// aviso de enfado dentro de la burbuja (mejora 4)
export function drawAngerCue(c,x,y,stage,T){
  if(stage===1){ c.fillStyle='#e0a000'; for(let i=0;i<3;i++){ c.globalAlpha=0.4+0.6*Math.abs(Math.sin(T*2+i*0.7)); c.beginPath(); c.arc(x+i*6,y,2.2,0,7); c.fill(); } c.globalAlpha=1; }
  else if(stage===2){ c.strokeStyle='#d9633f'; c.lineWidth=1.8; c.beginPath(); c.arc(x+3,y-1,6,0,7); c.stroke(); c.beginPath(); c.moveTo(x+3,y-1); c.lineTo(x+3,y-5.5); c.moveTo(x+3,y-1); c.lineTo(x+6.5,y); c.stroke(); }
  else { c.fillStyle=Math.sin(T*10)>0?'#e8473c':'#a3322a'; c.font='700 13px Satoshi, sans-serif'; c.textAlign='left'; c.fillText('!',x,y+5); c.textAlign='center'; }
}
export function drawBubble(c,cu,T){
  if(cu.state==='queue' || cu.state==='arrive' || cu.state==='prep'){
    const n=cu.order.length, bw=14+n*34;
    const stag = cu.spot>=0 ? cu.spot%2===1 : cu.id%2===0;
    const by = cu.y - (stag?214:142);
    const bx = clamp(cu.x, bw/2+6, W-bw/2-6);
    const grace = cu.patience<=0 && cu.maxPatience>0;
    c.fillStyle='#fff6e6'; rr(c,bx-bw/2,by,bw,40,12); c.fill();
    c.strokeStyle = grace ? (Math.sin(T*10)>0?'#e8473c':'#7d2f24') : '#2a211c'; c.lineWidth=2; c.stroke();
    const ax=clamp(cu.x,bx-bw/2+16,bx+bw/2-16);
    c.beginPath(); c.moveTo(ax-6,by+40); c.lineTo(ax,by+48); c.lineTo(ax+6,by+40); c.fillStyle='#fff6e6'; c.fill();
    drawOrderIcons(c,cu,bx-bw/2,by);
    // franja de paciencia dentro de la burbuja (cabe siempre: burbuja de 1 item incluida)
    if(cu.state==='queue' || (cu.state==='prep' && !cu.inPrep)){
      const p=clamp(cu.patience/(cu.maxPatience||1),0,1);
      const sw=Math.min(50,bw-12);
      c.fillStyle='rgba(42,33,28,.18)'; rr(c,bx-sw/2,by+33,sw,7,3.5); c.fill();
      c.fillStyle = p>0.5?'#5cc35a': p>0.25?'#f5b82e':'#e8473c'; rr(c,bx-sw/2,by+33,Math.max(2,sw*p),7,3.5); c.fill();
      if(cu.anger>0) drawAngerCue(c, bx-sw/2+7, by+36.5, cu.anger, T);
    }
    // número de puesto
    if(cu.spot>=0){ c.fillStyle='rgba(42,33,28,.85)'; c.beginPath(); c.arc(cu.x,cu.y+20,11,0,7); c.fill(); c.fillStyle='#fff6e6'; c.font='700 13px Satoshi, sans-serif'; c.textAlign='center'; c.fillText(String(cu.spot+1),cu.x,cu.y+25); }
    drawPersonalityBadge(c,cu,bx,by,bw);
    if(cu.regular) drawNameplate(c,cu,bx,by-26);
  } else if(cu.mood && cu.moodT>0){
    const txt=cu.moodTxt || MOODS[cu.mood]; if(!txt) return;
    c.font='700 13px Satoshi, sans-serif'; const tw=c.measureText(txt).width+18;
    const good = cu.mood==='feliz';
    const mx=clamp(cu.x,tw/2+4,W-tw/2-4); // no cortarse en los bordes
    c.globalAlpha=clamp(cu.moodT,0,1);
    c.fillStyle= good?'#dff3d6': (cu.mood==='llevar'||cu.mood==='meh'||cu.mood==='cambio'||cu.mood==='mesa')?'#fff6e6':'#ffd9cf'; rr(c,mx-tw/2,cu.y-132,tw,26,13); c.fill(); c.strokeStyle='#2a211c'; c.lineWidth=2; c.stroke();
    c.fillStyle='#2a211c'; c.textAlign='center'; c.fillText(txt,mx,cu.y-114); c.globalAlpha=1;
  } else if(cu.state==='waitTable'){
    c.font='700 13px Satoshi, sans-serif'; const txt=cu.moodTxt||'¿Mesa?'; const tw=c.measureText(txt).width+18;
    const mx=clamp(cu.x,tw/2+4,W-tw/2-4);
    c.fillStyle='#fff6e6'; rr(c,mx-tw/2,cu.y-132,tw,26,13); c.fill(); c.strokeStyle='#2a211c'; c.lineWidth=2; c.stroke();
    c.fillStyle='#2a211c'; c.textAlign='center'; c.fillText(txt,mx,cu.y-114);
  }
}
// etiquetas de puesto (coop): se dibujan al FINAL de render() para que
// ni los clientes ni sus burbujas de pedido las tapen
export function drawStationLabels(c){
  if(!isCoop()) return;
  c.font='700 13px Satoshi, sans-serif'; c.textAlign='center';
  const px = Net.roles.p1==='barra'?435:265;
  const p2x = Net.roles.p2==='barra'?435:265;
  const nps=[['p1',px],['p2',p2x]].map(([w,x])=>({w,x,lab:Net.names[w]+' · '+STATION_LABEL[Net.roles[w]],tw:c.measureText(Net.names[w]+' · '+STATION_LABEL[Net.roles[w]]).width+14}));
  // nombres largos: resolver solape horizontal de izquierda a derecha (hueco de 8px, sin salir del lienzo)
  const sorted=nps.slice().sort((a,b)=>a.x-b.x);
  for(let i=1;i<sorted.length;i++){ const p=sorted[i-1], q=sorted[i]; const minX=p.x+p.tw/2+8+q.tw/2; if(q.x<minX) q.x=minX; }
  for(const n of nps){ if(n.x+n.tw/2>W-6) n.x=W-6-n.tw/2; c.fillStyle='rgba(42,33,28,.8)'; rr(c,n.x-n.tw/2,332,n.tw,20,10); c.fill(); c.fillStyle=WHO_COLOR[n.w]; c.fillText(n.lab,n.x,346); }
  c.textAlign='center';
}
// ---------- Latencia visible (invitado): acción enviada, esperando al anfitrión ----------
// Anillo punteado + etiqueta sobre el objetivo tocado. Verde: enviada; ámbar: sin confirmación.
export function drawPendingBadges(c,T){
  if(!isGuest() || !Net.pend.size) return;
  for(const p of Net.pend.values()){
    let x,y,r;
    if(p.kind==='serve'){
      const cu=guestCust.get(p.key); if(!cu) continue;
      x=cu.x; y=cu.y-8; r=30;
    } else {
      const t=Game.tables[p.key]; if(!t) continue;
      // r=42 centrado en (t.x, t.y-4): el aro queda por debajo del rótulo «Limpiar» (t.y-76…t.y-50)
      x=t.x; y=t.y-4; r=42;
    }
    c.save();
    c.globalAlpha = p.expired?1:0.65+0.35*Math.sin(T*5);
    c.strokeStyle = p.expired?'#e8a33d':'#9ff0d0';
    c.lineWidth=2.5; c.setLineDash([7,5]); c.lineDashOffset=-(T*26)%12;
    c.beginPath(); c.arc(x,y,r,0,7); c.stroke();
    c.restore();
    // píldora en coordenadas de PANTALLA (tamaño legible constante en px CSS):
    // los anillos siguen al objeto, pero el texto no se encoge con la escena
    const dpr=view.dpr||1;
    const sx=view.ox+x*view.s, sy=view.oy+y*view.s, sr=r*view.s; // ancla del anillo en pantalla
    const label = p.expired?'Sin confirmación':'Enviado…';
    c.save();
    c.setTransform(1,0,0,1,0,0);
    c.font='700 '+(12*dpr)+'px Satoshi, sans-serif';
    const tw=c.measureText(label).width+18*dpr;
    let bx=sx+sr+10*dpr; if(bx+tw>canvas.width-8*dpr) bx=sx-sr-10*dpr-tw; // no cabe: a la izquierda
    let by=sy-9*dpr;
    by=Math.max(8*dpr, Math.min(by, canvas.height-8*dpr-19*dpr));      // dentro del lienzo
    c.fillStyle='rgba(42,33,28,.88)'; rr(c,bx,by,tw,19*dpr,9*dpr); c.fill();
    c.strokeStyle=p.expired?'#e8a33d':'#9ff0d0'; c.lineWidth=1.2*dpr; rr(c,bx,by,tw,19*dpr,9*dpr); c.stroke();
    c.fillStyle=p.expired?'#ffd9a0':'#d9fff0'; c.textAlign='left'; c.fillText(label,bx+9*dpr,by+13*dpr);
    c.restore();
  }
}
// estado de la red en pantalla (invitado): latencia medida de tus acciones hasta el anfitrión
export function drawNetStatus(c){
  if(!isGuest() || Net.confMs==null) return;
  const dpr=view.dpr||1;
  // esquina superior derecha del ÁREA DE ESCENA (por debajo del HUD), en píxeles de canvas
  const rx=view.ox+W*view.s, ry=view.oy;
  c.save(); c.setTransform(1,0,0,1,0,0); // coordenadas de pantalla, sin la escala de la escena
  const ms=Math.round(Net.confMs);
  const col = ms<150?'#5cc35a': ms<400?'#f5b82e':'#e8473c';
  const txt = 'confirmación '+ms+' ms';
  c.font='700 '+(11*dpr)+'px Satoshi, sans-serif';
  const tw=c.measureText(txt).width+24*dpr;
  const pillX=rx-tw-14*dpr; // misma x para fondo, punto y texto: márgenes consistentes
  c.fillStyle='rgba(42,33,28,.72)'; rr(c,pillX,ry+12*dpr,tw,20*dpr,10*dpr); c.fill();
  c.fillStyle=col; c.beginPath(); c.arc(pillX+9*dpr,ry+22*dpr,3.5*dpr,0,7); c.fill();
  c.fillStyle='#fff6e6'; c.textAlign='left'; c.fillText(txt,pillX+18*dpr,ry+26*dpr);
  c.restore();
}
