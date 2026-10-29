export const VERSION='v28.12';
<<<<<<< HEAD
export const LABEL='v28.12 · pies en suelo del quiosco (HUT_BAR_FLOOR_Y=450)';
=======
export const LABEL='v28.12 · pies en suelo del chiringuito';
>>>>>>> 2488cad (v28.12: player feet on hut deck (HUT_BAR_FLOOR_Y=450))
document.documentElement.dataset.version=VERSION;
const old=document.getElementById('version-badge');if(old)old.remove();
const title=document.getElementById('ver-title');if(title)title.textContent=LABEL;
for(const sel of ['#lobby .lobby-card','#plan .sheet','#report .sheet']){const host=document.querySelector(sel);if(host&&!host.querySelector('.ver-line')){const p=document.createElement('p');p.className='ver-line';p.textContent=LABEL;host.append(p);}}
