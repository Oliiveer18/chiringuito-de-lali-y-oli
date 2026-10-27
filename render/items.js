/* Mechanical extraction from render.js; declaration bodies are unchanged. */
import { clamp } from "../util.js?v=27.1";
import { mixColor } from "../util.js?v=27.1";
import { rr } from "../icons.js?v=27.1";
import { COUNTER } from "../world.js?v=27.1";

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
