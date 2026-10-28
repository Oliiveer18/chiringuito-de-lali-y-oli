/* Mechanical extraction from sim.js; declaration bodies are unchanged. */
import { ITEMS } from "../config.js?v=28.5";
import { ITEM_IDS } from "../config.js?v=28.5";
import { REGULARS } from "../config.js?v=28.5";
import { SEASON_DAYS } from "../config.js?v=28.5";
import { SPECIAL_DAYS } from "../config.js?v=28.5";
import { START_MONEY } from "../config.js?v=28.5";
import { clamp } from "../util.js?v=28.5";
import { pickW } from "../util.js?v=28.5";
import { rnd } from "../util.js?v=28.5";
import { Audio } from "../audio.js?v=28.5";
import { Game } from "../state.js?v=28.5";
import { closeHour } from "../state.js?v=28.5";
import { setTimeoutGame } from "../state.js?v=28.5";
import { buildTables } from "../world.js?v=28.5";
import { toast } from "../ui.js?v=28.5";
import { updateStockbar } from "../ui.js?v=28.5";
import { spawnCustomer } from "./customers.js?v=28.5";

export function newSeason(){
  Object.assign(Game,{day:1,money:START_MONEY,rep:3.0,hour:10,upgrades:{},staff:{},customers:[],floaters:[],particles:[],season:{revenue:0,served:0,lost:0,bestDay:0,bestDayN:1}, lastDebt:false, starsLog:[], revUsed:{}, revPrev:{}, pendingPurchases:0});
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

export const RANDOM_EVENTS = [
  {id:'influencer', w:3, run(){ Game.rep=clamp(Game.rep+0.35,0,5); Game.mods.arr*=1.3; toast('Un influencer en tu barra','Se ha hecho una foto con un barraquito. Llega más gente el resto del día.','good'); Audio.good(); }},
  {id:'sanidad', w:2, run(){ const dirty=Game.tables.filter(t=>t.state==='dirty').length;
      if(dirty>=2){ Game.money-=200; Game.dayStats.fines+=200; Game.rep=clamp(Game.rep-0.25,0,5); toast('Inspección de sanidad','Había '+dirty+' mesas sucias. Multa de 200 €.','bad'); Audio.bad(); }
      else { Game.rep=clamp(Game.rep+0.1,0,5); toast('Inspección de sanidad','Todo limpio y en orden. Buena nota.','good'); Audio.good(); } }},
  {id:'guagua', w:3, run(){ for(let i=0;i<6;i++) setTimeoutGame(()=>spawnCustomer('turista'), i*0.6); toast('Llega una guagua de turistas','Un grupo baja de excursión con mucha sed.','good'); }},
  {id:'futbol', w:2, run(){ Game.mods.beer=true; Game.mods.mix={local:1.6}; toast('Partido del CD Tenerife','Los vecinos vienen a verlo. Se dispara la cerveza.','good'); }},
  {id:'apagon', w:1, run(){ const lost=Math.floor(Game.stock.batido*0.5); Game.stock.batido-=lost; updateStockbar(); toast('Se va la luz un rato','La batidora se queda parada y se estropean '+lost+' plátanos.','bad'); Audio.bad(); }},
];
