export const VERSION='v28.14.9';
export const LABEL='v28.14.9 · cooperativo a prueba de desconexiones: reintentos del invitado, sala del anfitrión autorreparable y kiosco centrado en Barra y cola';
document.documentElement.dataset.version=VERSION;
const old=document.getElementById('version-badge');if(old)old.remove();
const title=document.getElementById('ver-title');if(title)title.textContent=LABEL;
for(const sel of ['#lobby .lobby-card','#plan .sheet','#report .sheet']){const host=document.querySelector(sel);if(host&&!host.querySelector('.ver-line')){const p=document.createElement('p');p.className='ver-line';p.textContent=LABEL;host.append(p);}}
