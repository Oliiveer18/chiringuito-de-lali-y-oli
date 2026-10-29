/* camera-beta: equilibrio de la nueva carga de trabajo. */
import { Game } from '../state.js';
export const BALANCE={patienceMul:1.15,arrivalMul:.92,staffBonus:1.1};
export function applyBalance(){if(Game.mode!=='service')return;Game.mods.arr*=BALANCE.arrivalMul;}
export function balancePatience(base){return base*BALANCE.patienceMul;}
