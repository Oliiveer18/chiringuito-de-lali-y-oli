/* Mechanical extraction from sim.js; declaration bodies are unchanged. */
import { releaseFloorCustomer } from "../floor-service.js?v=30.0.0";
import { ITEMS } from "../config.js?v=30.0.0";
import { PKEYS } from "../config.js?v=30.0.0";
import { QUEUE_SPOTS } from "../config.js?v=30.0.0";
import { REGULARS } from "../config.js?v=30.0.0";
import { SEC_PER_HOUR } from "../config.js?v=30.0.0";
import { TYPES } from "../config.js?v=30.0.0";
import { W } from "../config.js?v=30.0.0";
import { WEATHER } from "../config.js?v=30.0.0";
import { stationOf } from "../config.js?v=30.0.0";
import { who } from "../config.js?v=30.0.0";
import { clamp } from "../util.js?v=30.0.0";
import { pickW } from "../util.js?v=30.0.0";
import { rand } from "../util.js?v=30.0.0";
import { rnd } from "../util.js?v=30.0.0";
import { Game } from "../state.js?v=30.0.0";
import { activeItems } from "../state.js?v=30.0.0";
import { closeHour } from "../state.js?v=30.0.0";
import { isCoop } from "../state.js?v=30.0.0";
import { isWeekend } from "../state.js?v=30.0.0";
import { itemUnlocked } from "../state.js?v=30.0.0";
import { lvl } from "../state.js?v=30.0.0";
import { simProgressDay } from "../state.js?v=30.0.0";
import { setTimeoutGame } from "../state.js?v=30.0.0";
import { weatherToday } from "../state.js?v=30.0.0";
import { QUEUE_POS } from "../world.js?v=30.0.0";
import { custSeq } from "../world.js?v=30.0.0";
import { genLook } from "../world.js?v=30.0.0";
import { EXIT_X_R } from "../world.js?v=30.0.0";
import { EXIT_X_L } from "../world.js?v=30.0.0";
import { navSetTarget } from "../nav.js?v=30.0.0";
import { recordVisit } from "../report.js?v=30.0.0";
import { addSat } from "./economy.js?v=30.0.0";
import { difficultyProfile } from "./season.js?v=30.0.0";

