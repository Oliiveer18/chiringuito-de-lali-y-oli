// Progreso diario v23. Las tres ligas económicas se calculan en market-model.
import * as R from './market-model.mjs?v=29.5.1';
import { dailyPoints } from './management-model.mjs?v=29.5.1';
export const areas=R.AREAS,tiers=R.TIERS;
export const num=x=>Number.isFinite(x)?x:0;
export const hash=R.hash;
export function initial(seed){return {version:1,seed:String(seed),history:[],records:{},streaks:{clean:0,quality:0},best:{clean:0,quality:0},achievements:{},league:0,review:0,badges:[],last:0,goal:null};}
export function goalFor(p,day){const h=p.history.slice(-7),avg=h.length?h.reduce((s,r)=>s+r.served,0)/h.length:20;return {day,target:Math.max(15,Math.round(avg*1.05)),reward:20};}
// v29.4.9: una sola puntuación por jornada. La nota del informe ES la puntuación
// que suma en las ligas (dailyPoints): mismo número en los dos sitios, para que
// "nota 78" y "66 puntos en la liga" no puedan volver a contradecirse.
export function grade(r){const d=dailyPoints(r),score=d.total;const components=[['Servicio',d.parts.service/40,40],['Valoración',d.parts.rating/25,25],['Margen',d.parts.margin/20,20],['Comunidad',d.parts.community/15,15]];return {score,letter:score>=95?'S':score>=85?'A':score>=70?'B':score>=55?'C':'D',components};}
// Reconversion de partidas guardadas: recalcula las notas del historial con la
// formula unificada la primera vez que se cargan (una sola vez, idempotente).
export const GRADE_FORMULA='liga-unica';
export function regrade(p){if(!p||p.formula===GRADE_FORMULA)return false;for(const r of p.history||[])r.grade=grade(r);p.formula=GRADE_FORMULA;return true;}
export function settle(p,input){if(!Number.isInteger(input.day)||input.day<=p.last)return {p,reward:0,awards:[],applied:false};const r={};for(const k of ['day','served','lost','rating','waste','revenue','sales','profit','cash','cashDelta','followers'])r[k]=num(input[k]);r.grade=grade(r);r.goalOk=p.goal?.day===r.day&&r.served>=p.goal.target;const next=JSON.parse(JSON.stringify(p));next.last=r.day;next.history.push(r);next.history=next.history.slice(-120);for(const k of ['served','revenue','profit','followers'])next.records[k]=Math.max(num(next.records[k]),r[k]);for(const [k,ok] of [['clean',r.served>0&&!r.lost],['quality',r.grade.score>=85]]){next.streaks[k]=ok?next.streaks[k]+1:0;next.best[k]=Math.max(next.best[k],next.streaks[k]);}const rules=[['Primera jornada',true],['50 clientes',r.served>=50],['100 clientes',r.served>=100],['Sin pérdidas',r.served>=20&&!r.lost],['Sin merma',r.served>=20&&!r.waste],['Nota S',r.grade.letter==='S'],['Semana limpia',next.streaks.clean>=7],['Semana excelente',next.streaks.quality>=7],['500 seguidores',r.followers>=500],['1000 € vendidos',r.revenue>=1000]];const awards=[];for(const [id,ok]of rules)if(ok&&!next.achievements[id]){next.achievements[id]=r.day;awards.push(id);}return {p:next,reward:r.goalOk?p.goal.reward:0,awards,applied:true};}
// Corrige la jornada ya registrada cuando su resultado se vuelve definitivo (p. ej. una respuesta a una resena). No crea otra jornada.
export function amend(p,input){const h=p.history.at(-1);if(!h||h.day!==input.day)return {p,changed:false};const keys=['served','lost','rating','waste','revenue','sales','profit','cash','cashDelta','followers'];if(keys.every(k=>input[k]===undefined||num(input[k])===h[k]))return {p,changed:false};const next=JSON.parse(JSON.stringify(p)),n=next.history.at(-1);for(const k of keys)if(input[k]!==undefined)n[k]=num(input[k]);n.grade=grade(n);for(const k of ['served','revenue','profit','followers'])next.records[k]=Math.max(0,...next.history.map(r=>num(r[k])));return {p:next,changed:true};}
export function roster(seed){return R.migrate(seed).npcs;}
export const score=R.points;
function ensure(p){if(!p.rivals)p.rivals=R.migrate(p.seed,p.league||0,p.last||0);else if(p.rivals.version<2)p.rivals=R.ensureV2(p.rivals);return p.rivals;}
export function table(p,area,tier,day,weather,event){return R.table(ensure(p),area,tier,p.history,p.kioskName||'El Charco Azul');}
export function review(p,day,weather,event){const next=JSON.parse(JSON.stringify(p));const s=ensure(next);next.rivals=R.review(R.step(s,day,{weather,event}),day,next.history,next.kioskName);next.league=next.rivals.tiers[0];return next;}
export function readiness(stock,staff,poster,product){return [{label:'20 unidades de '+product,ok:num(stock[product])>=20},{label:'Refuerzo: camarero',ok:!!staff.camarero},{label:'Cartel promocional',ok:!!poster}];}
