from pathlib import Path
import re

def patch(file,old,new):
 p=Path(file);t=p.read_text();assert old in t,(file,old[:90]);p.write_text(t.replace(old,new))
patch('v14.js','if(b.dataset.v14===h&&b.childElementCount)return;','if(b.innerHTML===h)return;')
patch('ui.js',"const b=$('#tab-body'); let h='';","const b=$('#tab-body'); let h=''; if(Plan.tab==='personal'){document.dispatchEvent(new Event('workforce-paint'));return;}")
patch('state.js','(Game.staff[st.id]?st.wage:0)','(Game.staff[st.id]?(Game.upgrades.workforce?.team?.[st.id]?.wage??st.wage):0)')
patch('state.js',"w==='yeray'?'Yeray'","w==='yeray'?(Game.upgrades.workforce?.team?.camarero?.name||'Yeray')")
patch('sim.js',"if(Game.staff.cocinero) t*=0.6;","if(Game.staff.cocinero) t*=0.6*(Game.upgrades.workforce?.team?.cocinero?.workMultiplier??1);")
patch('sim.js',"(slot.who==='yeray'?1.15:1)","(slot.who==='yeray'?1.15*(Game.upgrades.workforce?.team?.camarero?.workMultiplier??1):1)")
patch('sim.js','c.inPrep--; c.partT[slot.who]=Game.t;','if(Game.staff.cocinero)Game.dayStats.staffPrepared=(Game.dayStats.staffPrepared||0)+slot.items.length; c.inPrep--; c.partT[slot.who]=Game.t;')
patch('sim.js','Game.dayStats.served++;','Game.dayStats.served++; if(c.partT?.yeray!=null)Game.dayStats.staffClients=(Game.dayStats.staffClients||0)+1;')
patch('sim.js','.sort((a,b)=>a.patience-b.patience)',".sort((a,b)=>Game.upgrades.workforce?.priority?.camarero==='arrival'?(a.tQueue??a.id)-(b.tQueue??b.id):a.patience-b.patience)")
patch('sim.js',"for(const t of Game.tables){ if(t.state==='dirty'){ t.dirtyT+=dt; if(Game.staff.limpiador && t.dirtyT>3.2){ cleanTable(t,true,'acaymo'); } } }","for(const t of Game.tables)if(t.state==='dirty')t.dirtyT+=dt; if(Game.staff.limpiador){const q=Game.tables.filter(t=>t.state==='dirty').sort((a,b)=>Game.upgrades.workforce?.priority?.limpiador==='near'?a.x-b.x:b.dirtyT-a.dirtyT);const t=q[0];if(t&&t.dirtyT>3.2*(Game.upgrades.workforce?.team?.limpiador?.workMultiplier??1))cleanTable(t,true,'acaymo');}")
patch('sim.js',"const b=Game.dayStats.by[who||'p1']; if(b) b.clean++;","const key=who||'p1';const b=Game.dayStats.by[key]||(Game.dayStats.by[key]={items:0,rev:0,clean:0});b.clean++;")
p=Path('market-model.mjs');t=p.read_text();t="import {weeklyPoints} from './management-model.mjs?v=26.0';\n"+t
start=t.index('export function points(');end=t.index('export function migrate(',start)
t=t[:start]+"export function points(h,day=Math.max(1,...h.map(r=>r.day||0))){return weeklyPoints(h,day).total;}\n"+t[end:]
t=t.replace("name='El Charco Azul'){","name='El Charco Azul',day=s.last||1){").replace('points(playerHistory)','points(playerHistory,day)').replace('points(n.history)','points(n.history,day)').replace('if(day-state.reviewDay<7)return state;','if(day%7!==0||day<=state.reviewDay)return state;').replace('table(s,a,t,history,name)','table(s,a,t,history,name,day)').replace('rank:own.rank,day','rank:own.rank,score:own.score,day').replace('s.reviewDay=day;return s;','s.weeklyHistory=[...(s.weeklyHistory||[]),{day,results:s.results.map(r=>({...r}))}].slice(-104);s.reviewDay=day;return s;')
p.write_text(t)
p=Path('market-ui.js');t=p.read_text();old='const rows=R.table(s,area,tier,p.history,name());let h=';assert old in t
t=t.replace(old,"const rows=R.table(s,area,tier,p.history,name(),day());const summary='<div class=\"league-summary\">'+R.AREAS.map((label,a)=>{const r=R.table(s,a,s.tiers[a],p.history,name(),day()).find(r=>r.id==='player');return '<article>'+label+' · '+R.TIERS[s.tiers[a]]+'<strong>'+r.rank+'º de 10</strong>'+r.score+' puntos acumulados</article>';}).join('')+'</div><p>Semana '+(Math.floor((day()-1)/7)+1)+' · Jornada '+((day()-1)%7+1)+' de 7. Los puntos de hoy se suman al cerrar.</p>';let h=summary+")
t=t.replace('40 × valoración media + 0,12 × ventas medias + 0,08 × seguidores medios + clientes medios + nota media. Ventana máxima de 30 jornadas registradas.','Cada jornada suma hasta 100 puntos: servicio 40, valoración 25, margen 20 y comunidad 15. El total semanal empieza en cero; se suman las siete jornadas antes de resolver ascensos y descensos.')
t=t.replace("h+='<h4>Fajines</h4>'", "h+='<h4>Cierres semanales recientes</h4>'+(s.weeklyHistory||[]).slice(-8).reverse().map(w=>'<p>Jornada '+w.day+': '+w.results.map(r=>R.AREAS[r.area]+' '+R.TIERS[r.tier]+' · '+r.rank+'º · '+r.score+' puntos').join(' / ')+'</p>').join('');h+='<h4>Fajines</h4>'")
p.write_text(t)
p=Path('v12.js');t=p.read_text();t="import {socialIdle,markSocial,capturePhoto,closePhoto} from './management-ui.js?v=26.0';\nconst absSocial=()=>((Game.upgrades.career?.season||1)-1)*30+Game.day;\n"+t
old='const done=U.socialSettledDay===ayer&&U.socialReport&&U.socialReport.dia===ayer;';assert old in t
t=t.replace(old,'const done=absSocial()===1||(U.socialCalendar?.last>=absSocial()-1)||(U.socialSettledDay===ayer&&U.socialReport&&U.socialReport.dia===ayer);')
t=t.replace('const idle=p?0:(U.socialIdle||0)+1;','const idle=socialIdle(absSocial()-1,!!p);').replace('U[FOL]=S.total;U.socialIdle=idle;','U[FOL]=S.total;U.socialIdle=idle;markSocial(absSocial()-1,idle);').replace("if(Game.day>1)toast('Chiringo", "if(Game.day>1&&S)toast('Chiringo")
t=t.replace('if(U.socialSettledDay===Game.day&&U.socialReport&&U.socialReport.dia===Game.day)return U.socialReport;',"if(U.socialSettledAbs===absSocial()||(U.socialSettledAbs==null&&(U.career?.season||1)===1&&U.socialSettledDay===Game.day&&U.socialReport?.dia===Game.day))return U.socialReport;")
t=t.replace('const quiet=p?0:(U.socialIdle||0)+1,','const quiet=socialIdle(absSocial(),!!p),').replace('U[FOL]=S.total;U.socialIdle=quiet;','U[FOL]=S.total;U.socialIdle=quiet;markSocial(absSocial(),quiet);').replace('U.socialPend=[];U.socialSettledDay=day;','U.socialPend=[];U.socialSettledDay=day;U.socialSettledAbs=absSocial();closePhoto();')
t=t.replace('U.socialArr=fx.arr;addPend','U.socialArr=fx.arr;U.socialIdle=0;if(U.socialCalendar)U.socialCalendar.idle=0;capturePhoto(id,P.cost,fx.arr);addPend')
p.write_text(t)
p=Path('chiringo-ui.js');t=p.read_text();t="import {photoThread} from './management-ui.js?v=26.0';\n"+t
old="+ '</p></div></article>';";assert old in t;t=t.replace(old,"+ '</p></div>' + photoThread(r) + '</article>';")
t=t.replace('Comentarios y respuestas</div>','Reseñas generales y respuestas</div>');p.write_text(t)
p=Path('progression-ui.js');t=p.read_text();t="import {closeSocialDay} from './v12.js?v=26.0';\n"+t;t=t.replace("function close(){if(Net.role==='guest'||!Game.dayStats)return;","function close(){if(Net.role==='guest'||!Game.dayStats)return;closeSocialDay();");p.write_text(t)
for p in [*Path('.').glob('*.js'),*Path('.').glob('*.mjs')]:
 t=p.read_text();t=re.sub(r'\?v=\d+(?:\.\d+)*','?v=26.0',t);p.write_text(t)
p=Path('game.js');t=p.read_text();t=re.sub(r'v25\.\d+ · activas:', 'v26.0 · activas:',t);p.write_text(t)
p=Path('index.html');t=p.read_text();t=re.sub(r'game\.js\?v=[\d.]+','game.js?v=26.0',t);t=re.sub(r'v25\.\d+ · cargando','v26.0 · cargando',t);p.write_text(t)
