/* =========================================================
   report.js
   Informe de fin de día y reseñas: el modelo se genera una vez y el render es puro.
   ========================================================= */
import { ITEMS, ITEM_IDS, REGULARS, REG_TOWN, RENT, SEASON_DAYS, SEC_PER_HOUR, STATION_COLOR, STATION_LABEL, TYPES, who } from './config.js';
import { $, clamp, escapeHtml, eur, eur2, rnd, stars } from './util.js';
import { rr } from './icons.js';
import { Audio } from './audio.js';
import { visitStars, experienceSummary, reputation } from './ratings-model.mjs';
import { decideAll, opinionCounts } from './opinions-model.mjs';
import { Game, Net, closeHour, dayName, isCoop, isGuest, lvl, wages, weatherToday } from './state.js';
import { hideAll, showFinal, showPlan, toast, updateReadyUI } from './ui.js';
import { netAct, netDirty } from './net.js';

export function endDay(){
  Game.mode='report';
  const s=Game.dayStats;
  const wage=wages(), rent=RENT;
  // merma
  let spoilVal=0; const spoilLines=[];
  for(const id of ITEM_IDS){
    const rate = lvl('nevera')?ITEMS[id].spoilF:ITEMS[id].spoil;
    const lost = Math.floor(Game.stock[id]*rate + (rate>0 && Game.stock[id]>0 && rnd()<rate?1:0)*0);
    if(lost>0){ Game.stock[id]-=lost; spoilVal+=lost*ITEMS[id].cost; spoilLines.push(`${lost} × ${ITEMS[id].name.toLowerCase()}`); }
  }
  Game.money -= wage + rent;
  const net = s.revenue + s.hamacas - wage - rent - s.fines - s.urgent - s.purchases;
  Game.season.revenue+=s.revenue; Game.season.served+=s.served; Game.season.lost+=s.lost;
  if(s.revenue>Game.season.bestDay){ Game.season.bestDay=s.revenue; Game.season.bestDayN=Game.day; }
  Game.rep=reputation(s.repStart,s.visits||[]);
  const dayStars = dayStarsSummary(s);
  if(!s._starsLogged){ Game.starsLog.push({sum:dayStars.sumStars, n:dayStars.count}); s._starsLogged=true; }
  Game.revPrev = Game.revUsed || {}; Game.revUsed = {}; // las frases de ayer no se repiten hoy
  // boca a boca: los habituales satisfechos de hoy traen amigos mañana (decae si fallas)
  const regGood=(s.visits||[]).filter(v=>v.regular && !v.lost && v.sat!=null && v.sat>=0.7).length;
  Game.buzz=clamp(0.55*(Game.buzz||0)+0.45*Math.min(regGood,3)/3,0,1);
  const repDelta = Game.rep - s.repStart;
  $('#rep-eyebrow').textContent = `Día ${Game.day} · ${dayName(Game.day)} · ${closeHour()}:00`;
  $('#rep-title').textContent = net>=0 ? (net>600?'¡Día redondo!':'Buen día de playa') : 'Día flojo';
  const soldStr = Object.entries(s.sold).sort((a,b)=>b[1]-a[1]).map(([id,n])=>`<span class="tag">${n} ${ITEMS[id].name.toLowerCase()}</span>`).join(' ');
  // modelo del informe: generación única + render puro (respuestas, caja y rep)
  Game.revModel = buildRevModel(s, dayStars);
  Game.revModel.acc = { wage, rent, spoilVal, spoilLines, soldStr, repStart:s.repStart };
  Rev.expanded = false; Rev.shownDay = Game.day;
  const last = Game.day>=SEASON_DAYS;
  const bankrupt = Game.money < -300;
  Net.ready={p1:false,p2:false};
  // el cuerpo viaja SIN la sección de reseñas: cada jugador la pinta en local
  // (así "Ver más" es una elección propia y no se impone a la pareja)
  Net.ui = {kind:'report', eyebrow:$('#rep-eyebrow').textContent, title:$('#rep-title').textContent, body:reportStatsHtml(s, Game.revModel),
            btn: bankrupt? 'Ver el final' : last? 'Ver el final de temporada' : 'Siguiente día', bankrupt, last};
  showReportUI();
  if(Game.money<0 && !bankrupt) toast('Números rojos','Si la caja baja de −300 € el banco cierra el chiringuito.','bad');
  Audio.good();
  netDirty();
}
// render puro de las estadísticas del informe: caja y reputación actuales + modelo del día
// (responder una reseña o gastar en cortesías repinta sin regenerar nada).
// NO incluye las reseñas: cada jugador las renderiza en local con su "Ver más".
export function reportStatsHtml(s, m){
  const acc=m.acc;
  const repDelta=Game.rep-acc.repStart;
  const net=s.revenue+s.hamacas-acc.wage-acc.rent-s.fines-s.urgent-s.purchases-(s.courtesies||0);
  return `
    <div class="kpis">
      <div class="kpi"><div class="k">Atendidos</div><div class="v">${s.served}</div></div>
      <div class="kpi"><div class="k">Perdidos</div><div class="v">${s.lost}</div></div>
      <div class="kpi"><div class="k">Reputación del kiosco</div><div class="v" style="color:#d98a12">${Game.rep.toFixed(1)} <small style="font-size:14px;color:${repDelta>=0?'#3f8a3a':'#c73e2a'}">${repDelta>=0?'+':''}${repDelta.toFixed(2)}</small></div></div>
    </div>
    <p class="muted" style="margin:0 24px 12px">${opinionLine(s)} Alquileres de hamacas: ${s.beachRentals||0}.</p>
    <div class="stats">
      <span>Ventas en barra</span><span class="pos">+${eur(s.revenue-s.tips)}</span>
      ${s.tips>0.5?`<span>Propinas sincronizadas (${s.combos})</span><span class="pos">+${eur(s.tips)}</span>`:''}
      ${s.tipsP>0.05?`<span>Propinas de agradecimiento</span><span class="pos">+${eur(s.tipsP)}</span>`:''}
      ${s.hamacas>0.5?`<span>Alquiler de hamacas</span><span class="pos">+${eur(s.hamacas)}</span>`:''}
      <span>Compras de género (mañana)</span><span class="neg">−${eur(s.purchases)}</span>
      ${s.urgent?`<span>Pedidos urgentes</span><span class="neg">−${eur(s.urgent)}</span>`:''}
      ${wageLine(s,acc)}
      <span>Licencia y alquiler</span><span class="neg">−${eur(acc.rent)}</span>
      ${s.fines?`<span>Multas</span><span class="neg">−${eur(s.fines)}</span>`:''}
      ${s.courtesies?`<span>Cortesías a clientes (respuestas)</span><span class="neg">−${eur(s.courtesies)}</span>`:''}
      <span class="total">Resultado del día</span><span class="total ${net>=0?'pos':'neg'}">${net>=0?'+':'−'}${eur(Math.abs(net))}</span>
      <span class="total">En caja</span><span class="total">${eur(Game.money)}</span>
    </div>
    <div style="padding:0 24px 12px;display:flex;flex-wrap:wrap;gap:6px">${acc.soldStr||'<span class="muted" style="margin:0">Hoy no se vendió nada.</span>'}</div>
    ${acc.spoilLines.length?`<p class="muted" style="margin:0 24px 12px">Se ha estropeado: ${acc.spoilLines.join(', ')} (${eur(acc.spoilVal)}).</p>`:''}
    ${s.lost?`<p class="muted" style="margin:0 24px 12px">Clientes perdidos: ${[s.lostPrice?s.lostPrice+' por precios altos':'',s.lostQueue?s.lostQueue+' por cola llena':'',s.lostPatience?s.lostPatience+' por esperar demasiado':'',s.lostStock?s.lostStock+' porque no quedaba género':''].filter(Boolean).join(', ')}.</p>`:''}
    ${s.regVisits?`<p class="muted" style="margin:0 24px 12px">Habituales hoy: ${s.regVisits} visita${s.regVisits>1?'s':''}. Atendedlos bien y volverán más fieles.</p>`:''}
    ${Game.buzz>0.03?`<p class="muted" style="margin:0 24px 12px">Boca a boca: los habituales contentos traen amigos (+${Math.round(Game.buzz*12)}% de afluencia mañana).</p>`:''}
    ${isCoop()?teamHtml(s):''}`;
}
// sección de reseñas: se renderiza siempre en local (propia expansión de "Ver más")
export function reviewsWrapHtml(m){ return `<div class="reviews">${reviewsSectionHtml(m)}</div>`; }
// firma del modelo: detecta si el invitado debe repintar (respuesta nueva)
export function revSigOf(m){ return m ? m.day+'#'+m.respCount+'#'+m.cards.map(c=>c.vid+':'+(c.resp||0)).join(',') : ''; }
export function wageLine(s,acc){ return acc.wage?`<span>Sueldos</span><span class="neg">−${eur(acc.wage)}</span>`:''; }

