export const VERSION='v31.0.0';
export const LABEL='v31.0.0 · el imperio: locales de marca fuera de la playa (El Médano, Los Cristianos) que ingresan cada noche según tu reputación, con su línea en el informe y su sección en el plan · más allá: momento de reforma con obreros, semáforos de cola y capacidad visible (v30.1–v30.2)';
document.documentElement.dataset.version=VERSION;
const old=document.getElementById('version-badge');if(old)old.remove();
const title=document.getElementById('ver-title');if(title)title.textContent=LABEL;
for(const sel of ['#lobby .lobby-card','#plan .sheet','#report .sheet']){const host=document.querySelector(sel);if(host&&!host.querySelector('.ver-line')){const p=document.createElement('p');p.className='ver-line';p.textContent=LABEL;host.append(p);}}
