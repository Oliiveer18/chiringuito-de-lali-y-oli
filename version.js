export const VERSION='v28.21.0';
export const LABEL='v28.21.0 · ligas más claras con barras de puntos por jornada, sin sustituciones de género: si no queda lo que pide el cliente se marcha, clientes perdidos al cierre bien contados y género estropeado reflejado en la caja del día';
document.documentElement.dataset.version=VERSION;
const old=document.getElementById('version-badge');if(old)old.remove();
const title=document.getElementById('ver-title');if(title)title.textContent=LABEL;
for(const sel of ['#lobby .lobby-card','#plan .sheet','#report .sheet']){const host=document.querySelector(sel);if(host&&!host.querySelector('.ver-line')){const p=document.createElement('p');p.className='ver-line';p.textContent=LABEL;host.append(p);}}
