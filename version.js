export const VERSION='v29.4.6';
export const LABEL='v29.4.6 · controles de precio compatibles con iPhone, iPad y Mac: los botones menos y más funcionan sin selección de texto ni resaltado verde';
document.documentElement.dataset.version=VERSION;
const old=document.getElementById('version-badge');if(old)old.remove();
const title=document.getElementById('ver-title');if(title)title.textContent=LABEL;
for(const sel of ['#lobby .lobby-card','#plan .sheet','#report .sheet']){const host=document.querySelector(sel);if(host&&!host.querySelector('.ver-line')){const p=document.createElement('p');p.className='ver-line';p.textContent=LABEL;host.append(p);}}
