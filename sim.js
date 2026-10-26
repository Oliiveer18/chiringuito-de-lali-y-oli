/* =========================================================
   sim.js
   Simulación autoritativa (anfitrión): dificultad, clientes, pedidos, ciclo del día y economía.
   ========================================================= */
import { ANGER_MIN_STAGE, DRINKS, HOUR_CURVE, ITEMS, ITEM_IDS, PERSONALITIES, PKEYS, QUEUE_SPOTS, REGULARS, SEASON_DAYS, SEC_PER_HOUR, SPECIAL_DAYS, START_MONEY, TYPES, W, WAIT_TABLE_MAX, WEATHER, stationOf, who } from './config.js';
import { $, clamp, eur2, pickW, rand, rnd } from './util.js';
import { Audio } from './audio.js';
import { satisfaction } from './ratings-model.mjs';
import { startBeach, updateBeach } from './beach.js';
import { Game, Net, activeItems, closeHour, gameTimers, hamacaCount, hostLive, isCoop, isWeekend, itemUnlocked, lvl, setTimeoutGame, weatherToday } from './state.js';
import { QUEUE_POS, buildTables, custSeq, genLook } from './world.js';
import { navSetTarget, navStep } from './nav.js';
import { endDay, recordVisit } from './report.js';
import { flashMoney, setSpeed, showServiceUI, toast, updateHud, updateStockbar } from './ui.js';

export function newSeason(){
  Object.assign(Game,{day:1,money:START_MONEY,rep:3.0,hour:10,upgrades:{},staff:{},customers:[],floaters:[],particles:[],season:{revenue:0,served:0,lost:0,bestDay:0,bestDayN:1}, lastDebt:false, starsLog:[], revUsed:{}, revPrev:{}});
  for(const id of ITEM_IDS){ Game.stock[id]= ITEMS[id].unlock?0:15; Game.prices[id]=ITEMS[id].ref; Game.enabled[id]=true; }
  Game.forecast=[];
  Game.regulars={}; Game.regVisited={}; Game.buzz=0;
  for(const r of REGULARS) Game.regulars[r.id]={loyalty:1,visits:0,next:2+Math.floor(rnd()*3)};
  for(let d=1; d<=SEASON_DAYS+1; d++){
    let w = pickW({sol:52,panza:20,calima:13,viento:15});
    if(SPECIAL_DAYS[d] && SPECIAL_DAYS[d].forceWeather) w = SPECIAL_DAYS[d].forceWeather;
    if(d===1) w='sol';
    Game.forecast.push(w);
  }
  buildTables();
}
export function difficultyProfile(day=Game.day){
  const d=clamp(Number(day)||1,1,SEASON_DAYS);
  const t=(d-1)/(SEASON_DAYS-1);
  const smooth=t*t*(3-2*t);
  const late=clamp((d-8)/(SEASON_DAYS-8),0,1);
  return {
    label:d<=3?'Aprendizaje':d<=9?'Rodaje':d<=17?'Exigente':d<=24?'Hora de demostrar':'Recta final',
    arrivals:0.85+0.65*smooth,
    patience:1.15-0.27*smooth,
    doubleBonus:-0.12+0.27*smooth,
    mixedChance:0.30+0.35*smooth,
    tripleChance:0.18*late*late,
    peak:0.22*clamp((d-4)/(SEASON_DAYS-4),0,1)
  };
}
export function difficultyRush(hour,profile=difficultyProfile()){
  const lunch=Math.max(0,1-Math.abs(hour-13.5)/1.5);
  const sunset=closeHour()>20?Math.max(0,1-Math.abs(hour-20.5)/1):0;
  return 1+profile.peak*Math.max(lunch,sunset);
}

