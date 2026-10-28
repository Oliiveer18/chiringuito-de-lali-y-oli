// Opiniones y candidaturas: curva progresiva y currículums con datos coherentes.
const cap=(v,a,b)=>Math.max(a,Math.min(b,v));
export function hash32(t){let h=2166136261;for(let i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,16777616);}return h>>>0;}
const unit=(key,salt)=>hash32(key+'|'+salt)/4294967296;
export function decide(v,day,index,starsFn){
 if(!v||v.lost==='caro')return {rated:false,comment:false,stars:null};
 const stars=starsFn(v),key=[day,index,v.type||'',v.hour==null?'':v.hour,v.regular||''].join(':'),extreme=Math.abs(stars-3)/2;
 const growth=Math.min(Math.max(day,1),12)/12;
 const pRate=cap(0.05+0.10*growth+0.18*extreme+(v.regular?0.05:0)+(v.lost?0.08:0),0.03,0.35);
 if(unit(key,'rate')>=pRate)return {rated:false,comment:false,stars:null};
 return {rated:true,comment:unit(key,'comment')<cap(0.25+0.35*extreme,0.15,0.6),stars};
}
export function decideAll(visits,day,starsFn){
 const ops=visits.map((v,i)=>decide(v,day,i,starsFn));
 const maxReviews=3+Math.floor(Math.min(Math.max(day,1),12)/12*5);
 let n=0;
 return ops.map(o=>{if(o&&o.rated){if(n>=maxReviews)return {rated:false,comment:false,stars:null};n++;}return o;});
}
export function opinionCounts(s){
 const vs=s.visits||[],o=s.opinions||[];
 return {visitors:vs.length,served:vs.filter(v=>!v.lost).length,rated:o.filter(x=>x&&x.rated).length,comments:o.filter(x=>x&&x.rated&&x.comment).length};
}
export function publicRating(visits,opinions,starsFn){
 const st=[];visits.forEach((v,i)=>{if(opinions[i]&&opinions[i].rated)st.push(starsFn(v));});
 return {count:st.length,avg:st.length?st.reduce((a,b)=>a+b,0)/st.length:null};
}
function hash(text){let h=2166136261;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
const NAMES=['Naira','Aday','Dacil','Jonay','Iballa','Nauzet','Nerea','Airam','Yaiza','Beneharo','Celia','Saul'];
const ORIGINS=['Arona','Adeje','Los Cristianos','El Médano','Granadilla','San Isidro','Guía de Isora','La Laguna'];
const ROLES=[['camarero',55],['cocinero',65],['limpiador',30],['terraza',60]];
const EXPERIENCE=[['Sin experiencia previa',0,1.15],['Una temporada en barra',2,1],['Experiencia en hostelería',5,0.85]];
const AVAILABILITY=['Jornada completa','Fines de semana','Mañanas','Tardes'];
const PRESENTATIONS=['Busco un puesto cerca del mar y me gusta el trato con la gente.','He trabajado en hostelería durante las vacaciones y quiero seguir en ello.','Vivo cerca de la costa y conozco bien el ritmo de los días de playa.','Me interesa aprender y poder crecer en un puesto de cara al público.','Busco un trabajo estable para la temporada y me adapto bien a los horarios.'];
export function candidates(seed,day){
 if(!Number.isInteger(day)||day<1)throw new Error('Invalid recruitment day');
 const batch=Math.floor((day-1)/3);
 const h0=hash(seed+':'+batch+':count');
 const min=day<=3?0:day<=7?1:2;
 const max=day<=1?1:day<=4?2:day<=10?3:4;
 const count=min+(h0%Math.max(1,max-min+1));
 const out=[];
 for(let i=0;i<count;i++){
  const h=hash(seed+':'+batch+':'+i),[role,base]=ROLES[i%ROLES.length];
  const level=h%3,exp=EXPERIENCE[level],age=18+((h>>3)%23),origin=ORIGINS[(h>>6)%ORIGINS.length];
  const wage=base+[-10,0,15][level];
  out.push({id:'cv-'+batch+'-'+i,role,name:NAMES[(h+i)%NAMES.length],age,origin,experience:exp[1],experienceLabel:exp[0],availability:AVAILABILITY[(h>>9)%AVAILABILITY.length],presentation:PRESENTATIONS[(h>>12)%PRESENTATIONS.length],wage,workMultiplier:exp[2],received:batch*3+1,expires:batch*3+3,training:0});
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
