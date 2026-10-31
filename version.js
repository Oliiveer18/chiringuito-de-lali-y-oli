export const VERSION='v29.3.0';
export const LABEL='v29.3.0 · clientes que no se traban entre las mesas, cierre a las 8 en punto con informe inmediato, sueldos solo por el tiempo trabajado, hamacas de verdad con precio por hora y personal a mitad de ritmo';
document.documentElement.dataset.version=VERSION;
const old=document.getElementById('version-badge');if(old)old.remove();
const title=document.getElementById('ver-title');if(title)title.textContent=LABEL;
for(const sel of ['#lobby .lobby-card','#plan .sheet','#report .sheet']){const host=document.querySelector(sel);if(host&&!host.querySelector('.ver-line')){const p=document.createElement('p');p.className='ver-line';p.textContent=LABEL;host.append(p);}}
