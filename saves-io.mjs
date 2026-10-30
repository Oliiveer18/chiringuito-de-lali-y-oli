/* Utilidades puras del guardado: codificación, validación, fusión de importaciones
   y nombres de archivo. Sin DOM para poder testearlas en Node (saves-io.test.mjs).
   Lo importa saves.js. */
export const encode=x=>JSON.stringify(x,(_,v)=>v instanceof Set?{__laliSet:[...v]}:v);
export const decode=s=>JSON.parse(s,(_,v)=>v&&Array.isArray(v.__laliSet)?new Set(v.__laliSet):v);
export const copy=x=>decode(encode(x));
export const uid=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);

export const FIELDS=['day','money','rep','stock','prices','enabled','upgrades','staff','forecast','season','lastDebt','starsLog','revUsed','revPrev','regulars','regVisited','buzz','pendingPurchases'];

/** Un guardado es válido si tiene la estructura de temporada esperada. Mismo
    criterio que la biblioteca local: evita restaurar basura que rompería el juego. */
export function valid(s){
  return !!(s&&s.data&&Number.isInteger(s.data.day)&&s.data.day>=1&&s.data.day<=30&&Number.isFinite(s.data.money)&&Number.isFinite(s.data.rep)
    &&['solo','coop'].includes(s.kind)&&Array.isArray(s.data.forecast)
    &&['stock','prices','enabled','upgrades','staff','season','regulars'].every(k=>s.data[k]&&typeof s.data[k]==='object')
    &&(s.phase!=='report'||s.ui&&s.data.dayStats&&s.data.revModel));
}

/** La biblioteca completa debe ser un array de guardados válidos. */
export function parseLibrary(raw){
  const a=decode(raw);
  if(!Array.isArray(a)||!a.every(valid)) throw Error('Guardado incompatible');
  return a;
}

/** v28.15: fusionar un guardado importado. Si ya existe uno con el mismo id
    (re-importar una copia de seguridad), se sustituye; si viene de otro
    dispositivo, su id es distinto y simplemente se añade. */
export function mergeImported(library, s){
  if(!valid(s)) throw Error('Guardado incompatible');
  const next=library.filter(x=>x.id!==s.id);
  next.push(s);
  return next;
}

/** Nombre de archivo descriptivo y ordenable para la copia exportada. */
export function exportFileName(s){
  const d=new Date(s.date||Date.now());
  const p=n=>String(n).padStart(2,'0');
  return `chiringuito-${s.kind}-dia${s.data.day}-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
}