// ---------- Respuestas del propietario a reseñas de 1-2★ ----------
// El host es la única fuente de verdad: el invitado solo envía la intención.
// Aplicación conjunta (respuesta + coste + reputación) e idempotente.
export function respondReview(vid, kind){
  if(isGuest()){ netAct({a:'revresp', vid, kind, day:Game.day}); return; }
  applyRevResp(vid, kind, Net.me||'p1', Game.day);
}
export function applyRevResp(vid, kind, who, day){
  if(Game.mode!=='report') return false;                 // acción fuera del informe
  if(day!==undefined && day!==Game.day) return false;     // acción de otro informe (vids se reusan cada día)
  if(kind!=='disculpa' && kind!=='invita') return false;  // respuesta no válida
  const m=Game.revModel, s=Game.dayStats;
  if(!m || !s || m.day!==Game.day) return false;         // informe de otro día
  const card=m.cards.find(c=>c.vid===vid);
  if(!card || card.stars>2 || card.resp) return false;   // no elegible o ya respondida
  if(m.respCount>=REV_RESP_MAX) return false;            // límite diario compartido
  let gain=0;
  if(kind==='invita'){
    if(Game.money<REV_INVITE_COST) return false;         // sin saldo
    Game.money-=REV_INVITE_COST;
    s.courtesies=(s.courtesies||0)+REV_INVITE_COST;     // gasto visible en el balance
    gain=Math.min(REV_INVITE_REP, 5-Game.rep);
  } else gain=Math.min(REV_APOLOGY_REP, 5-Game.rep);
  Game.rep=clamp(Game.rep+gain,0,5);
  card.resp=kind; card.respGain=+gain.toFixed(2); m.respCount++;
  if(isCoop()){
    Net.ready={p1:false,p2:false}; // el informe cambió: ambos deben volver a leerlo
    toast('Respuesta enviada', `${escapeHtml(Net.names[who]||'Jugador')} ha respondido a una reseña.`, '');
  }
  refreshReportUI();
  netDirty();
  return true;
}
// repinta el informe conservando scroll y estado local de "Ver más"
export function refreshReportUI(){
  if(Game.mode!=='report' || !Net.ui) return;
  const rep=$('#report');
  const st1=rep.scrollTop||0;
  const kid=(rep.children&&rep.children[0])||null;
  const st2=kid?(kid.scrollTop||0):0;
  const m=Game.revModel;
  // el anfitrión (o partida en solitario) repinta caja y reputación con los valores
  // nuevos; el invitado reutiliza las estadísticas del anfitrión y solo rehace sus reseñas
  if(m && m.day===Game.day && !isGuest() && Game.dayStats) Net.ui.body=reportStatsHtml(Game.dayStats, m);
  showReportUI();
  rep.scrollTop=st1; if(kid) kid.scrollTop=st2;
}
export function advanceFromReport(){
  const u=Net.ui||{}; Net.ready={p1:false,p2:false};
  if(u.bankrupt) showFinal(true); else if(u.last) showFinal(false); else { Game.day++; showPlan(); }
}
export function showReportUI(){
  const u=Net.ui; if(!u) return;
  Net.lastBody=u.body;
  $('#rep-eyebrow').textContent=u.eyebrow; $('#rep-title').textContent=u.title;
  // reseñas renderizadas en local: el "Ver más" de cada jugador es suyo
  const m=(Game.mode==='report')?Game.revModel:null;
  if(m && m.day!==Rev.shownDay){ Rev.expanded=false; Rev.shownDay=m.day; } // informe nuevo: plegado
  $('#rep-body').innerHTML = u.body + (m && m.day===Game.day ? reviewsWrapHtml(m) : '');
  if(m && m.day===Game.day) Net.lastRevSig=revSigOf(m);
  hideAll(); $('#hud').classList.add('hidden'); $('#stockbar').classList.add('hidden'); $('#report').classList.add('show');
  updateReadyUI();
}
export function teamHtml(s){
  const row=(w)=>{ const b=s.by[w]||{items:0,rev:0,clean:0}; const st=Net.roles[w];
    return `<div class="mate"><div class="mate-h"><span class="dot" style="background:${STATION_COLOR[st]}"></span><b>${escapeHtml(Net.names[w])}</b><span class="tag">${STATION_LABEL[st]}</span></div>
      <div class="mate-s"><span><b>${b.items}</b> preparados</span><span><b>${eur(b.rev)}</b> vendidos</span><span><b>${b.clean}</b> mesas</span></div></div>`; };
  const a=s.by.p1||{rev:0,items:0}, b=s.by.p2||{rev:0,items:0};
  const mvp = Math.abs(a.items-b.items)<=2 ? 'Equipo compenetrado: os habéis repartido el trabajo a partes iguales.' : `${escapeHtml(Net.names[a.items>b.items?'p1':'p2'])} ha tirado del carro hoy.`;
  return `<div class="team"><p class="eyebrow">El equipo</p>${row('p1')}${row('p2')}
    <p class="team-note">${mvp} ${s.combos?`<b>${s.combos}</b> pedidos sincronizados.`:'Entregad las dos partes de un pedido a la vez para cobrar propina.'}</p></div>`;
}
// ---------- Reseñas del día: cada una la escribe un cliente real ----------
// Se registra cada visita tal como ocurre (pedido, espera con marcas de tiempo
// reales, mesa, propina) y al cierre el informe se genera UNA sola vez.
export function recordVisit(c, extra){
  if(!Game.dayStats) return;
  const qEnd = c.tServe!=null? c.tServe : (c.tLeave!=null? c.tLeave : Game.t);
  const queueSec = c.tQueue!=null? Math.max(0, qEnd-c.tQueue) : 0;
  const v = {
    type:c.type, sat:(c.sat!=null)?c.sat:null,
    order:(c.served||[]).slice(), asked:(c.asked||[]).slice(),
    missing:c.missing||0, substituted:Object.values(c.subs||{}).some(x=>x),
    queueSec:+queueSec.toFixed(1),
    waitFrac:(c.maxPatience>0)?clamp(1-c.patience/c.maxPatience,0,1):0,
    priceF:clamp(c.priceF||0,0,1), tipAmt:c.tipAmt||0, total:+((extra&&extra.total)||0).toFixed(2),
    regular:c.regular?c.regular.id:null,
    regVisits:c.regular? (Game.regulars[c.regular.id]?Game.regulars[c.regular.id].visits:1) : 0,
    name:c.revName||null,
    look:(c.look?{shirt:c.shirt,skin:c.skin,hair:c.look.hair,hat:c.hat||null}:null),
    hour:+Game.hour.toFixed(2),
    peak:(Game.hour>12.3&&Game.hour<15)||(closeHour()>20&&Game.hour>19.3&&Game.hour<21.7),
    dirtySeen:c.dirtySeen||0,
    lost:null, table:false, upset:false,
  };
  Object.assign(v, extra||{});
  Game.dayStats.visits.push(v);
}

