export const VERSION='v28.22.0';
export const LABEL='v28.22.0 · informe con el personal en solitario: fila del jugador y métricas de cada contratado (preparados, vendidos, mesas, terraza) con resumen de plantilla, y el personal fuera de turno ya no aparece parado en el kiosco';
document.documentElement.dataset.version=VERSION;
const old=document.getElementById('version-badge');if(old)old.remove();
const title=document.getElementById('ver-title');if(title)title.textContent=LABEL;
for(const sel of ['#lobby .lobby-card','#plan .sheet','#report .sheet']){const host=document.querySelector(sel);if(host&&!host.querySelector('.ver-line')){const p=document.createElement('p');p.className='ver-line';p.textContent=LABEL;host.append(p);}}
