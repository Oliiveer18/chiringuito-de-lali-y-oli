"""v25.1: correcciones tras la revision. Cada contexto debe existir exactamente una vez; no se escribe nada si algo falla."""
from pathlib import Path
files={}
def read(n):
    if n not in files: files[n]=Path(n).read_text(encoding='utf-8')
    return files[n]
def once(n,old,new):
    s=read(n)
    if s.count(old)!=1: raise RuntimeError(f'{n}: contexto esperado una vez, encontrado {s.count(old)}: {old[:80]}')
    files[n]=s.replace(old,new,1)

# Carrera: la cache comparaba solo el HTML y daba por pintada la pestana aunque el cuerpo tuviera el contenido de otra
once('career-ui.js',"  if (b.__cr === h && b.firstChild) return;","  if (b.__cr === h && b.firstElementChild && b.firstElementChild.classList.contains('cr')) return;")
once('career-ui.js',"  if (card.__cr === h && card.firstChild) return;","  if (card.__cr === h && card.querySelector('[data-cr]')) return;")
# Ligas: sin avisos repetitivos de NPC
once('market-ui.js','hay 29 kioscos NPC por ámbito','hay 29 kioscos rivales por ámbito')
once('market-ui.js','Los NPC realizan inversiones','Los rivales realizan inversiones')
# Textos coherentes con el nuevo modelo
once('report.js','reflejan solo a los clientes atendidos','reflejan solo a los clientes que dejaron estrellas')
once('v12.js',"+' seguidores al cierre · +'+Math.round(fx.arr*100)+'% de afluencia.'","+' seguidores esperados · +'+Math.round(fx.arr*100)+'% de afluencia hoy.'")
once('chiringo-ui.js',"' seguidores al cierre · +' + Math.round((u.socialArr","' seguidores esperados · +' + Math.round((u.socialArr")
# Versiones: v12 se comparte por URL, asi que las tres importaciones cambian a la vez
once('chiringo-ui.js',"'./v12.js?v=25'","'./v12.js?v=26'")
once('cierre-ui.js',"'./v12.js?v=25'","'./v12.js?v=26'")
once('game.js',"'./v12.js?v=25'","'./v12.js?v=26'")
once('game.js',"'./career-ui.js?v=2'","'./career-ui.js?v=3'")
once('game.js',"'./market-ui.js?v=23'","'./market-ui.js?v=25'")
once('game.js',"'./chiringo-ui.js?v=3'","'./chiringo-ui.js?v=4'")
once('game.js',"'./cierre-ui.js?v=2'","'./cierre-ui.js?v=3'")
once('index.html','game.js?v=25','game.js?v=26')
for n,d in files.items(): Path(n).write_text(d,encoding='utf-8')
print('v25.1 aplicada:',', '.join(sorted(files)))