// estrellas a partir de la satisfacción real (o del motivo de la pérdida)
export function starsOf(v){ return visitStars(v); }
// Incluye experiencias fallidas; rechazar precios antes de entrar se trata como conversión.
// La decision de cada cliente se toma una vez y se guarda en la jornada: recargar no genera opiniones nuevas.
export function ensureOpinions(s){ if(!Array.isArray(s.opinions)) s.opinions=decideAll(s.visits||[],Game.day,visitStars); return s.opinions; }
// Valoracion publica: solo cuentan quienes dejaron estrellas; un comentario no suma otra valoracion.
export function dayStarsSummary(s){ const o=ensureOpinions(s); return experienceSummary((s.visits||[]).filter((v,i)=>o[i]&&o[i].rated)); }
export function opinionLine(s){
  const sat=experienceSummary(s.visits||[]), pub=dayStarsSummary(s), c=opinionCounts(s);
  return 'Satisfacción interna: '+(sat.avg==null?'sin datos':sat.avg.toFixed(2)+' / 5')+' · Valoración pública: '+(pub.count?pub.avg.toFixed(1)+' ★ ('+pub.count+')':'Sin valoraciones nuevas')+' · Reputación acumulada: '+Game.rep.toFixed(2)+'. Visitantes '+c.visitors+' · Atendidos '+c.served+' · Valoraciones '+c.rated+' · Comentarios '+c.comments+'.';
}

