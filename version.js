export const VERSION='v29.4.10';
export const LABEL='v29.4.10 · el informe del día explica las tres capas de la valoración (satisfacción por cliente, reseñas públicas y reputación) con los números reales de la jornada';
document.documentElement.dataset.version=VERSION;
const old=document.getElementById('version-badge');if(old)old.remove();
const title=document.getElementById('ver-title');if(title)title.textContent=LABEL;
for(const sel of ['#lobby .lobby-card','#plan .sheet','#report .sheet']){const host=document.querySelector(sel);if(host&&!host.querySelector('.ver-line')){const p=document.createElement('p');p.className='ver-line';p.textContent=LABEL;host.append(p);}}
