import {tieVector} from './professional-model.mjs?v=29.5.2';
import {dailyPoints,weeklyPoints} from './management-model.mjs?v=29.5.2';
// v23: tres ligas simultáneas. Simulación económica resumida y determinista por cierre.
// v29.4.11: rivales con nivel propio y vida real. Cada kiosco rival tiene un nivel
// intrínseco (0–1) del que salen su capacidad, calidad, caja y seguidores, un
// "estado de forma" con memoria (buenas y malas rachas, no ruido blanco) y
// contratiempos visibles (averías, bajas, inspecciones, fiestas). Los estilos ya
// no son decorativos: cada uno juega distinto. Todo determinista por (semilla,
// rival, día), así que coop y tests se mantienen estables.
export const AREAS=['Pueblo','Isla','Nación'],TIERS=['Bronce','Plata','Oro'];
const names=['La Brisa','El Muelle','La Gaviota','Salitre','La Toalla','El Faro','La Duna','La Sombrilla','El Ancla','La Ola','El Coral','La Caleta','El Alisio','La Arena','El Mirador','Las Palmeras','La Orilla','El Timón','La Espuma','El Velero','El Cangrejo','El Pez Azul','La Costa','El Horizonte','Las Conchas','El Puerto','La Marea','El Refugio','El Islote'];
const styles=['Clásico','Familiar','Turístico','Gourmet','Económico','De moda'];
const cap=(x,a,b)=>Math.max(a,Math.min(b,x));
export function hash(s){let h=2166136261;for(const c of String(s)){h=Math.imul(h^c.charCodeAt(0),16777619);}return h>>>0;}
// v29.4.11: avalancha final (murmul-ish). Sin ella, claves que solo cambian en el
// último carácter (p. ej. "...:demand:10" y "...:demand:11") dan valores casi
// iguales y las jornadas de cada rival salían calcadas día tras día.
const random=(s,k)=>{let h=hash(s+':'+k);h^=h>>>16;h=Math.imul(h,2246822507);h^=h>>>13;h=Math.imul(h,3266489909);h^=h>>>16;return (h>>>0)/4294967296;};
export function points(h,day=Math.max(1,...h.map(r=>r.day||0))){return weeklyPoints(h,day).total;}
// Cada estilo tiene un carácter: precios, calidad, clientela fiel o demanda volátil.
export const STYLE_TRAIT={
 'Clásico':{stability:.55},
 'Familiar':{growth:1.5},
 'Turístico':{},
 'Gourmet':{price:1.12,quality:.45,capacity:.92},
 'Económico':{price:.85,quality:-.25,initFollowers:1.15},
 'De moda':{noise:1.45}
};
// Contratiempos y golpes de suerte del rival: mismos palos que el jugador.
const INCIDENTS=[
 {key:'Avería en la cocina',effect:'capacity'},
 {key:'Baja por enfermedad',effect:'quality'},
 {key:'Inspección de sanidad',effect:'rating'},
 {key:'Marejada y viento',effect:'demand'},
 {key:'Fiesta en el pueblo',effect:'fiesta'}
];
function leveled(seed,a,i){
 const L=i/28,style=styles[hash(seed+a+':'+i)%6],trait=STYLE_TRAIT[style]||{};
 return {
  id:`npc-${a}-${i}`,name:names[i]+' · '+AREAS[a],area:a,style,level:+L.toFixed(3),
  cash:Math.round(600+L*3400+a*1400),
  capacity:Math.round((12+L*76)*(1+a*.45)*(trait.capacity||1)),
  staff:L>.66?2:L>.33?1:0,
  quality:cap(1.5+L*2.15+a*.35+(hash(seed+':q:'+a+':'+i)%100)/100*.16-.08+(trait.quality||0),1,4.9),
  price:cap((trait.price||1)*(.96+L*.05)+(hash(seed+':p:'+a+':'+i)%100)/100*.06-.03,.8,1.28),
  followers:Math.round((5+(L*.9)**2*950+a*60)*(trait.initFollowers||1)),
  history:[],lastAction:'Apertura',actions:[],reserve:300,form:0
 };
}
export function migrate(seed,oldLeague=0,day=0){
 const npcs=AREAS.flatMap((_,a)=>names.map((name,i)=>leveled(String(seed),a,i)));
 const groups=AREAS.map((_,a)=>[['player',...npcs.filter(n=>n.area===a).slice(0,9).map(n=>n.id)],npcs.filter(n=>n.area===a).slice(9,19).map(n=>n.id),npcs.filter(n=>n.area===a).slice(19).map(n=>n.id)]);
 // Conserva la categoría alcanzada en el antiguo ámbito sin bloquear los otros.
 const area=Math.floor(Math.max(0,Math.min(8,oldLeague))/3),tier=oldLeague%3;
 if(tier){const id=groups[area][tier].pop();groups[area][0][0]=id;groups[area][tier].push('player');}
 return {version:2,seed:String(seed),npcs,groups,tiers:groups.map(g=>g.findIndex(t=>t.includes('player'))),last:day,reviewDay:day,badges:[],previous:{},results:[]};
}
// Reconversion de partidas guardadas: recalcula el nivel y los parámetros base de
// los rivales (capacidad, calidad, precio, personal) conservando su historia,
// caja, grupos y logros. Una sola vez (version 2), idempotente.
export function ensureV2(state){
 if(!state||state.version>=2)return state;
 const s=JSON.parse(JSON.stringify(state));
 for(const n of s.npcs){
  const idx=Number(String(n.id).split('-')[2])||0,fresh=leveled(String(s.seed),n.area,idx);
  n.level=fresh.level;n.capacity=fresh.capacity;n.quality=fresh.quality;n.price=fresh.price;n.staff=fresh.staff;n.form=0;
  n.followers=Math.max(n.followers,fresh.followers);
 }
 s.version=2;return s;
}
function spend(n,action,cost,apply,day){if(n.cash<cost+n.reserve)return false;n.cash-=cost;apply();n.lastAction=action;n.actions.push({day,action,cost});n.actions=n.actions.slice(-7);return true;}
export function step(state,day,context={}){
 if(day<=state.last)return state;
 const s=JSON.parse(JSON.stringify(state));
 for(const n of s.npcs){
  const idx=Number(String(n.id).split('-')[2])||0,L=n.level??idx/28,trait=STYLE_TRAIT[n.style]||{};
  // Estado de forma con memoria: sube y baja despacio (rachas), no ruido diario.
  const damp=trait.stability!=null?trait.stability:1;
  n.form=cap((n.form||0)*.82*damp+(random(s.seed,n.id+':form:'+day)-.5)*.22*damp,-.3,.3);
  const prev=n.history.at(-1),candidates=[{key:'reserve',value:n.cash<n.reserve*2?100:5,cost:0}];
  if(n.cash>=500+n.reserve)candidates.push({key:'capacity',value:prev&&prev.lost>5?80:15,cost:500});
  if(n.cash>=250+n.reserve)candidates.push({key:'quality',value:n.quality<4?65:10,cost:250});
  if(n.cash>=80+n.reserve)candidates.push({key:'promotion',value:n.style==='De moda'?75:25,cost:80});
  const pick=candidates.sort((a,b)=>b.value-a.value||a.key.localeCompare(b.key))[0];let promotion=0;
  if(pick.key==='capacity')spend(n,'Amplió capacidad',500,()=>{n.capacity+=5;},day);
  if(pick.key==='quality')spend(n,'Formación del equipo',250,()=>{n.quality=cap(n.quality+.08,1,5);},day);
  if(pick.key==='promotion')spend(n,'Campaña de promoción',80,()=>{promotion=.15;},day);
  if(pick.key==='reserve')n.lastAction='Protege su caja';
  if(prev?.profit<0)n.price=cap(n.price+.01,.8,1.5);else if(prev?.lost>8)n.price=cap(n.price+.01,.8,1.5);
  // Contratiempo o golpe de suerte del día (determinista por semilla y rival).
  let incident=null;
  if(random(s.seed,n.id+':ev:'+day)<.07){
   const k=Math.floor(random(s.seed,n.id+':evt:'+day)*INCIDENTS.length);
   incident=INCIDENTS[k];n.lastAction=incident.key+' · jornada marcada';
  }
  const weather=n.area===0?context.weather:['sol','panza','viento','calima'][Math.floor(random(s.seed,n.id+':weather:'+day)*4)];
  // La clientela sigue al nivel del kiosco y a su forma: los buenos atraen más.
  const pull=.68+L*.78;
  const demand=(30+n.area*18)*pull*(weather==='panza'?.75:1)*(1+promotion)*(context.event&&n.area===0&&n.style==='Turístico'?1.25:1)*(0.72+random(s.seed,n.id+':demand:'+day)*.56*(trait.noise||1))*(1+n.form*.6)*(incident?.effect==='fiesta'?1.3:incident?.effect==='demand'?.8:1);
  const capDay=Math.max(4,Math.round(n.capacity*(incident?.effect==='capacity'?.6:1)));
  // Ritmo de servicio por nivel y área, con día a día: la forma y el azar
  // (personal, cansancio, suerte) mueven el despacho de cada jornada.
  const serveRate=cap((.6+L*.35+n.area*.04)*(1+n.form*.4)+(random(s.seed,n.id+':sr:'+day)-.5)*.2,.35,1.18);
  const served=Math.max(0,Math.floor(Math.min(capDay,demand/(n.price*n.price)*serveRate)));
  const lost=Math.max(0,Math.round(demand-served)),revenue=served*8*n.price;
  const ingredients=served*2.5,overhead=45+n.staff*35;
  // Solo vende género que puede financiar. Menos caja implica menos pedidos atendidos.
  const affordable=Math.min(served,Math.floor(Math.max(0,n.cash)/2.5));
  // Los proveedores no cobran igual todos los días: el margen respira aunque el local esté lleno.
  const supplies=0.8+random(s.seed,n.id+':cost:'+day)*0.4;
  const actualRevenue=affordable*8*n.price,cost=(affordable*2.5+overhead)*supplies;
  const profit=actualRevenue-cost;n.cash+=profit;
  const qEff=cap(n.quality*(1+n.form*.15)+(random(s.seed,n.id+':qj:'+day)-.5)*.34-(incident?.effect==='quality'?.25:0),1,5);
  const rating=cap(qEff-Math.min(.8,lost*.025)-Math.max(0,n.price-1)*.3-(incident?.effect==='rating'?.4:0),1,5);
  n.followers=Math.max(0,Math.round(n.followers*(1-.015)+((rating-2)*2+(promotion?8:0))*(trait.growth||1)));
  // v29.4.9: los rivales puntuan con la misma formula que el jugador (dailyPoints);
  // antes su "grade" interno usaba otra formula distinta de la de la tabla.
  const row={day,served:affordable,lost:lost+served-affordable,revenue:actualRevenue,profit,rating,followers:n.followers};
  row.grade={score:dailyPoints(row).total};
  n.history.push(row);n.history=n.history.slice(-30);
  if(n.cash < -300){n.lastAction='Reestructuración: reduce actividad';n.capacity=Math.max(15,n.capacity-3);n.staff=0;}
 }
 s.last=day;return s;
}
export function table(s,area,tier,playerHistory=[],name='El Charco Azul',day=s.last||1){
 return s.groups[area][tier].map(id=>{if(id==='player')return {id,name,style:'Vuestro kiosco',score:points(playerHistory,day),tie:tieVector(playerHistory,day)};const n=s.npcs.find(n=>n.id===id);return {id,name:n.name,style:n.style,score:points(n.history,day),tie:tieVector(n.history,day),action:n.lastAction};}).sort((a,b)=>b.score-a.score||b.tie[0]-a.tie[0]||b.tie[1]-a.tie[1]||b.tie[2]-a.tie[2]||a.id.localeCompare(b.id)).map((r,i)=>({...r,rank:i+1,change:s.previous[area+':'+r.id]==null?null:s.previous[area+':'+r.id]-(i+1)}));
}
export function review(state,day,history,name){if(day%7!==0||day<=state.reviewDay)return state;const s=JSON.parse(JSON.stringify(state));s.results=[];
 for(let a=0;a<3;a++){
  const ranked=[0,1,2].map(t=>table(s,a,t,history,name,day));
  const own=ranked[s.tiers[a]].find(r=>r.id==='player');
  s.results.push({area:a,tier:s.tiers[a],rank:own.rank,score:own.score,day});
  for(const rows of ranked)for(const r of rows)s.previous[a+':'+r.id]=r.rank;
  // Ascensos/descensos adyacentes simultáneos: ningún participante se mueve dos veces.
  const b=ranked[0].slice(0,3).map(r=>r.id),pd=ranked[1].slice(-3).map(r=>r.id);
  const pu=ranked[1].slice(0,3).map(r=>r.id),gd=ranked[2].slice(-3).map(r=>r.id);
  s.groups[a]=[ranked[0].map(r=>r.id).filter(id=>!b.includes(id)).concat(pd),ranked[1].map(r=>r.id).filter(id=>!pd.includes(id)&&!pu.includes(id)).concat(b,gd),ranked[2].map(r=>r.id).filter(id=>!gd.includes(id)).concat(pu)];
  const old=s.tiers[a];s.tiers[a]=s.groups[a].findIndex(g=>g.includes('player'));
  if(s.tiers[a]>old)s.badges.push({area:a,tier:s.tiers[a],day});
 }
 s.weeklyHistory=[...(s.weeklyHistory||[]),{day,results:s.results.map(r=>({...r}))}].slice(-104);s.reviewDay=day;return s;
}
export function nameValue(value){return Array.from(String(value||'').normalize('NFC').replace(/[\u0000-\u001f\u007f]/g,'').trim()).slice(0,32).join('')||'El Charco Azul';}
