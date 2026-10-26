// Alquiler por sesión: 6 €, estancia máxima 2,5 horas, tres sesiones por hamaca y jornada.
export const FEE=6,MAX_SESSIONS=3;
export function createBeach(count,hour=10){return {slots:Array.from({length:Math.min(8,Math.max(0,count))},(_,i)=>({state:'free',next:hour+.2+i*.08,started:0,end:0,sessions:0})),income:0,rentals:0};}
export function stepBeach(old,hour,closing,weather,closeHour=20){
 const s=JSON.parse(JSON.stringify(old)),events=[];
 s.slots.forEach((slot,i)=>{
  if(closing){if(slot.state==='occupied'||slot.state==='arriving'){slot.state='leaving';slot.started=hour;slot.end=hour+.12;}else if(slot.state==='leaving'&&hour>=slot.end){slot.state='free';slot.next=closeHour+1;}return;}
  if(slot.state==='free'&&hour>=slot.next&&slot.sessions<MAX_SESSIONS&&hour<=closeHour-1.5){slot.state='arriving';slot.started=hour;slot.end=hour+.12;}
  else if(slot.state==='arriving'&&hour>=slot.end){slot.state='occupied';slot.started=hour;slot.end=Math.min(hour+2.5,closeHour);slot.sessions++;s.rentals++;s.income+=FEE;events.push({slot:i,amount:FEE});}
  else if(slot.state==='occupied'&&hour>=slot.end){slot.state='leaving';slot.started=hour;slot.end=hour+.12;}
  else if(slot.state==='leaving'&&hour>=slot.end){slot.state='free';slot.next=hour+({sol:.7,calima:1.2,viento:2,panza:3}[weather]||2)+i*.02;}
 });return {state:s,events};
}
