import {Game,Net,hamacaCount,weatherToday,closeHour} from './state.js?v=29.4.5';
import {createBeach,stepBeach} from './beach-model.mjs?v=29.4.5';
import {SEC_PER_HOUR} from './config.js?v=29.4.5';
import {netDirty} from './net.js?v=29.4.5';
export function startBeach(){Game.upgrades.beach=createBeach(hamacaCount());Game.dayStats.beachRentals=0;}
export function updateBeach(){if(Net.role==='guest'||!Game.dayStats)return;if(!Game.upgrades.beach)startBeach();
  /* v29.3: el precio de la hamaca lo fija la jugadora en el plan (€/hora);
     los bañistas deciden si alquilan y por cuánto tiempo. */
  const price=Number.isFinite(Game.prices.hamacas)&&Game.prices.hamacas>0?Game.prices.hamacas:3;
  const out=stepBeach(Game.upgrades.beach,Game.hour+(Game.closing?Game.closeT/SEC_PER_HOUR:0),Game.closing,weatherToday(),closeHour(),price);
  Game.upgrades.beach=out.state;
  for(const e of out.events){Game.money+=e.amount;Game.dayStats.hamacas+=e.amount;Game.dayStats.beachRentals++;
    Game.floaters.push({x:560+e.slot*88,y:418,text:`Hamaca +${e.amount} € (${e.hours.toFixed(1).replace('.',',')} h)`,t:0,color:'#ffe066'});}
  if(out.events.length)netDirty();}
