export const VERSION='v28.19.0';
export const LABEL='v28.19.0 · currículums equilibrados: cada candidato tiene ventajas y desventajas reales (ritmo, especialidad y disponibilidad) con sueldo proporcional a lo que produce, y nombres de NPCs corregidos';
document.documentElement.dataset.version=VERSION;
const old=document.getElementById('version-badge');if(old)old.remove();
const title=document.getElementById('ver-title');if(title)title.textContent=LABEL;
for(const sel of ['#lobby .lobby-card','#plan .sheet','#report .sheet']){const host=document.querySelector(sel);if(host&&!host.querySelector('.ver-line')){const p=document.createElement('p');p.className='ver-line';p.textContent=LABEL;host.append(p);}}
