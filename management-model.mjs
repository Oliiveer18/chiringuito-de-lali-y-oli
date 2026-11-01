// Modelo de gestión: puntuaciones, actividad, comentarios y contratación.
const finite=x=>Number.isFinite(x)?x:0;
const cap=(x,a,b)=>Math.max(a,Math.min(b,x));
// Same calendar math as simProgressDay() in state.js when season=career.season and day=Game.day (30-day seasons).
export function absoluteDay(season,day){
 if(!Number.isInteger(season)||season<1||!Number.isInteger(day)||day<1||day>30)throw new Error('Invalid season/day');
 return (season-1)*30+day;
}
export function dailyPoints(r){
 const served=Math.max(0,finite(r.served)),lost=Math.max(0,finite(r.lost)),revenue=Math.max(0,finite(r.revenue));
 const service=served+lost?served/(served+lost):0;
 const parts={service:40*service,rating:25*cap(finite(r.rating)/5,0,1),margin:20*cap(finite(r.profit)/Math.max(1,revenue),0,1),community:15*cap(Math.log1p(Math.max(0,finite(r.followers)))/Math.log1p(1000),0,1)};
 if(!served&&!revenue)return {total:0,parts:{service:0,rating:0,margin:0,community:0}};
 return {total:Math.round(Object.values(parts).reduce((a,b)=>a+b,0)),parts};
}
export function weeklyPoints(history,day){
 if(!Number.isInteger(day)||day<1)throw new Error('Invalid league day');
 const first=Math.floor((day-1)/7)*7+1,byDay=new Map();
 for(const r of history||[])if(Number.isInteger(r.day)&&r.day>=first&&r.day<=day)byDay.set(r.day,r);
 const rows=[...byDay.values()].sort((a,b)=>a.day-b.day).map(r=>({day:r.day,...dailyPoints(r)}));
 return {first,last:first+6,week:Math.floor((day-1)/7)+1,rows,total:rows.reduce((s,r)=>s+r.total,0)};
}
export function closeActivity(state,day,published){
 if(!Number.isInteger(day)||day<1)throw new Error('Invalid activity day');
 const s=state||{last:0,idle:0};
 if(day<=s.last)return {...s,applied:false};
 if(day!==s.last+1)throw new Error('Activity gap requires migration, not invented days');
 return {last:day,idle:published?0:s.idle+1,applied:true};
}
export function recordComment(posts,postId,comment){
 if(!comment||!comment.id||!comment.authorId||typeof comment.text!=='string'||!comment.text.trim())throw new Error('Invalid comment');
 if(!posts.some(p=>p.id===postId))throw new Error('Missing publication');
 return posts.map(p=>{if(p.id!==postId)return p;const comments=p.comments||[];if(comments.some(c=>c.id===comment.id))return p;return {...p,comments:[...comments,{id:String(comment.id),authorId:String(comment.authorId),text:comment.text.trim(),day:comment.day,reply:null}]};});
}
// Conserva las exportaciones auxiliares de la revisión anterior sin duplicar su implementación.
export {hash32,decide,decideAll,opinionCounts,publicRating} from './opinions-model.mjs';
function hash(text){let h=2166136261;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
const NAMES=['Naira','Aday','Dácil','Jonay','Iballa','Nauzet','Nerea','Airam','Yaiza','Beneharo','Celia','Saúl'];
const ORIGINS=['Arona','Adeje','Los Cristianos','El Médano','Granadilla','San Isidro','Guía de Isora','La Laguna'];
const ROLES=[['camarero',110],['cocinero',130],['limpiador',60],['terraza',120]];
const AVAILABILITY=['Jornada completa','Fines de semana','Mañanas','Tardes'];
/* v28.19: sueldos proporcionales a lo que produce cada candidato.
   Ejes con ventajas Y desventajas reales:
   - Ritmo (workMultiplier es tiempo por unidad): el novato es un 18% más
     lento pero cuesta menos; el experto es un 16% más rápido pero cobra más.
   - Especialidad: mejora su terreno y empeora en el contrario (factor()).
   - Disponibilidad: ahora es real (staffOnDuty) y descuenta el sueldo en la
     misma proporción: media jornada cuesta ~62%, solo fines de semana ~50%.
   El sueldo sale de base x ritmo x presencia (+-5% de regateo), redondeado
   a 5 €: nunca hay fichas desproporcionadas, solo decisiones. */
export const PRESENCE_PRICE={'Jornada completa':1,'Fines de semana':0.55,'Mañanas':0.55,'Tardes':0.55};
/* v29.5: nivel, cansancio y felicidad del personal.
   - Nivel 1-10: la experiencia acumulada mejora el ritmo (~3%/nivel) pero el
     sueldo que el trabajador espera crece con el nivel: mantener talento cuesta.
   - Cansancio: sube trabajando la jornada (0-1). Penaliza el ritmo hasta -20%
     en la segunda mitad de una jornada completa; se resetea cada día.
   - Felicidad (0-1): sueldo justo, carga de trabajo cómoda y eventos del día.
     Trabajar de más cansa; trabajar de menos aburre ("poco que hacer").
     Felicidad alta = hasta +10% de ritmo; sostenida muy baja = renuncia.
   Balance de sueldos: jornada completa produce ~9h frescas por sueldo íntegro;
     dos medias jornadas producen ~10h por 1,1 sueldos: eficiencia por euro
     casi idéntica (±1%), sin que ninguna opción domine. */
export const MAX_LEVEL=10;
export function xpForLevel(level){return Math.round(25*Math.pow(level,1.5));}
export function fatiguePenalty(e){const f=e?.fatigue||0;return f>0.5?(f-0.5)*0.4:0;}
export function happinessBonus(e){const h=e?.happiness==null?0.7:e.happiness;return (h-0.7)*0.33;}
export function effMultiplier(e){
  if(!e||!e.workMultiplier)return 1;
  const level=Math.min(MAX_LEVEL,e.level||1);
  const levelCut=1-0.03*(level-1);
  const weekend=e.availability==='Fines de semana'?0.95:1;
  return Math.max(0.5,Math.min(1.6,e.workMultiplier*levelCut*(1+fatiguePenalty(e))*(1-happinessBonus(e))*weekend));
}
export function expectedWage(e,base){
  const presence=PRESENCE_PRICE[e?.availability]??1;
  const level=1+0.08*((e?.level||1)-1);
  return Math.max(5,Math.round(base*presence*level*(2-(e?.workMultiplier||1))));
}
/* v29.5: cierre de jornada de un empleado. prod: {items,clean,orders,escort,
   delivered,load,eventMood}. Devuelve el empleado actualizado y si renuncia. */
export function dayEndEmployee(e,base,prod){
  const out={...(e||{})};
  const xpGain=Math.round((prod.items||0)*3+(prod.clean||0)*2+(prod.orders||0)*2+(prod.escort||0)+(prod.delivered||0)*1.5);
  out.xp=(out.xp||0)+xpGain;
  out.fatigue=0;
  let leveled=false;
  while((out.level||1)<MAX_LEVEL&&out.xp>=xpForLevel((out.level||1)+1)){out.level=(out.level||1)+1;leveled=true;}
  out.leveledUp=leveled;
  let target=0.75;
  const expected=expectedWage(out,base);
  if(out.wage>=expected*0.95)target+=0.12;else if(out.wage<expected*0.8)target-=0.3;
  if(prod.load!=null){
    if(prod.load<0.35)target-=0.25;
    else if(prod.load>1.2)target-=0.15;
    else target+=0.1;
  }
  if(prod.eventMood)target+=prod.eventMood;
  const prev=out.happiness??0.7;
  out.happiness=Math.max(0,Math.min(1,prev+(target-prev)*0.4));
  if(out.happiness<0.25)out.lowDays=(out.lowDays||0)+1;
  else out.lowDays=Math.max(0,(out.lowDays||0)-1);
  return {employee:out,quit:(out.lowDays||0)>=3,xpGain};
}
export function candidates(seed,day){
 if(!Number.isInteger(day)||day<1)throw new Error('Invalid recruitment day');
 const batch=Math.floor((day-1)/3),h0=hash(seed+':'+batch+':count');
 const min=day<=3?0:day<=7?1:2,max=day<=1?1:day<=4?2:day<=10?3:4;
 const count=min+(h0%Math.max(1,max-min+1)),out=[];
 for(let i=0;i<count;i++){
  const h=hash(seed+':'+batch+':'+i),[role,base]=ROLES[(h>>>16)%ROLES.length];
  const level=h%3,experience=[0,2,5][level];
  const age=Math.max(18+((h>>>3)%23),18+experience),origin=ORIGINS[(h>>>6)%ORIGINS.length];
  const availability=AVAILABILITY[(h>>>9)%AVAILABILITY.length];
  const slowness=[1.18,1,0.84][level];
  const noise=0.95+((h>>>12)%11)/100;
  const raw=base*(2-slowness)*PRESENCE_PRICE[availability]*noise;
  const wage=raw>=25?Math.round(raw/5)*5:Math.round(raw);
  const experienceLabel=experience?experience+' años en '+({camarero:'servicio de barra',cocinero:'cocina',limpiador:'limpieza de establecimientos',terraza:'servicio de terraza'}[role]):'Sin experiencia previa';
  const presRole={camarero:'barra',cocinero:'cocina',limpiador:'limpieza',terraza:'terraza'}[role];
  const presAvail={'Jornada completa':'Puedo hacer jornada completa.','Fines de semana':'Solo puedo trabajar fines de semana: el precio lo refleja.','Mañanas':'Solo doy mañanas (hasta las 15:00): el precio lo refleja.','Tardes':'Solo doy tardes (desde las 14:00): el precio lo refleja.'}[availability];
  const presentation=(experience?'Busco trabajo de temporada en '+presRole+'. Tengo experiencia en el puesto. ':'Busco mi primera oportunidad en '+presRole+' y tengo disposición para aprender. ')+presAvail;
  out.push({id:'cv-'+batch+'-'+i,role,name:NAMES[(h+i)%NAMES.length],age,origin,experience,experienceLabel,availability,presentation,wage,workMultiplier:slowness,received:batch*3+1,expires:batch*3+3,training:0,level:1,xp:0,fatigue:0,happiness:0.7,lowDays:0});
 }
 return out;
}
/* v29.5: la plantilla admite hasta 3 empleados por puesto (huecos extra
   desbloqueados con la mejora de vestuarios). team[rol] es un array. */
export function teamOf(team,role){const v=team?.[role];return Array.isArray(v)?v:v?[v]:[];}
export function hireCandidate(team,applicants,id,day,openSlots=1){
 const c=applicants.find(c=>c.id===id);
 if(!c||day<c.received||day>c.expires)throw new Error('Unavailable candidate');
 if(Object.values(team||{}).some(v=>(Array.isArray(v)?v:[v]).some(e=>e&&e.id===id)))throw new Error('Already hired');
 const list=teamOf(team,c.role);
 if(list.length>=Math.min(3,Math.max(1,openSlots)))throw new Error('No queda hueco para ese puesto');
 return {team:{...team,[c.role]:[...list,{...c,hiredDay:day}]},applicants:applicants.filter(a=>a.id!==id)};
}
export function trainEmployee(employee,cash){
 if(!employee||!Number.isInteger(employee.training)||employee.training<0||employee.training>=2||!Number.isFinite(employee.workMultiplier)||employee.workMultiplier<=0)throw new Error('Training limit');
 const cost=100*(employee.training+1);
 if(!Number.isFinite(cash)||cash<cost)throw new Error('Insufficient cash');
 return {employee:{...employee,training:employee.training+1,workMultiplier:Math.max(0.7,employee.workMultiplier*0.95)},cash:cash-cost,cost};
}
