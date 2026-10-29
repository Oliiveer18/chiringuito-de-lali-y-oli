/* Render del informe de fin de día. Lo importa report.js. */
import {operatingResult,ledgerHtml,capitalNote} from './bookkeeping.js?v=28.14.4';
import { ITEMS, ITEM_IDS, REGULARS, REG_TOWN, RENT, SEASON_DAYS, STATION_COLOR, STATION_LABEL, TYPES } from './config.js?v=28.14.4';
import { $, clamp, escapeHtml, eur, rnd, stars } from './util.js?v=28.14.4';
import { rr } from './icons.js?v=28.14.4';
import { Audio } from './audio.js?v=28.14.4';
import { reputation } from './ratings-model.mjs?v=28.14.4';
import { Game, Net, closeHour, dayName, isCoop, isGuest, lvl, wages } from './state.js?v=28.14.4';
import { hideAll, showFinal, showPlan, toast, updateReadyUI } from './ui.js?v=28.14.4';
import { netAct, netDirty } from './net.js?v=28.14.4';
import { dayStarsSummary, buildRevModel, opinionLine, Rev, REV_RESP_MAX, REV_INVITE_COST, REV_INVITE_REP, REV_APOLOGY_REP } from './report-model.js?v=28.14.4';

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
  return `
    <div class="kpis">
      <div class="kpi"><div class="k">Atendidos</div><div class="v">${s.served}</div></div>
      <div class="kpi"><div class="k">Perdidos</div><div class="v">${s.lost}</div></div>
      <div class="kpi"><div class="k">Reputación del kiosco</div><div class="v" style="color:#d98a12">${Game.rep.toFixed(1)} <small style="font-size:14px;color:${repDelta>=0?'#3f8a3a':'#c73e2a'}">${repDelta>=0?'+':''}${repDelta.toFixed(2)}</small></div></div>
    </div>
    <p class="muted" style="margin:0 24px 12px">${opinionLine(s)} Alquileres de hamacas: ${s.beachRentals||0}.</p>
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
      ${ledgerHtml(s)}<span class="total">Resultado operativo (base caja)</span><span class="total ${net>=0?'pos':'neg'}">${net>=0?'+':'−'}${eur(Math.abs(net))}</span>
      <span class="total">En caja</span><span class="total">${eur(Game.money)}</span>
    </div>
    <div style="padding:0 24px 12px;display:flex;flex-wrap:wrap;gap:6px">${acc.soldStr||'<span class="muted" style="margin:0">Hoy no se vendió nada.</span>'}</div>
    ${acc.spoilLines.length?`<p class="muted" style="margin:0 24px 12px">Se ha estropeado: ${acc.spoilLines.join(', ')} (${eur(acc.spoilVal)}).</p>`:''}
    ${s.lost?`<p class="muted" style="margin:0 24px 12px">Clientes perdidos: ${[s.lostPrice?s.lostPrice+' por precios altos':'',s.lostQueue?s.lostQueue+' por cola llena':'',s.lostPatience?s.lostPatience+' por esperar demasiado':'',s.lostStock?s.lostStock+' porque no quedaba género':''].filter(Boolean).join(', ')}.</p>`:''}
    ${s.regVisits?`<p class="muted" style="margin:0 24px 12px">Habituales hoy: ${s.regVisits} visita${s.regVisits>1?'s':''}. Atendedlos bien y volverán más fieles.</p>`:''}
    ${Game.buzz>0.03?`<p class="muted" style="margin:0 24px 12px">Boca a boca: los habituales contentos traen amigos (+${Math.round(Game.buzz*12)}% de afluencia mañana).</p>`:''}
    ${capitalNote(s)}${isCoop()?teamHtml(s):''}`;
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
  const cards=m.cards.map(c=>{
    const loc=c.town?`<span class="rev-loc">${escapeHtml(c.town)}</span>`:'';
    const head=`<div class="rev-head"><div class="rev-who"><b>${escapeHtml(c.name)}</b>${loc}</div><span class="rev-stars">${stars(c.stars)}</span></div>`;
    const body=`<p class="rev-text">${c.text}</p>`;
    let foot='';
    if(c.resp){
      foot=`<p class="muted">Respuesta enviada: ${c.resp==='invita'?'invitación':"disculpas"} (+${c.respGain} de reputación).</p>`;
    } else if(c.stars<=2){
      foot=`<div class="net-actions">
        <button class="btn" onclick="window.__respondReview('${c.vid}','disculpa')">Disculparte</button>
        <button class="btn" onclick="window.__respondReview('${c.vid}','invita')">Invitar (${REV_INVITE_COST} €)</button>
      </div>`;
    }
    return `<div class="review">${head}${body}${foot}</div>`;
  }).join('');
  return `<p class="eyebrow">Reseñas del día</p>${cards||'<p class="muted">Hoy no quedó ninguna reseña.</p>'}`;
}
