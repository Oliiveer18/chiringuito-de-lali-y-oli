/* =========================================================
   util.js
   Utilidades puras: RNG con semilla, formatos de números/dinero y helpers.
   ========================================================= */
// ---------- Utilidades ----------
export let seed = (Date.now() % 100000) + 7;
export function rnd(){ seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
export const rand = (a,b)=> a + rnd()*(b-a);
export const clamp = (v,a,b)=> Math.max(a, Math.min(b, v));
export const lerp = (a,b,t)=> a + (b-a)*t;
export function pickW(obj){ let s=0; for(const k in obj) s+=obj[k]; let r=rnd()*s; for(const k in obj){ r-=obj[k]; if(r<=0) return k;} return Object.keys(obj)[0]; }
export const fmt0 = new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0,minimumFractionDigits:0});
export const fmt2 = new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2});
export const eur = v => fmt0.format(Math.round(v));
export const eur2 = v => fmt2.format(v);
export function hexToRgb(h){ const n=parseInt(h.slice(1),16); return [n>>16&255,n>>8&255,n&255]; }
export function mixColor(a,b,t){ const A=hexToRgb(a),B=hexToRgb(b); return `rgb(${Math.round(lerp(A[0],B[0],t))},${Math.round(lerp(A[1],B[1],t))},${Math.round(lerp(A[2],B[2],t))})`; }
export const $ = s => document.querySelector(s);
export function stars(r){ const f=Math.round(clamp(r,0,5)); return '★'.repeat(f)+'☆'.repeat(5-f); }
export function hhmm(h){ const hh=Math.floor(h), mm=Math.floor((h-hh)*60/10)*10; return `${hh}:${String(mm).padStart(2,'0')}`; }

export function escapeHtml(t){ return String(t).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
