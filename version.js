export const VERSION='v29.4.0';
export const LABEL='v29.4.0 · composición nueva en horizontal: el kiosco respira en su punto focal (mostrador a 1/3 del ancho, playa a la izquierda) sin perder de vista ni la última mesa';
document.documentElement.dataset.version=VERSION;
const old=document.getElementById('version-badge');if(old)old.remove();
const title=document.getElementById('ver-title');if(title)title.textContent=LABEL;
for(const sel of ['#lobby .lobby-card','#plan .sheet','#report .sheet']){const host=document.querySelector(sel);if(host&&!host.querySelector('.ver-line')){const p=document.createElement('p');p.className='ver-line';p.textContent=LABEL;host.append(p);}}
