import assert from 'node:assert/strict';import * as M from './market-model.mjs';
let s=M.migrate('test',5,0),h=[];assert.deepEqual(s.tiers,[0,2,0]);
for(let day=1;day<=500;day++){
 h.push({day,served:65,revenue:800,profit:300,rating:4.5,followers:day*3,grade:{score:90}});h=h.slice(-30);
 const next=M.step(s,day,{weather:'sol',event:day%12===0});assert.deepEqual(M.step(next,day),next);
 assert.deepEqual(next,M.step(s,day,{weather:'sol',event:day%12===0}));s=M.review(next,day,h,'Prueba');
 for(let a=0;a<3;a++){const ids=s.groups[a].flat();assert.equal(ids.length,30);assert.equal(new Set(ids).size,30);assert.equal(ids.filter(id=>id==='player').length,1);for(let t=0;t<3;t++)assert.equal(M.table(s,a,t,h).length,10);}
 for(const n of s.npcs){assert(Number.isFinite(n.cash));assert(n.history.length<=30);assert(n.actions.every(a=>a.cost>0));}
 assert.deepEqual(s,JSON.parse(JSON.stringify(s)));
}
assert.equal(s.npcs.length,87);assert.equal(M.nameValue('   '),'El Charco Azul');assert.equal(Array.from(M.nameValue('🍹'.repeat(40))).length,32);
const t=M.migrate('cash');t.npcs.forEach(n=>n.cash=0);const u=M.step(t,1);assert(u.npcs.every(n=>n.actions.length===0));
console.log('OK: 500 jornadas, 87 economías, ligas simultáneas de 10, persistencia, determinismo, inversiones condicionadas a caja, nombres Unicode.');
