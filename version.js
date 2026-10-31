export const VERSION='v29.4.5';
export const LABEL='v29.4.5 · averías reales (sombrilla, altavoz, algodonera, batidora — adiós al "cristal roto") con informe de incidencias al cerrar la jornada · nuevos eventos visibles: club de running, yate y marejada';
document.documentElement.dataset.version=VERSION;
const old=document.getElementById('version-badge');if(old)old.remove();
const title=document.getElementById('ver-title');if(title)title.textContent=LABEL;
for(const sel of ['#lobby .lobby-card','#plan .sheet','#report .sheet']){const host=document.querySelector(sel);if(host&&!host.querySelector('.ver-line')){const p=document.createElement('p');p.className='ver-line';p.textContent=LABEL;host.append(p);}}
