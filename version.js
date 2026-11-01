export const VERSION='v30.0.0';
export const LABEL='v29.5.0 · plantilla viva: hasta 3 contratos por puesto con vestuarios, niveles y XP, barras de cansancio y ánimo, renuncias si les va mal, sueldos equilibrados por disponibilidad, parejas de clientes que llegan juntas, mesas sucias solo con comida y el personal ya se ve dentro del kiosco';
document.documentElement.dataset.version=VERSION;
const old=document.getElementById('version-badge');if(old)old.remove();
const title=document.getElementById('ver-title');if(title)title.textContent=LABEL;
for(const sel of ['#lobby .lobby-card','#plan .sheet','#report .sheet']){const host=document.querySelector(sel);if(host&&!host.querySelector('.ver-line')){const p=document.createElement('p');p.className='ver-line';p.textContent=LABEL;host.append(p);}}
