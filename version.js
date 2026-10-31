export const VERSION='v29.1.0';
export const LABEL='v29.1.0 · barra superior profesional: estado, inventario y vistas en un solo centro de control arriba, pantalla despejada abajo y reparto en jornada solo con el pack medio (10 uds)';
document.documentElement.dataset.version=VERSION;
const old=document.getElementById('version-badge');if(old)old.remove();
const title=document.getElementById('ver-title');if(title)title.textContent=LABEL;
for(const sel of ['#lobby .lobby-card','#plan .sheet','#report .sheet']){const host=document.querySelector(sel);if(host&&!host.querySelector('.ver-line')){const p=document.createElement('p');p.className='ver-line';p.textContent=LABEL;host.append(p);}}