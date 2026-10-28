/* ui-polish v27.76: clima de hoy, agenda compacta con iconos, reseñas y una reseña por cliente. */
import { Game } from './state.js?v=27.6';
import { SEASON_DAYS, SPECIAL_DAYS, WEATHER } from './config.js?v=27.6';
const svgWrap=inner=>`<svg class="wicon" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
const SUN=svgWrap('<circle cx="12" cy="12" r="5" fill="#f5b82e"/><g stroke="#f5b82e" stroke-width="2" stroke-linecap="round"><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/></g>');
const CLOUD=svgWrap('<circle cx="9" cy="9" r="4" fill="#f5b82e"/><path d="M7 18h10a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.5A3.5 3.5 0 0 0 7 18z" fill="#cfd8dc"/>');
const HAZE=svgWrap('<circle cx="12" cy="8" r="4" fill="#e8b04a"/><path d="M3 15h18M5 18h14" stroke="#d9a24a" stroke-width="2" stroke-linecap="round"/>');
const WIND=svgWrap('<path d="M3 8h11a3 3 0 1 0-3-3M3 13h15a3 3 0 1 1-3 3M3 18h8" stroke="#7fb7c9" stroke-width="2" fill="none" stroke-linecap="round"/>');
const ICONS={sol:SUN,panza:CLOUD,calima:HAZE,viento:WIND};
const iconFor=w=>ICONS[w]||CLOUD;
const esc=t=>String(t==null?'':t).replace(/[&<>"']/g,c=>({'&':'&','<':'<','>':'>','"':'"',"'":'&#39;'}[c]));
const cap=s=>s?s[0].toUpperCase()+s.slice(1):'';
function weatherAt(d){const w=(Game.forecast&&Game.forecast[d])||'sol';return WEATHER[w]?w:'sol';}
function dayCard(d,i){
 const w=weatherAt(d),W=WEATHER[w]||{label:cap(w),desc:''};
 const ev=SPECIAL_DAYS[d];
 return `<div class="fc${i===0?' today':''}${ev?' event':''}"><div class="k">${i===0?'Hoy':'Día '+i}</div><div class="v">${iconFor(w)}<span>${esc(W.label)}</span></div><div class="d">${esc(ev?ev.title:(W.desc||''))}</div></div>`;
}
function agenda(){
 const fc=document.getElementById('forecast');
 if(!fc||Game.mode!=='plan')return;
 let html=dayCard(Game.day,0);
 html+='<p class="agenda-title">Agenda</p><div class="agenda">';
 for(let i=0;i<7;i++){const d=Game.day+i;if(d>SEASON_DAYS)break;html+=dayCard(d,i);}
 html+='</div>';
 if(fc.dataset.polish!==html){fc.dataset.polish=html;fc.innerHTML=html;}
}
function norm(s){return String(s||'').toLowerCase().replace(/\s+/g,' ').trim();}
function starCount(card){const el=card.querySelector('.rev-head span');if(!el)return 0;const m=el.textContent.match(/★|☆/g)||[];return m.filter(c=>c==='★').length;}
function polishReviews(){
 const rep=document.getElementById('rep-body');
 if(!rep||Game.mode!=='report')return;
 const seen=new Set();
 const cards=[...rep.querySelectorAll('.review')];
 cards.forEach(card=>{
  const txt=card.querySelector('.rev-text');
  const starsEl=card.querySelector('.rev-head span');
  if(starsEl&&!starsEl.dataset.polished){const filled=starCount(card);starsEl.dataset.polished='1';starsEl.innerHTML=`<span class="stars"><b>${'★'.repeat(filled)}</b><span>${'☆'.repeat(5-filled)}</span></span>`;}
  card.querySelectorAll('.net-actions .btn').forEach(b=>{const t=b.textContent||'';if(t.includes('Disculparte'))b.classList.add('primary');else if(t.includes('Invitar'))b.classList.add('teal');});
  const nameEl=card.querySelector('.rev-head b');
  const name=norm(nameEl?nameEl.textContent:'');
  if(name&&seen.has(name)){card.classList.add('dup');}else{if(name)seen.add(name);card.classList.remove('dup');}
 });
 const visible=cards.filter(c=>!c.classList.contains('dup'));
 visible.forEach((c,i)=>c.classList.toggle('extra',i>=3&&!rep.classList.contains('show-all')));
 const wrap=rep.querySelector('.reviews');
 if(!wrap)return;
 let summary=wrap.querySelector('.rev-summary');
 if(visible.length){
  const total=visible.reduce((a,c)=>a+starCount(c),0);
  const avg=visible.length?total/visible.length:0;
  const pos=visible.filter(c=>starCount(c)>=4).length;
  const neu=visible.filter(c=>starCount(c)===3).length;
  const neg=visible.filter(c=>starCount(c)<=2).length;
  const html=`<div class="rev-summary"><div><span class="k">Valoración media</span><b>${avg.toFixed(1)} ★</b></div><div><span class="k">Reseñas</span><b>${visible.length}</b></div><div><span class="k">Reparto</span><b>${pos} positivas · ${neu} neutras · ${neg} negativas</b></div></div>`;
  if(!summary){wrap.insertAdjacentHTML('afterbegin',html);summary=wrap.querySelector('.rev-summary');}
  else summary.outerHTML=html;
 } else if(summary)summary.remove();
 let btn=rep.querySelector('#btn-all-reviews');
 if(visible.length>3){
  if(!btn){btn=document.createElement('button');btn.id='btn-all-reviews';btn.className='btn text';btn.type='button';btn.addEventListener('click',()=>rep.classList.toggle('show-all'));wrap.after(btn);}
  btn.textContent=rep.classList.contains('show-all')?'Mostrar menos comentarios':`Ver todos los comentarios (${visible.length})`;
 } else if(btn)btn.remove();
}
const CSS=`
.fc .wicon{width:18px;height:18px;flex:none}
.fc .v{display:flex;align-items:center;gap:6px}
.fc.today{background:#e6f4f2;border-color:#9fd4cf}
.agenda-title{margin:10px 0 6px;font-size:10.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--teal)}
.agenda{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px}
.agenda .fc{width:auto;flex:none}
.review.extra{display:none}
#rep-body.show-all .review.extra{display:block}
#btn-all-reviews{margin:0 24px 14px;display:inline-block}
.rev-summary{display:flex;flex-wrap:wrap;gap:14px;align-items:center;background:var(--sand);border:1px solid var(--line);border-radius:16px;padding:12px 14px;margin:0 0 12px}
.rev-summary .k{display:block;font-size:10.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--teal)}
.rev-summary b{font:700 18px/1.2 var(--font-d);color:var(--ink)}
.review{background:var(--sand);border:1px solid var(--line);border-radius:16px;padding:14px;min-width:0}
.review.dup{display:none}
.rev-head{display:flex;justify-content:space-between;align-items:center;gap:10px}
.rev-text{margin:8px 0 10px;color:var(--ink);line-height:1.5;overflow-wrap:anywhere}
.stars b{color:#f5b82e;font-weight:400}.stars span{color:#d8cbb2;font-weight:400}
.net-actions{display:flex;gap:8px;flex-wrap:wrap}
.net-actions .btn.primary{background:linear-gradient(180deg,#ee6d49,var(--coral));border-color:var(--coral-d);color:#fff}
.net-actions .btn.teal{background:var(--teal);border-color:var(--teal-d);color:#fff}
`;
function injectCss(){if(document.getElementById('ui-polish-css'))return;const s=document.createElement('style');s.id='ui-polish-css';s.textContent=CSS;document.head.append(s);}
injectCss();
setInterval(()=>{agenda();polishReviews();},400);
