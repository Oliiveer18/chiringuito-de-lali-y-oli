/* Evita bucles infinitos: los módulos v11-v14 reescriben #tab-body dentro de su propio MutationObserver. */
const Native=window.MutationObserver;
function Guarded(cb){
  let tgt=null,opt=null;
  const mo=new Native(recs=>{
    if(!tgt||tgt.id!=='tab-body'){cb.call(api,recs,api);return;}
    mo.disconnect();
    try{cb.call(api,recs,api);}finally{mo.observe(tgt,opt);}
  });
  const api={observe(t,o){tgt=t;opt=o;mo.observe(t,o);},disconnect(){tgt=null;mo.disconnect();},takeRecords(){return mo.takeRecords();}};
  return api;
}
window.MutationObserver=Guarded;