// RNG con semilla por día (el informe de un día siempre es el mismo)
export function mulberry32(a){ return function(){ a|=0; a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }
// elige frase del banco sin repetir la de ayer ni la de hoy (por conjuntos)
export function pickPhrase(key, bank, rng){
  const used = Game.revUsed || (Game.revUsed={});
  const prev = Game.revPrev || {};
  const tSet = used[key] || (used[key]=new Set());
  const pSet = prev[key];
  let cands=[];
  for(let i=0;i<bank.length;i++) if(!tSet.has(i) && !(pSet && pSet.has(i))) cands.push(i);
  if(!cands.length) for(let i=0;i<bank.length;i++) if(!tSet.has(i)) cands.push(i);
  if(!cands.length) cands=bank.map((_,i)=>i); // banco agotado: se permite repetir
  const idx=cands[Math.floor(rng()*cands.length)];
  tSet.add(idx);
  return bank[idx];
}

// ---------- Bancos de frases (4-5 variantes por desencadenante) ----------
export const REVIEW_BANK = {
  colaLenta:[
    'La cola avanzaba más lento que un cangrejo.',
    'Esperamos un ratazo de pie, aunque el día acompañaba.',
    'La espera se hizo larga, no lo vamos a negar.',
    'Con lo rico que está todo, fastidia la cola que se forma.',
    'La fila para pedir era del tamaño de la playa.',
    'Tanta gente delante que casi nos da tiempo a broncearnos.',
    'Una cola respetable para un chiringuito de playa.',
  ],
  colaLlena:[
    'Pasamos y la cola llegaba hasta la orilla: dimos media vuelta.',
    'Con la cola que había, ni te molestes.',
    'No nos pusimos ni en la fila, daba cosa verla.',
    'La cola era tan larga que parecía la del carnaval.',
    'Ni cabía un alfiler en la barra, seguimos andando.',
    'Vimos la fila desde la hamaca y ni nos acercamos.',
    'La cola daba la vuelta al chiringuito: otra vez será.',
  ],
  preciosAltos:[
    'Los precios han subido más que la marea.',
    'Está bien el sitio, pero cobran como en el puerto deportivo.',
    'Por lo que cuesta un refresco aquí, en el pueblo comes dos platos.',
    'Caro para lo que es, la verdad.',
    'Nos entró la risa al ver la cuenta, y no de alegría.',
    'Bueno, bonito y caro: dos de tres no está mal.',
    'La cuenta no acompañó tanto como el sol.',
  ],
  sinStock:[
    'Lo que queríamos pedir se había agotado.',
    'No quedaba de lo que más apetecía, una pena.',
    'Parte de la carta estaba agotada.',
    'El género se nos agotó justo a nosotros, qué mala suerte.',
    'Nos quedamos con las ganas de lo que queríamos pedir.',
    'Nos quedamos sin lo nuestro de siempre, qué rabia.',
    'Se nos quedó la carta a medias por agotados.',
  ],
  mesasSucias:[
    'Las mesas de al lado siguieron sucias un buen rato.',
    'Había varias mesas sin recoger mientras esperábamos.',
    'Nos tocó pedir que nos arreglaran la mesa.',
    'Con las mesas que había pendientes, daba apetito en la barra mejor.',
    'Las gaviotas comían mejor servidas que nosotros.',
    'Vimos más de una mesa sin recoger antes de sentarnos.',
    'Las mesas tardaban en recogerse más que la marea en subir.',
  ],
  sinMesa:[
    'Ni una mesa libre en todo el rato que estuvimos.',
    'Nos tocó comer de pie como los cormoranes.',
    'Queríamos sentarnos y nada, no cabía un alfiler.',
    'Nos fuimos con el papel de aluminio a la toalla.',
    'Con lo bien que está el sitio, pena no tener dónde sentarse.',
    'Mesa para dos hubo, para cuatro ni hablar.',
    'Ni sombra ni mesa: a la toalla, que no queda otra.',
  ],
  decepcion:[
    'Esperábamos más, la verdad.',
    'Nos fuimos con la sensación de que podía estar mejor.',
    'Un poco desganado el servicio hoy.',
    'No acabamos de disfrutar la visita.',
    'Nos dejó tibios, siendo sinceros.',
    'Veníamos con expectativas y salimos regular.',
    'No es malo, pero hoy no acertamos con el día.',
  ],
  habitual:[
    'Ya nos conocen: venimos siempre que bajamos a la playa.',
    'Otra vez por aquí, como cada verano.',
    'Es nuestra parada fija después del baño.',
    'Repetimos visita y seguimos contentos.',
    'Cuando volvemos a la isla, aquí sin falta.',
    'El chiringuito de confianza: no falla.',
  ],
  pedidoPerfecto:[
    'Pedido completo y tal cual lo pedimos, ni un fallo.',
    'Todo exactamente como lo pedimos, perfecto.',
    'Ni un cambio ni una falta: pedido redondo.',
    'Exactamente lo que pedimos, todo y bien servido.',
    'Lo que pedimos, tal cual, sin sustos.',
    'Todo lo que pedimos, completo y sin faltas.',
    'Nos sirvieron el pedido entero, tal cual.',
    'Lo pedido es lo servido: sin cambios ni faltas.',
  ],
  servicioRapido:[
    'Con la barra llena y nos sirvieron en nada.',
    'A la hora punta y volando: ni nos dio tiempo a sudar.',
    'Rapidez de récord incluso con la terraza llena.',
    'Ni tiempo a decidirnos y ya teníamos el pedido en la mano.',
    'A pleno mediodía y todo como un reloj: para aplaudir.',
    'Pedimos, parpadeamos y ya estaba listo.',
    'Pese a la marea de gente, con el pedido rapidísimo.',
  ],
  calima:[
    'Con la calima se sudaba hasta el sombrero, pero se aguantaba bien a la sombra.',
    'Día de polvo del Sáhara, pero el sitio tiene su encanto.',
    'Con este bochorno, menos mal que se está a pie de playa.',
    'La calima no perdonaba, pero el chiringuito sí.',
    'Hacía un calor de calima y la sombrilla se agradecía.',
    'Con la calima, cualquier sombra es oro, y aquí había.',
    'Bochorno de polvo, pero el refresco supo a gloria.',
  ],
  templado:[
    'Correcto, sin más. La playa manda y esto está bien para un refresco.',
    'Ni fu ni fa: cumple para matar la sed.',
    'Un sitio normal, la comida de siempre a precio de temporada.',
    'Está bien para lo que es, aunque no nos volvió locos.',
    'Pasable. El sitio es agradable, el servicio regular.',
    'Ni nochevieja ni un funeral: simplemente correcto.',
    'Cumple, sin más historia.',
  ],
};
// elogios entusiastas de algo concreto que sí pidió el cliente
export const PRAISE = {
  cerveza:['La cerveza estaba tan fría que daba dolor de muelas, como manda la tradición.','Dorada bien fría, no se puede pedir más con este calor.','La cervecita a su temperatura perfecta.'],
  barraquito:['El barraquito es otro nivel: con su licor y su canela.','El mejor barraquito del sur, y eso que he probado unos cuantos.','Ese barraquito con su tostado encima… escritura pura.'],
  batido:['El batido de plátano canario, espeso y frío, una maravilla.','Batido de plátanos de la zona, se nota la diferencia.','Ese batido de plátano, para repetir.'],
  papas:['Las papas arrugadas con mojo verde y picante, como las de casa.','El mojo está hecho en el mortero, se nota.','Papas del país con su mojo: para chuparse los dedos.'],
  queso:['El queso asado con mojo es el plato que salvaría la temporada.','Queso del país a la plancha, en su punto justo.','Ese queso asado con mojo verde no lo he probado mejor ni en el norte.'],
  pescado:['El pescado era del día, fresquísimo, se notaba.','Pescado del día a la plancha, ni le faltó ni le sobró limón.','La mitad de la isla debería venir por ese pescado.'],
};
// frases de detalle reales del cliente (pedido, espera, mesa, propina)
export const DETAIL = {
  order:['Pedimos {items}.','Entre los dos: {items}.','Fuimos a por {items}.','Nuestro pedido: {items}.','A pedir: {items}.','Lo nuestro de siempre: {items}.','Pedimos sin pensarlo: {items}.'],
  // sustitución: frase inequívoca entre lo pedido y lo recibido
  orderSub:[
    'Pedimos {asked} y no quedó: acabamos con {items}.',
    'Pedimos {asked}; al final recibimos {items}.',
    'Nuestro pedido era {asked}; lo que recibimos fue {items}.',
    'Pedimos {asked} y hubo que conformarse con {items}.',
    'Lo que pedimos ({asked}) no quedó; nos quedaron {items}.',
    'Elegimos {asked}, pero a la hora de la verdad fueron {items}.',
  ],
  wait:['Esperamos {mins} minutos en la cola.','Con {mins} minutos de cola se hace largo.','Nos tocaron {mins} minutos de espera de pie.','Cola de {mins} minutos, al sol.','La cola nos tuvo {mins} minutos plantados.','Una espera de {mins} minutos, no es lo ideal.','Cola de {mins} minutos que se hizo eterna.'],
  waitFast:['En nada teníamos el pedido en la mano.','Nos atendieron en un momento.','Sin apenas espera, y con la playa llena.','Rápidos incluso con la hora punta encima.','Ni nos dio tiempo a estirar las piernas.','En un visto y no visto teníamos el pedido.'],
  tableYes:['Nos sentamos en la mesa con vistas al mar.','Comimos tranquilos mirando las olas.','Hubo mesa para nosotros sin problema.','Mesa en la arena, qué más se puede pedir.','Mesa en primera línea, con la playa entera delante.','Mesa para nosotros, y con vistas de sobra.'],
  tableNo:['Nos lo llevamos a la toalla.','Comimos de pie, como buenamente se puede.','Para llevar y a la arena.','No hubo mesa y nos lo llevamos.','Sin mesa, pero con las vistas no se sufre tanto.','Sin mesa, tocó toalla.'],
  tip:['Dejamos propina, que se lo ganaron.','Dejé unas monedas de más por el trato.','Propina entregada con gusto.','Hasta propina dejamos, cosa rara en mí.','La propina salió sola, cosa que dice mucho.','Propina bien merecida.'],
  // frases con datos reales incrustados (espera, pedido, cuenta, propina).
  // Reglas: las que citan minutos solo si hubo cola real (queueSec>=2, nunca
  // 'sin espera minutos'); las conformes solo si el cliente quedó satisfecho;
  // las de propina solo si dejó propina. Neutras para el resto.
  data:[ // neutras, con minutos
    'Cuenta de {price} tras {mins} minutos de cola.',
    'Con {mins} minutos de espera, {price} de cuenta.',
    'Por {price}, con {mins} minutos de cola.',
  ],
  dataNW:[ // neutras, sin minutos y sin afirmar espera cero (queueSec<2 no siempre es 0)
    'Cuenta de {price}, ni más ni menos.',
    'La cuenta salió {price}.',
  ],
  dataPos:[ // conformes, con minutos
    '{mins} minutos de cola y {price} bien gastados.',
    '{items}, {mins} minutos y contentos.',
    'En {mins} minutos de cola, {items}, sin queja.',
    '{items} en {mins} minutos de cola para pedir.',
    '{items}, después de {mins} minutos de cola.',
  ],
  dataPosNW:[ // conformes, sin minutos
    'Cuenta de {price} bien gastados.',
    'Cuenta de {price}, sin queja.',
  ],
  dataTip:[ // con propina y minutos
    '{mins} minutos de cola, {price} de cuenta y {tip} de propina.',
  ],
  dataTipNW:[ // con propina, sin minutos
    '{price} de cuenta y {tip} de propina, bien invertidos.',
    'Con {price} pagados y {tip} de propina, quedamos tan a gusto.',
    'Cuenta de {price} y propina de {tip}: señal de que repetiremos.',
  ],
  dataLost:[
    'Vinimos a por {asked} y no quedaba.',
    'Queríamos {asked}; sin existencias, no hay playa que valga.',
    'Fuimos a por {asked} y se había agotado.',
  ],
  // datos para visitas con sustitución: citan lo pedido (nunca lo recibido sin lo pedido)
  dataSubW:[ // con minutos
    '{mins} minutos de cola y una cuenta de {price} que no era lo previsto.',
    'A pesar de la cola de {mins} minutos, por lo menos pedimos {asked}.',
  ],
  dataSubNW:[ // sin minutos
    'Pedimos {asked} y salió por {price}.',
    'Pedimos {asked} y la cuenta subió a {price}.',
  ],
};

export function itemsStr(v){
  const names=(v.order||[]).map(id=>ITEMS[id].name.toLowerCase());
  if(!names.length) return '';
  if(names.length===1) return names[0];
  return names.slice(0,-1).join(', ')+' y '+names[names.length-1];
}
export function askedStr(v){
  const names=(v.asked||[]).map(id=>ITEMS[id].name.toLowerCase());
  if(!names.length) return '';
  if(names.length===1) return names[0];
  return names.slice(0,-1).join(', ')+' y '+names[names.length-1];
}
// minutos del juego (SEC_PER_HOUR s reales = 1 h de juego), sin escalas inventadas
export function waitMinsLabel(v){
  if(v.queueSec<2) return 'sin espera';
  return Math.max(5, Math.round(v.queueSec/SEC_PER_HOUR*60/5)*5)+' min';
}
export function fill(t,v){ return t.replace('{items}',itemsStr(v)).replace('{asked}',askedStr(v)||itemsStr(v)).replace('{price}',eur2(v.total||0)).replace('{tip}',eur2(v.tipAmt||0)).replace('{mins}',waitMinsLabel(v).replace(' min','')); }

// desencadenante según los hechos reales de esa visita
export function triggerFor(v, rng){
  if(v.lost) return v.lost==='espera'?'colaLenta' : v.lost==='lleno'?'colaLlena' : v.lost==='caro'?'preciosAltos' : 'sinStock';
  if(v.missing>0 || v.substituted) return 'sinStock';
  if(v.waitFrac>0.55) return 'colaLenta';
  if(v.priceF>0.3) return 'preciosAltos';
  if(v.sat<0.45){
    if(v.upset) return 'sinMesa';
    if(v.dirtySeen>=2) return 'mesasSucias';
    return 'decepcion';
  }
  if(v.regular && v.regVisits>=1 && v.sat>0.6 && rng()<0.55) return 'habitual';
  if(v.sat>0.8) return 'pedidoPerfecto'; // el elogio concreto del producto se añade en el texto
  if(v.sat>0.6){
    if(v.peak && v.waitFrac<0.25 && rng()<0.6) return 'servicioRapido';
    if(weatherToday()==='calima' && v.type!=='local' && rng()<0.5) return 'calima';
    return 'templado';
  }
  if(weatherToday()==='calima' && v.type!=='local' && rng()<0.35) return 'calima';
  return 'templado';
}

export function reviewText(v, trig, rng){
  const P=[];
  P.push(pickPhrase(trig, REVIEW_BANK[trig], rng));
  const good = v.sat!=null && v.sat>0.6;
  // en día mediocre también sale un elogio concreto de algo que pidió
  let praised=null;
  if(good && (trig==='pedidoPerfecto'||trig==='habitual'||trig==='templado'||trig==='calima'||trig==='servicioRapido')){
    const it=(v.order||[]).find(id=>PRAISE[id]);
    if(it && rng()<0.7){ praised=it; P.push(pickPhrase('praise:'+it, PRAISE[it], rng)); }
  }
  if(!v.lost){
    const det=[];
    const isSub = v.substituted || v.missing>0;
    if((v.order||[]).length && rng()<0.75 && !praised){
      if(isSub) det.push(fill(pickPhrase('d:orderSub', DETAIL.orderSub, rng), v)); // pedido ≠ recibido: frase inequívoca
      else det.push(fill(pickPhrase('d:order', DETAIL.order, rng), v)); // ya se mencionó en el elogio
    }
    if(v.waitFrac>0.4 && v.queueSec>=2) det.push(fill(pickPhrase('d:wait', DETAIL.wait, rng), v));
    else if(v.peak && v.waitFrac<0.2 && rng()<0.4) det.push(pickPhrase('d:waitFast', DETAIL.waitFast, rng));
    // hecho concreto con datos reales de la visita (espera, cuenta, pedido):
    // minutos solo si hubo cola; conformidad solo si quedó satisfecho; propina solo si dejó
    const wait = v.queueSec>=2;
    let dataBank, dataKey;
    if(isSub){ dataBank = wait?DETAIL.dataSubW:DETAIL.dataSubNW; dataKey='d:dataSub'; }
    else if(good){
      dataBank = wait?DETAIL.dataPos:DETAIL.dataPosNW;
      if(v.tipAmt>0.01) dataBank=dataBank.concat(wait?DETAIL.dataTip:DETAIL.dataTipNW);
      dataKey='d:dataG';
    } else {
      dataBank = wait?DETAIL.data:DETAIL.dataNW;
      dataKey='d:dataN';
    }
    if(rng()<0.7) det.push(fill(pickPhrase(dataKey, dataBank, rng), v));
    if(v.table && rng()<0.5) det.push(pickPhrase('d:tableY', DETAIL.tableYes, rng));
    else if(!v.table && rng()<0.35) det.push(pickPhrase('d:tableN', DETAIL.tableNo, rng));
    if(v.tipAmt>0.01 && good && rng()<0.8) det.push(pickPhrase('d:tip', DETAIL.tip, rng));
    while(det.length>2) det.splice(Math.floor(rng()*det.length),1);
    // garantía: sin elogio, la reseña lleva al menos un dato real
    if(!praised && det.length===0) det.push(fill(pickPhrase('d:data', dataBank, rng), v));
    for(const d of det) P.push(d);
  } else {
    // reseña de cliente perdido: al menos un dato real (espera o pedido)
    if(v.queueSec>20) P.push(fill(pickPhrase('d:wait', DETAIL.wait, rng), v));
    else if(v.lost==='sinStock' && (v.asked||[]).length) P.push(fill(pickPhrase('d:dataLost', DETAIL.dataLost, rng), v));
    else if(v.lost==='espera') P.push(fill(pickPhrase('d:wait', DETAIL.wait, rng), v));
  }
  return P.join(' ');
}
// ---------- Modelo del informe del día ----------
// La generación (nombres, tarjetas, frases) ocurre UNA sola vez al cerrar el día;
// el renderizado es puro: responder reseñas o mover caja/reputación repinta el
// informe sin regenerar frases ni consumir el banco.
export const Rev={expanded:false, shownDay:0}; // "Ver más reseñas": elección local de cada jugador
// (shownDay evita replegar las reseñas de otro informe)
export const REV_RESP_MAX=2, REV_INVITE_COST=4, REV_APOLOGY_REP=0.05, REV_INVITE_REP=0.15;

// selección de tarjetas: hasta 8 reseñas — mejor y peor experiencia, hasta dos
// habituales (priorizando los que salieron contentos), una queja de perdido y
// el resto con desencadenantes variados
export function buildCards(visits, rng){
  const MAXC=8;
  const served=visits.filter(v=>!v.lost);
  const lost=visits.filter(v=>v.lost);
  const out=[];
  const add=v=>{ if(v && out.length<MAXC && !out.some(o=>o.v===v)) out.push({v, trig:triggerFor(v,rng)}); };
  if(served.length){
    const bySat=served.slice().sort((a,b)=>b.sat-a.sat);
    add(bySat[0]);
    add(bySat[bySat.length-1]);
    const regs=bySat.filter(v=>v.regular);
    add(regs.find(v=>v.sat>=0.7) || regs[0]);
    if(regs.length>1) add(regs.filter(v=>v.sat>=0.7)[1] || regs[1]);
    if(lost.length>=3) add(lost[Math.floor(rng()*lost.length)]);
    if(out.length<MAXC){
      const rest=bySat.filter(v=>!out.some(o=>o.v===v));
      for(let i=rest.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); [rest[i],rest[j]]=[rest[j],rest[i]]; }
      const used=new Set(out.map(o=>o.trig));
      for(const v of rest){ if(out.length>=MAXC) break; const t=triggerFor(v,rng); if(!used.has(t)){ used.add(t); add(v); } }
      for(const v of rest){ if(out.length>=MAXC) break; add(v); }
    }
  } else if(lost.length){
    for(const v of lost.slice(0,4)) add(v);
  }
  for(let i=out.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); [out[i],out[j]]=[out[j],out[i]]; }
  return out;
}

