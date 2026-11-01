import {trackCost} from './bookkeeping.js?v=30.0.0';
import {profile,factor,skillText,portrait,trainChoice,reconcileCalendar,photoComments,replyOptions,AUTHORS} from './professional-model.mjs?v=30.0.0';
import {weeklyPoints,dailyPoints} from './management-model.mjs?v=30.0.0';
import * as Rankings from './market-model.mjs?v=30.0.0';
import { Game, Net, staffOnDuty, simProgressDay, isWeekend } from './state.js?v=30.0.0';
import {STAFF,RENT} from './config.js?v=30.0.0';
import {Plan,toast,staffAvatar,refreshPlanMoney} from './ui.js?v=30.0.0';
import {netDirty} from './net.js?v=30.0.0';
import {guestSend,onGuestAction} from './coopbridge.js?v=30.0.0';
import {escapeHtml as E,eur} from './util.js?v=30.0.0';
import {candidates,hireCandidate,teamOf,dayEndEmployee,xpForLevel,MAX_LEVEL,expectedWage} from './management-model.mjs?v=30.0.0';
const day=()=>simProgressDay();
export function socialIdle(target,published){const u=Game.upgrades;if(target<1)return 0;if(!u.socialCalendar)u.socialCalendar={last:target-1,idle:Math.max(0,Math.min(Number(u.socialIdle)||0,target-1))};const c=u.socialCalendar;if(c.last>=target)return c.idle;return published?0:c.idle+1;}
export function markSocial(target,idle){if(target<1)return;Game.upgrades.socialCalendar={last:target,idle};Game.upgrades.socialIdle=idle;}
export function capturePhoto(post,cost,arr){const u=Game.upgrades,id=(u.career?.season||1)+':'+Game.day;const a=Array.isArray(u.chiringoArchive)?u.chiringoArchive:[];if(!a.some(r=>r.id===id))u.chiringoArchive=[...a,{id,season:u.career?.season||1,day:Game.day,post,cost,arr,metrics:null,comments:[],threadClosed:false}].slice(-60);}
export function closePhoto(){const u=Game.upgrades,id=(u.career?.season||1)+':'+Game.day,r=u.chiringoArchive?.find(r=>r.id===id);if(!r||r.threadClosed)return;const w=Game.forecast?.[Game.day-1];r.comments=photoComments(r,{stockOuts:Game.dayStats?.stockOuts,showDay:u.showDia,showFlojo:u.showFlojoDia===Game.day,poll:u.socialPoll,weather:w,stock:Game.stock});r.metrics=u.socialStats?{...u.socialStats}:null;r.threadClosed=true;}
export function photoThread(r){const comments=r.comments||[];return '<section class="photo-thread"><h4>Comentarios visibles · '+comments.length+'</h4><p class="muted">Las interacciones estimadas de la publicacion se muestran por separado. Compensar una queja cuesta 50 euros y permite una recuperacion por jornada de carrera: un seguidor pendiente al cierre y +0,05 de valoracion publica.</p>'+comments.map(c=>{const author=c.author||{id:'visitor-'+c.authorId,name:AUTHORS[Number(c.authorId)%AUTHORS.length]||'Visitante'};return '<article><img width="36" height="36" src="'+portrait(author)+'" alt=""><b>'+E(author.name)+'</b><p>'+E(c.text)+'</p>'+(c.reply?'<blockquote><b>'+E(Game.upgrades.kioskName||'El Charco Azul')+'</b><p>'+E(c.reply.text)+'</p></blockquote>':replyOptions(c).map(o=>'<button class="btn sm" data-manage="reply" data-id="'+E(r.id)+'" data-comment="'+E(c.id)+'" data-choice="'+o.id+'" '+(o.id==='compensate'&&Game.upgrades.compensationRewardDay===day()?'disabled':'')+'>'+E(o.label)+'</button>').join(''))+'</article>';}).join('')+(comments.length?'':'<p>Los comentarios apareceran al cerrar la jornada.</p>')+'</section>';}
function workforce(){const u=Game.upgrades,d=day();if(Net.role==='guest')return u.workforce||{team:{},applicants:[],priority:{camarero:'patience',limpiador:'oldest'}};if(!u.workforce){u.workforce={team:{},batch:-1,applicants:[],priority:{camarero:'patience',limpiador:'oldest'}};for(const s of STAFF)if(Game.staff[s.id])u.workforce.team[s.id]=[{id:'original-'+s.id,name:s.name,role:s.id,wage:s.wage,workMultiplier:1,training:0,hiredDay:d,level:1,xp:0,fatigue:0,happiness:0.7,lowDays:0}];}const w=u.workforce,b=Math.floor((d-1)/3);if(w.batch!==b){w.batch=b;w.applicants=candidates(u.career?.id||u.progression?.seed||u.kioskName||'charco',d);netDirty();}upgradeWorkforce(w);if(!u.floorRosterMigrated){for(const c of candidates(u.career?.id||u.progression?.seed||u.kioskName||'charco',d))if(c.role==='terraza'&&!w.applicants.some(a=>a.id===c.id))w.applicants.push(c);u.floorRosterMigrated=true;netDirty();}return w;}
const roleName=id=>({camarero:'Atención de cola',cocinero:'Preparación',limpiador:'Limpieza',terraza:'Servicio de terraza'})[id]||id;
function button(action,id,label){return '<button class="btn sm" data-manage="'+action+'" data-id="'+E(id)+'">'+E(label)+'</button>';}
function cvCard(c,current,openSlots=1){
 const age=c.age?c.age+' años':'Edad no registrada';
 const origin=c.origin?'De '+c.origin:'Origen no registrado';
 const exp=c.experienceLabel||(c.experience?c.experience+' años de experiencia':'Sin experiencia registrada');
 const avail=c.availability||'Disponibilidad no registrada';
 const pres=c.presentation||'';
 return '<article class="wf-card cv" data-candidate="'+E(c.id)+'"><div class="cv-head"><img class="cv-portrait" src="'+portrait(c)+'" alt="Retrato de '+E(c.name)+'"><div class="cv-head-text"><h4>'+E(c.name)+'</h4><p class="cv-origin">'+E(age)+' · '+E(origin)+'</p></div></div><div class="cv-fields"><div class="cv-section"><span class="k">Puesto</span><b>'+roleName(c.role)+'</b></div><div class="cv-section"><span class="k">Experiencia</span><b>'+E(exp)+'</b></div><div class="cv-section"><span class="k">Disponibilidad</span><b>'+E(avail)+'</b></div><div class="cv-section"><span class="k">Pretensión</span><b>'+eur(c.wage)+'/día</b></div></div>'+(pres?'<p class="cv-text">'+E(pres)+'</p>':'')+'<p class="cv-text">'+E(skillText(c))+'</p>'+'<p class="cv-meta">Vigente hasta la jornada '+c.expires+' de carrera.</p>'+(current&&current.length?'<p class="cv-meta">Plantilla actual del puesto: '+current.length+' (hueco '+(current.length<openSlots?'libre':'completo')+')</p>':'<p class="cv-meta">Puesto actualmente vacante.</p>')+'<footer class="cv-footer">'+button('hire',c.id,current?'Sustituir a '+current.name:'Contratar')+button('discard',c.id,'Descartar')+'</footer></article>';
}
function paint(){
  if(Game.mode!=='plan'||Plan.tab!=='personal')return;
  const w=workforce(),d=day();
  const flatTeam=Object.values(w.team).flatMap(v=>Array.isArray(v)?v:v?[v]:[]);const wage=flatTeam.reduce((n,e)=>n+(Game.staff[e.role]?e.wage:0),0);
  let h='<div class="workforce">';
  h+='<header class="wf-head"><h3>Tu equipo</h3></header>';
  h+='<section class="wf-summary" aria-label="Resumen económico"><p class="wf-summary-line">Sueldos activos: '+eur(wage)+'/día · Licencia y sueldos: '+eur(RENT+wage)+'/día. No hay pago inicial de contratación.</p>';
  if(Game.money<RENT+wage)h+='<p class="wf-warning">La caja actual no cubre esos gastos de cierre. La contratación no queda bloqueada.</p>';
  h+='</section>';
  h+='<section class="wf-team" aria-label="Plantilla"><div class="wf-grid">';
  const openSlots=role=>Math.min(3,1+(Game.upgrades.vestuarios||0));
  const bar=(v,color)=>'<span class="wf-bar" title="'+Math.round(v*100)+'%"><i style="width:'+Math.max(2,Math.round(v*100))+'%;background:'+color+'"></i></span>';
  for(const s of STAFF){
    const list=teamOf(w.team,s.id),open=openSlots(s.id);
    h+='<article class="wf-card wf-card-multi"><img src="'+(list[0]?portrait(list[0]):staffAvatar(s.id))+'" alt=""><div class="wf-card-body"><h4>'+E(list[0]?.name||'Puesto vacante')+'</h4><p class="wf-role">'+roleName(s.id)+' · Hueco'+(list.length===1?'':'s')+' '+list.length+'/'+open+(Game.upgrades.vestuarios?'':' (más con Vestuarios)')+'</p>';
    if(!list.length)h+='<p>'+E(s.desc)+'</p>';
    for(const e of list){
      if(e.dateUnknown)h+='<p class="wf-meta">Antigüedad anterior no registrada.</p>';
      const hap=e.happiness==null?0.7:e.happiness;
      const moodTxt=hap<0.35?'<b class="wf-bad">descontento</b>':hap>0.75?'contento':'normal';
      h+='<div class="wf-emp"><p class="wf-emp-name"><b>'+E(e.name)+'</b> · Nv '+(e.level||1)+'/10'+((e.level||1)<MAX_LEVEL?' <span class="wf-xp">'+(e.xp||0)+'/'+xpForLevel((e.level||1)+1)+' XP</span>':' · máximo')+'</p>';
      h+='<p>'+eur(e.wage)+'/día · '+(Game.upgrades['ausente_'+e.id]?'ausente hoy':e.availability==='Jornada completa'||!e.availability?'jornada completa':e.availability)+'</p>';
      h+='<p class="wf-bars">Cansancio '+bar(e.fatigue||0,'#c0392b')+' Ánimo '+bar(hap,'#e8a03c')+' <span>'+moodTxt+'</span></p>';
      h+='<p>Antigüedad: '+Math.max(1,d-e.hiredDay+1)+' jornada(s) · Formación '+(e.training||0)+'/2 · Trabajadas: '+(e.worked||0)+' · Ausencias: '+(e.absences||0)+'</p>';
      h+='<p>'+E(skillText(e))+'</p>';
      if(hap<0.35)h+='<p class="wf-warning">Está descontento: mejora su sueldo o su carga de trabajo o acabará renunciando.</p>';
      h+='<div class="wf-card-actions">'+button('dismiss',e.id,'Despedir');
      if((e.training||0)<2){
        h+=button('train',e.id,'Rapidez: reduce un 5% el tiempo · '+eur(100*((e.training||0)+1)));
        if(!['general','polivalente'].includes(e.specialty))h+=button('focus',e.id,'Especialidad: mejora su ventaja · '+eur(100*((e.training||0)+1)));
      }else h+='<span class="wf-meta">Formación completada.</span>';
      h+='</div></div>';
    }
    h+='</div></article>';
  }
  h+='</div></section>';
  h+='<section class="wf-settings" aria-label="Apoyo de terraza"><p>Apoyo de terraza del limpiador: '+(Game.upgrades.floorCleanerSupport?'activado cuando no hay mesas sucias':'desactivado')+'</p><button class="btn sm" data-floor-setting="support">Cambiar apoyo de terraza</button></section>';
  h+='<section class="wf-priorities" aria-label="Prioridades de trabajo"><h3>Prioridades de trabajo</h3>';
  h+='<div class="wf-priority-row"><p>Camarero: '+(w.priority.camarero==='arrival'?'orden de llegada':'menor paciencia primero')+'</p>'+button('priority','camarero','Cambiar prioridad')+'</div>';
  h+='<div class="wf-priority-row"><p>Limpieza: '+(w.priority.limpiador==='near'?'mesas cercanas a la barra':'mesa que lleva más tiempo sucia')+'</p>'+button('priority','limpiador','Cambiar prioridad')+'</div></section>';
  if(w.performance){
    h+='<section class="wf-performance" aria-label="Rendimiento reciente"><h3>Última jornada registrada · '+w.performance.day+'</h3><p>Clientes con intervención del camarero: '+w.performance.clients+' · Productos preparados con ayuda de cocina: '+w.performance.prepared+' · Mesas recogidas por el ayudante: '+w.performance.cleaned+'. No se atribuyen beneficios económicos estimados.</p></section>';
  }
  h+='<section class="wf-applicants" aria-label="Candidaturas"><h3>Candidaturas · '+w.applicants.length+'</h3><p class="wf-applicants-intro">Las candidaturas llegan poco a poco según la jornada y la marcha del chiringuito. Cada ficha incluye experiencia, disponibilidad y pretensión salarial.</p>';
  if(!w.applicants.length)h+='<p class="wf-empty">No hay candidaturas abiertas en este lote. Vuelve en unos días de carrera.</p>';
  else{h+='<div class="wf-grid">';for(const c of w.applicants){const list=teamOf(w.team,c.role);const open=Math.min(3,1+(Game.upgrades.vestuarios||0));h+=cvCard(c,list,open);}h+='</div>';}
  h+='</section></div>';
  const b=document.getElementById('tab-body');
  if(b&&b.innerHTML!==h)b.innerHTML=h;
}
function act(a){if(Net.role==='guest'||Game.mode!=='plan'||a.day!==day())return;const w=workforce();if(!a.requestId||typeof a.requestId!=='string'||a.requestId.length>128||(w.applied||[]).includes(a.requestId))return;const flat=()=>Object.values(w.team).flatMap(v=>Array.isArray(v)?v:v?[v]:[]);const target=a.action==='hire'?w.applicants.find(c=>c.id===a.id)?.role:a.id;if(['hire','train','focus','dismiss'].includes(a.action)){if(a.action==='hire'){if(teamOf(w.team,target).length!==(a.expectedCount|0))return;}else{const emp=flat().find(e=>e.id===a.id);if(!emp||emp.id!==a.expectedEmployee)return;if(['train','focus'].includes(a.action)&&(emp.training||0)!==a.expectedTraining)return;}}try{if(a.action==='hire'){const r=hireCandidate(w.team,w.applicants,a.id,day(),Math.min(3,1+(Game.upgrades.vestuarios||0)));w.team=r.team;w.applicants=r.applicants;const emp=Object.values(r.team).flatMap(v=>Array.isArray(v)?v:v?[v]:[]).find(e=>e.id===a.id);if(emp)Game.staff[emp.role]=true;}else if(a.action==='dismiss'){for(const role of Object.keys(w.team)){const arr=Array.isArray(w.team[role])?w.team[role]:w.team[role]?[w.team[role]]:[];const idx=arr.findIndex(e=>e.id===a.id);if(idx>=0){arr.splice(idx,1);w.team[role]=arr;Game.staff[role]=arr.length>0;break;}}}else if(a.action==='discard'){w.applicants=w.applicants.filter(c=>c.id!==a.id);}else if(a.action==='train'||a.action==='focus'){for(const role of Object.keys(w.team)){const arr=Array.isArray(w.team[role])?w.team[role]:w.team[role]?[w.team[role]]:[];const idx=arr.findIndex(e=>e.id===a.id);if(idx<0)continue;const r=trainChoice(arr[idx],Game.money,a.action==='focus'?'focus':'speed');arr[idx]=r.employee;w.team[role]=arr;Game.money=r.cash;trackCost(r.cost,'training',true);break;}}else if(a.action==='priority'){if(a.id==='camarero')w.priority.camarero=w.priority.camarero==='arrival'?'patience':'arrival';if(a.id==='limpiador')w.priority.limpiador=w.priority.limpiador==='near'?'oldest':'near';}else if(a.action==='reply'){const p=Game.upgrades.chiringoArchive?.find(p=>p.id===a.id),c=p?.comments?.find(c=>c.id===a.comment);if(!c||c.reply)return;const option=replyOptions(c).find(o=>o.id===a.choice);if(!option||Game.money<option.cost||(option.id==='compensate'&&Game.upgrades.compensationRewardDay===day()))return;Game.money-=option.cost;trackCost(option.cost,'compensations');if(option.id==='compensate'){Game.upgrades.compensationRewardDay=day();Game.upgrades.socialPend=Game.upgrades.socialPend||[];Game.upgrades.socialPend.push({k:'Atencion a una queja en publicacion',n:1});Game.upgrades.socialRating=Math.min(5,(Game.upgrades.socialRating||3)+.05);}c.reply={day:day(),text:option.text,kind:option.id,cost:option.cost};}else return;w.applied=[...(w.applied||[]),a.requestId].slice(-256);refreshPlanMoney();netDirty();paint();}catch(e){toast('No se ha realizado la acción',e.message,'bad');}}
onGuestAction('management',act);
document.addEventListener('workforce-paint',paint);
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-manage]');if(!b||b.disabled)return;e.preventDefault();e.stopImmediatePropagation();const w=Game.upgrades.workforce;const action=b.dataset.manage,id=b.dataset.id,target=action==='hire'?w?.applicants.find(c=>c.id===id)?.role:id;const wflat=Object.values(w?.team||{}).flatMap(v=>Array.isArray(v)?v:v?[v]:[]);const a={action,id,comment:b.dataset.comment||'',choice:b.dataset.choice||'',day:day(),requestId:crypto.randomUUID(),expectedEmployee:wflat.find(e=>e.id===id)?.id||'',expectedCount:target?teamOf(w?.team,target).length:0,expectedTraining:wflat.find(e=>e.id===id)?.training||0};if(Net.role==='guest')guestSend('management',a);else act(a);},true);
setInterval(()=>{if(!['plan','service','report'].includes(Game.mode))return;if(Net.role!=='guest'){const w=workforce();if(Game.mode==='plan'){for(const [role,list] of Object.entries(w.team)){const arr=Array.isArray(list)?list:list?[list]:[];if(arr.length&&!Game.upgrades['ausente_'+role])Game.staff[role]=true;if(!arr.length)Game.staff[role]=false;}const done=day()-1;if(!Game.upgrades.socialCalendar){const idle=Math.max(0,Math.min(Number(Game.upgrades.socialIdle)||0,done));Game.upgrades.socialCalendar={last:done,idle};Game.upgrades.socialIdle=idle;netDirty();}}if(Game.mode==='report'&&Game.dayStats&&w.performance?.day!==day()){const s=Game.dayStats;w.performance={day:day(),clients:s.staffClients||0,prepared:s.staffPrepared||0,cleaned:(()=>{let n=0;for(const role of ['limpiador'])for(const e of teamOf(w.team,role))n+=s.by?.[e.id]?.clean||0;return n;})()};netDirty();}}paint();},350);
export {act as applyManagementAction};
function upgradeWorkforce(w){const u=Game.upgrades;if(!u.professionalSchema){u.managementMigrationBackup={workforce:JSON.parse(JSON.stringify(w)),calendar:u.socialCalendar?{...u.socialCalendar}:null,idle:u.socialIdle};for(const e of Object.values(w.team))if(String(e.id).startsWith('original-'))e.dateUnknown=true;const completed=day()-(u.socialSettledAbs===day()?0:1),posts=(u.chiringoArchive||[]).map(r=>(r.season-1)*30+r.day).filter(d=>d<=completed),lastPost=Math.max(0,...posts);u.socialCalendar=reconcileCalendar(u.socialCalendar||{last:completed,idle:u.socialIdle},completed,lastPost);u.socialIdle=u.socialCalendar.idle;u.professionalSchema=1;netDirty();}w.applicants=w.applicants.map(profile);for(const key of Object.keys(w.team)){const v=w.team[key];const arr=Array.isArray(v)?v:v?[v]:[];w.team[key]=arr.map(e=>{const p=profile(e);p.level=Math.min(MAX_LEVEL,p.level||1);p.xp=p.xp||0;p.fatigue=p.fatigue||0;p.happiness=p.happiness==null?0.7:p.happiness;p.lowDays=p.lowDays||0;return p;});}}
setInterval(()=>{if(Net.role==='guest'||Game.mode!=='report'||!Game.dayStats||!Game.upgrades.workforce)return;const w=Game.upgrades.workforce,s=Game.dayStats;let changed=false,quits=[];
  /* v29.5: cierre de jornada de cada empleado: experiencia, ánimo y cansancio. */
  const ROLES_BASE={camarero:110,cocinero:130,limpiador:60,terraza:120};
  const served=s.served||0;
  for(const [role,list] of Object.entries(w.team)){
    const arr=Array.isArray(list)?list:list?[list]:[];
    const onDuty=arr.filter(e=>!Game.upgrades['ausente_'+e.id]&&(e.availability==='Fines de semana'?isWeekend(day()):true));
    const load=onDuty.length?served/(22*Math.max(1,onDuty.length)):null;
    const keep=[];
    for(const e of arr){
      if(e.lastAuditDay===day()){keep.push(e);continue;}
      e.lastAuditDay=day();
      const prod={items:s.by?.[e.id]?.items||0,clean:s.by?.[e.id]?.clean||0,orders:s.by?.[e.id]?.orders||0,escort:s.by?.[e.id]?.escort||0,delivered:s.by?.[e.id]?.delivered||0,load};
      const r=dayEndEmployee(e,ROLES_BASE[role]||100,prod);
      if(r.quit){quits.push(e.name);continue;}
      keep.push(r.employee);changed=true;
    }
    w.team[role]=keep;
    Game.staff[role]=keep.length>0;
  }
  if(quits.length){toast('Renuncia',quits.join(', ')+' ha dejado el chiringuito por descontento.','bad');}
  if(changed)netDirty();},400);
