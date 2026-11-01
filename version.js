export const VERSION='v30.0.0';
export const LABEL='v30.0.0 · reformas del chiringuito: el edificio crece por niveles comprables solo con dinero (Palapa, Terraza techada con pérgola y guirnaldas, Escenario con conciertos), cola ampliada a 8 en dos filas y segunda cola por intención (Barra/Terraza), rótulo repintado a nombre de Lali y Oli';
document.documentElement.dataset.version=VERSION;
const old=document.getElementById('version-badge');if(old)old.remove();
const title=document.getElementById('ver-title');if(title)title.textContent=LABEL;
for(const sel of ['#lobby .lobby-card','#plan .sheet','#report .sheet']){const host=document.querySelector(sel);if(host&&!host.querySelector('.ver-line')){const p=document.createElement('p');p.className='ver-line';p.textContent=LABEL;host.append(p);}}
