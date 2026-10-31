export const VERSION='v29.4.9';
export const LABEL='v29.4.9 · una sola puntuación por jornada: la nota del informe y los puntos de la liga son el mismo número (servicio 40, valoración 25, margen 20, comunidad 15), el margen cuenta también las hamacas, los rivales puntúan igual y las partidas guardadas se reconvierten';
document.documentElement.dataset.version=VERSION;
const old=document.getElementById('version-badge');if(old)old.remove();
const title=document.getElementById('ver-title');if(title)title.textContent=LABEL;
for(const sel of ['#lobby .lobby-card','#plan .sheet','#report .sheet']){const host=document.querySelector(sel);if(host&&!host.querySelector('.ver-line')){const p=document.createElement('p');p.className='ver-line';p.textContent=LABEL;host.append(p);}}