export function leaguePanel(p,area,tier,d){const w=weeklyPoints(p.history,d),playerTier=p.rivals.tiers[area],rows=Rankings.table(p.rivals,area,playerTier,p.history,p.kioskName,d),own=rows.find(r=>r.id==='player'),t=playerTier;let h='<section class="mk-card lg-weekpoints"><h3>Puntos de cada jornada</h3><div class="lg-wp-how"><p>Cada jornada vale hasta <b>100 puntos</b>, según cuatro cosas:</p><ul><li><i class="sw svc"></i><b>Servicio · 40</b> clientes atendidos</li><li><i class="sw rat"></i><b>Valoración · 25</b> nota media del día</li><li><i class="sw mar"></i><b>Margen · 20</b> beneficio por euro vendido</li><li><i class="sw com"></i><b>Comunidad · 15</b> seguidores en Chiringo</li></ul></div>';if(own&&t<2)h+='<p class="lg-ctx-line up">Al ascenso: '+(own.rank<=3?'estás dentro, con ventaja de '+(own.score-rows[3].score)+' pts sobre el 4.º':'te faltan '+Math.max(0,rows[2].score-own.score)+' pts para el 3.º')+'. Es provisional, no una garantía.</p>';if(own&&t>0)h+='<p class="lg-ctx-line down">Permanencia: '+(own.rank>7?'en puestos de descenso, a '+(rows[6].score-own.score)+' pts del 7.º':'+'+(own.score-rows[6].score)+' pts sobre el 7.º')+'.</p>';h+='<div class="lg-wp-rows">'+w.rows.map(r=>'<div class="lg-wp-row" title="Jornada '+r.day+' · Servicio '+r.parts.service.toFixed(1)+'/40 · Valoración '+r.parts.rating.toFixed(1)+'/25 · Margen '+r.parts.margin.toFixed(1)+'/20 · Comunidad '+r.parts.community.toFixed(1)+'/15"><span class="lg-wp-day">J'+r.day+'</span><span class="lg-wp-bar"><i class="svc" style="width:'+Math.min(40,r.parts.service)+'%"></i><i class="rat" style="width:'+Math.min(25,r.parts.rating)+'%"></i><i class="mar" style="width:'+Math.min(20,r.parts.margin)+'%"></i><i class="com" style="width:'+Math.min(15,r.parts.community)+'%"></i></span><span class="lg-wp-tot">'+r.total+'</span></div>').join('')+'</div><p class="lg-wp-sum">Total semanal: <b>'+w.total+'</b> puntos. Se redondea el total de cada jornada antes de sumar.</p>';const a=p.history.slice(-2);if(a.length===2){const prev=dailyPoints(a[0]).total,now=dailyPoints(a[1]).total;h+='<p class="lg-wp-diff '+(now>=prev?'up':'down')+'">Última jornada cerrada: '+now+' puntos ('+(now>=prev?'+':'')+(now-prev)+' respecto a la anterior).</p>';}h+='<p class="lg-wp-note">Si hay empate a puntos, gana quien más clientes haya atendido en la semana; después, la mejor valoración media.</p>';return h+'</section>';}
