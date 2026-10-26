"""v25.2: equilibrio. Cada contexto debe existir exactamente una vez; no se escribe nada si algo falla."""
from pathlib import Path
files={}
def read(n):
    if n not in files: files[n]=Path(n).read_text(encoding='utf-8')
    return files[n]
def once(n,old,new):
    s=read(n)
    if s.count(old)!=1: raise RuntimeError(f'{n}: contexto esperado una vez, encontrado {s.count(old)}: {old[:80]}')
    files[n]=s.replace(old,new,1)

# Cinco estrellas: reservadas a una experiencia excelente pero alcanzables (espera de hasta ~12 % de la paciencia, precio justo, sin incidencias)
once('ratings-model.mjs',"let star=s>=.94?5:s>=.76?4:s>=.54?3:s>=.3?2:1;","let star=s>=.90?5:s>=.72?4:s>=.52?3:s>=.3?2:1;")
# Reputacion: vuelve a subir hasta 0,2 por dia, con memoria por volumen y bajada algo mas rapida que la subida
once('ratings-model.mjs',"const alpha=.22*s.weight/(s.weight+14);return cap(previous+cap((s.avg-previous)*alpha,-.3,.15),.5,5);","const alpha=.25*s.weight/(s.weight+14);return cap(previous+cap((s.avg-previous)*alpha,-.35,.2),.5,5);")
# Pescado: sigue siendo perecedero, pero parte del genero aguanta una noche
once('config.js',"spoil:1.0,  spoilF:0.3,","spoil:0.75, spoilF:0.25,")
# Influencers: precio ligado a las ventas recientes y mayor efecto
once('v12.js',"import { openDelivery } from './delivery-panel.js';","import { openDelivery } from './delivery-panel.js';\nimport { influCost } from './influencer-model.mjs';")
once('v12.js',"export const INFLU=","function influCostNow(k){const h=((Game.upgrades.progression&&Game.upgrades.progression.history)||[]).slice(-7).map(r=>r.sales!==undefined?r.sales:r.revenue).filter(x=>x>0);return influCost(k,h.length?h.reduce((a,b)=>a+b,0)/h.length:0);}\nexport const INFLU=")
once('v12.js',"cost:100,arr:0.10,","get cost(){return influCostNow('micro');},arr:0.15,")
once('v12.js',"cost:250,arr:0.20,","get cost(){return influCostNow('medio');},arr:0.26,")
once('v12.js',"cost:600,arr:0.35,","get cost(){return influCostNow('grande');},arr:0.42,")
# Pruebas
once('v25.test.mjs',"import * as S from './social-model.js';","import * as S from './social-model.js';\nimport * as I from './influencer-model.mjs';\nimport { readFileSync } from 'node:fs';")
once('v25.test.mjs',"-3<=0.15+1e-9","-3<=0.2+1e-9")
once('v25.test.mjs',">=3.7-1e-9",">=3.65-1e-9")
once('v25.test.mjs',"const mx=S.postMetrics(","""assert.equal(R.visitStars({sat:0.91}),5);assert.equal(R.visitStars({sat:0.89}),4);assert.equal(R.visitStars({sat:0.99,upset:true}),4);
for(const [k,lo] of [['micro',250],['medio',300],['grande',450]])for(const sales of [lo,600,900]){const cost=I.influCost(k,sales),roi=I.influRoi({arr:I.INFLU_ARR[k],cost,sales});assert(roi>=1.1&&roi<=1.45,k+' '+sales+' '+roi.toFixed(2));}
assert.equal(I.influCost('micro',0),I.influCost('micro',250));
assert(/spoil:0\\.75, spoilF:0\\.25/.test(readFileSync('config.js','utf8')));
const mx=S.postMetrics(""")
# Versiones (v12 se comparte por URL: las tres importaciones cambian a la vez)
once('chiringo-ui.js',"'./v12.js?v=26'","'./v12.js?v=27'")
once('cierre-ui.js',"'./v12.js?v=26'","'./v12.js?v=27'")
once('game.js',"'./v12.js?v=26'","'./v12.js?v=27'")
once('index.html','game.js?v=26','game.js?v=27')
for n,d in files.items(): Path(n).write_text(d,encoding='utf-8')
print('v25.2 aplicada:',', '.join(sorted(files)))
