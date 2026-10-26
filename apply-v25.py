"""v25: aplicacion controlada. Cada contexto debe existir exactamente una vez; no se escribe nada si algo falla."""
from pathlib import Path
files={}
def read(n):
    if n not in files: files[n]=Path(n).read_text(encoding='utf-8')
    return files[n]
def once(n,old,new):
    s=read(n)
    if s.count(old)!=1: raise RuntimeError(f'{n}: contexto esperado una vez, encontrado {s.count(old)}: {old[:80]}')
    files[n]=s.replace(old,new,1)
def between(n,start,end,new):
    s=read(n)
    if s.count(start)!=1 or s.count(end)!=1: raise RuntimeError(f'{n}: bloque ambiguo: {start[:60]}')
    a=s.index(start);b=s.index(end,a)
    files[n]=s[:a]+new+s[b:]

# ---- Bloque 2: reputacion gradual y una causa por incidente
once('ratings-model.mjs',r'''export function reputation(previous,visits=[]){const s=experienceSummary(visits);if(!s.weight)return previous;const alpha=.25*s.weight/(s.weight+12);return cap(previous+cap((s.avg-previous)*alpha,-.45,.2),.5,5);}''',r'''export function reputation(previous,visits=[]){const s=experienceSummary(visits);if(!s.weight)return previous;const alpha=.22*s.weight/(s.weight+14);return cap(previous+cap((s.avg-previous)*alpha,-.3,.15),.5,5);}
// Una sola causa por visita: el mismo incidente no se explica ni se penaliza dos veces.
export function incidentCause(v){if(v.lost==='caro')return 'precio';if(v.lost==='espera')return 'espera';if(v.lost==='sinStock'||v.missing||v.substituted)return 'pedido';if(v.lost==='lleno')return 'aforo';if(v.upset)return 'mesa';if((v.dirtySeen||0)>=2)return 'limpieza';if(v.priceF>.3)return 'precio';if(v.waitFrac>.55)return 'espera';return null;}
// Tres capas separadas: satisfaccion de hoy, valoracion publica y reputacion acumulada.
export function layers(previousRep,visits=[],publicStars=[]){const sat=experienceSummary(visits);return {satisfaction:sat.avg,publicRating:publicStars.length?publicStars.reduce((a,b)=>a+b,0)/publicStars.length:null,reputation:reputation(previousRep,visits)};}''')

# ---- Bloque 6: metricas sociales separadas
once('social-model.js','export function postEffect({ id, P, f, rating, trendId, prevId }) {',r'''// Alcance, interacciones y seguidores son metricas distintas.
export function postMetrics({ fx, f = 0 } = {}) {
  const reach = Math.round(Math.max(20, num(f)) * 2.5 * num((fx && fx.reach) || 1));
  const interactions = Math.round(reach * 0.06 * num((fx && fx.eng) || 1));
  const likes = Math.round(interactions * 0.7);
  return { reach, interactions, likes, comments: interactions - likes };
}
export function postEffect({ id, P, f, rating, trendId, prevId }) {''')

