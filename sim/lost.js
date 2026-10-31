/* v29.2: contabilidad honesta de clientes perdidos.
   Módulo sin dependencias para poder probarlo en Node sin navegador. */

/* Clientes de barra que al forzar el cierre siguen sin resolver: llegando,
   en cola, esperando mesa o en plena preparación. Los de terraza los cuenta
   abortFloor; estos antes se descartaban sin sumar al informe. */
const STRANDED=['arrive','queue','waitTable','prep'];

/* Cuenta los clientes varados al cierre forzado y devuelve cuántos sumó.
   visit/outcome son callbacks inyectados (recordVisit/regularOutcome) para
   no arrastrar dependencias de UI aquí. */
export function countStranded(customers, stats, visit, outcome){
  if(!Array.isArray(customers)||!stats) return 0;
  let n=0;
  for(const c of customers){
    if(c.floorTableId==null&&STRANDED.includes(c.state)&&!c.lostCounted){
      c.lostCounted=true;
      stats.lostClose=(stats.lostClose||0)+1;
      stats.lost=(stats.lost||0)+1;
      n++;
      if(visit)visit(c,{lost:'cierre'});
      if(outcome)outcome(c,0);
    }
  }
  return n;
}

/* v29.2: todo cliente que come en mesa deja la mesa sucia. Antes era una
   lotería del 75%. Centralizado aquí para probarlo sin el simulador. */
export function tableStateAfterMeal(){ return 'dirty'; }
