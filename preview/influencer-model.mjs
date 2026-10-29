// Influencers v25.2: el precio sigue a las ventas recientes para que la colaboracion rinda parecido al principio y al final de la temporada.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const INFLU_TIERS={micro:{pct:0.075,floor:15,cap:80},medio:{pct:0.13,floor:30,cap:220},grande:{pct:0.22,floor:100,cap:520}};
export const INFLU_ARR={micro:0.15,medio:0.26,grande:0.42};
export function influCost(key,avgSales){const t=INFLU_TIERS[key];if(!t)return 0;const base=Number.isFinite(avgSales)&&avgSales>0?avgSales:250;return Math.round(clamp(base*t.pct,t.floor,t.cap)/5)*5;}
// Retorno estimado del dia: margen bruto x parte de la afluencia extra que se llega a atender x ventas / coste.
export function influRoi({arr,cost,sales,margin=0.75,capture=0.85}){return cost>0?margin*capture*arr*sales/cost:0;}
