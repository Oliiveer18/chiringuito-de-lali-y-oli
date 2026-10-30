/* Acciones pendientes del invitado. Lo importa net.js. */
import { Game, Net } from './state.js?v=28.19.0';
import { netAct } from './net-link.js?v=28.19.0';
export const REJECT_MSG = {
  busy:'Tu puesto ya estaba ocupado con otro pedido.',
  gone:'Ese cliente ya no esperaba el pedido.',
  clean:'Esa mesa ya estaba limpia.',
  taken:'Tu pareja ya había pedido esa mesa. Si no avanza, en unos segundos podrás tomarla tú.',
};
export function pendHas(kind,key){ for(const p of Net.pend.values()) if(p.kind===kind && p.key===key) return true; return false; }
export function guestServe(cu){
  if(!cu || pendHas('serve', cu.id)) return;
  const q=++Net.seq;
  netAct({a:'serve', id:cu.id, q,serviceId:Game.floor?.id});
  Net.pend.set(q, {kind:'serve', key:cu.id, t0:performance.now(), expired:false});
}
export function guestClean(i){
  if(i==null || i<0 || pendHas('clean', i)) return;
  const q=++Net.seq;
  netAct({a:'clean', i, q,serviceId:Game.floor?.id});
  Net.pend.set(q, {kind:'clean', key:i, t0:performance.now(), expired:false});
}
let readyRetryT=0;
/* v28.18: reintenta el aviso de "listo" mientras el anfitrión no avance de
   pantalla: los mensajes sueltos se pierden y el toggle antiguo se rompía. */
export function guestReadyTick(dt){
  if(!Net.readySent) return;
  if(Game.mode!=='report' && Game.mode!=='plan') return;
  readyRetryT+=dt;
  if(readyRetryT>=0.6){ readyRetryT=0; netAct({a:'ready'}); }
}
export function guestPendTick(){
  const now=performance.now();
  for(const [q,p] of Net.pend){
    const age=now-p.t0;
    if(!p.expired && age>Net.pendTimeout) p.expired=true;
    if(age>Net.pendDrop) Net.pend.delete(q);
  }
}
