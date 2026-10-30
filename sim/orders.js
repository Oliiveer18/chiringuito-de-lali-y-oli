/* Mechanical extraction from sim.js; declaration bodies are unchanged. */
export function pendingIdx(c){ const out=[]; if(!c.itemSt) return out; c.itemSt.forEach((st,i)=>{ if(st===0) out.push(i); }); return out; }
