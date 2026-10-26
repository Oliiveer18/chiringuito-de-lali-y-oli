/* Cooperativo: contratar shows y reparar la algodonera lo decide el anfitrión (como la pestaña Red). */
import { Net } from './state.js';
import { toastLocal } from './ui.js';
document.addEventListener('click',e=>{
  const t=e.target.closest&&e.target.closest('[data-show],[data-repair]');
  if(!t||Net.role!=='guest')return;
  e.stopImmediatePropagation();e.preventDefault();
  toastLocal('Solo el anfitrión','El anfitrión es quien contrata los shows y repara la maquinaria.','');
},true);
