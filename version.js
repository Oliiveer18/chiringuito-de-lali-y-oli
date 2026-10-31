export const VERSION='v29.4.3';
export const LABEL='v29.4.3 · bañistas que saben qué hora es: con menos de una hora de playa no alquilan, la estancia va en medias horas (0,5/1/1,5/2/2,5/3 h) y nadie paga tiempo que no puede disfrutar antes del cierre';
document.documentElement.dataset.version=VERSION;
const old=document.getElementById('version-badge');if(old)old.remove();
const title=document.getElementById('ver-title');if(title)title.textContent=LABEL;
for(const sel of ['#lobby .lobby-card','#plan .sheet','#report .sheet']){const host=document.querySelector(sel);if(host&&!host.querySelector('.ver-line')){const p=document.createElement('p');p.className='ver-line';p.textContent=LABEL;host.append(p);}}