// ---------- Avatar: carita dibujada a partir del aspecto real del cliente ----------
export const revAvatarCache={};
export function visitAvatar(v){
  const look=v.look||{};
  const key=[look.shirt,look.skin,look.hair&&look.hair.style,look.hair&&look.hair.color,look.hat].join('|');
  if(revAvatarCache[key]) return revAvatarCache[key];
  const cv=document.createElement('canvas'); cv.width=cv.height=76;
  const c=cv.getContext('2d');
  const shirt=look.shirt||'#0f8b8d', skin=look.skin||'#e0a97e';
  const hair=look.hair||{style:'corto',color:'#2a211c'};
  c.save(); c.beginPath(); c.arc(38,38,38,0,7); c.closePath(); c.clip();
  c.fillStyle=shirt; c.fillRect(0,0,76,76);
  c.fillStyle=skin; c.beginPath(); c.arc(38,44,17,0,7); c.fill();
  c.fillStyle=hair.color||'#2a211c';
  if(hair.style!=='calvo'){ c.beginPath(); c.arc(38,40,17,Math.PI,0); c.fill(); }
  if(hair.style==='largo'||hair.style==='coleta'){ c.fillRect(21,40,7,22); c.fillRect(48,40,7,22); }
  if(hair.style==='moño'){ c.beginPath(); c.arc(38,21,6,0,7); c.fill(); }
  if(hair.style==='flequillo'){ c.fillRect(28,27,20,5); }
  if(hair.style==='rastas'){ for(let i=0;i<4;i++) c.fillRect(23+i*9,26,4,18); }
  if(look.hat==='sombrero'){ c.fillStyle='#f1d9a8'; c.beginPath(); c.ellipse(38,26,21,5,0,0,7); c.fill(); rr(c,28,13,20,13,5); c.fill(); }
  else if(look.hat==='gorra'){ c.fillStyle='#0f8b8d'; c.beginPath(); c.arc(38,29,14,Math.PI,0); c.fill(); }
  else if(look.hat==='gafas'){ c.fillStyle='#3b2a1e'; c.beginPath(); c.arc(38,32,14,Math.PI,0); c.fill(); }
  c.fillStyle='#2a211c';
  c.beginPath(); c.arc(32,46,2.2,0,7); c.fill();
  c.beginPath(); c.arc(44,46,2.2,0,7); c.fill();
  c.strokeStyle='#2a211c'; c.lineWidth=1.6; c.beginPath(); c.arc(38,50,5,0.15*Math.PI,0.85*Math.PI); c.stroke();
  c.restore();
  const d=cv.toDataURL(); revAvatarCache[key]=d; return d;
}

