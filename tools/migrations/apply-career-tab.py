"""Bloque 3 (pestana Carrera). Aplicacion controlada: cada contexto debe aparecer exactamente una vez."""
from pathlib import Path
files={}
def read(n):
    if n not in files: files[n]=Path(n).read_text()
    return files[n]
def once(n,old,new):
    s=read(n)
    if s.count(old)!=1: raise RuntimeError(f'{n}: contexto esperado una vez, encontrado {s.count(old)}')
    files[n]=s.replace(old,new,1)
once('ui.js',"  const b=$('#tab-body'); let h='';\n  if(Plan.tab==='compras'){",
"  const b=$('#tab-body'); let h='';\n  // Pestanas de otros modulos (p. ej. Carrera) pintan su propio contenido: no se borra en cada actualizacion de dinero o cooperativo.\n  if(!['compras','carta','mejoras','personal'].includes(Plan.tab)){ document.dispatchEvent(new Event('plan-tab-repaint')); return; }\n  if(Plan.tab==='compras'){")
once('career-ui.js',"for (const id of ['final-card', 'tab-body'])",
"document.addEventListener('plan-tab-repaint', () => { const c = Game.upgrades && Game.upgrades.career; if (c && c.obj) paintTab(c); });\nfor (const id of ['final-card', 'tab-body'])")
for n,d in files.items(): Path(n).write_text(d)
print('Bloque 3 aplicado:',', '.join(files))