export function spawnCustomer(forceType, opts){
  const difficulty=difficultyProfile();
  const w = WEATHER[weatherToday()];
  let mix = {turista:0.45, local:0.35, surfista:0.2};
  for(const k in w.mix) mix[k]*=w.mix[k];
  if(isWeekend(Game.day)) mix.local*=1.6;
  if(Game.dayEvent && Game.dayEvent.mix) for(const k in Game.dayEvent.mix) mix[k]*=Game.dayEvent.mix[k];
  if(Game.mods.mix) for(const k in Game.mods.mix) mix[k]*=Game.mods.mix[k];
  const type = (opts && opts.regular) ? opts.regular.type : (forceType || pickW(mix));
  const T = TYPES[type];
  const fromRight = rnd()<0.75;
  const regular = opts && opts.regular ? opts.regular : null;
  const personality = regular ? regular.personality : PKEYS[Math.floor(rnd()*PKEYS.length)];
  const look = regular ? regular.look : genLook(type);
  const c = {id:++custSeq.id, type, x: fromRight? W+40 : -40, y: rand(684,702), state:'arrive', speed:rand(95,125),
    shirt:look.shirt, skin:look.skin, look, personality, regular,
    order:[], patience:0, maxPatience:0, spot:-1, bob:rnd()*6, mood:null, moodT:0, moodTxt:null, tx:0, ty:0, table:null, eatT:0, waited:0, tag:null,
    act:'walk', actT:0, anger:0, angerT:0, graceT:null, subs:{}, walkPhase:0, stridePh:0,
    hat: look.hat || null};
  if(Game.dayStats){
    let nm=who(type), tries=0;
    while(Game.dayStats.usedNames.has(nm) && tries++<4) nm=who(type);
    Game.dayStats.usedNames.add(nm);
    c.revName=nm;
  }
  c.speed *= (0.9 + look.walk.stride*0.15);
  if(regular){
    c.regLoyalty=Game.regulars[regular.id].loyalty;
    Game.regVisited[regular.id]='spawned';
    Game.floaters.push({x:clamp(c.x,60,W-60),y:c.y-90,text:(Game.regulars[regular.id].loyalty>1?'¡Hola otra vez, ':'¡Hola, ')+regular.name+'!',t:0,color:'#ffe9a8'});
  }
  const items = activeItems().filter(id=>Game.stock[id]>0 || rnd()<0.5);
  const drinks = ['cerveza','barraquito','batido'];
  const weights = {};
  for(const id of activeItems()){
    const ratio = Game.prices[id]/ITEMS[id].ref;
    if(ratio > T.maxRatio) continue;
    let wv = T.pref[id] * Math.pow(1/ratio, T.elas*2);
    if(drinks.includes(id)) wv *= w.drinks;
    if(id==='cerveza' && lvl('nevera')) wv*=1.25;
    if(Game.mods.beer && id==='cerveza') wv*=2;
    if(isCoop() && stationOf(id)==='cocina') wv*=1.7;
    weights[id]=wv;
  }
  if(regular && itemUnlocked(regular.fav)){
    weights[regular.fav]=(weights[regular.fav]||1)+8;
  }
  const keys = Object.keys(weights);
  const avgRatio = activeItems().reduce((s,id)=>s+Game.prices[id]/ITEMS[id].ref,0)/Math.max(1,activeItems().length);
  const priceDeter = clamp((avgRatio-1)*T.elas*0.55,0,0.9);
  if(keys.length===0 || rnd()<priceDeter){
    c.state='walkby'; c.mood='caro'; c.moodT=3; navSetTarget(c, fromRight? -60 : W+60, 690); c.y=rand(684,700);
    Game.dayStats.lostPrice++; Game.dayStats.lost++; recordVisit(c,{lost:'caro'}); if(regular) regularOutcome(c,0);
    Game.customers.push(c); return;
  }
  const n = rnd()<clamp(T.two+difficulty.doubleBonus,0.2,0.85)?2:1;
  const pool = {...weights};
  if(regular && itemUnlocked(regular.fav)){ c.order.push(regular.fav); delete pool[regular.fav]; }
  for(let i=c.order.length;i<n && Object.keys(pool).length;i++){ const k=pickW(pool); c.order.push(k); delete pool[k]; }
  if(isCoop() && c.order.length===1 && rnd()<difficulty.mixedChance){
    const other = Object.keys(weights).filter(k=>stationOf(k)!==stationOf(c.order[0]));
    if(other.length){ const sub={}; other.forEach(k=>sub[k]=weights[k]); c.order.push(pickW(sub)); }
  }
  if(c.order.length===2 && rnd()<difficulty.tripleChance){
    const remaining={};
    for(const id of Object.keys(weights)) if(!c.order.includes(id)) remaining[id]=weights[id];
    if(Object.keys(remaining).length) c.order.push(pickW(remaining));
  }
  c.itemSt = c.order.map(()=>0); c.served=[]; c.missing=0; c.inPrep=0; c.partT={}; c.menuDur=rand(1.4,2.4); c.asked=c.order.slice();
  const taken = new Set(Game.customers.filter(o=>o.spot>=0).map(o=>o.spot));
  let spot=-1; for(let i=0;i<QUEUE_SPOTS;i++) if(!taken.has(i)){ spot=i; break; }
  if(spot<0){
    c.state='walkby'; c.mood='lleno'; c.moodT=3; navSetTarget(c, fromRight? -60 : W+60, 690); c.y=rand(684,700);
    Game.dayStats.lostQueue++; Game.dayStats.lost++; recordVisit(c,{lost:'lleno'}); if(regular) regularOutcome(c,0);
    Game.customers.push(c); return;
  }
  c.spot=spot; navSetTarget(c, QUEUE_POS[spot].x, QUEUE_POS[spot].y, {x:QUEUE_POS[spot].x, y:QUEUE_POS[spot].y+46});
  const dirty = Game.tables.filter(t=>t.state==='dirty').length;
  c.maxPatience = T.patience * difficulty.patience * (c.order.length>2?1.12:1) * (lvl('altavoz')?1.25:1) * (1 - Math.min(0.3,dirty*0.06)) * rand(0.85,1.15);
  c.patience = c.maxPatience;
  Game.customers.push(c);
}