// ficha factual: tipo, pedido, espera real, mesa y propina
export function factLine(v){
  const mins=waitMinsLabel(v);
  const parts=[TYPES[v.type]?TYPES[v.type].label:v.type];
  if(v.regular && v.regVisits>0) parts.push('visita n.º '+v.regVisits+' esta temporada');
  if(v.lost){
    if(v.lost==='espera') parts.push('se fue de la cola');
    else if(v.lost==='sinStock') parts.push('se fue sin género');
    else if(v.lost==='lleno') parts.push('no cabía en la cola');
    else if(v.lost==='caro') parts.push('se fue por los precios');
    if(v.queueSec>2) parts.push('cola '+mins);
  } else {
    if(v.substituted || v.missing>0){
      parts.push('pidió: '+(askedStr(v)||'—'));
      parts.push('recibió: '+(itemsStr(v)||'nada'));
    } else parts.push(itemsStr(v)||'—');
    parts.push('cola: '+mins);
    parts.push(v.table?'con mesa':'para llevar');
    parts.push(v.tipAmt>0.01?('propina '+eur2(v.tipAmt)):'sin propina');
  }
  return parts.join(' · ');
}

// datos de una tarjeta: se calculan UNA vez y luego el render es puro
export function makeCard(v, trig, rng, vid){
  const txt=reviewText(v,trig,rng);
  const st=starsOf(v);
  let name, origin, badge=false;
  if(v.regular){ const r=REGULARS.find(x=>x.id===v.regular); name=r?r.name:'—'; origin=REG_TOWN[v.regular]||''; badge=true; }
  else { const nm=v.name||''; const i=nm.indexOf(','); name=i>0?nm.slice(0,i).trim():nm; origin=i>0?nm.slice(i+1).trim():''; }
  const hrs=Math.max(1, Math.round(closeHour()-v.hour));
  return { vid, stars:st, name, origin, badge, hrs, txt, fact:factLine(v), avatar:visitAvatar(v), lost:!!v.lost, resp:null, respGain:0 };
}