export function spawnCustomer(forceType, opts){
  const difficulty=difficultyProfile();
  const w = WEATHER[weatherToday()];
  let mix = {turista:0.45, local:0.35, surfista:0.2};
  for(const k in w.mix) mix[k]*=w.mix[k];
  if(isWeekend(simProgressDay())) mix.local*=1.6;
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
    if(Game.mods.batido && id==='batido') wv*=2; /* v29.4.5: evento del club de running */
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
    c.state='walkby'; c.mood='caro'; c.moodT=3; navSetTarget(c, fromRight? EXIT_X_L : EXIT_X_R, 690); c.y=rand(684,700);
    Game.dayStats.lostPrice++; Game.dayStats.lost++; recordVisit(c,{lost:'caro'}); if(regular) regularOutcome(c,0);
    Game.customers.push(c); return c;
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
  /* v29.5: parejas. Llegan juntas, piden por separado y solo van a la mesa si
     atienden a las dos; si una pierde la paciencia, se marchan las dos. */
  let mate=null;
  if(!regular && !forceType && simProgressDay()>=4 && rnd()<0.16){ /* parejas solo en llegadas normales, no en eventos forzados */
    const n2=rnd()<0.55?1:2;
    const pool2={...weights};
    if(regular&&itemUnlocked(regular.fav))delete pool2[regular.fav];
    const order2=[];
    for(let i=0;i<n2&&Object.keys(pool2).length;i++){const k=pickW(pool2);order2.push(k);delete pool2[k];}
    if(order2.length){
      mate={...c};
      mate.id=++custSeq.id;
      mate.personality=PKEYS[Math.floor(rnd()*PKEYS.length)];
      mate.look=genLook(type); mate.shirt=mate.look.shirt; mate.skin=mate.look.skin; mate.hat=mate.look.hat||null;
      mate.bob=rnd()*6; mate.walkPhase=0; mate.stridePh=0; mate.speed=c.speed*rand(0.95,1.05);
      mate.order=order2; mate.asked=order2.slice(); mate.itemSt=order2.map(()=>0); mate.served=[]; mate.missing=0;
      mate.inPrep=0; mate.partT={}; mate.menuDur=rand(1.4,2.4);
      mate.revName=null;
      if(Game.dayStats){let nm=who(type),tries=0;while(Game.dayStats.usedNames.has(nm)&&tries++<4)nm=who(type);Game.dayStats.usedNames.add(nm);mate.revName=nm;}
      mate.partnerId=c.id; mate.coupleLead=false;
      c.partnerId=mate.id; c.coupleLead=true;
      Game.customers.push(mate);
    }
  }
  const taken = new Set(Game.customers.filter(o=>o.spot>=0).map(o=>o.spot));
  let spot=-1;
  if(mate){
    for(let i=0;i+1<QUEUE_SPOTS;i++) if(!taken.has(i)&&!taken.has(i+1)){spot=i;break;}
  }else{
    for(let i=0;i<QUEUE_SPOTS;i++) if(!taken.has(i)){ spot=i; break; }
  }
  if(spot<0){
    c.state='walkby'; c.mood='lleno'; c.moodT=3; navSetTarget(c, fromRight? EXIT_X_L : EXIT_X_R, 690); c.y=rand(684,700);
    Game.dayStats.lostQueue++; Game.dayStats.lost++; recordVisit(c,{lost:'lleno'}); if(regular) regularOutcome(c,0);
    if(mate){ // sin dos puestos contiguos no hay sitio para la pareja: se van las dos
      mate.state='walkby'; mate.mood='lleno'; mate.moodT=3; navSetTarget(mate, fromRight? EXIT_X_L : EXIT_X_R, 690); mate.y=rand(684,700);
      Game.dayStats.lostQueue++; Game.dayStats.lost++; recordVisit(mate,{lost:'lleno'});
    }
    Game.customers.push(c); return c;
  }
  c.spot=spot; navSetTarget(c, QUEUE_POS[spot].x, QUEUE_POS[spot].y, {x:QUEUE_POS[spot].x, y:QUEUE_POS[spot].y+46});
  const dirty = Game.tables.filter(t=>t.state==='dirty').length;
  c.maxPatience = T.patience * difficulty.patience * (c.order.length>2?1.12:1) * (lvl('altavoz')?1.25:1) * (1 - Math.min(0.3,dirty*0.06)) * rand(0.85,1.15);
  c.patience = c.maxPatience;
  if(mate){
    mate.spot=spot+1; navSetTarget(mate, QUEUE_POS[spot+1].x, QUEUE_POS[spot+1].y, {x:QUEUE_POS[spot+1].x, y:QUEUE_POS[spot+1].y+46});
    const Tm=TYPES[type];
    mate.maxPatience = Tm.patience * difficulty.patience * (mate.order.length>2?1.12:1) * (lvl('altavoz')?1.25:1) * (1 - Math.min(0.3,dirty*0.06)) * rand(0.85,1.15);
    mate.patience = mate.maxPatience;
  }
  Game.customers.push(c); return c;
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
  if(simProgressDay()<=2) return;
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

export function leaveQueue(c){if(c.floorTableId!=null)releaseFloorCustomer(c); c.spot=-1; navSetTarget(c, c.x<W/2 && rnd()<0.3 ? EXIT_X_L : EXIT_X_R, rand(660,700)); }

/* v29.5: si una pareja no recibe atención y una se cansa, se van las dos. */
export function coupleAbandon(c){
  if(!c||!c.partnerId)return false;
  const mate=Game.customers.find(x=>x.id===c.partnerId);
  if(!mate||mate.coupleGone)return false;
  if(['eat','toTable','leave','walkby','gone'].includes(mate.state))return false;
  mate.coupleGone=true;
  if(mate.floorTableId!=null)releaseFloorCustomer(mate);
  for(const s of Game.slots)if(s.cust===mate){s.cust=null;s.items=[];}
  mate.inPrep=0; mate.spot=-1;
  leaveQueue(mate);
  mate.state='leave'; mate.act='walk'; mate.mood='triste'; mate.moodT=3; mate.moodTxt='¡Nos vamos, vida!';
  if(Game.dayStats){Game.dayStats.lost++;Game.dayStats.lostPatience++;}
  recordVisit(mate,{lost:'espera'}); regularOutcome(mate,0); addSat(0);
  return true;
}