export function prepTime(order){
  let t = order.reduce((s,id)=>s+ITEMS[id].prep,0);
  if(lvl('plancha')) t*=0.8; if(Game.staff.cocinero) t*=0.6;
  return t;
}
export function slotOf(who){ return Game.slots.find(s=>s.who===who); }
export function pendingIdx(c){ const out=[]; if(!c.itemSt) return out; c.itemSt.forEach((st,i)=>{ if(st===0) out.push(i); }); return out; }
export function servable(c){ return c && (c.state==='queue' || c.state==='prep') && pendingIdx(c).length>0; }

export function chooseSubstitute(c, missingId){
  const cands = activeItems().filter(id=>Game.stock[id]>0 && !c.order.includes(id));
  if(!cands.length) return null;
  const sameStation = cands.filter(id=>stationOf(id)===stationOf(missingId));
  const pool = sameStation.length ? sameStation : cands;
  const w={}; pool.forEach(id=>w[id]=TYPES[c.type].pref[id]||1);
  return pickW(w);
}
export function announceSub(c, newId){
  c.mood='cambio'; c.moodT=4.5;
  c.moodTxt=`Pues ${ITEMS[newId].name.toLowerCase()}, ¡gracias!`;
  Game.floaters.push({x:c.x,y:c.y-120,text:'Cambia a '+ITEMS[newId].name.toLowerCase(),t:0,color:'#fff2c9'});
}
export function regularOutcome(c, sat){
  if(!c.regular || c.regDone) return;
  c.regDone=true;
  const rec=Game.regulars[c.regular.id]; if(!rec) return;
  if(Game.dayStats) Game.dayStats.regVisits=(Game.dayStats.regVisits||0)+1;
  const d = sat>=0.7?1 : sat<=0.35?-1 : 0;
  rec.loyalty=clamp(rec.loyalty+d,0,5); rec.visits++;
  rec.next=Game.day+clamp(6-rec.loyalty,2,6)+Math.floor(rnd()*2);
  if(d>0) Game.floaters.push({x:c.x,y:c.y-165,text:'★ '+c.regular.name+' más fiel',t:0,color:'#ffd36b'});
  else if(d<0) Game.floaters.push({x:c.x,y:c.y-165,text:c.regular.name+' defraudado',t:0,color:'#ffb0a0'});
}
export function scheduleRegulars(){
  Game.regVisited={};
  for(const r of REGULARS){
    const rec=Game.regulars[r.id]; if(!rec) continue;
    if(rec.next<=Game.day && !Game.regVisited[r.id]){
      if(!itemUnlocked(r.fav)){ rec.next=Game.day+2; continue; }
      Game.regVisited[r.id]='scheduled';
      const delay = rand(0.2, Math.max(0.5, closeHour()-10.5)) * SEC_PER_HOUR;
      setTimeoutGame(()=>{ if(Game.mode==='service' && Game.regVisited[r.id]==='scheduled') spawnCustomer(null,{regular:r}); }, delay);
    }
  }
}
export function startPart(c, slot){
  if(!servable(c) || !slot || slot.cust) return false;
  const pend = pendingIdx(c);
  let take = slot.station==='all' ? pend : pend.filter(i=>stationOf(c.order[i])===slot.station);
  let penalty = 1;
  if(!take.length){ take = pend; penalty = 1.6; }
  const P = PERSONALITIES[c.personality] || PERSONALITIES.tranquilo;
  for(const i of take){
    if(Game.stock[c.order[i]]>0) continue;
    if(P.flex && c.subs[i]===undefined){
      const sub = chooseSubstitute(c, c.order[i]);
      c.subs[i]=sub;
      if(sub){ c.order[i]=sub; announceSub(c, sub); }
    }
  }
  const avail = take.filter(i=>Game.stock[c.order[i]]>0);
  for(const i of take){ if(Game.stock[c.order[i]]<=0){ c.itemSt[i]=3; c.missing++; const id=c.order[i]; Game.dayStats.stockOuts[id]=(Game.dayStats.stockOuts[id]||0)+1; } }
  if(!avail.length){ Game.floaters.push({x:c.x,y:c.y-120,text:c.subs&&Object.values(c.subs).includes(null)?'No queda nada parecido':'No queda',t:0,color:'#ffd9cf'}); checkComplete(c); updateStockbar(); return true; }
  for(const i of avail){ Game.stock[c.order[i]]--; c.itemSt[i]=1; }
  if(c.patience<=0 || c.anger===3){ c.patience=Math.max(c.patience, c.maxPatience*0.3); c.anger=Math.min(c.anger,1); c.angerT=0; c.graceT=null; }
  c.inPrep++; c.state='prep';
  if(c.tServe==null) c.tServe=Game.t;
  slot.cust=c; slot.items=avail; slot.t=0;
  slot.total = prepTime(avail.map(i=>c.order[i])) * penalty * (slot.who==='yeray'?1.15:1);
  slot.cover = penalty>1;
  if(avail.some(i=>stationOf(c.order[i])==='cocina')) Audio.sizzle(); else Audio.start();
  updateStockbar();
  return true;
}
export function finishSlot(slot){
  const c=slot.cust; slot.cust=null; if(!c) return;
  c.inPrep--; c.partT[slot.who]=Game.t;
  const by = Game.dayStats.by[slot.who] || (Game.dayStats.by[slot.who]={items:0,rev:0,clean:0});
  for(const i of slot.items){ c.itemSt[i]=2; const id=c.order[i]; c.served.push(id); by.items++; by.rev+=Game.prices[id]; }
  slot.items=[];
  if(pendingIdx(c).length && c.state==='prep') Audio.start();
  checkComplete(c);
}
export function checkComplete(c){
  if(c.inPrep>0 || pendingIdx(c).length) return;
  if(c.served.length===0){
    c.state='leave'; c.mood='nohay'; c.moodT=3; leaveQueue(c);
    Game.dayStats.lostStock++; Game.dayStats.lost++;
    recordVisit(c,{lost:'sinStock'});
    regularOutcome(c,0);
    addSat(0.1); Audio.angry(); return;
  }
  if(c.missing) Game.dayStats.partial++;
  completeOrder(c);
}
export function charge(c, total, sync){
  Game.money+=total; Game.dayStats.revenue+=total; Game.dayStats.served++;
  Game.floaters.push({x:c.x,y:c.y-110,text:'+'+eur2(total),t:0,color:'#ffe066'});
  if(sync) Game.floaters.push({x:c.x,y:c.y-150,text:'¡Sincronizados!',t:0,color:'#9ff0d0'});
  Audio.coin();
  c.spot=-1;
  regularOutcome(c, c.sat!=null?c.sat:0.8);
}
export function payAndSeat(c, total, s, t){
  c.sat=clamp(s,0,1); addSat(c.sat);
  charge(c,total, c.syncTip);
  c.tResolve=Game.t; recordVisit(c,{table:true,total});
  t.state='busy'; t.cust=c; c.table=t; c.state='toTable'; c.act='walk'; c.actT=0;
  const side = rnd()<0.5?-1:1;
  c.exemptTable=t;
  navSetTarget(c, t.x+side*38, t.y+8, {x:t.x+side*38, y:t.y+46});
  c.eatT=rand(9,15);
  if(c.sat>0.8){ c.mood='feliz'; c.moodT=2; c.moodTxt=null; }
  else if(c.sat<0.45){ c.mood='meh'; c.moodT=2.5; c.moodTxt=null; }
}
export function payAndGo(c, total, s, upset){
  c.sat=clamp(s,0,1); addSat(c.sat);
  charge(c,total,false);
  c.tResolve=Game.t; recordVisit(c,{table:false, takeaway:true, upset:!!upset, total});
  Game.dayStats.noTable++;
  c.state='leave'; c.act = c.sat>0.6?'bye':'walk'; c.actT=0;
  c.mood='llevar'; c.moodT=3.5;
  const P=PERSONALITIES[c.personality]||PERSONALITIES.tranquilo;
  c.moodTxt = P.takeaway==='prefiere' ? '¡Para llevar, genial!' : upset ? '¡Ni mesa! Para llevar…' : 'Para llevar, gracias';
  leaveQueue(c);
}
export function completeOrder(c){
  let total=0; for(const id of c.served){ total+=Game.prices[id]; Game.dayStats.sold[id]=(Game.dayStats.sold[id]||0)+1; }
  c.tDone=Game.t;
  let sync=false, syncTip=0;
  if(isCoop() && c.partT.p1!=null && c.partT.p2!=null && Math.abs(c.partT.p1-c.partT.p2)<=2.5){
    sync=true; syncTip=total*0.15; total+=syncTip; Game.dayStats.tips+=syncTip; Game.dayStats.combos++;
  }
  const T=TYPES[c.type];
  const waitFrac = 1 - clamp(c.patience/c.maxPatience,0,1);
  let priceF=0; for(const id of c.served) priceF += Math.max(0, Game.prices[id]/ITEMS[id].ref - 1)/T.maxRatio; priceF/=c.served.length;
  const cheap = c.served.reduce((a,id)=>a+Math.max(0,1-Game.prices[id]/ITEMS[id].ref),0)/c.served.length;
  const dirty = Game.tables.filter(t=>t.state==='dirty').length;
  let s=satisfaction({wait:waitFrac,price:priceF,missing:!!c.missing,dirty,cheap,music:!!lvl('altavoz'),sync});
  c.dirtySeen=dirty;
  c.priceF=priceF;
  const P=PERSONALITIES[c.personality]||PERSONALITIES.tranquilo;
  let pTip=0;
  if(c.personality==='generoso') pTip=total*P.tipP;
  if(c.personality==='exigente' && s>0.85) pTip=total*P.tipP;
  if(pTip>0.01){ total+=pTip; Game.dayStats.tipsP=(Game.dayStats.tipsP||0)+pTip; Game.floaters.push({x:c.x,y:c.y-190,text:'Propina +'+eur2(pTip),t:0,color:'#ffd36b'}); }
  c.syncTip=sync; c.tipped = sync || pTip>0.01; c.tipAmt = syncTip + Math.max(0,pTip);
  const free = Game.tables.find(t=>t.state==='free');
  if(free){ payAndSeat(c,total,s,free); return; }
  if(P.takeaway==='mesa'){
    c.totalDue=total; c.sat=clamp(s,0,1); c.state='waitTable'; c.waitT=0;
    c.mood='mesa'; c.moodT=2.5; c.moodTxt='¿Mesa libre, por favor?';
    return;
  }
  s -= (P.takeaway==='prefiere'?0:0.05);
  payAndGo(c,total,s,false);
}
export function giveUpPending(c){ pendingIdx(c).forEach(i=>{ c.itemSt[i]=3; c.missing++; }); checkComplete(c); }
export function leaveQueue(c){ c.spot=-1; navSetTarget(c, c.x<W/2 && rnd()<0.3 ? -60 : W+60, rand(660,700)); }
export function addSat(s){
  Game.dayStats.satSum+=s; Game.dayStats.satN++;
}

