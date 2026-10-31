import {Game,lvl} from './state.js?v=29.4.1';
import {drawPerson} from './render.js?v=29.4.1';
/* v29.3: bañista de verdad. El mismo muñeco llega andando desde la derecha,
   se tumba en la tumbona (cabeza a la izquierda) el tiempo exacto que ha
   pagado y se levanta y se va. La etiqueta sobre la sombrilla muestra el
   tiempo restante de su estancia. */
export function drawBeachGuest(c,x,y,i,T){const s=Game.upgrades.beach?.slots[i];if(Game.mode!=='service'||!s||s.state==='free')return;const g=s.guest||{};c.save();
 if(s.state==='occupied'){
  c.translate(x+18,y+3);c.rotate(-Math.PI/2);
  drawPerson(c,0,0,{skin:g.skin||'#e0a97e',shirt:g.shirt||'#0f8b8d',hat:g.hat||null,scale:.52,pose:'lie',t:T,look:{walk:{},hair:{style:'corto',color:g.hair||'#2a211c'},acc:[]}});
  c.restore();
  // etiqueta: tiempo restante de la estancia pagada
  const hour=Game.hour+(Game.closing?(Game.closeT||0)/16:0),rem=Math.max(0,s.end-hour);
  const txt=rem>=1?rem.toFixed(1).replace('.',',')+' h':Math.round(rem*60)+' min';
  c.save();c.font='700 10px Satoshi, sans-serif';c.textAlign='center';
  const tw=c.measureText(txt).width+12;
  c.fillStyle='rgba(42,33,28,.78)';rr2(c,x+18-tw/2,y-84,tw,16,8);c.fill();
  c.fillStyle='#fff6e6';c.fillText(txt,x+18,y-72);c.restore();
  return;
 }
 const hour=Game.hour+(Game.closing?(Game.closeT||0)/16:0),p=Math.max(0,Math.min(1,(hour-s.started)/Math.max(.01,s.end-s.started)));
 const moving=s.state==='arriving'?1-p:p;
 drawPerson(c,x+(1300-x)*moving,y+22,{skin:g.skin||'#e0a97e',shirt:g.shirt||'#0f8b8d',hat:g.hat||null,scale:.55,pose:'walk',ph:T*8,look:{walk:{},hair:{style:'corto',color:g.hair||'#2a211c'},acc:[]}});
 c.restore();}
function rr2(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
export function drawPurchasedProps(c,T,nt){c.save();c.globalAlpha=1-Math.min(.5,nt||0);if(lvl('altavoz')){for(const x of [76,448]){c.fillStyle='#20252b';c.fillRect(x,280,27,43);c.strokeStyle='#85919a';c.lineWidth=2;for(const [r,y]of [[4,289],[9,309]]){c.beginPath();c.arc(x+13,y,r,0,Math.PI*2);c.stroke();}if(Game.mode==='service'&&Game.speed){c.fillStyle='#ffe08a';c.font='16px sans-serif';c.fillText('♪',x+30,291-Math.sin(T*2)*5);}}}if(lvl('sombrillas')){for(const t of Game.tables){c.strokeStyle='#e9e1d2';c.lineWidth=3;c.beginPath();c.moveTo(t.x,t.y-5);c.lineTo(t.x,t.y-90);c.stroke();c.fillStyle='#e8603c';c.beginPath();c.moveTo(t.x-42,t.y-79);c.quadraticCurveTo(t.x,t.y-130,t.x+42,t.y-79);c.closePath();c.fill();c.fillStyle='#fff3d6';c.beginPath();c.moveTo(t.x,t.y-106);c.lineTo(t.x+14,t.y-79);c.lineTo(t.x-14,t.y-79);c.closePath();c.fill();}}c.restore();}
