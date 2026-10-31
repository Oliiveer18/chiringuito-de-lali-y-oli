export const VERSION='v29.4.1';
export const LABEL='v29.4.1 · movimiento fluido: los clientes que se van salen de verdad (despawn fuera de encuadre, sin NPCs trabados en los bordes ni temblores) y las salidas ya no se apiñan a la vista';
document.documentElement.dataset.version=VERSION;
const old=document.getElementById('version-badge');if(old)old.remove();
const title=document.getElementById('ver-title');if(title)title.textContent=LABEL;
for(const sel of ['#lobby .lobby-card','#plan .sheet','#report .sheet']){const host=document.querySelector(sel);if(host&&!host.querySelector('.ver-line')){const p=document.createElement('p');p.className='ver-line';p.textContent=LABEL;host.append(p);}}
