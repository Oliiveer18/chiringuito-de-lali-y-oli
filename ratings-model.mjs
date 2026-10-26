// Experiencia y reputación v24. Funciones puras; ninguna reseña negativa aleatoria.
const cap=(v,a,b)=>Math.max(a,Math.min(b,v));
export function satisfaction({wait=0,price=0,missing=false,dirty=0,cheap=0,music=false,sync=false}){
 const fast=wait<=.08?.08:0;
 return cap(.88+fast-cap(wait,0,1)*.48-cap(price,0,1)*.6-(missing?.30:0)-Math.min(4,dirty)*.04+Math.min(.03,cheap*.1)+(music?.015:0)+(sync?.025:0),0,1);
}
export function visitStars(v){
 if(v.lost==='espera'||v.lost==='sinStock')return 1;
 if(v.lost)return 2;
 let s=Number.isFinite(v.sat)?v.sat:.5;
 let star=s>=.90?5:s>=.72?4:s>=.52?3:s>=.3?2:1;
 if(v.missing||v.substituted||v.waitFrac>.5||v.upset)star=Math.min(star,4);
 return star;
}
export function experienceSummary(visits=[]){
 // Rechazar el precio antes de entrar es conversión, no una visita de servicio.
 const rated=visits.filter(v=>v.lost!=='caro');
 const dist={1:0,2:0,3:0,4:0,5:0};let sum=0,weight=0;
 for(const v of rated){const stars=visitStars(v),w=v.lost==='lleno'?.5:1;dist[stars]++;sum+=stars*w;weight+=w;}
 return {avg:weight?sum/weight:null,dist,count:rated.length,sumStars:Object.entries(dist).reduce((s,[k,n])=>s+Number(k)*n,0),weight};
}
export function reputation(previous,visits=[]){const s=experienceSummary(visits);if(!s.weight)return previous;const alpha=.25*s.weight/(s.weight+14);return cap(previous+cap((s.avg-previous)*alpha,-.35,.2),.5,5);}
// Una sola causa por visita: el mismo incidente no se explica ni se penaliza dos veces.
export function incidentCause(v){if(v.lost==='caro')return 'precio';if(v.lost==='espera')return 'espera';if(v.lost==='sinStock'||v.missing||v.substituted)return 'pedido';if(v.lost==='lleno')return 'aforo';if(v.upset)return 'mesa';if((v.dirtySeen||0)>=2)return 'limpieza';if(v.priceF>.3)return 'precio';if(v.waitFrac>.55)return 'espera';return null;}
// Tres capas separadas: satisfaccion de hoy, valoracion publica y reputacion acumulada.
export function layers(previousRep,visits=[],publicStars=[]){const sat=experienceSummary(visits);return {satisfaction:sat.avg,publicRating:publicStars.length?publicStars.reduce((a,b)=>a+b,0)/publicStars.length:null,reputation:reputation(previousRep,visits)};}