# ---- Bloque 4: historial corregible y con ventas / resultado / caja separados
once('progression-model.mjs',r'''for(const k of ['day','served','lost','rating','waste','revenue','profit','cash','followers'])r[k]=num(input[k]);''',r'''for(const k of ['day','served','lost','rating','waste','revenue','sales','profit','cash','cashDelta','followers'])r[k]=num(input[k]);''')
once('progression-model.mjs','export function roster(seed){',r'''// Corrige la jornada ya registrada cuando su resultado se vuelve definitivo (p. ej. una respuesta a una resena). No crea otra jornada.
export function amend(p,input){const h=p.history.at(-1);if(!h||h.day!==input.day)return {p,changed:false};const keys=['served','lost','rating','waste','revenue','sales','profit','cash','cashDelta','followers'];if(keys.every(k=>input[k]===undefined||num(input[k])===h[k]))return {p,changed:false};const next=JSON.parse(JSON.stringify(p)),n=next.history.at(-1);for(const k of keys)if(input[k]!==undefined)n[k]=num(input[k]);n.grade=grade(n);for(const k of ['served','revenue','profit','followers'])next.records[k]=Math.max(0,...next.history.map(r=>num(r[k])));return {p:next,changed:true};}
export function roster(seed){''')
once('progression-ui.js',"function close(){if(Net.role==='guest'||!Game.dayStats)return;",r'''function figs(s,a,p){const sales=M.num(s.revenue)+M.num(s.hamacas),profit=sales-M.num(a.wage)-M.num(a.rent)-M.num(s.fines)-M.num(s.urgent)-M.num(s.purchases)-M.num(s.courtesies);return {served:s.served,lost:s.lost,rating:Game.rep,waste:a.spoilVal,revenue:s.revenue,sales,profit,cash:Game.money,cashDelta:Game.money-M.num(p.start&&p.start.cash!=null?p.start.cash:Game.money),followers:Game.upgrades.socialFollowers||0};}
function close(){if(Net.role==='guest'||!Game.dayStats)return;''')
once('progression-ui.js','if(p.last>=d)return;const s=Game.dayStats,a=Game.revModel?.acc;',r'''const s=Game.dayStats,a=Game.revModel?.acc;if(p.last>=d){if(a&&p.last===d){const am=M.amend(p,{day:d,...figs(s,a,p)});if(am.changed){Game.upgrades.progression=am.p;netDirty();}}return;}''')
once('progression-ui.js','const out=M.settle(p,{day:d,served:s.served,lost:s.lost,rating:Game.rep,waste:a.spoilVal,revenue:s.revenue,profit,cash:Game.money,followers:Game.upgrades.socialFollowers||0});','const out=M.settle(p,{day:d,...figs(s,a,p)});')
once('progression-ui.js',"if(body&&!body.querySelector('#pg-report')){const el=document.createElement('div');el.id='pg-report';el.innerHTML=gradeHtml(p);body.append(el);}",r'''if(body){let el=body.querySelector('#pg-report');if(!el){el=document.createElement('div');el.id='pg-report';body.append(el);}const gh=gradeHtml(p);if(el.__h!==gh){el.__h=gh;el.innerHTML=gh;}}''')
once('progression-ui.js',"['cash','Caja'],['revenue','Ventas'],['profit','Resultado'],","['cash','Caja'],['revenue','Ventas'],['profit','Resultado operativo'],['cashDelta','Variación de caja'],")
once('progression-ui.js','<p>Resultado operativo ${eur(r.profit)}. La recompensa no está incluida.</p>','<p>Ventas ${eur(r.sales!==undefined?r.sales:r.revenue)} · resultado operativo ${eur(r.profit)} · variación de caja ${eur(r.cashDelta||0)}. La recompensa no está incluida en el resultado operativo.</p>')
once('progression-ui.js','<h3>Ligas de kioscos NPC</h3><p>Negocios ficticios, no jugadores reales. 29 rivales por ámbito;','<h3>Ligas de kioscos</h3><p>29 rivales por ámbito;')

# ---- Bloque 4: guardado coherente y diagnostico real del fallo
once('saves.js','function save(){if(locked',r'''const settled=()=>{const p=Game.upgrades&&Game.upgrades.progression;if(!p)return true;const d=((Game.upgrades.career&&Game.upgrades.career.season)||1)-1;return p.last>=d*30+Game.day;};
function save(){if(locked''')
once('saves.js','Game.mode===\'report\'&&(!Net.ui||!Game.revModel))return;','Game.mode===\'report\'&&(!Net.ui||!Game.revModel)||Game.mode===\'report\'&&!settled())return;')
once('saves.js',"message('No se pudo guardar. Conserva la página abierta; comprueba el almacenamiento.')","(console.error('[guardado]',e),message('No se pudo guardar ('+(e&&e.name||'error')+'). Conserva la página abierta; comprueba el almacenamiento.'))")

