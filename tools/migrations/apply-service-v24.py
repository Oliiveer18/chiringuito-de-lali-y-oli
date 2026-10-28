"""Aplicación controlada v24. Comprueba cada contexto antes de escribir ningún archivo existente."""
from pathlib import Path
import re
files={}
def read(name):
    if name not in files: files[name]=Path(name).read_text()
    return files[name]
def once(name,old,new):
    s=read(name)
    if s.count(old)!=1: raise RuntimeError(f'{name}: contexto esperado una vez, encontrado {s.count(old)}')
    files[name]=s.replace(old,new,1)
def between(name,start,end,new):
    s=read(name)
    if s.count(start)!=1 or s.count(end)!=1: raise RuntimeError(f'{name}: bloque ambiguo')
    a=s.index(start);b=s.index(end,a)
    files[name]=s[:a]+new+s[b:]
once('sim.js',"import { Audio } from './audio.js';","import { Audio } from './audio.js';\nimport { satisfaction } from './ratings-model.mjs';\nimport { startBeach, updateBeach } from './beach.js';")
once('sim.js','  scheduleRegulars();','  startBeach();\n  scheduleRegulars();')
once('sim.js','  const prevHour=Game.hour;','  updateBeach();\n  const prevHour=Game.hour;')
between('sim.js','    // hamacas\n','    // llegada\n','')
between('sim.js','  let s = 1 - waitFrac*0.45','  c.dirtySeen=dirty;',"  const cheap = c.served.reduce((a,id)=>a+Math.max(0,1-Game.prices[id]/ITEMS[id].ref),0)/c.served.length;\n  const dirty = Game.tables.filter(t=>t.state==='dirty').length;\n  let s=satisfaction({wait:waitFrac,price:priceF,missing:!!c.missing,dirty,cheap,music:!!lvl('altavoz'),sync});\n")
once('sim.js','  Game.rep = clamp(Game.rep + (s*5 - Game.rep)*0.035, 0.5, 5);','  // La reputación se calcula al cierre; cada visita sigue aportando satisfacción.')
once('render.js',"import { canvas, ctx, view } from './canvas.js';","import { canvas, ctx, view } from './canvas.js';\nimport { drawBeachGuest, drawPurchasedProps } from './scene-extras.js';")
once('render.js','  drawHut(c,T,h,nt,wind);','  drawHut(c,T,h,nt,wind);\n  drawPurchasedProps(c,T,nt);')
once('render.js',"  if((weather==='sol'||(weather==='calima'&&i%2===0)) && (i*7)%3!==2 && nt<0.5){ c.fillStyle=SKINS[i%SKINS.length]; c.beginPath(); c.ellipse(x,y-2,16,5,0,0,7); c.fill(); c.beginPath(); c.arc(x+22,y-6,5,0,7); c.fill(); c.fillStyle=cols[(i+1)%4]; c.fillRect(x-6,y-6,10,6); }",'  drawBeachGuest(c,x,y,i,T);')
once('report.js',"import { Audio } from './audio.js';","import { Audio } from './audio.js';\nimport { visitStars, experienceSummary, reputation } from './ratings-model.mjs';")
once('report.js','  const dayStars = dayStarsSummary(s);',"  Game.rep=reputation(s.repStart,s.visits||[]);\n  const dayStars = dayStarsSummary(s);")
between('report.js','export function starsOf(v){','// RNG con semilla por día',"export function starsOf(v){ return visitStars(v); }\n// Incluye experiencias fallidas; rechazar precios antes de entrar se trata como conversión.\nexport function dayStarsSummary(s){ return experienceSummary(s.visits||[]); }\n\n")
once('report.js','<div class="k">Valoración</div><div class="v" style="color:#d98a12">','<div class="k">Reputación del kiosco</div><div class="v" style="color:#d98a12">')
once('report.js','    <div class="stats">',"    <p class=\"muted\" style=\"margin:0 24px 12px\">Satisfacción de hoy: ${experienceSummary(s.visits||[]).avg==null?'sin visitas valorables':experienceSummary(s.visits||[]).avg.toFixed(2)+' / 5'}. La reputación tiene memoria y no cambia por cada cobro. Alquileres de hamacas: ${s.beachRentals||0}.</p>\n    <div class=\"stats\">")
once('v12.js',"import { postEffect, influEffect, settle } from './social-model.js';","import { postEffect, influEffect, settle } from './social-model.js';\nimport { openDelivery } from './delivery-panel.js';")
old="document.addEventListener('click',e=>{if(e.target.id!=='v12-order')return;if(Game.upgrades.deliveryItem){toast('Repartidor en camino','Esperad al pedido actual.','');return;}const id=prompt('Producto (cerveza, barraquito, batido, papas, queso, pescado):','cerveza');if(!id||!ITEMS[id])return;const q=parseInt(prompt('¿Cuántas unidades?','5'),10);if(!q||q<1)return;const n=Math.min(20,q);if(Net.role==='guest'){guestSend('delivery',{id,qty:n});return;}orderDelivery(id,n);});"
once('v12.js',old,"document.addEventListener('click',e=>{if(!e.target.closest?.('#v12-order')||Game.mode!=='service')return;openDelivery(orderDelivery);});")
once('v12.js','function orderDelivery(id,qty){const it=ITEMS[id];',"function orderDelivery(id,qty){if(Game.mode!=='service'||!Number.isInteger(qty)||qty<1||qty>20)return;const it=ITEMS[id];")
once('game.js',"'./v12.js?v=18'","'./v12.js?v=24'")
once('chiringo-ui.js',"'./v12.js?v=18'","'./v12.js?v=24'")
once('game.js',"'v23 · activas: '","'v24 · activas: '")
once('index.html','game.js?v=23','game.js?v=24')
once('index.html','v23 · cargando…','v24 · cargando…')
assert 'prompt(' not in files['v12.js']
assert 'ham*rate*dt' not in files['sim.js']
once('progression.test.mjs',"const before=p.league;p=M.review(p,d);assert(p.league>=0&&p.league<=8);if(d%7!==0)assert.equal(p.league,before);","const before=p.league,reviewBefore=p.rivals?.reviewDay??d;p=M.review(p,d);assert(p.league>=0&&p.league<=2);if(d-reviewBefore<7)assert.equal(p.league,before);")
for name,data in files.items():Path(name).write_text(data)
print('Parche v24 aplicado:',', '.join(files))
