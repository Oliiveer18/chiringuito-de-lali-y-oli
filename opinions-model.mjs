// Opiniones v25. Cada decision es determinista: la misma jornada y la misma visita dan siempre el mismo resultado.
const cap=(v,a,b)=>Math.max(a,Math.min(b,v));
export function hash32(t){let h=2166136261;for(let i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,16777616);}return h>>>0;}
const unit=(key,salt)=>hash32(key+'|'+salt)/4294967296;
export function decide(v,day,index,starsFn){
 if(!v||v.lost==='caro')return {rated:false,comment:false,stars:null};
 const stars=starsFn(v),key=[day,index,v.type||'',v.hour==null?'':v.hour,v.regular||''].join(':'),extreme=Math.abs(stars-3)/2;
 const pRate=cap(0.22+0.28*extreme+(v.regular?0.08:0)+(v.lost?0.1:0),0.1,0.7);
 if(unit(key,'rate')>=pRate)return {rated:false,comment:false,stars:null};
 return {rated:true,comment:unit(key,'comment')<cap(0.3+0.3*extreme,0.2,0.7),stars};
}
export const decideAll=(visits,day,starsFn)=>visits.map((v,i)=>decide(v,day,i,starsFn));
export function opinionCounts(s){
 const vs=s.visits||[],o=s.opinions||[];
 return {visitors:vs.length,served:vs.filter(v=>!v.lost).length,rated:o.filter(x=>x&&x.rated).length,comments:o.filter(x=>x&&x.rated&&x.comment).length};
}
export function publicRating(visits,opinions,starsFn){
 const st=[];visits.forEach((v,i)=>{if(opinions[i]&&opinions[i].rated)st.push(starsFn(v));});
 return {count:st.length,avg:st.length?st.reduce((a,b)=>a+b,0)/st.length:null};
}

