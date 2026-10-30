export const VERSION='v29.0.0';
export const LABEL='v29.0.0 · cámara unificada: un solo sistema de encuadre para vertical y horizontal, con zoom de kiosco y mesas también en horizontal y margen de playa a ambos lados para que el chiringuito no quede pegado al borde';
document.documentElement.dataset.version=VERSION;
const old=document.getElementById('version-badge');if(old)old.remove();
const title=document.getElementById('ver-title');if(title)title.textContent=LABEL;
for(const sel of ['#lobby .lobby-card','#plan .sheet','#report .sheet']){const host=document.querySelector(sel);if(host&&!host.querySelector('.ver-line')){const p=document.createElement('p');p.className='ver-line';p.textContent=LABEL;host.append(p);}}
