/* Render del informe de fin de día. Lo importa report.js. */
import {operatingResult,ledgerHtml,capitalNote} from './bookkeeping.js?v=29.2.0';
import { ITEMS, ITEM_IDS, REGULARS, REG_TOWN, RENT, SEASON_DAYS, STATION_COLOR, STATION_LABEL, TYPES } from './config.js?v=29.2.0';
import { $, clamp, escapeHtml, eur, rnd, stars } from './util.js?v=29.2.0';
import { rr } from './icons.js?v=29.2.0';
import { Audio } from './audio.js?v=29.2.0';
import { experienceSummary, reputation } from './ratings-model.mjs?v=29.2.0';
import { Game, Net, closeHour, dayName, isCoop, isGuest, lvl, wages, staffOnDuty } from './state.js?v=29.2.0';
import { hideAll, showFinal, showPlan, toast, updateReadyUI } from './ui.js?v=29.2.0';
import { netAct, netDirty } from './net.js?v=29.2.0';
import { dayStarsSummary, buildRevModel, Rev, REV_RESP_MAX, REV_INVITE_COST, REV_INVITE_REP, REV_APOLOGY_REP } from './report-model.js?v=29.2.0';

export function endDay(){
  Game.mode='report';
  const s=Game.dayStats;
  const wage=wages(), rent=RENT;
  let spoilVal=0; const spoilLines=[];
  for(const id of ITEM_IDS){
    const rate = lvl('nevera')?ITEMS[id].spoilF:ITEMS[id].spoil;
    const lost = Math.floor(Game.stock[id]*rate) + ((rate>0 && Game.stock[id]>0 && rnd()<rate)?1:0);
    if(lost>0){ Game.stock[id]-=lost; spoilVal+=lost*ITEMS[id].cost; spoilLines.push(`${lost} × ${ITEMS[id].name.toLowerCase()}`); }
  }
  Game.money -= wage + rent;
  const net = operatingResult(s,{wage,rent});
  Game.season.revenue+=s.revenue; Game.season.served+=s.served; Game.season.lost+=s.lost;
  if(s.revenue>Game.season.bestDay){ Game.season.bestDay=s.revenue; Game.season.bestDayN=Game.day; }
  Game.rep=reputation(s.repStart,s.visits||[]);
  const dayStars = dayStarsSummary(s);
  if(!s._starsLogged){ Game.starsLog.push({sum:dayStars.sumStars, n:dayStars.count}); s._starsLogged=true; }
  Game.revPrev = Game.revUsed || {}; Game.revUsed = {};
  const regGood=(s.visits||[]).filter(v=>v.regular && !v.lost && v.sat!=null && v.sat>=0.7).length;
  Game.buzz=clamp(0.55*(Game.buzz||0)+0.45*Math.min(regGood,3)/3,0,1);
  const repDelta = Game.rep - s.repStart;
  $('#rep-eyebrow').textContent = `Día ${Game.day} · ${dayName(Game.day)} · ${closeHour()}:00`;
  $('#rep-title').textContent = net>=0 ? (net>600?'¡Día redondo!':'Buen día de playa') : 'Día flojo';
  const soldStr = Object.entries(s.sold).sort((a,b)=>b[1]-a[1]).map(([id,n])=>`<span class="tag">${n} ${ITEMS[id].name.toLowerCase()}</span>`).join(' ');
  Game.revModel = buildRevModel(s, dayStars);
  Game.revModel.acc = { wage, rent, spoilVal, spoilLines, soldStr, repStart:s.repStart };
  Rev.expanded = false; Rev.shownDay = Game.day;
  const last = Game.day>=SEASON_DAYS;
  const bankrupt = Game.money < -300;
  Net.ready={p1:false,p2:false};
  Net.ui = {kind:'report', eyebrow:$('#rep-eyebrow').textContent, title:$('#rep-title').textContent, body:reportStatsHtml(s, Game.revModel),
            btn: bankrupt? 'Ver el final' : last? 'Ver el final de temporada' : 'Siguiente día', bankrupt, last};
  showReportUI();
  if(Game.money<0 && !bankrupt) toast('Números rojos','Si la caja baja de −300 € el banco cierra el chiringuito.','bad');
  Audio.good();
  netDirty();
}
export function reportStatsHtml(s, m){
  const acc=m.acc;
  const repDelta=Game.rep-acc.repStart;
  const net=operatingResult(s,acc);
  const pub=dayStarsSummary(s);
  const sat=experienceSummary(s.visits||[]);
  const dist=pub.dist||{1:0,2:0,3:0,4:0,5:0};
  const maxD=Math.max(1,...Object.values(dist));
  const hist=[5,4,3,2,1].map(k=>{
    const n=dist[k]||0;
    return `<div class="rep-hist-row" title="${n} reseñas de ${k} estrella${k>1?'s':''}"><span class="rep-hist-k">${k}★</span><span class="rep-hist-track"><i class="rep-hist-fill h${k}" style="width:${Math.round(n/maxD*100)}%"></i></span><span class="rep-hist-n">${n}</span></div>`;
  }).join('');
  const starBar=avg=>{const w=Math.round(clamp(avg||0,0,5)/5*100);return `<span class="rep-stars"><span class="rep-stars-bg">★★★★★</span><span class="rep-stars-fg" style="width:${w}%">★★★★★</span></span>`;};
  const kpi=(k,v,cls='')=>`<div class="rep-kpi"><div class="k">${k}</div><div class="v ${cls}">${v}</div></div>`;
  const tips=(s.tips||0)+(s.tipsP||0);
  const notes=[];
  if(s.lost) notes.push(`<p>Clientes perdidos: <b>${[s.lostPrice?s.lostPrice+' por precios altos':'',s.lostQueue?s.lostQueue+' por cola llena':'',s.lostPatience?s.lostPatience+' por esperar demasiado':'',s.lostStock?s.lostStock+' porque no quedaba lo que pedían':'',s.lostClose?s.lostClose+' por cerrar con ellos esperando':''].filter(Boolean).join(', ')}</b>.</p>`);
  if(s.noTable) notes.push(`<p>Sin mesa: <b>${s.noTable} cliente${s.noTable>1?'s':''}</b> pagó${s.noTable>1?'ron':''} para llevar sin sitio donde sentarse. Amplía la terraza o contrata ayuda de sala.</p>`);
  if(s.regVisits) notes.push(`<p>Habituales hoy: <b>${s.regVisits} visita${s.regVisits>1?'s':''}</b>. Atendedlos bien y volverán más fieles.</p>`);
  if(Game.buzz>0.03) notes.push(`<p>Boca a boca: los habituales contentos traen amigos (<b>+${Math.round(Game.buzz*12)}%</b> de afluencia mañana).</p>`);
  if((s.beachRentals||0)>0) notes.push(`<p>Alquileres de hamacas: <b>${s.beachRentals}</b>.</p>`);
  return `
    <section class="rep-hero">
      <div class="rep-hero-main">
        <p class="eyebrow">Valoración del día</p>
        <div class="rep-hero-avg">
          <span class="rep-avg-n">${pub.count?pub.avg.toFixed(1):'—'}</span>
          <div class="rep-avg-r">
            ${starBar(pub.avg)}
            <span class="rep-avg-c">${pub.count?pub.count+' valoraciones'+(m.cards.length?' · '+m.cards.length+' con comentario':''):'Sin valoraciones todavía'}</span>
          </div>
        </div>
        <p class="rep-hero-note">${pub.count?'La media pública de hoy marca la reputación del kiosco.':'Atiende bien la barra y la terraza para ganarte las primeras valoraciones.'}</p>
      </div>
      <div class="rep-hist" aria-label="Reparto de reseñas">${hist}</div>
    </section>
    <div class="rep-mini">
      <div class="rep-mini-i"><span class="k">Satisfacción interna</span><span class="v">${sat.avg==null?'—':sat.avg.toFixed(2)+' / 5'}</span></div>
      <div class="rep-mini-i"><span class="k">Reputación del kiosco</span><span class="v">${Game.rep.toFixed(2)} <b class="${repDelta>=0?'pos':'neg'}">${repDelta>=0?'+':''}${repDelta.toFixed(2)}</b></span></div>
      <div class="rep-mini-i"><span class="k">Resultado del día</span><span class="v ${net>=0?'pos':'neg'}">${net>=0?'+':'−'}${eur(Math.abs(net))}</span></div>
    </div>
    <div class="rep-kpis">
      ${kpi('Atendidos',s.served)}
      ${kpi('Perdidos',s.lost,s.lost?'neg':'')}
      ${kpi('Propinas',tips>0.01?'+'+eur(tips):'—',tips>0.01?'pos':'')}
      ${kpi('En caja',eur(Game.money),Game.money<0?'neg':'')}
    </div>
    <p class="rep-sec-h">Caja del día</p>
    <div class="stats">
      <span>Ventas en barra</span><span class="pos">+${eur(s.revenue-s.tips-(s.tipsP||0))}</span>
      ${s.tips>0.5?`<span>Propinas sincronizadas (${s.combos})</span><span class="pos">+${eur(s.tips)}</span>`:''}
      ${s.tipsP>0.05?`<span>Propinas de agradecimiento</span><span class="pos">+${eur(s.tipsP)}</span>`:''}
      ${s.hamacas>0.5?`<span>Alquiler de hamacas</span><span class="pos">+${eur(s.hamacas)}</span>`:''}
      <span>Compras de género (mañana)</span><span class="neg">−${eur(s.purchases)}</span>
      ${s.urgent?`<span>Pedidos urgentes</span><span class="neg">−${eur(s.urgent)}</span>`:''}
      ${wageLine(s,acc)}
      <span>Licencia y alquiler</span><span class="neg">−${eur(acc.rent)}</span>
      ${s.fines?`<span>Multas</span><span class="neg">−${eur(s.fines)}</span>`:''}
      ${s.courtesies?`<span>Cortesías a clientes (respuestas)</span><span class="neg">−${eur(s.courtesies)}</span>`:''}
      ${acc.spoilVal?`<span>Género estropeado al cierre</span><span class="neg">−${eur(acc.spoilVal)}</span>`:''}
      ${ledgerHtml(s)}<span class="total">Resultado operativo (base caja)</span><span class="total ${net>=0?'pos':'neg'}">${net>=0?'+':'−'}${eur(Math.abs(net))}</span>
      <span class="total">En caja</span><span class="total">${eur(Game.money)}</span>
    </div>
    <p class="rep-sec-h">Detalles del día</p>
    <div class="rep-notes">
      <div class="rep-tags">${acc.soldStr||'<span class="muted" style="margin:0">Hoy no se vendió nada.</span>'}</div>
      ${acc.spoilLines.length?`<p>Se ha estropeado: <b>${acc.spoilLines.join(', ')}</b> (${eur(acc.spoilVal)}).</p>`:''}
      ${notes.map(n=>n).join('')}
    </div>
    ${capitalNote(s)}${teamPanelHtml(s,m)}`;
}
export function reviewsWrapHtml(m){ return `<div class="reviews">${reviewsSectionHtml(m)}</div>`; }
export function revSigOf(m){ return m ? m.day+'#'+m.respCount+'#'+m.cards.map(c=>c.vid+':'+(c.resp||0)).join(',') : ''; }
export function wageLine(s,acc){ return acc.wage?`<span>Sueldos</span><span class="neg">−${eur(acc.wage)}</span>`:''; }