# ---- Bloque 1: valoraciones, comentarios y decision guardada
once('report.js',"import { visitStars, experienceSummary, reputation } from './ratings-model.mjs';","import { visitStars, experienceSummary, reputation } from './ratings-model.mjs';\nimport { decideAll, opinionCounts } from './opinions-model.mjs';")
once('report.js',"export function dayStarsSummary(s){ return experienceSummary(s.visits||[]); }",r'''// La decision de cada cliente se toma una vez y se guarda en la jornada: recargar no genera opiniones nuevas.
export function ensureOpinions(s){ if(!Array.isArray(s.opinions)) s.opinions=decideAll(s.visits||[],Game.day,visitStars); return s.opinions; }
// Valoracion publica: solo cuentan quienes dejaron estrellas; un comentario no suma otra valoracion.
export function dayStarsSummary(s){ const o=ensureOpinions(s); return experienceSummary((s.visits||[]).filter((v,i)=>o[i]&&o[i].rated)); }
export function opinionLine(s){
  const sat=experienceSummary(s.visits||[]), pub=dayStarsSummary(s), c=opinionCounts(s);
  return 'Satisfacción interna: '+(sat.avg==null?'sin datos':sat.avg.toFixed(2)+' / 5')+' · Valoración pública: '+(pub.count?pub.avg.toFixed(1)+' ★ ('+pub.count+')':'Sin valoraciones nuevas')+' · Reputación acumulada: '+Game.rep.toFixed(2)+'. Visitantes '+c.visitors+' · Atendidos '+c.served+' · Valoraciones '+c.rated+' · Comentarios '+c.comments+'.';
}''')
once('report.js','const cards=buildCards(visits,rng).map((p,i)=>makeCard(p.v,p.trig,rng,i+1));','const op=ensureOpinions(s);\n  const cards=buildCards(visits.filter((v,i)=>op[i]&&op[i].comment),rng).map((p,i)=>makeCard(p.v,p.trig,rng,i+1));')
once('report.js','return { day:Game.day, cards, dayStars, visitsCount:visits.length, respCount:0 };','return { day:Game.day, cards, dayStars, visitsCount:visits.length, counts:opinionCounts(s), respCount:0 };')
once('report.js',"${n>0?(n===1?'1 valoración':n+' valoraciones'):'sin valoraciones'} de clientes atendidos · ${m.visitsCount} clientes hoy","${n>0?(n===1?'1 valoración':n+' valoraciones'):'Sin valoraciones nuevas'} · ${m.counts?m.counts.comments:0} con comentario · ${m.counts?m.counts.served:0} atendidos de ${m.visitsCount} visitantes")
once('report.js',"Satisfacción de hoy: ${experienceSummary(s.visits||[]).avg==null?'sin visitas valorables':experienceSummary(s.visits||[]).avg.toFixed(2)+' / 5'}. La reputación tiene memoria y no cambia por cada cobro.",'${opinionLine(s)}')
once('report.js','Hoy no dejó reseña nadie.','Nadie dejó comentario hoy.')