export const RANDOM_EVENTS = [
  {id:'influencer', w:3, run(){ Game.rep=clamp(Game.rep+0.35,0,5); Game.mods.arr*=1.3; toast('Un influencer en tu barra','Se ha hecho una foto con un barraquito. Llega más gente el resto del día.','good'); Audio.good(); }},
  {id:'sanidad', w:2, run(){ const dirty=Game.tables.filter(t=>t.state==='dirty').length;
      if(dirty>=2){ Game.money-=200; Game.dayStats.fines+=200; Game.rep=clamp(Game.rep-0.25,0,5); toast('Inspección de sanidad','Había '+dirty+' mesas sucias. Multa de 200 €.','bad'); Audio.bad(); }
      else { Game.rep=clamp(Game.rep+0.1,0,5); toast('Inspección de sanidad','Todo limpio y en orden. Buena nota.','good'); Audio.good(); } }},
  {id:'guagua', w:3, run(){ for(let i=0;i<6;i++) setTimeoutGame(()=>spawnCustomer('turista'), i*0.6); toast('Llega una guagua de turistas','Un grupo baja de excursión con mucha sed.','good'); }},
  {id:'futbol', w:2, run(){ Game.mods.beer=true; Game.mods.mix={local:1.6}; toast('Partido del CD Tenerife','Los vecinos vienen a verlo. Se dispara la cerveza.','good'); }},
  {id:'apagon', w:1, run(){ const lost=Math.floor(Game.stock.batido*0.5); Game.stock.batido-=lost; updateStockbar(); toast('Se va la luz un rato','La batidora se queda parada y se estropean '+lost+' plátanos.','bad'); Audio.bad(); }},
];
export function startDay(){
  Game.mode='service'; Game.hour=10; Game.closing=false; Game.closeT=0; Game.spawnAcc=0;
  Game.customers=[]; Game.floaters=[]; Game.mods={arr:1};
  Game.dayEvent = SPECIAL_DAYS[Game.day]||null;
  Game.eventDone = rnd()>0.45; Game.eventHour = rand(11.5,17.5);
  buildTables(); for(const t of Game.tables){ t.state='free'; t.cust=null; }
  const mk=(who,station)=>({who,station,cust:null,items:[],t:0,total:0,think:0});
  Game.slots=[mk('p1', isCoop()?Net.roles.p1:'all')];
  if(isCoop()) Game.slots.push(mk('p2', Net.roles.p2));
  if(Game.staff.camarero) Game.slots.push(mk('yeray','all'));
  Game.dayStats={revenue:0,served:0,lost:0,lostPrice:0,lostQueue:0,lostPatience:0,lostStock:0,partial:0,noTable:0,satSum:0,satN:0,sold:{},stockOuts:{},hamacas:0,fines:0,urgent:0,purchases:0,repStart:Game.rep,cleaned:0,tips:0,combos:0,tipsP:0,regVisits:0,visits:[],usedNames:new Set(),
    by:{p1:{items:0,rev:0,clean:0},p2:{items:0,rev:0,clean:0},yeray:{items:0,rev:0,clean:0}}};
  startBeach();
  scheduleRegulars();
  Net.ready={p1:false,p2:false};
  showServiceUI();
  if(Game.speed===0) Game.speed=1;
  setSpeed(Game.speed||1);
  if(Game.dayEvent) toast(Game.dayEvent.title, Game.dayEvent.desc, 'good');
  Audio.init();
}
export function update(dt){
  Game.t += dt;
  if(Game.mode!=='service') { updateAmbient(dt); return; }
  for(let i=gameTimers.length-1;i>=0;i--){ gameTimers[i].t-=dt; if(gameTimers[i].t<=0){ const f=gameTimers[i].fn; gameTimers.splice(i,1); f(); } }
  updateBeach();
  const prevHour=Game.hour;
  if(!Game.closing){
    Game.hour += dt/SEC_PER_HOUR;
    const w=WEATHER[weatherToday()];
    let rate = 8 * (HOUR_CURVE[Math.floor(Game.hour)]||0.6) * w.arr * (0.35 + Game.rep/5*0.95) * Game.mods.arr;
    if(lvl('sombrillas') && (weatherToday()==='sol'||weatherToday()==='calima')) rate*=1.15;
    if(lvl('redes')) rate*=1.15;
    if(isWeekend(Game.day)) rate*=1.25;
    if(Game.dayEvent) rate*=Game.dayEvent.arr;
    rate *= difficultyProfile().arrivals * difficultyRush(Game.hour);
    if(isCoop()) rate *= 1.4;
    rate *= 1 + 0.12*(Game.buzz||0);
    Game.spawnAcc += rate*dt/SEC_PER_HOUR;
    while(Game.spawnAcc>=1){ Game.spawnAcc-=1; spawnCustomer(); }
    if(!Game.eventDone && Game.hour>=Game.eventHour){ Game.eventDone=true; let e=RANDOM_EVENTS[0]; const tot=RANDOM_EVENTS.reduce((s,e)=>s+e.w,0); let r=rnd()*tot; for(const ev of RANDOM_EVENTS){ r-=ev.w; if(r<=0){e=ev;break;} } e.run(); }
    if(Game.hour>=closeHour()){ Game.hour=closeHour(); beginClosing(); }
    if(Math.floor(prevHour)!==Math.floor(Game.hour)) updateHud();
  } else {
    Game.closeT+=dt;
    for(const c of Game.customers) if(c.state==='prep' && c.inPrep===0 && pendingIdx(c).length) giveUpPending(c);
    const busy = Game.customers.some(c=>c.state!=='gone');
    if(Game.closeT>3.5 && (!busy || Game.closeT>9)){ endDay(); return; }
  }
  Game.slots.forEach(s=>{
    if(s.cust){ s.t+=dt; if(s.t>=s.total) finishSlot(s); }
    else if(s.who==='yeray' && !Game.closing){
      s.think=(s.think||0)+dt;
      if(s.think>0.5){ s.think=0;
        const busy = new Set(Game.slots.filter(o=>o.cust).map(o=>o.cust));
        const q = Game.customers.filter(c=>servable(c) && !busy.has(c)).sort((a,b)=>a.patience-b.patience);
        if(q.length) startPart(q[0], s);
      }
    }
  });
  const inLine = Game.customers.filter(c=>c.spot>=0).sort((a,b)=>a.spot-b.spot);
  inLine.forEach((c,i)=>{ if(c.spot!==i){ c.spot=i; navSetTarget(c, QUEUE_POS[i].x, QUEUE_POS[i].y, {x:QUEUE_POS[i].x, y:QUEUE_POS[i].y+46}); } });
  function angerUpdate(c, dt, drainMul){
    const P=PERSONALITIES[c.personality]||PERSONALITIES.tranquilo;
    c.patience -= dt*drainMul*P.patMul;
    c.angerT += dt;
    const frac = c.patience/c.maxPatience;
    if(c.anger<3){
      const want = frac<P.stages[2]?3 : frac<P.stages[1]?2 : frac<P.stages[0]?1 : 0;
      if(want>c.anger && c.angerT>=ANGER_MIN_STAGE){
        c.anger=want; c.angerT=0;
        if(want===3 && !c.protested){ c.protested=true; Audio.protest(); }
      }
    }
    if(c.patience<=0){
      if(c.anger<3){ c.anger=3; c.angerT=0; if(!c.protested){ c.protested=true; Audio.protest(); } }
      c.graceT = (c.graceT==null? P.grace : c.graceT) - dt;
      return c.graceT<=0;
    }
    return false;
  }
  for(const c of Game.customers){
    c.bob += dt*8;
    if(c.moodT>0){ c.moodT-=dt; if(c.moodT<=0){ c.mood=null; c.moodTxt=null; } }
    switch(c.state){
      case 'arrive': {
        const sp=QUEUE_POS[c.spot];
        if(sp && Math.hypot(c.x-sp.x,c.y-sp.y)<16){
          c.x=sp.x; c.y=sp.y; c.path=null; c.movingSpd=0;
          c.state='queue'; c.act='menu'; c.actT=0; c.tQueue=Game.t;
        } else if(navStep(c,dt,1.3)){ c.state='queue'; c.act='menu'; c.actT=0; c.tQueue=Game.t; }
        c.patience-=dt*0.3*(PERSONALITIES[c.personality]||PERSONALITIES.tranquilo).patMul;
        break;
      }
      case 'queue': {
        const sp=QUEUE_POS[c.spot];
        if(sp && Math.hypot(c.x-sp.x,c.y-sp.y)<6){
          c.x=sp.x; c.y=sp.y; c.path=null; c.movingSpd=0;
        } else {
          navStep(c,dt,1);
        }
        c.waited+=dt; c.actT+=dt;
        if(c.act==='menu' && c.actT>c.menuDur){ c.act='order'; c.actT=0; }
        else if(c.act==='order' && c.actT>0.9){ c.act='wait'; c.actT=0; }
        if(Game.closing){ c.state='leave'; c.act='walk'; leaveQueue(c); break; }
        if(angerUpdate(c,dt,1)){ c.state='leave'; c.act='walk'; c.mood='enfado'; c.moodT=3; c.moodTxt='¡Me largo!'; leaveQueue(c); c.tLeave=Game.t; Game.dayStats.lostPatience++; Game.dayStats.lost++; recordVisit(c,{lost:'espera'}); regularOutcome(c,0); addSat(0); Audio.angry(); }
        break;
      }
      case 'prep':
        navStep(c,dt,1); c.actT+=dt;
        if(c.act!=='wait' && c.act!=='lookAround' && c.act!=='watch' && c.act!=='protest'){ c.act='wait'; c.actT=0; }
        if(c.inPrep===0 && pendingIdx(c).length){
          if(angerUpdate(c,dt,0.6)){ c.mood='enfado'; c.moodT=2.5; c.moodTxt='¡No espero más!'; giveUpPending(c); }
        }
        break;
      case 'toTable': if(navStep(c,dt,1)){ c.state='eat'; c.act = c.served && c.served.some(id=>DRINKS.includes(id)) ? 'drink':'eat'; c.actT=0; } break;
      case 'eat': {
        c.eatT-=dt*(Game.closing?4:1); c.actT+=dt;
        const hasDrink = c.served.some(id=>DRINKS.includes(id));
        const hasFood = c.served.some(id=>!DRINKS.includes(id));
        const dur = c.act==='drink'?2.0:3.0;
        if(c.actT>dur){ c.act = c.act==='drink' ? (hasFood?'eat':'drink') : (hasDrink?'drink':'eat'); c.actT=0; }
        if(c.eatT<=0){ const t=c.table; t.cust=null; t.state= rnd()<0.75?'dirty':'free'; t.dirtyT=0; c.table=null; c.state='leave'; c.act = c.sat>0.6?'bye':'walk'; c.actT=0; navSetTarget(c, rnd()<0.8?W+60:-60, rand(660,700)); }
        break;
      }
      case 'waitTable': {
        c.waitT+=dt; c.actT+=dt;
        const free = Game.tables.find(t=>t.state==='free');
        if(free){ payAndSeat(c, c.totalDue, c.sat, free); }
        else if(c.waitT>WAIT_TABLE_MAX || Game.closing){ payAndGo(c, c.totalDue, c.sat-0.2, true); }
        break;
      }
      case 'leave': case 'walkby': if(navStep(c,dt, c.state==='walkby'?1:1.2)) c.state='gone'; break;
    }
  }
  Game.customers = Game.customers.filter(c=>c.state!=='gone');
  for(const t of Game.tables){ if(t.state==='dirty'){ t.dirtyT+=dt; if(Game.staff.limpiador && t.dirtyT>3.2){ cleanTable(t,true,'acaymo'); } } }
  updateAmbient(dt);
  hud.tick+=dt; if(hud.tick>0.25){ hud.tick=0; updateHud(); }
}
export const hud={tick:0};
export function updateAmbient(dt){
  for(const f of Game.floaters) f.t+=dt; Game.floaters=Game.floaters.filter(f=>f.t<1.4);
  for(const p of Game.particles){ p.t+=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=200*dt; } Game.particles=Game.particles.filter(p=>p.t<p.life);
}
export function cleanTable(t,auto,who){
  if(!t || t.state!=='dirty') return;
  t.state='free'; t.dirtyT=0; Game.dayStats.cleaned++;
  const b=Game.dayStats.by[who||'p1']; if(b) b.clean++;
  cleanFx(t);
  if(hostLive()) Net.events.push({e:'clean',i:Game.tables.indexOf(t),snd:!auto});
  if(!auto) Audio._raw.clean();
}
export function cleanFx(t){ for(let i=0;i<8;i++) Game.particles.push({x:t.x,y:t.y-20,vx:rand(-80,80),vy:rand(-160,-60),t:0,life:0.6,color:'#bfefff'}); }
export function beginClosing(){
  if(Game.closing) return; Game.closing=true; Game.closeT=0;
  toast('Hora de cerrar','Los últimos clientes terminan y recoges la barra.','');
}

export function buyStock(id,n,mult=1){
  const cost = ITEMS[id].cost*n*mult;
  if(Game.money < cost) { Audio.bad(); flashMoney(); return false; }
  Game.money -= cost; Game.stock[id]+=n; Audio.click(); return cost;
}
export function tryServe(c, who='p1'){
  const slot=slotOf(who); if(!slot || !servable(c)) return false;
  if(slot.cust){ Game.floaters.push({x:c.x,y:c.y-120,text:'Un momento…',t:0,color:'#fff6e6'}); return false; }
  return startPart(c, slot);
}