// respuesta del propietario (estilo Google) en tarjetas de 1-2★
export function respHtml(card, m){
  if(card.stars>2) return '';
  if(card.resp){
    const g=card.respGain>0?` (+${card.respGain.toFixed(2)} ★)`:'';
    const reply = card.resp==='invita'
      ? `Lo sentimos, ${escapeHtml(card.name)}. Te invitamos a una consumición de cortesía (${REV_INVITE_COST} €); esperamos verte de vuelta.`
      : `Lo sentimos mucho, ${escapeHtml(card.name)}. Se nos escapó el día; gracias por avisarnos.`;
    return `<div style="margin:8px 0 0;background:#f2ede1;border:1px dashed #d8cbb2;border-radius:10px;padding:8px 12px;font:600 11px/1.5 Satoshi,sans-serif;color:#6b5c48"><b style="color:#0f8b8d">Respuesta del propietario</b>${g}<br>${reply} — El equipo del Charco Azul</div>`;
  }
  if(m.respCount>=REV_RESP_MAX) return '';
  const canInvite=Game.money>=REV_INVITE_COST;
  return `<div style="margin:8px 0 0;display:flex;gap:6px;flex-wrap:wrap">
    <button class="btn sm" data-vid="${card.vid}" data-kind="disculpa">Disculparse (+${REV_APOLOGY_REP.toFixed(2)} ★)</button>
    <button class="btn sm" data-vid="${card.vid}" data-kind="invita" ${canInvite?'':'disabled'}>Invitar (${REV_INVITE_COST} €, +${REV_INVITE_REP.toFixed(2)} ★)</button>
  </div>`;
}

