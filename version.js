export const VERSION='v29.4.11';
export const LABEL='v29.4.11 · rivales con carácter: cada kiosco tiene estilo propio, racha y contratiempos, puntúa con la misma fórmula que tú y las ligas quedan escalonadas de verdad (Bronce-Plata-Oro por Pueblo, Isla y Nación)';
document.documentElement.dataset.version=VERSION;
const old=document.getElementById('version-badge');if(old)old.remove();
const title=document.getElementById('ver-title');if(title)title.textContent=LABEL;
for(const sel of ['#lobby .lobby-card','#plan .sheet','#report .sheet']){const host=document.querySelector(sel);if(host&&!host.querySelector('.ver-line')){const p=document.createElement('p');p.className='ver-line';p.textContent=LABEL;host.append(p);}}