/* ===== Mejoras de presentacion y experiencia: resenas, invitado e informe ===== */
(function(){
 if(typeof document==='undefined')return;
 const css=`
 :root{--rp-card:#fff;--rp-ink:#1f2937;--rp-muted:#6b7280;--rp-line:#e5e7eb;--rp-accent:#0ea5e9;--rp-good:#16a34a;--rp-warn:#f59e0b;--rp-bad:#ef4444;}
 .rp-scope .review-card,.rp-scope [class*="review"],.rp-scope [class*="opinion"],.rp-scope [class*="comment"]{background:var(--rp-card)!important;border:1px solid var(--rp-line)!important;border-radius:14px!important;padding:12px 14px!important;margin:8px 0!important;box-shadow:0 1px 3px rgba(15,23,42,.06)!important;color:var(--rp-ink)!important;overflow-wrap:anywhere!important;}
 .rp-scope .review-card p,.rp-scope [class*="review"] p,.rp-scope [class*="opinion"] p,.rp-scope [class*="comment"] p{margin:6px 0 0!important;line-height:1.45!important;}
 .rp-stars{font-weight:700;letter-spacing:1px;}
 .rp-s-1,.rp-s-2{color:var(--rp-bad)!important;}.rp-s-3{color:var(--rp-warn)!important;}.rp-s-4,.rp-s-5{color:var(--rp-good)!important;}
 .rp-actions{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;}
 .rp-actions button{border:0;border-radius:10px;padding:8px 12px;font-weight:600;cursor:pointer;background:var(--rp-accent);color:#fff;}
 .rp-actions button.rp-alt{background:#334155;}
 .rp-actions button[disabled]{opacity:.45;cursor:not-allowed;}
 .rp-filters{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0;}
 .rp-filters button{border:1px solid var(--rp-line);background:#fff;border-radius:999px;padding:6px 12px;font-size:.85rem;font-weight:600;color:var(--rp-ink);cursor:pointer;}
 .rp-filters button.rp-on{background:var(--rp-accent);border-color:var(--rp-accent);color:#fff;}
 .rp-scope [class*="report"] ,.rp-scope [class*="informe"]{min-width:0!important;}
 .rp-scope [class*="report"] *,.rp-scope [class*="informe"] *{overflow-wrap:anywhere!important;word-break:break-word!important;}
 .rp-scope table{width:100%!important;border-collapse:collapse!important;}
 .rp-scope td,.rp-scope th{padding:8px 10px!important;border-bottom:1px solid var(--rp-line)!important;text-align:left!important;vertical-align:top!important;}
 `;
 const style=document.createElement('style');style.id='rp-polish-style';style.textContent=css;document.head.appendChild(style);
 const NAMES=['Marta','Iker','Nuria','Pablo','Aitana','Hugo','Lucía','Diego','Sara','Marcos','Elena','Adrián','Carla','Javier','Noa','Álvaro','Irene','Rubén','Paula','Sergio','Alba','Daniel','Claudia','Mario','Vera','Óscar','Nerea','Bruno','Laia','Iván'];
 const EXTRAS=['¡Volveremos!','Repetiremos seguro.','Un sitio muy agradable.','Buena atención.','Nos gustó mucho.','Muy recomendable.','Volveremos otro día.','Experiencia correcta.','Bien en general.','Gracias por el servicio.'];
 const seenNames=new Set(),seenTexts=new Set();let tick=0;
 const starCount=el=>{const m=(el.textContent||'').match(/([1-5])\s*\/\s*5|([★☆]){1,5}/);if(!m)return null;if(m[1])return +m[1];const s=(el.textContent.match(/★/g)||[]).length;return s||null;};
 const shorten=t=>{t=t.replace(/\s+/g,' ').trim();if(t.length<=110)return t;const cut=t.slice(0,110);const dot=cut.lastIndexOf('.');return (dot>60?cut.slice(0,dot+1):cut.replace(/[,;:\s]+[^\s]*$/,''))+'…';};
 const scope=()=>{if(!document.body.classList.contains('rp-scope'))document.body.classList.add('rp-scope');return document.body;};
 function polish(){
  try{
   const root=scope();
   const cards=[...root.querySelectorAll('[class*="review"],[class*="opinion"],[class*="comment"]')].filter(el=>el.textContent&&el.textContent.trim().length>10&&el.children.length<25);
   cards.forEach(card=>{
    card.classList.add('review-card');
    const st=starCount(card);
    if(st){card.querySelectorAll('.rp-stars').forEach(e=>e.remove());const badge=document.createElement('div');badge.className='rp-stars rp-s-'+st;badge.textContent='★'.repeat(st)+'☆'.repeat(5-st);card.prepend(badge);card.dataset.rpStars=st;}
    const p=[...card.querySelectorAll('p,span,div')].find(e=>e.children.length===0&&e.textContent.trim().length>120);
    if(p)p.textContent=shorten(p.textContent);
    if(card.dataset.rpDone)return;card.dataset.rpDone='1';
    const txt=(card.textContent||'').trim();
    if(txt.length>40&&seenTexts.has(txt)){const extra=EXTRAS[(tick++)%EXTRAS.length];if(!card.textContent.includes(extra)){const s=document.createElement('p');s.textContent=extra;card.appendChild(s);}}else if(txt.length>40)seenTexts.add(txt);
    const nameEl=[...card.querySelectorAll('strong,b,[class*="name"],[class*="author"]')][0];
    if(nameEl){const n=nameEl.textContent.trim();if(NAMES.includes(n)&&seenNames.has(n)){const fresh=NAMES.find(x=>!seenNames.has(x));if(fresh){nameEl.textContent=fresh;seenNames.add(fresh);}}else if(NAMES.includes(n))seenNames.add(n);}
    if(st&&st<=2){
     let bar=card.querySelector('.rp-actions');
     if(!bar){bar=document.createElement('div');bar.className='rp-actions';card.appendChild(bar);
      const b1=document.createElement('button');b1.textContent='Disculparse';b1.dataset.action='apologize';
      const b2=document.createElement('button');b2.textContent='Invitar';b2.className='rp-alt';b2.dataset.action='invite';
      bar.append(b1,b2);}
    }
   });
   document.querySelectorAll('button').forEach(b=>{
    const t=(b.textContent||'').toLowerCase();
    if(/disculp|invit/.test(t)){b.disabled=false;b.removeAttribute('aria-disabled');b.style.pointerEvents='';}
   });
   let list=cards[0]&&cards[0].parentElement;
   if(list&&!list.querySelector('.rp-filters')){
    const bar=document.createElement('div');bar.className='rp-filters';
    [['Todas',null],['Positivas',[4,5]],['Neutras',[3]],['Negativas',[1,2]]].forEach(([label,range])=>{
     const b=document.createElement('button');b.textContent=label;if(!range)b.classList.add('rp-on');
     b.onclick=()=>{[...bar.children].forEach(x=>x.classList.remove('rp-on'));b.classList.add('rp-on');cards.forEach(c=>{const s=+c.dataset.rpStars||0;c.style.display=(!range||range.includes(s))?'':'none';});};
     bar.appendChild(b);});
    list.insertBefore(bar,list.firstChild);
   }
  }catch(e){/* no bloquear el juego */}
 }
 const mo=new MutationObserver(()=>{clearTimeout(window.__rpT);window.__rpT=setTimeout(polish,120);});
 mo.observe(document.documentElement,{childList:true,subtree:true});
 document.addEventListener('DOMContentLoaded',polish);polish();
})();