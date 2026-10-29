import assert from 'node:assert/strict';import * as R from './ratings-model.mjs';import * as B from './beach-model.mjs';
assert.equal(R.visitStars({sat:R.satisfaction({wait:.03})}),5);
assert.equal(R.visitStars({sat:R.satisfaction({wait:.2})}),4);
assert(R.visitStars({sat:R.satisfaction({wait:.8,missing:true})})<4);
assert.equal(R.visitStars({sat:1,missing:1}),4);assert.equal(R.visitStars({sat:1,substituted:true}),4);
assert.equal(R.experienceSummary([]).avg,null);assert.equal(R.reputation(3,[]),3);
assert.equal(R.experienceSummary([{lost:'caro'}]).avg,null);
const good=Array.from({length:50},()=>({sat:.99})),bad=[...good,...Array.from({length:20},()=>({lost:'espera'}))];
assert(R.experienceSummary(bad).avg<R.experienceSummary(good).avg);
assert(R.reputation(3,good)<=3.2);assert(R.reputation(4,bad)<R.reputation(4,good));
for(const weather of ['sol','calima','panza','viento'])for(const count of [0,4,8]){
 let s=B.createBeach(count),charges=0;for(let t=10;t<=22;t+=.01){const out=B.stepBeach(s,t,t>=20,weather,20);s=out.state;charges+=out.events.reduce((n,e)=>n+e.amount,0);}
 assert.equal(charges,s.income);assert.equal(s.income,s.rentals*B.FEE);assert(s.income<=count*B.MAX_SESSIONS*B.FEE);assert(s.slots.every(x=>x.sessions<=3));
}
let s=B.createBeach(4);const x=B.stepBeach(s,10.3,false,'sol');assert.equal(x.events.length,0);assert.equal(s.income,0);
console.log('OK: equilibrio de estrellas, reputación con memoria, pérdidas y precios diferenciados; 12 jornadas de hamacas con cobros por sesión y límites de ingresos.');
