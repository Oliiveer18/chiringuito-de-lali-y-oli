export const VERSION='v29.4.2';
export const LABEL='v29.4.2 · hamacas sin errores: comprar mejoras ya no revienta el plan (toast importada) y la pestaña se llama "Compras y precios" — ahí se fija el precio de los productos y el precio por hora de las hamacas (sección Playa)';
document.documentElement.dataset.version=VERSION;
const old=document.getElementById('version-badge');if(old)old.remove();
const title=document.getElementById('ver-title');if(title)title.textContent=LABEL;
for(const sel of ['#lobby .lobby-card','#plan .sheet','#report .sheet']){const host=document.querySelector(sel);if(host&&!host.querySelector('.ver-line')){const p=document.createElement('p');p.className='ver-line';p.textContent=LABEL;host.append(p);}}
