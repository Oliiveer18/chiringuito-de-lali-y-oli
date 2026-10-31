export const VERSION='v29.2.0';
export const LABEL='v29.2.0 · jornada honesta: clientes perdidos bien contados (solo quienes se van por mesa sucia), mesas siempre sucias tras comer, rutas directas entre mesas sin vueltas, inventario en raíl lateral que no estorba, camarero y cocinera visibles dentro del kiosco';
document.documentElement.dataset.version=VERSION;
const old=document.getElementById('version-badge');if(old)old.remove();
const title=document.getElementById('ver-title');if(title)title.textContent=LABEL;
for(const sel of ['#lobby .lobby-card','#plan .sheet','#report .sheet']){const host=document.querySelector(sel);if(host&&!host.querySelector('.ver-line')){const p=document.createElement('p');p.className='ver-line';p.textContent=LABEL;host.append(p);}}