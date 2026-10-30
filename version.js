export const VERSION='v28.17.0';
export const LABEL='v28.17.0 · ARREGLADO el bloqueo al limpiar mesas: el jugador ya no se queda clavado entre las mesas y la pareja puede tomar el relevo';
document.documentElement.dataset.version=VERSION;
const old=document.getElementById('version-badge');if(old)old.remove();
const title=document.getElementById('ver-title');if(title)title.textContent=LABEL;
for(const sel of ['#lobby .lobby-card','#plan .sheet','#report .sheet']){const host=document.querySelector(sel);if(host&&!host.querySelector('.ver-line')){const p=document.createElement('p');p.className='ver-line';p.textContent=LABEL;host.append(p);}}
