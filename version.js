export const VERSION='v28.18.0';
export const LABEL='v28.18.0 · el personal ya trabaja de verdad (cocinera prepara, limpiador vela las mesas), nadie se va sin mesa con mesas libres, el cierre no corta escenas y el "siguiente día" cooperativo es instantáneo';
document.documentElement.dataset.version=VERSION;
const old=document.getElementById('version-badge');if(old)old.remove();
const title=document.getElementById('ver-title');if(title)title.textContent=LABEL;
for(const sel of ['#lobby .lobby-card','#plan .sheet','#report .sheet']){const host=document.querySelector(sel);if(host&&!host.querySelector('.ver-line')){const p=document.createElement('p');p.className='ver-line';p.textContent=LABEL;host.append(p);}}
