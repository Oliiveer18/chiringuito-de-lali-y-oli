// Modelo puro de progreso v22. RNG propio: no altera la simulación del juego.
export const areas=['Pueblo','Isla','Nación'], tiers=['Bronce','Plata','Oro'];
export const num=x=>Number.isFinite(x)?x:0;
const cap=(x,a,b)=>Math.max(a,Math.min(b,x));
export function hash(s){let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
export function initial(seed){return {version:1,seed:String(seed),history:[],records:{},streaks:{clean:0,quality:0},best:{clean:0,quality:0},achievements:{},league:0,review:0,badges:[],last:0,goal:null};}
export function goalFor(p,day){const h=p.history.slice(-7),avg=h.length?h.reduce((s,r)=>s+r.served,0)/h.length:20;return {day,target:Math.max(15,Math.round(avg*1.05)),reward:20};}
export function grade(r){const service=r.served+r.lost?r.served/(r.served+r.lost):0;const components=[['Servicio',service,40],['Valoración',cap(r.rating/5,0,1),30],['Merma',cap(1-r.waste/Math.max(1,r.revenue),0,1),15],['Margen',cap(r.profit/Math.max(1,r.revenue),0,1),15]];const score=Math.round(components.reduce((s,[,v,w])=>s+v*w,0));return {score,letter:score>=95?'S':score>=85?'A':score>=70?'B':score>=55?'C':'D',components};}
export function settle(p,input){if(!Number.isInteger(input.day)||input.day<=p.last)return {p,reward:0,awards:[],applied:false};const r={};for(const k of ['day','served','lost','rating','waste','revenue','profit','cash','followers'])r[k]=num(input[k]);r.grade=grade(r);r.goalOk=p.goal?.day===r.day&&r.served>=p.goal.target;const next=JSON.parse(JSON.stringify(p));next.last=r.day;next.history.push(r);next.history=next.history.slice(-120);for(const k of ['served','revenue','profit','followers'])next.records[k]=Math.max(num(next.records[k]),r[k]);for(const [k,ok] of [['clean',r.served>0&&!r.lost],['quality',r.grade.score>=85]]){next.streaks[k]=ok?next.streaks[k]+1:0;next.best[k]=Math.max(next.best[k],next.streaks[k]);}const rules=[['Primera jornada',true],['50 clientes',r.served>=50],['100 clientes',r.served>=100],['Sin pérdidas',r.served>=20&&!r.lost],['Sin merma',r.served>=20&&!r.waste],['Nota S',r.grade.letter==='S'],['Semana limpia',next.streaks.clean>=7],['Semana excelente',next.streaks.quality>=7],['500 seguidores',r.followers>=500],['1000 € vendidos',r.revenue>=1000]];const awards=[];for(const [id,ok]of rules)if(ok&&!next.achievements[id]){next.achievements[id]=r.day;awards.push(id);}return {p:next,reward:r.goalOk?p.goal.reward:0,awards,applied:true};}
const names=['La Brisa','El Muelle','La Gaviota','Salitre','La Toalla','El Faro','La Duna','La Sombrilla','El Ancla','La Ola','El Coral','La Caleta','El Alisio','La Arena','El Mirador','Las Palmeras','La Orilla','El Timón','La Espuma','El Velero','El Cangrejo','El Pez Azul','La Costa','El Horizonte','Las Conchas','El Puerto','La Marea','El Refugio','El Islote'];
const styles=['Clásico','Familiar','Turístico','Gourmet','Económico','De moda'];
export function roster(seed){return areas.flatMap((a,j)=>names.map((name,i)=>({id:`npc-${j}-${i}`,name:name+' · '+a,area:j,style:styles[hash(seed+j+':'+i)%6],base:120+j*220+i*10})));}
export function score(history){const h=history.slice(-30);if(!h.length)return 0;const avg=k=>h.reduce((s,r)=>s+num(r[k]),0)/h.length;return Math.round(40*avg('rating')+.12*avg('revenue')+.08*avg('followers')+avg('served')+h.reduce((s,r)=>s+r.grade.score,0)/h.length);}
export function table(p,area,tier,day,weather='sol',event=false){
 const all=roster(p.seed).filter(r=>r.area===area).map(r=>({...r,score:Math.round(r.base+Math.min(80,Math.sqrt(day)*2)+(hash(p.seed+r.id+Math.floor(day/7))%31-15)+(event&&r.style==='Turístico'?15:0)+(weather==='viento'&&r.style==='Turístico'?-8:0))}));
 const activeArea=Math.floor(p.league/3),activeTier=p.league%3;
 // 30 plazas por ámbito. En el ámbito activo se reserva al jugador una plaza en su categoría.
 const ownTier=area===activeArea?activeTier:0;
 const groups=[all.slice(0,10),all.slice(10,20),all.slice(20,29)];
 const spare=groups[ownTier].length===10?groups[ownTier].pop():null;
 if(spare)groups[2].push(spare);
 groups[ownTier].push({id:'player',name:'El Charco Azul',style:'Vuestro kiosco',score:score(p.history)});
 return groups[tier].sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).map((r,i)=>({...r,rank:i+1}));
}
export function review(p,day,weather,event){if(day-p.review<7||!p.history.length)return p;const next=JSON.parse(JSON.stringify(p));next.review=day;const area=Math.floor(p.league/3),tier=p.league%3,rows=table(p,area,tier,day,weather,event),rank=rows.find(x=>x.id==='player').rank;next.result={day,rank,league:p.league};if(rank<=3&&p.league<8){next.badges.push({league:p.league,day});next.league++;}else if(rank>=9&&tier>0)next.league--;return next;}
export function readiness(stock,staff,poster,product){return [{label:'20 unidades de '+product,ok:num(stock[product])>=20},{label:'Refuerzo: camarero',ok:!!staff.camarero},{label:'Cartel promocional',ok:!!poster}];}
