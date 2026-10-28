// Opiniones v27: curva progresiva y determinista; sin interfaz heredada.
const cap=(v,a,b)=>Math.max(a,Math.min(b,v));
export function hash32(t){let h=2166136261;for(let i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,16777616);}return h>>>0;}
const unit=(key,salt)=>hash32(key+'|'+salt)/4294967296;
export function decide(v,day,index,starsFn){
 if(!v||v.lost==='caro')return {rated:false,comment:false,stars:null};
 const stars=starsFn(v),key=[day,index,v.type||'',v.hour==null?'':v.hour,v.regular||''].join(':'),extreme=Math.abs(stars-3)/2;
 const growth=Math.min(Math.max(day,1),12)/12;
 const pRate=cap(0.05+0.10*growth+0.18*extreme+(v.regular?0.05:0)+(v.lost?0.08:0),0.03,0.35);
 if(unit(key,'rate')>=pRate)return {rated:false,comment:false,stars:null};
 return {rated:true,comment:unit(key,'comment')<cap(0.25+0.35*extreme,0.15,0.6),stars};
}
export function decideAll(visits,day,starsFn){
 const ops=visits.map((v,i)=>decide(v,day,i,starsFn));
 const maxReviews=3+Math.floor(Math.min(Math.max(day,1),12)/12*5);
 let n=0;
 return ops.map(o=>{
  if(o&&o.rated){
   if(n>=maxReviews)return {rated:false,comment:false,stars:null};
   n++;
  }
  return o;
 });
}
export function opinionCounts(s){
 const vs=s.visits||[],o=s.opinions||[];
 return {visitors:vs.length,served:vs.filter(v=>!v.lost).length,rated:o.filter(x=>x&&x.rated).length,comments:o.filter(x=>x&&x.rated&&x.comment).length};
}
export function publicRating(visits,opinions,starsFn){
 const st=[];visits.forEach((v,i)=>{if(opinions[i]&&opinions[i].rated)st.push(starsFn(v));});
 return {count:st.length,avg:st.length?st.reduce((a,b)=>a+b,0)/st.length:null};
}