# ---- Bloque 5: balance real de hoy (se aplica al cerrar, no al abrir mañana)
once('v12.js',"import { postEffect, influEffect, settle } from './social-model.js';","import { postEffect, influEffect, settle, postMetrics, reachFactor, engagement } from './social-model.js';")
between('v12.js',' const idle=p?0:(U.socialIdle||0)+1;'," if(Game.day>1)toast('Chiringo · balance de ayer'",r''' const done=U.socialSettledDay===ayer&&U.socialReport&&U.socialReport.dia===ayer;
 let S=U.socialReport;
 if(!done){
 const idle=p?0:(U.socialIdle||0)+1;
 S=settle({f,rep,pend:U.socialPend||[],postOk,extra,sinResp,idle,prestados:U.socialPrestados});
 U[FOL]=S.total;U.socialIdle=idle;
 U.socialReport={dia:ayer,before:f,total:S.total,gains:S.gains,losses:S.losses,gainSum:S.gainSum,lossSum:S.lossSum,net:S.net};
 let pr=U.socialPrestados;if(pr){pr.dias-=1;if(pr.dias<=0)pr=null;}
 const add=(U.socialPend||[]).filter(e=>e.prest).reduce((a,e)=>a+(e.n||0),0);if(add>0)pr={n:(pr?pr.n:0)+add,dias:7};
 if(pr)U.socialPrestados=pr;else delete U.socialPrestados;
 U.socialPend=[];
 }
''')
once('v12.js','function runIncident(){',r'''// v25: resuelve ganados y perdidos al cerrar la jornada, una sola vez. newDay() no vuelve a aplicarlo.
export function closeSocialDay(){
 const U=Game.upgrades;
 if(Net.role==='guest'||Game.mode!=='report'||!Game.dayStats||U[FOL]==null)return U.socialReport||null;
 if(U.socialSettledDay===Game.day&&U.socialReport&&U.socialReport.dia===Game.day)return U.socialReport;
 const s=Game.dayStats,sold=s.sold||{},outs=s.stockOuts||{},day=Game.day,p=(U.socialPostDia===day)?U.socialPost:null;
 const f=U[FOL]||0,rep=Game.rep,extra=[];let postOk=true;
 if(p==='algodon'&&(outs.algodon||0)>0)postOk=false;
 if(p==='show'&&(U.showDia!==day||U.showFlojoDia===day))postOk=false;
 if(p==='encuesta'&&U.socialPoll&&ITEMS[U.socialPoll]&&(sold[U.socialPoll]||0)>=3)extra.push({k:'Encuesta acertada',n:4});
 if(U.socialTrendDia===day&&U.socialTrend&&ITEMS[U.socialTrend]&&(sold[U.socialTrend]||0)>=3)extra.push({k:'Tendencia acertada',n:6});
 if(rep>=4)extra.push({k:'Boca a boca',n:2+(day*7)%4});else if(rep>=3&&(day*5)%3>0)extra.push({k:'Boca a boca',n:(day*5)%3});
 const hist=((U.progression&&U.progression.history)||[]).slice(-7),base=hist.length?hist.reduce((a,r)=>a+(r.served||0),0)/hist.length:20;
 const resp=clamp(0.5+0.5*(s.served||0)/Math.max(10,base),0.4,1.5);
 const pend=(U.socialPend||[]).map(e=>e.post?{...e,n:Math.max(0,Math.round(e.n*resp))}:e);
 const quiet=p?0:(U.socialIdle||0)+1,sinResp=U.socialNegativo===1&&!U.socialRespondido;
 const S=settle({f,rep,pend,postOk,extra,sinResp,idle:quiet,prestados:U.socialPrestados});
 U[FOL]=S.total;U.socialIdle=quiet;
 let pr=U.socialPrestados;if(pr){pr.dias-=1;if(pr.dias<=0)pr=null;}
 const add=(U.socialPend||[]).filter(e=>e.prest).reduce((a,e)=>a+(e.n||0),0);if(add>0)pr={n:(pr?pr.n:0)+add,dias:7};
 if(pr)U.socialPrestados=pr;else delete U.socialPrestados;
 if(p){const mx=postMetrics({fx:{reach:reachFactor(f),eng:engagement({rating:U[RAT]||3})},f});U.socialStats={dia:day,reach:mx.reach,interactions:Math.round(mx.interactions*resp),likes:Math.round(mx.likes*resp),comments:Math.round(mx.comments*resp),followers:S.net};}else delete U.socialStats;
 U.socialReport={dia:day,before:f,total:S.total,gains:S.gains,losses:S.losses,gainSum:S.gainSum,lossSum:S.lossSum,net:S.net,resp:+resp.toFixed(2)};
 U.socialPend=[];U.socialSettledDay=day;
 netDirty();return U.socialReport;
}
function runIncident(){''')
files['cierre-ui.js']=Path('cierre-ui.v25.js').read_text(encoding='utf-8')

# ---- Bloque 6: Chiringo sin estrellas, con publicaciones, me gusta, comentarios y metricas separadas
once('chiringo-ui.js',"import { postEffect, influEffect } from './social-model.js';","import { postEffect, influEffect, postMetrics } from './social-model.js';")
once('chiringo-ui.js',"'./v12.js?v=24'","'./v12.js?v=25'")
once('chiringo-ui.js',r'''</span><span><span class="rd-stars">' + stars(r) + '</span> ' + r.toFixed(1).replace('.', ',') + '</span>'''.replace('\\"','"'),r'''</span><span>👁️ <b>' + ((u.socialStats && u.socialStats.reach) || 0) + '</b> alcance</span><span>💬 <b>' + ((u.socialStats && u.socialStats.interactions) || 0) + '</b> interacciones</span>''')
once('chiringo-ui.js',"(P.cost ? P.cost + ' €' : 'Gratis') + '</span>","(P.cost ? P.cost + ' €' : 'Gratis') + '</span><span>' + (P.cost ? 'Campaña' : 'Orgánica') + '</span>")
once('chiringo-ui.js','<b>Oferta: \' + I.name + \'</b>','<b>Influencer · \' + I.name + \'</b>')
once('chiringo-ui.js',"  return '<div class=\"rd-prev\">","  const mx = postMetrics({ fx, f: c.f });\n  return '<div class=\"rd-prev\">")
once('chiringo-ui.js',"'<li>👥 Seguidores: <b>+' + fx.followers + '</b> al cierre, si cumplís lo prometido (ahora ' + c.f + ')</li>' +",r'''  '<li>👁️ Alcance estimado: <b>≈ ' + mx.reach + '</b> personas · 💬 interacciones: <b>≈ ' + mx.interactions + '</b></li>' +
    '<li>👥 Seguidores: <b>+' + fx.followers + '</b> esperados; el resultado final depende de cómo responda el público hoy (ahora ' + c.f + ')</li>' +
    '<li>🏷️ Tipo: <b>' + (P.cost ? 'campaña pagada' : 'publicación orgánica') + '</b></li>' +''')
