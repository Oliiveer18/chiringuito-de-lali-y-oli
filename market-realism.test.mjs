/* Pruebas de regresión v29.4.11: rivales con nivel, rachas y vida propia.
   Cubre:
   1. Bandas de dificultad: Bronce < Plata < Oro dentro de cada área y
      Pueblo < Isla < Nación dentro de cada categoría. Los últimos de
      Bronce-Pueblo ya no hacen 70-80 por jornada (antes sí).
   2. Nada robotico: cada rival varía de un día a otro (sd > 0, sin rachas de
      puntuaciones idénticas), pero todo es determinista por (semilla, rival, día).
   3. La cima es alcanzable pero exigente: los mejores de Oro-Nación rondan
      80-90, sin tocar el techo de 100.
   4. Reconversion de partidas guardadas (ensureV2): recalcula el nivel y los
      parámetros base de rivales de la versión 1, conservando su historia.
   Uso: node market-realism.test.mjs */
import assert from 'node:assert/strict';import * as M from './market-model.mjs';
const seeds=['realismo-a','realismo-b','realismo-c'];
const DAYS=21;
function simulate(seed){
 let s=M.migrate(seed,0,0);const daily={};
 for(let d=1;d<=DAYS;d++){
  s=M.step(s,d,{weather:'sol'});
  for(const n of s.npcs)daily[n.id]=[...(daily[n.id]||[]),n.history.at(-1).grade.score];
  if(d%7===0)s=M.review(s,d,[],'Test');
 }
 return {s,daily};
}
// Media diaria de cada rival agrupado por su categoría de origen (índice) y área.
function cells({s,daily}){
 const out={};
 for(const n of s.npcs){
  const idx=Number(n.id.split('-')[2]),t=idx<9?0:idx<19?1:2;
  const k=n.area+':'+t;(out[k]=out[k]||[]).push({id:n.id,mean:daily[n.id].reduce((a,b)=>a+b,0)/daily[n.id].length,scores:daily[n.id]});
 }
 return out;
}
let last=null;
for(const seed of seeds){
 const sim=simulate(seed);assert.deepEqual(M.step(sim.s,DAYS),sim.s,'step determinista con el mismo día');
 const c=cells(sim);
 const COUNTS=[9,10,10]; // por índice: Bronce 0-8 (más el jugador), Plata 9-18, Oro 19-28
 for(let a=0;a<3;a++)for(let t=0;t<3;t++)assert.ok(c[a+':'+t]&&c[a+':'+t].length===COUNTS[t],`celda ${a}:${t} con ${COUNTS[t]} rivales`);
 const mean=k=>c[k].reduce((x,r)=>x+r.mean,0)/COUNTS[Number(k.split(':')[1])];
 for(let a=0;a<3;a++)assert.ok(mean(a+':0')<mean(a+':1')&&mean(a+':1')<mean(a+':2'),`${seed}: Bronce < Plata < Oro en el área ${a} (${mean(a+':0').toFixed(1)} / ${mean(a+':1').toFixed(1)} / ${mean(a+':2').toFixed(1)})`);
 for(let t=0;t<3;t++)assert.ok(mean('0:'+t)<mean('1:'+t)&&mean('1:'+t)<mean('2:'+t),`${seed}: Pueblo < Isla < Nación en la categoría ${t}`);
 // La queja original: los últimos de Bronce-Pueblo no pueden hacer 70-80.
 const bP=c['0:0'].map(r=>r.mean).sort((x,y)=>x-y);
 assert.ok((bP[0]+bP[1]+bP[2])/3<=50,`${seed}: los últimos de Bronce-Pueblo hacen ${(bP[0]+bP[1]+bP[2])/3|0} de media (<= 50)`);
 assert.ok(bP[0]>=15,`${seed}: ni el peor rival cae en la miseria absoluta (${bP[0].toFixed(1)})`);
 // La cima: exigente pero sin clavar el techo.
 const oN=c['2:2'].map(r=>r.mean).sort((x,y)=>y-x);
 assert.ok((oN[0]+oN[1]+oN[2])/3>=78,`${seed}: los mejores de Oro-Nación rondan ${(oN[0]+oN[1]+oN[2])/3|0} (>= 78)`);
 assert.ok(oN[0]<=92,`${seed}: nadie clava un 95+ de media (${oN[0].toFixed(1)})`);
 // Nada robotico: cada rival tiene días distintos y nadie repite puntuación 5 días seguidos.
 for(const k of Object.keys(c))for(const r of c[k]){
  const uniq=new Set(r.scores).size;
  assert.ok(uniq>=6,`${r.id}: ${uniq} puntuaciones distintas en ${r.scores.length} días`);
  let run=1;
  for(let i=1;i<r.scores.length;i++){run=r.scores[i]===r.scores[i-1]?run+1:1;assert.ok(run<5,`${r.id}: repite ${r.scores[i]} ${run} días seguidos`);}
 }
 last=sim;
}
// Contratiempos y golpes de suerte: la semilla reparte incidentes (misma fuente
// que usa step, para garantizar que existen y son deterministas).
{let incidents=0;const s=M.migrate('realismo-a',0,0);
 for(let d=1;d<=DAYS;d++)for(const n of s.npcs)if(M.hash(String(s.seed)+':'+n.id+':ev:'+d)/4294967296<.06)incidents++;
 assert.ok(incidents>=20,`hay ${incidents} contratiempos en 3 semanas (>= 20)`);}
// Reconversion de partidas guardadas de la versión 1.
{const fresh=M.migrate('guardado',0,5);
 const old=JSON.parse(JSON.stringify(fresh));old.version=1;
 for(const n of old.npcs){delete n.level;n.capacity=590;n.quality=3.4;n.price=1;n.staff=2;}
 const v2=M.ensureV2(old);
 assert.equal(v2.version,2,'la versión sube a 2');
 assert.equal(v2,M.ensureV2(v2),'ensureV2 es idempotente');
 for(const n of v2.npcs){
  const freshN=fresh.npcs.find(x=>x.id===n.id);
  assert.ok(n.level===freshN.level&&n.capacity===freshN.capacity&&n.quality===freshN.quality,`${n.id} reconvertido a sus parámetros de nivel`);
  assert.ok(n.history.length===freshN.history.length&&n.followers>=freshN.followers,`${n.id} conserva su historia y su clientela`);
 }
 assert.deepEqual(v2.groups,fresh.groups,'conserva grupos, categorías y logros');
 assert.deepEqual(v2.badges,fresh.badges);}
console.log('OK: 9 tablas escalonadas (Bronce<Plata<Oro y Pueblo<Isla<Nación), últimos de Bronce-Pueblo lejos del 70-80, cima Oro-Nación ~80-90, sin puntuaciones roboticas, contratiempos y reconversión de partidas guardadas.');
