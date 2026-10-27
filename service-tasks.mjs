const TYPES=new Set(['clean','escort','takeOrder','pickup','deliver']);
const ACTIVE=new Set(['queued','walking','working','blocked']);
const number=(x,name)=>{if(!Number.isFinite(x)||x<0)throw Error('Invalid '+name);return x;};
const clone=x=>JSON.parse(JSON.stringify(x));
export function createService(id,actors,tables){
 if(!id||new Set(actors.map(a=>a.id)).size!==actors.length||new Set(tables.map(t=>t.id)).size!==tables.length)throw Error('Invalid identities');
 for(const a of actors){number(a.x,'x');number(a.y,'y');if(!Number.isFinite(a.speed)||!(a.speed>0))throw Error('Invalid speed');}
 return {id:String(id),sequence:0,time:0,actors:clone(actors).map(a=>({...a,task:null,completed:0})),tables:clone(tables).map(t=>({...t,generation:t.generation||0,claim:null})),tasks:[],tickets:[],events:[]};
}
export function markDirty(s,id){const t=s.tables.find(t=>t.id===id);if(!t||t.claim||t.state==='busy'||t.state==='reserved')return false;t.state='dirty';t.generation++;return true;}
export function requestTask(s,{kind,target,requestedBy=null,legs,priority=0}){
 if(!TYPES.has(kind)||!Array.isArray(legs)||!legs.length)throw Error('Invalid task');
 if(requestedBy&&!s.actors.some(a=>a.id===requestedBy&&a.player))throw Error('Invalid requester');
 for(const l of legs){number(l.x,'target x');number(l.y,'target y');number(l.duration||0,'duration');}
 const table=['clean','escort'].includes(kind)?s.tables.find(t=>t.id===target):null;
 if(kind==='clean'&&(!table||table.state!=='dirty'))return null;
 const old=s.tasks.find(t=>t.kind===kind&&t.target===target&&ACTIVE.has(t.state));
 if(old){if(kind==='clean'){if(old.requestedBy&&requestedBy&&old.requestedBy!==requestedBy)return null;if(old.state!=='queued')return !requestedBy||old.actor===requestedBy?old.id:null;}if(requestedBy){old.requestedBy=requestedBy;old.priority=Math.max(old.priority,100);}return old.id;}
 if(kind==='escort'&&(!table||table.state!=='free'||table.claim))return null;
 const id=s.id+':task:'+ ++s.sequence;
 if(kind==='escort'){table.state='reserved';table.claim=id;}
 s.tasks.push({id,kind,target,requestedBy,legs:clone(legs),leg:0,state:'queued',created:s.time,priority:requestedBy?Math.max(100,priority):priority,actor:null,progress:0,path:[],reason:null});return id;
}
function release(s,t){const a=s.actors.find(a=>a.id===t.actor);if(a?.task===t.id)a.task=null;const table=s.tables.find(x=>x.id===t.target);if(table?.claim===t.id){table.claim=null;if(t.kind==='escort'&&table.state==='reserved')table.state='free';}}
export function cancelTask(s,id){const t=s.tasks.find(t=>t.id===id);if(!t||!ACTIVE.has(t.state))return false;release(s,t);t.state='cancelled';s.events.push({id:t.id+':cancel',task:t.id,type:'cancelled'});return true;}
function eligible(a,t){if(t.kind==='clean'&&t.requestedBy&&a.id!==t.requestedBy)return false;if(a.task||a.busy||!a.can?.includes(t.kind))return false;if(a.player)return t.requestedBy===a.id;return !!t.requestedBy||a.auto?.includes(t.kind);}
export function assignTasks(s,planPath){
 const queue=s.tasks.filter(t=>t.state==='queued').sort((a,b)=>(b.priority+(s.time-b.created)*2)-(a.priority+(s.time-a.created)*2)||a.created-b.created||a.id.localeCompare(b.id));
 for(const t of queue){if(t.kind==='clean'&&s.tables.find(x=>x.id===t.target)?.state!=='dirty'){cancelTask(s,t.id);continue;}
  const possible=s.actors.filter(a=>eligible(a,t)).sort((a,b)=>Number(b.id===t.requestedBy)-Number(a.id===t.requestedBy)||Math.hypot(a.x-t.legs[0].x,a.y-t.legs[0].y)-Math.hypot(b.x-t.legs[0].x,b.y-t.legs[0].y)||a.id.localeCompare(b.id));
  for(const a of possible){
   const path=planPath(a,t.legs[0],t);
   if(!Array.isArray(path)||!path.length||path.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.y<0))continue;
   const table=t.kind==='clean'?s.tables.find(x=>x.id===t.target):null;if(table&&table.claim&&table.claim!==t.id)break;
   if(table)table.claim=t.id;
   t.actor=a.id;a.task=t.id;t.state='walking';t.path=clone(path);t.reason=null;break;
  }
  if(t.state==='queued')t.reason=possible.length?'no-route':'no-available-worker';
 }
}
function complete(s,t){
 if(t.state==='done')return;const a=s.actors.find(a=>a.id===t.actor),table=s.tables.find(x=>x.id===t.target);
 if(t.kind==='clean'&&table?.claim===t.id&&table.state==='dirty'){table.state='free';table.claim=null;}
 if(t.kind==='escort'&&table?.claim===t.id){table.state='busy';table.claim=null;}
 if(a){a.completed++;if(a.task===t.id)a.task=null;}t.state='done';s.events.push({id:t.id+':complete',task:t.id,type:'completed',kind:t.kind,target:t.target,actor:t.actor});
}
export function stepTasks(s,dt,planPath){
 number(dt,'dt');if(dt===0)return;s.time+=dt;assignTasks(s,planPath);
 for(const t of s.tasks.filter(t=>t.state==='walking'||t.state==='working'||t.state==='blocked')){
  const a=s.actors.find(a=>a.id===t.actor);if(!a||a.task!==t.id){cancelTask(s,t.id);continue;}
  if(t.state==='blocked'){const p=planPath(a,t.legs[t.leg],t);if(!Array.isArray(p)||!p.length)continue;t.path=clone(p);t.state='walking';t.reason=null;}let remaining=dt,guard=0;
  while(remaining>0&&ACTIVE.has(t.state)&&guard++<10000){
   if(t.state==='walking'){
    const p=t.path[0];if(!p){t.state='working';continue;}
    const dx=p.x-a.x,dy=p.y-a.y,d=Math.hypot(dx,dy);
    if(d<.001){a.x=p.x;a.y=p.y;t.path.shift();continue;}
    const used=Math.min(remaining,d/a.speed);a.x+=dx/d*a.speed*used;a.y+=dy/d*a.speed*used;remaining-=used;if(used>=d/a.speed)t.path.shift();
   }else{
    const leg=t.legs[t.leg],duration=leg.duration||0,used=Math.min(remaining,Math.max(0,duration-t.progress));t.progress+=used;remaining-=used;
    if(t.progress<duration)break;
    s.events.push({id:t.id+':leg:'+t.leg,task:t.id,type:'leg-completed',leg:t.leg,actor:t.actor});t.leg++;t.progress=0;
    if(t.leg>=t.legs.length){complete(s,t);break;}
    const path=planPath(a,t.legs[t.leg],t);
    if(!Array.isArray(path)||!path.length){t.reason='route-blocked';t.state='blocked';break;}
    t.path=clone(path);t.state='walking';
   }
  }
 }
}
export function openTicket(s,{id,customer,table,lines,prices}){
 const old=s.tickets.find(t=>t.id===id);if(old)return old;
 const seat=s.tables.find(t=>t.id===table);if(!id||!customer||!seat||seat.state!=='busy'||s.tickets.some(t=>t.customer===customer&&!t.cancelled))throw Error('Invalid ticket assignment');
 if(!Array.isArray(lines)||!lines.length)throw Error('Empty order');
 const items=lines.map((item,i)=>({id:id+':'+i,item,price:number(prices[item],'price'),state:'pending',worker:null}));
 const t={id,customer,table,items,paid:false,cancelled:false,amount:0};s.tickets.push(t);return t;
}
export function beginItem(s,ticketId,lineId,stock,worker){
 const t=s.tickets.find(t=>t.id===ticketId),line=t?.items.find(l=>l.id===lineId);
 if(!t||t.cancelled||t.paid||!line||line.state!=='pending'||!worker||!Number.isFinite(stock[line.item])||stock[line.item]<1)return false;
 stock[line.item]--;line.state='preparing';line.worker=worker;return true;
}
export function finishItem(s,ticketId,lineId,worker){const t=s.tickets.find(t=>t.id===ticketId),line=t?.items.find(l=>l.id===lineId);if(!t||t.cancelled||!line||line.state!=='preparing'||line.worker!==worker)return false;line.state='ready';return true;}
export function deliverTicket(s,ticketId){
 const t=s.tickets.find(t=>t.id===ticketId);if(!t||t.cancelled||t.paid||t.items.some(l=>!['ready','omitted'].includes(l.state))||!t.items.some(l=>l.state==='ready'))return null;
 t.paid=true;t.amount=t.items.filter(l=>l.state==='ready').reduce((n,l)=>n+l.price,0);s.events.push({id:t.id+':payment',type:'payment',ticket:t.id,amount:t.amount});return {ticket:t.id,amount:t.amount};
}
export function cancelTicket(s,id){const t=s.tickets.find(t=>t.id===id);if(!t||t.paid||t.cancelled)return false;t.cancelled=true;s.events.push({id:t.id+':cancel',type:'ticket-cancelled',ticket:t.id,consumed:t.items.filter(l=>l.state!=='pending').map(l=>l.item)});return true;}