export function cardHtml(card, m){
  const tag = card.lost?'<span style="font:700 9px Satoshi,sans-serif;color:#b3541e;background:#fbe9d2;border-radius:8px;padding:2px 7px;vertical-align:1px;margin-left:6px">No atendido</span>':'';
  return `<div style="background:#fffdf8;border:1px solid #eadfc9;border-radius:14px;padding:12px 14px;margin:0 24px 10px">
    <div style="display:flex;gap:11px;align-items:center">
      <img src="${card.avatar}" alt="" style="width:40px;height:40px;border-radius:50%;flex:none;border:2px solid #fff;box-shadow:0 0 0 1px #e5d9c0">
      <div style="min-width:0;flex:1">
        <div style="font:700 13px Satoshi,sans-serif;color:#2a211c">${escapeHtml(card.name)}${card.origin?` <span style="font-weight:600;color:#9a8a72">· ${escapeHtml(card.origin)}</span>`:''}${card.badge?' <span style="font:700 9px Satoshi,sans-serif;color:#0f8b8d;background:#e2f4f4;border-radius:8px;padding:2px 7px;vertical-align:1px;margin-left:6px">Cliente habitual</span>':''}${tag}</div>
        <div style="color:#e8a33d;font-size:14px;letter-spacing:1.5px">${stars(card.stars)} <span style="font:600 10px Satoshi,sans-serif;color:#9a8a72;letter-spacing:0">hace ${card.hrs} h</span></div>
      </div>
    </div>
    <p style="margin:8px 0 0;font:500 13px/1.5 Satoshi,sans-serif;color:#4a3f36">${escapeHtml(card.txt)}</p>
    <div style="margin:6px 0 0;font:600 10px Satoshi,sans-serif;color:#9a8a72">${escapeHtml(card.fact)}</div>
    ${respHtml(card,m)}
  </div>`;
}

// modelo de reseñas del día (generación única; luego render puro)
export function buildRevModel(s, dayStars){
  const rng=mulberry32(Game.day*7919+1013);
  const visits=(s.visits||[]).slice();
  const op=ensureOpinions(s);
  const cards=buildCards(visits.filter((v,i)=>op[i]&&op[i].comment),rng).map((p,i)=>makeCard(p.v,p.trig,rng,i+1));
  return { day:Game.day, cards, dayStars, visitsCount:visits.length, counts:opinionCounts(s), respCount:0 };
}

// sección de reseñas: cabecera estilo Google (media, distribución, tendencia) + tarjetas
export function reviewsSectionHtml(m){
  const dayStars=m.dayStars;
  const rng=null; // sin rng: el render es puro
  const avg=dayStars.avg, n=dayStars.count;
  // tendencia: media ponderada por clientes de las últimas 7 jornadas
  const log=Game.starsLog;
  const wavg=a=>{ let sn=0,c=0; for(const e of a){ if(e.n>0){ sn+=e.sum; c+=e.n; } } return c? sn/c : null; };
  let trendHtml='';
  const cur=wavg(log.slice(-7)), prev=wavg(log.slice(-14,-7));
  const sparkDays=log.slice(-7).filter(e=>e.n>0);
  if(cur!=null){
    if(prev!=null){
      const d=cur-prev;
      const arr=d>0.05?'▲':d<-0.05?'▼':'—';
      const col=d>0.05?'#3f8a3a':d<-0.05?'#c73e2a':'#8a7a66';
      trendHtml=`<div style="margin-top:7px;font:700 11px Satoshi,sans-serif;color:${col}">${arr} ${prev.toFixed(1)} → ${cur.toFixed(1)} · últimos 7 días</div>`;
    } else trendHtml=`<div style="margin-top:7px;font:700 11px Satoshi,sans-serif;color:#8a7a66">Media de los últimos días: ${cur.toFixed(1)}</div>`;
    if(sparkDays.length>1){
      trendHtml+=`<div style="display:flex;gap:3px;align-items:flex-end;height:22px;margin-top:6px" title="Valoración de los últimos días">${sparkDays.map(e=>{const v=e.sum/e.n;return `<i style="flex:1;background:${v>=4?'#3f8a3a':v>=3?'#f2a93b':'#c73e2a'};opacity:.85;border-radius:2px;height:${Math.max(8,Math.round(v/5*100))}%"></i>`;}).join('')}</div>`;
    }
  }
  const distHtml=[5,4,3,2,1].map(k=>{
    const cnt=dayStars.dist[k]; const pct=n?Math.round(cnt/n*100):0;
    return `<div style="display:flex;align-items:center;gap:7px;font:700 11px Satoshi,sans-serif;color:#8a7a66"><span style="width:8px;text-align:center">${k}</span><div style="flex:1;height:8px;background:#f0e6d2;border-radius:4px;overflow:hidden"><i style="display:block;height:100%;width:${pct}%;background:linear-gradient(90deg,#f6c151,#e89b2c)"></i></div><span style="width:20px;text-align:right">${cnt}</span></div>`;
  }).join('');
  let html=`<div style="display:flex;gap:20px;align-items:center;background:#fdf6e8;border:1px solid #eadfc9;border-radius:16px;padding:14px 18px;margin:6px 24px 12px;flex-wrap:wrap">
    <div style="text-align:center;min-width:92px">
      <div style="font:800 42px/1 Chillax,sans-serif;color:#b3541e">${avg==null?'—':avg.toFixed(1)}</div>
      <div style="color:#e8a33d;font-size:15px;letter-spacing:2px;margin-top:2px">${stars(avg==null?0:Math.round(avg))}</div>
      <div style="font:600 10px Satoshi,sans-serif;color:#9a8a72;margin-top:3px" title="La media y la distribución reflejan solo a los clientes que dejaron estrellas">${n>0?(n===1?'1 valoración':n+' valoraciones'):'Sin valoraciones nuevas'} · ${m.counts?m.counts.comments:0} con comentario · ${m.counts?m.counts.served:0} atendidos de ${m.visitsCount} visitantes</div>
    </div>
    <div style="flex:1;min-width:200px">${distHtml}${trendHtml}</div>
  </div>`;
  const respNote = m.cards.some(c=>c.stars<=2) ? `<span style="font:600 11px Satoshi,sans-serif;color:#8a7a72;margin-left:auto">respuestas del propietario: ${m.respCount}/${REV_RESP_MAX}</span>` : '';
  html+=`<div style="display:flex;align-items:baseline;gap:8px;margin:2px 24px 8px;flex-wrap:wrap"><span style="font:800 15px Chillax,sans-serif;color:#2a211c">Reseñas de hoy</span><span style="font:600 11px Satoshi,sans-serif;color:#9a8a72">escritas por clientes reales de la jornada</span>${respNote}</div>`;
  const shown = Rev.expanded ? m.cards : m.cards.slice(0,4);
  for(const card of shown) html+=cardHtml(card,m);
  if(m.cards.length>4 && !Rev.expanded){
    html+=`<div style="margin:0 24px 12px"><button class="btn sm" data-revmore="1">Ver más reseñas (${m.cards.length-4})</button></div>`;
  }
  if(!m.cards.length) html+=`<div style="margin:0 24px 12px;font:500 13px Satoshi,sans-serif;color:#8a7a66">Nadie dejó comentario hoy.</div>`;
  return html;
}
