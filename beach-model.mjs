/* v29.3: la hamaca es una estación de verdad.
   Antes era un ingreso pasivo con tarifa fija por sesión (6 €) y un muñeco
   abstracto encima de la tumbona. Ahora:
   - La jugadora fija el PRECIO POR HORA (Game.prices.hamacas, referencia 3 €/h).
   - Los bañistas (NPCs) DECIDEN si alquilan y CUÁNTO TIEMPO pagan en función
     de ese precio: caro = menos bañistas y estancias más cortas.
   - El ingreso es exactamente precio × horas contratadas.
   - Se les ve llegar andando, tumbarse en la tumbona y levantarse cuando se
     acaba el tiempo pagado (ni un segundo más).
   El módulo sigue siendo puro (sin acceso a Game): la pantalla se lee en
   beach.js y el estado se sincroniza entero en el modo cooperativo. */
const rnd=Math.random;
const rand=(a,b)=>a+rnd()*(b-a);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const pick=a=>a[Math.floor(rnd()*a.length)];
export const REF_PRICE=3, MAX_SESSIONS=3;
/* gustos de bañista: camiseta, piel y pelo; se guardan en el slot para que el
   mismo muñeco que llega es el que se tumba y el que se va. */
const SHIRTS=['#e8603c','#0f8b8d','#f5b82e','#5b6ee1','#d94f8a','#3f8a3a','#ffffff','#9a5bd6','#ff9f43'];
const SKINS=['#f2c9a5','#e0a97e','#c58a5c','#8d5a3b','#f7d6bd'];
const HAIR=['#d9b35a','#2a211c','#8a5a3b','#b8321f','#e8e8e8','#6b4a2a'];
/* propensión a alquilar según el clima (la lluvia vacía la playa) */
const W_ARRIVE={sol:1,calima:0.55,viento:0.4,panza:0.15};
export function createBeach(count,hour=10){return {slots:Array.from({length:Math.min(8,Math.max(0,count))},(_,i)=>({state:'free',next:hour+.2+i*.08,started:0,end:0,sessions:0,hours:0,guest:null})),income:0,rentals:0};}
export function stepBeach(old,hour,closing,weather,closeH=20,price=REF_PRICE){
 const s=JSON.parse(JSON.stringify(old)),events=[];
 const p=Number.isFinite(price)&&price>0?price:REF_PRICE;
 s.slots.forEach((slot,i)=>{
  if(closing){if(slot.state==='occupied'||slot.state==='arriving'){slot.state='leaving';slot.started=hour;slot.end=hour+.12;}else if(slot.state==='leaving'&&hour>=slot.end){slot.state='free';slot.next=closeH+1;}return;}
  if(slot.state==='free'&&hour>=slot.next&&slot.sessions<MAX_SESSIONS&&hour<=closeH-1.5){
   /* decisión del NPC: ¿alquila esta hamaca? Depende del precio por hora
      (por encima de ~6 €/h casi nadie se tumba) y del clima. */
   const take=clamp(1.15-p/5,0.05,0.92)*(W_ARRIVE[weather]??0.5);
   if(rnd()<take){
    /* ¿cuánto tiempo paga? Los bañistas generosos estiran la estancia si el
       precio es razonable; nadie paga más horas de las que quedan de día. */
    const hours=clamp(rand(0.75,2.5)*Math.pow(REF_PRICE/p,0.4),0.5,Math.min(3,closeH-hour-0.25));
    slot.state='arriving';slot.started=hour;slot.end=hour+0.12;slot.hours=hours;
    slot.guest={shirt:pick(SHIRTS),skin:pick(SKINS),hair:pick(HAIR),hat:rnd()<0.45?'sombrero':null};
   } else slot.next=hour+rand(0.35,0.8);
  }
  else if(slot.state==='arriving'&&hour>=slot.end){
   /* se tumba: cobra precio × horas exactas de estancia */
   slot.state='occupied';slot.started=hour;slot.end=hour+slot.hours;slot.sessions++;s.rentals++;
   const amount=Math.round(p*slot.hours*10)/10;s.income+=amount;events.push({slot:i,amount,hours:slot.hours});
  }
  else if(slot.state==='occupied'&&hour>=slot.end){slot.state='leaving';slot.started=hour;slot.end=hour+.12;}
  else if(slot.state==='leaving'&&hour>=slot.end){slot.state='free';slot.next=hour+({sol:.7,calima:1.2,viento:2,panza:3}[weather]||2)+i*.02;}
 });
 return {state:s,events};
}