export function respondReview(vid, kind){
  if(isGuest()){ netAct({a:'revresp', vid, kind, day:Game.day}); return; }
  applyRevResp(vid, kind, Net.me||'p1', Game.day);
}
window.__respondReview = respondReview;
export function applyRevResp(vid, kind, who, day){
  if(Game.mode!=='report') return false;
  if(day!==undefined && day!==Game.day) return false;
  if(kind!=='disculpa' && kind!=='invita') return false;
  const m=Game.revModel, s=Game.dayStats;
  if(!m || !s || m.day!==Game.day) return false;
  const card=m.cards.find(c=>c.vid===vid);
  if(!card || card.stars>2 || card.resp) return false;
  if(m.respCount>=REV_RESP_MAX) return false;
  let gain=0;
  if(kind==='invita'){
    if(Game.money<REV_INVITE_COST) return false;
    Game.money-=REV_INVITE_COST;
    s.courtesies=(s.courtesies||0)+REV_INVITE_COST;
    gain=Math.min(REV_INVITE_REP, 5-Game.rep);
  } else gain=Math.min(REV_APOLOGY_REP, 5-Game.rep);
  Game.rep=clamp(Game.rep+gain,0,5);
  card.resp=kind; card.respGain=+gain.toFixed(2); m.respCount++;
  if(isCoop()){
    Net.ready={p1:false,p2:false};
    toast('Respuesta enviada', `${escapeHtml(Net.names[who]||'Jugador')} ha respondido a una reseña.`, '');
  }
  refreshReportUI();
  netDirty();
  return true;
}
export function refreshReportUI(){
  if(Game.mode!=='report' || !Net.ui) return;
  const rep=$('#report');
  const st1=rep.scrollTop||0;
  const kid=(rep.children&&rep.children[0])||null;
  const st2=kid?(kid.scrollTop||0):0;
  const m=Game.revModel;
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
  const m=(Game.mode==='report')?Game.revModel:null;
  if(m && m.day!==Rev.shownDay){ Rev.expanded=false; Rev.shownDay=m.day; }
  $('#rep-body').innerHTML = u.body + (m && m.day===Game.day ? reviewsWrapHtml(m) : '');
  if(m && m.day===Game.day) Net.lastRevSig=revSigOf(m);
  hideAll(); $('#hud').classList.add('hidden'); $('#stockbar').classList.add('hidden'); $('#report').classList.add('show');
  updateReadyUI();
}
/* v28.22: el informe de fin de jornada también muestra al personal en solitario:
   cada contratado con sus números (preparados, vendidos, mesas, terraza) y un
   resumen general de plantilla. En cooperativo se añade bajo el equipo. */