between('chiringo-ui.js','function feed(u) {','function render(force) {',r'''function feed(u) {
  const cms = u.socialComments || [];
  if (!cms.length) return '<div class="rd-h">Comentarios</div><p class="rd-mut">Todavía no hay comentarios. Aparecerán al cerrar el primer día.</p>';
  const rep = u.socialReply, ayer = (u.socialPostDia === Game.day - 1 && POSTS[u.socialPost]) ? POSTS[u.socialPost].name : null;
  let h = '<div class="rd-h">Comentarios y respuestas</div><div class="rd-feed">';
  cms.forEach((c, i) => {
    const r = review(c), av = avatar(c);
    const about = r.neg ? 'el servicio de ayer' : r.trend ? 'la tendencia de ayer' : ayer ? 'tu publicación «' + ayer + '»' : 'la jornada de ayer';
    const likes = 1 + hash(c) % Math.max(3, Math.round((u[FOL] || 0) / 15));
    const replied = rep && rep.text === c && cms.indexOf(c) === i && REPLY[rep.kind];
    const canReply = i === 0 && r.neg && !u.socialRespondido && !replied;
    h += '<div class="rd-rev"><div class="rd-rev-top">' + (av ? '<img class="rd-av" src="' + av + '" alt="">' : '<div class="rd-av">🙂</div>') +
      '<div class="rd-who"><b>' + r.name + '</b><span class="rd-mut">' + r.city + ' · sobre ' + escapeHtml(about) + '</span></div>' +
      '<span class="rd-tag ' + r.cls + '">' + r.tag + '</span></div><p class="rd-txt">“' + escapeHtml(c) + '”</p><div class="rd-mut">❤️ ' + likes + ' me gusta · 💬 ' + (replied ? 1 : 0) + '</div>';
    if (replied) h += '<div class="rd-reply"><b>🏝️ ' + KIOSCO + '</b><br>' + REPLY[rep.kind] + '</div>';
    if (canReply) h += '<div class="rd-reply-do"><span class="rd-mut">Responder (si no, perdéis seguidores mañana):</span><button class="btn sm teal" data-resp="disculpa">Disculparos</button><button class="btn sm primary" data-resp="descuento" ' + (Game.money < 50 ? 'disabled' : '') + '>Descuento · 50 €</button></div>';
    h += '</div>';
  });
  return h + '</div>';
}

''')

# ---- Versiones y cache
once('game.js',"'v24 · activas: '","'v25 · activas: '")
once('game.js',"'./v12.js?v=24'","'./v12.js?v=25'")
once('game.js',"'./chiringo-ui.js?v=2'","'./chiringo-ui.js?v=3'")
once('game.js',"'./cierre-ui.js?v=1'","'./cierre-ui.js?v=2'")
once('game.js',"'./career-ui.js?v=1'","'./career-ui.js?v=2'")
once('game.js',"'./progression-ui.js?v=23'","'./progression-ui.js?v=25'")
once('game.js',"import './saves.js?v=8';","import './saves.js?v=9';")
once('index.html','game.js?v=24','game.js?v=25')
once('index.html','v24 · cargando…','v25 · cargando…')

for n,d in files.items(): Path(n).write_text(d,encoding='utf-8')
print('v25 aplicada:',', '.join(sorted(files)))
