import assert from 'node:assert/strict';
import * as M from './progression-model.mjs';
let p=M.initial('test');
assert.equal(M.roster('test').length,87);
assert.equal(new Set(M.roster('test').map(x=>x.id)).size,87);
for(let d=1;d<=500;d++){
 p.goal=M.goalFor(p,d);
 const result=M.settle(p,{day:d,served:50,lost:0,revenue:800,profit:300,cash:d*300,rating:4.8,followers:d*3,waste:0});
 assert(result.applied);p=result.p;
 assert.equal(M.settle(p,{day:d}).applied,false);
 assert(p.history.length<=120);assert.equal(p.last,d);
 for(let area=0;area<3;area++){
  const rows=[0,1,2].flatMap(tier=>{const r=M.table(p,area,tier,d);assert.equal(r.length,10);assert.deepEqual(r,M.table(p,area,tier,d));return r;});
  assert.equal(new Set(rows.map(x=>x.id)).size,30);
  assert.equal(rows.filter(x=>x.id==='player').length,1);
 }
 const before=p.league;p=M.review(p,d);assert(p.league>=0&&p.league<=2);
 // Liga solo se recalcula en cierres semanales (d%7===0); el resto de días review es no-op.
 if(d%7!==0) assert.equal(p.league,before);
 assert.deepEqual(p,JSON.parse(JSON.stringify(p)));
}
assert.equal(p.history.length,120);assert.equal(p.streaks.clean,500);
assert.equal(p.achievements['Primera jornada'],1);
assert.equal(M.readiness({cerveza:20},{camarero:true},true,'cerveza').every(x=>x.ok),true);
assert.equal(M.grade({served:0,lost:0,rating:0,waste:0,revenue:0,profit:0}).letter,'D');
// v29.4.9: la nota del informe y los puntos de la liga son el mismo numero.
// Antes el informe usaba su propia formula (merma 15 + valoracion 30) y la liga
// otra (margen 20 + comunidad 15): 78 en el informe y 66 en la liga el mismo dia.
import {dailyPoints} from './management-model.mjs';
for(const r of p.history)assert.equal(r.grade.score,dailyPoints({served:r.served,lost:r.lost,rating:r.rating,revenue:r.revenue,profit:r.profit,followers:r.followers}).total,'la nota debe coincidir con los puntos de liga');
// La reconversion de partidas guardadas recalcula las notas una sola vez.
const saved=JSON.parse(JSON.stringify(p));delete saved.formula;
assert.equal(M.regrade(saved),true);assert.equal(M.regrade(saved),false);
assert.deepEqual(saved.history.map(r=>r.grade.score),p.history.map(r=>r.grade.score));
console.log('OK: 500 jornadas, 87 NPC, tres tablas de diez por ámbito, revisión semanal, cierres idempotentes, nota=puntos de liga y persistencia JSON.');