const STAFF_WHO={camarero:'yeray',cocinero:'carmela',limpiador:'acaymo',terraza:'terraza'};
const STAFF_LABEL={camarero:'Atención de cola',cocinero:'Preparación',limpiador:'Limpieza',terraza:'Servicio de terraza'};
const STAFF_COLOR={camarero:'#0f8b8d',cocinero:'#e8603c',limpiador:'#6b7f8e',terraza:'#b07a1e'};
export function staffRowsHtml(s){
  const team=(Game.upgrades.workforce&&Game.upgrades.workforce.team)||{};
  let h='';
  for(const [role,e] of Object.entries(team)){
    if(!Game.staff[role])continue;
    const b=(s.by&&s.by[STAFF_WHO[role]])||{};
    const name=(e&&e.name)||STAFF_WHO[role];
    let stats;
    if(role==='terraza') stats=`<span><b>${b.escort||0}</b> acompañados</span><span><b>${b.orders||0}</b> comandas</span><span><b>${b.delivered||0}</b> servidos</span>`;
    else if(role==='limpiador') stats=`<span><b>${b.clean||0}</b> mesas limpiadas</span>`;
    else stats=`<span><b>${b.items||0}</b> preparados</span><span><b>${eur(b.rev||0)}</b> vendidos</span>${role==='camarero'?`<span><b>${s.staffClients||0}</b> clientes</span>`:''}`;
    h+=`<div class="mate"><div class="mate-h"><span class="dot" style="background:${STAFF_COLOR[role]}"></span><b>${escapeHtml(name)}</b><span class="tag">${STAFF_LABEL[role]}</span></div><div class="mate-s">${stats}</div></div>`;
  }
  return h;
}
export function teamPanelHtml(s,m){
  const rows=staffRowsHtml(s);
  const team=(Game.upgrades.workforce&&Game.upgrades.workforce.team)||{};
  if(!rows){
    if(isCoop()) return teamHtml(s);
    const b=(s.by&&s.by.p1)||{};
    return `<div class="team"><p class="eyebrow">El equipo</p><div class="mate"><div class="mate-h"><span class="dot" style="background:#0f8b8d"></span><b>Tú</b><span class="tag">Barra y sala</span></div><div class="mate-s"><span><b>${b.items||0}</b> preparados</span><span><b>${eur(b.rev||0)}</b> vendidos</span><span><b>${b.clean||0}</b> mesas</span></div></div><p class="team-note">Sin personal contratado. Con el equipo del plan puedes contratar a camareros, cocineros, limpiadores y personal de terraza.</p></div>`;
  }
  const acc=(m&&m.acc)||{};
  let hired=0,onDuty=0,items=0,clean=0,ter=0;
  for(const [role] of Object.entries(team)){
    if(!Game.staff[role])continue;
    hired++; if(staffOnDuty(role))onDuty++;
    const b=(s.by&&s.by[STAFF_WHO[role]])||{};
    items+=b.items||0; clean+=b.clean||0; ter+=(b.escort||0)+(b.orders||0)+(b.delivered||0);
  }
  const sum=`<p class="team-note">Resumen del personal: <b>${hired}</b> contratado${hired>1?'s':''} · <b>${onDuty}</b> de turno hoy · sueldos <b>${eur(acc.wage||0)}</b>. Han preparado <b>${items}</b> producto${items!==1?'s':''}, limpiado <b>${clean}</b> mesa${clean!==1?'s':''} y atendido la terraza en <b>${ter}</b> momento${ter!==1?'s':''}.</p>`;
  if(isCoop()) return teamHtml(s)+`<div class="team"><p class="eyebrow">El personal</p>${rows}${sum}</div>`;
  const b=(s.by&&s.by.p1)||{};
  const you=`<div class="mate"><div class="mate-h"><span class="dot" style="background:#0f8b8d"></span><b>Tú</b><span class="tag">Barra y sala</span></div><div class="mate-s"><span><b>${b.items||0}</b> preparados</span><span><b>${eur(b.rev||0)}</b> vendidos</span><span><b>${b.clean||0}</b> mesas</span></div></div>`;
  return `<div class="team"><p class="eyebrow">El equipo</p>${you}${rows}${sum}</div>`;
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

export function reviewsSectionHtml(m){
  const left=REV_RESP_MAX-m.respCount;
  const ava=name=>{const h=String(name||'?').split('').reduce((a,c)=>((a*31)+c.charCodeAt(0))%997,7);const hue=h%360;return `style="background:hsl(${hue} 42% 87%);color:hsl(${hue} 48% 26%)"`;};
  const cards=m.cards.map(c=>{
    const st=c.stars>=4?'sc-good':c.stars===3?'sc-mid':'sc-bad';
    const loc=c.town?`<span class="rev-loc">${escapeHtml(c.town)}</span>`:'';
    const head=`<div class="rev-h"><b>${escapeHtml(c.name)}</b>${loc}<span class="rev-stars ${st}" title="${c.stars} de 5"><b>${'★'.repeat(c.stars)}</b><span>${'☆'.repeat(5-c.stars)}</span></span></div>`;
    const body=`<p class="rev-text">${c.text}</p>`;
    let foot='';
    if(c.resp){
      foot=`<p class="rev-sent"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>${c.resp==='invita'?'Invitación enviada':'Disculpas enviadas'} · +${c.respGain} de reputación</p>`;
    } else if(c.stars<=2){
      foot=`<div class="net-actions">
        <button class="btn sm" onclick="window.__respondReview('${c.vid}','disculpa')">Disculparse</button>
        <button class="btn sm teal" onclick="window.__respondReview('${c.vid}','invita')">Invitar a volver · ${REV_INVITE_COST} €</button>
      </div>`;
    }
    return `<article class="review"><span class="rev-ava" ${ava(c.name)}>${escapeHtml(String(c.name||'?').charAt(0).toUpperCase())}</span><div class="rev-b">${head}${body}${foot}</div></article>`;
  }).join('');
  const head=`<div class="rev-sec-h"><p class="eyebrow" style="margin:0">Reseñas del día</p>${left>0&&m.cards.length?`<span class="rev-left">${left} respuesta${left>1?'s':''} disponible${left>1?'s':''}</span>`:''}</div>`;
  return `${head}${cards||'<p class="muted">Hoy no quedó ninguna reseña.</p>'}`;
}
