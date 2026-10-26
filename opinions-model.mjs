// Opiniones v25. Cada decision es determinista: la misma jornada y la misma visita dan siempre el mismo resultado.
const cap=(v,a,b)=>Math.max(a,Math.min(b,v));
export function hash32(t){let h=2166136261;for(let i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
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
