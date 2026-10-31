export const VERSION='v29.4.4';
export const LABEL='v29.4.4 · bañistas bien tumbados (cabeza en el respaldo, sin sombrero), la peña del partido del Tenerife llega de verdad en grupo y el influencer se le ve hacer su foto · sin menú de copiar al mantener pulsado en móvil';
document.documentElement.dataset.version=VERSION;
const old=document.getElementById('version-badge');if(old)old.remove();
const title=document.getElementById('ver-title');if(title)title.textContent=LABEL;
for(const sel of ['#lobby .lobby-card','#plan .sheet','#report .sheet']){const host=document.querySelector(sel);if(host&&!host.querySelector('.ver-line')){const p=document.createElement('p');p.className='ver-line';p.textContent=LABEL;host.append(p);}}
