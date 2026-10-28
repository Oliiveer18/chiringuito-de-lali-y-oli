// Modelo de gestión: puntuaciones, actividad, comentarios y contratación.
const finite=x=>Number.isFinite(x)?x:0;
const cap=(x,a,b)=>Math.max(a,Math.min(b,x));
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
const NAMES=['Naira','Aday','Dacil','Jonay','Iballa','Nauzet','Nerea','Airam','Yaiza','Beneharo','Celia','Saul'];
const ORIGINS=['Arona','Adeje','Los Cristianos','El Médano','Granadilla','San Isidro','Guía de Isora','La Laguna'];
const ROLES=[['camarero',55],['cocinero',65],['limpiador',30],['terraza',60]];
const AVAILABILITY=['Jornada completa','Fines de semana','Mañanas','Tardes'];
export function candidates(seed,day){
 if(!Number.isInteger(day)||day<1)throw new Error('Invalid recruitment day');
 const batch=Math.floor((day-1)/3),h0=hash(seed+':'+batch+':count');
 const min=day<=3?0:day<=7?1:2,max=day<=1?1:day<=4?2:day<=10?3:4;
 const count=min+(h0%Math.max(1,max-min+1)),out=[];
 for(let i=0;i<count;i++){
  const h=hash(seed+':'+batch+':'+i),[role,base]=ROLES[i%ROLES.length];
  const level=h%3,experience=[0,2,5][level];
  const age=Math.max(18+((h>>>3)%23),18+experience),origin=ORIGINS[(h>>>6)%ORIGINS.length];
  const experienceLabel=experience?experience+' años en '+({camarero:'servicio de barra',cocinero:'cocina',limpiador:'limpieza de establecimientos',terraza:'servicio de terraza'}[role]):'Sin experiencia previa';
  const presentation=experience?'Busco trabajo de temporada en '+({camarero:'barra',cocinero:'cocina',limpiador:'limpieza',terraza:'terraza'}[role])+'. Tengo experiencia en el puesto.':'Busco mi primera oportunidad en este puesto y tengo disposición para aprender.';
  out.push({id:'cv-'+batch+'-'+i,role,name:NAMES[(h+i)%NAMES.length],age,origin,experience,experienceLabel,availability:AVAILABILITY[(h>>>9)%AVAILABILITY.length],presentation,wage:base+[-10,0,15][level],workMultiplier:[1.15,1,0.85][level],received:batch*3+1,expires:batch*3+3,training:0});
 }
 return out;
}
export function hireCandidate(team,applicants,id,day){
 const c=applicants.find(c=>c.id===id);
 if(!c||day<c.received||day>c.expires)throw new Error('Unavailable candidate');
 if(Object.values(team||{}).some(e=>e.id===id))throw new Error('Already hired');
 return {team:{...team,[c.role]:{...c,hiredDay:day}},applicants:applicants.filter(a=>a.id!==id)};
}
export function trainEmployee(employee,cash){
 if(!employee||!Number.isInteger(employee.training)||employee.training<0||employee.training>=2||!Number.isFinite(employee.workMultiplier)||employee.workMultiplier<=0)throw new Error('Training limit');
 const cost=100*(employee.training+1);
 if(!Number.isFinite(cash)||cash<cost)throw new Error('Insufficient cash');
 return {employee:{...employee,training:employee.training+1,workMultiplier:Math.max(0.7,employee.workMultiplier*0.95)},cash:cash-cost,cost};
}
