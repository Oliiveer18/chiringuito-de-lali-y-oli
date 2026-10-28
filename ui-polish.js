/* ui-polish v27.72: clima de hoy, agenda desplegable, reseñas sin duplicados y resumen profesional. */
import { Game } from './state.js?v=27.6';
import { SEASON_DAYS, SPECIAL_DAYS, WEATHER } from './config.js?v=27.6';

const svgWrap=(inner)=>`<svg class="wicon" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
const SUN=svgWrap('<circle cx="12" cy="12" r="5" fill="#f5b82e"/><g stroke="#f5b82e" stroke-width="2" stroke-linecap="round"><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/></g>');
const CLOUD=svgWrap('<circle cx="9" cy="9" r="4" fill="#f5b82e"/><path d="M7 18h10a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.5A3.5 3.5 0 0 0 7 18z" fill="#cfd8dc"/>');
const HAZE=svgWrap('<circle cx="12" cy="8" r="4" fill="#e8b04a"/><path d="M3 15h18M5 18h14" stroke="#d9a24a" stroke-width="2" stroke-linecap="round"/>');
const WIND=svgWrap('<path d="M3 8h11a3 3 0 1 0-3-3M3 13h15a3 3 0 1 1-3 3M3 18h8" stroke="#7fb7c9" stroke-width="2" fill="none" stroke-linecap="round"/>');
const RAIN=svgWrap('<path d="M7 15h10a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.5A3.5 3.5 0 0 0 7 15z" fill="#cfd8dc"/><g stroke="#5fa8d3" stroke-width="2" stroke-linecap="round"><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/></g>');
const ICON_ALIASES={
  sol:SUN,despejado:SUN,soleado:SUN,clear:SUN,
  panza:CLOUD,nubes:CLOUD,nublado:CLOUD,nuboso:CLOUD,cloudy:CLOUD,
  calima:HAZE,bochorno:HAZE,polvo:HAZE,
  viento:WIND,vientos:WIND,alisios:WIND,
  lluvia:RAIN,lluvioso:RAIN,agua:RAIN,rain:RAIN,
};
const iconFor=(w)=>ICON_ALIASES[w]||CLOUD;
const esc=t=>String(t==null?'':t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cap=s=>s?s[0].toUpperCase()+s.slice(1):'';
let agendaOpen=false;

function weatherAt(d){
  const w=(Game.forecast&&Game.forecast[d])||weatherFallback(d);
  return WEATHER[w]?w:'sol';
}
function weatherFallback(d){
  const keys=Object.keys(WEATHER);
  return keys.length?keys[Math.abs(d*7+3)%keys.length]:'sol';
}
function todayHtml(){
  const w=weatherAt(Game.day), W=WEATHER[w]||{label:cap(w),desc:''};
  const ev=SPECIAL_DAYS[Game.day];
  return `<div class="fc today"><div class="k">Hoy</div><div class="v">${iconFor(w)}<span>${esc(W.label)}</span></div><div class="d">${esc(W.desc||'')}${ev?` · ${esc(ev.title)}`:''}</div></div>`;
}
function agendaHtml(){
  let h='<div class="agenda">';
  for(let i=0;i<7;i++){
    const d=Game.day+i;
    if(d>SEASON_DAYS) break;
    const w=weatherAt(d), W=WEATHER[w]||{label:cap(w),desc:''};
    const ev=SPECIAL_DAYS[d];
    h+=`<div class="fc${i===0?' today':''}${ev?' event':''}"><div class="k">${i===0?'Hoy':'Día '+i}</div><div class="v">${iconFor(w)}<span>${esc(W.label)}</span></div><div class="d">${esc(ev?ev.title:(W.desc||''))}</div></div>`;
  }
  return h+'</div>';
}
function agenda(){
  const fc=document.getElementById('forecast');
  if(!fc||Game.mode!=='plan') return;
  const html=todayHtml()+`<button id="btn-agenda" class="btn text agenda-toggle" type="button">${agendaOpen?'Ocultar agenda':'Agenda de 7 días'}</button><div id="agenda-box" class="agenda-box${agendaOpen?' open':''}">${agendaOpen?agendaHtml():''}</div>`;
  if(fc.dataset.polish!==html){ fc.dataset.polish=html; fc.innerHTML=html; }
  const b=document.getElementById('btn-agenda');
  if(b&&!b.dataset.bound){ b.dataset.bound='1'; b.addEventListener('click',()=>{agendaOpen=!agendaOpen;fc.dataset.polish='';agenda();}); }
}
function norm(s){ return String(s||'').toLowerCase().replace(/\s+/g,' ').trim(); }
function polishReviews(){
  const rep=document.getElementById('rep-body');
  if(!rep||Game.mode!=='report') return;
  const seen=new Set();
  const cards=[...rep.querySelectorAll('.review')];
  cards.forEach(card=>{
    const txt=card.querySelector('.rev-text');
    const starsEl=card.querySelector('.rev-head span');
    if(starsEl&&!starsEl.dataset.polished){
      const m=(starsEl.textContent.match(/★|☆/g)||[]);
      const filled=m.filter(c=>c==='★').length;
      starsEl.dataset.polished='1';
      starsEl.innerHTML=`<span class="stars"><b>${'★'.repeat(filled)}</b><span>${'☆'.repeat(5-filled)}</span></span>`;
    }
    card.querySelectorAll('.net-actions .btn').forEach(b=>{
      const t=b.textContent||'';
      if(t.includes('Disculparte')) b.classList.add('primary');
      else if(t.includes('Invitar')) b.classList.add('teal');
    });
    const name=card.querySelector('.rev-head b');
    const key=norm((name?name.textContent:'')+'|'+(starsEl?starsEl.textContent:'')+'|'+(txt?txt.textContent.slice(0,80):''));
    if(seen.has(key)){ card.classList.add('dup'); } else { seen.add(key); card.classList.remove('dup'); }
  });
  const visible=cards.filter(c=>!c.classList.contains('dup'));
  visible.forEach((c,i)=>c.classList.toggle('extra',i>=3&&!rep.classList.contains('show-all')));
  const wrap=rep.querySelector('.reviews');
  if(!wrap) return;
  let btn=rep.querySelector('#btn-all-reviews');
  if(visible.length>3){
    if(!btn){
      btn=document.createElement('button');
      btn.id='btn-all-reviews'; btn.className='btn text'; btn.type='button';
      btn.addEventListener('click',()=>rep.classList.toggle('show-all'));
      wrap.after(btn);
    }
    const hidden=visible.length-3;
    btn.textContent=rep.classList.contains('show-all')?'Mostrar menos comentarios':`Ver todos los comentarios (${visible.length})`;
    btn.dataset.hidden=hidden;
  } else if(btn) btn.remove();
}
const CSS=`
.agenda-box{display:none;padding:0 24px 14px}
.agenda-box.open{display:block}
.agenda{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:10px}
.agenda .fc{width:auto;flex:none}
.fc .wicon{width:24px;height:24px;flex:none}
.fc .v{display:flex;align-items:center;gap:8px}
.fc.today{background:#e6f4f2;border-color:#9fd4cf}
.agenda-toggle{margin:6px 24px 10px;display:inline-block}
.review.extra{display:none}
#rep-body.show-all .review.extra{display:block}
#btn-all-reviews{margin:0 24px 14px;display:inline-block}
.info-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;padding:14px 24px}
.info-card{background:var(--sand);border:1px solid var(--line);border-radius:16px;padding:14px;min-width:0}
.info-card .k{font-size:10.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--teal)}
.info-card .v{font:600 18px/1.25 var(--font-d);margin:4px 0;color:var(--ink);overflow-wrap:anywhere}
.info-card .d{font-size:12.5px;color:var(--ink-2);line-height:1.45;overflow-wrap:anywhere}
.info-section{padding:0 24px 8px}
.reviews-grid{display:grid;gap:12px;padding:0 24px 12px}
.review{background:var(--sand);border:1px solid var(--line);border-radius:16px;padding:14px;min-width:0}
.review.dup{display:none}
.rev-head{display:flex;justify-content:space-between;align-items:center;gap:10px}
.rev-text{margin:8px 0 10px;color:var(--ink);line-height:1.5;overflow-wrap:anywhere}
.stars b{color:#f5b82e;font-weight:400}.stars span{color:#d8cbb2;font-weight:400}
.net-actions{display:flex;gap:8px;flex-wrap:wrap}
.net-actions .btn.primary{background:linear-gradient(180deg,#ee6d49,var(--coral));border-color:var(--coral-d);color:#fff}
.net-actions .btn.teal{background:var(--teal);border-color:var(--teal-d);color:#fff}
`;
function injectCss(){
  if(document.getElementById('ui-polish-css')) return;
  const s=document.createElement('style');
  s.id='ui-polish-css'; s.textContent=CSS;
  document.head.append(s);
}
injectCss();
setInterval(()=>{agenda();polishReviews();},400);
