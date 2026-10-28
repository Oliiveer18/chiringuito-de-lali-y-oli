import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createService,requestTask,assignTasks,stepTasks,stepHome} from './service-tasks.mjs';

// Regresión: el retorno a casa tras limpiar debe ser gradual (nunca un salto).
// El bug original usaba `left=use` en el bucle de moveHome: consumía todo el
// recorrido en una sola llamada y el actor se teletransportaba de la mesa al kiosco.
test('vuelta a casa caminando, sin teletransporte (stepHome)',()=>{
  const home={x:520,y:560};
  const a={x:100,y:200,home,speed:110,returning:true,returnPath:[]};
  const plan=(act,p)=>[{x:p.x,y:p.y}];
  let steps=0;
  while(a.returning&&steps<500){
    const px=a.x,py=a.y;
    stepHome(a,0.5,plan);
    const d=Math.hypot(a.x-px,a.y-py);
    assert.ok(d<=110*0.5+1e-6,`salto de ${d.toFixed(1)}px en un paso de 0.5s`);
    steps++;
  }
  assert.ok(steps>1,'debería necesitar varios pasos, no uno solo');
  assert.ok(!a.returning,'debe llegar a casa');
  assert.equal(a.x,home.x);assert.equal(a.y,home.y);
});

test('stepHome asienta la posición al llegar cerca',()=>{
  const a={x:518,y:559,home:{x:520,y:560},speed:110,returning:true,returnPath:[]};
  stepHome(a,0.1,()=>[]);
  assert.equal(a.x,520);assert.equal(a.y,560);assert.equal(a.returning,false);
});

// Limpieza manual del usuario (p1): camina hasta la mesa sin saltos,
// trabaja, libera la mesa y completa la tarea.
test('limpieza manual del usuario (p1): camino acotado y mesa liberada',()=>{
  const s=createService('t',[{id:'p1',player:true,x:100,y:200,speed:110,can:['clean'],auto:[]}],[{id:'table0',state:'dirty'}]);
  const id=requestTask(s,{kind:'clean',target:'table0',requestedBy:'p1',legs:[{x:400,y:400,duration:1.8}]});
  assert.ok(id,'la tarea debe registrarse');
  assignTasks(s,(a,p)=>[{x:p.x,y:p.y}]);
  const t=s.tasks.find(x=>x.id===id);
  assert.equal(t.actor,'p1');assert.equal(t.state,'walking');
  const p1=s.actors[0];
  let guard=0;
  while(t.state!=='done'&&guard++<5000){
    const px=p1.x,py=p1.y;
    stepTasks(s,0.05,(a,p)=>[{x:p.x,y:p.y}]);
    const d=Math.hypot(p1.x-px,p1.y-py);
    assert.ok(d<=110*0.05+1e-6,`salto de ${d.toFixed(1)}px mientras caminaba`);
  }
  assert.equal(t.state,'done','la tarea debe completarse');
  assert.equal(s.tables[0].state,'free','la mesa debe quedar limpia');
  assert.equal(s.tables[0].claim,null);
  assert.equal(p1.task,null);
});

// Limpieza automática: sin solicitante, la toma el trabajador con auto:['clean'].
test('limpieza automática la toma el trabajador, no el usuario',()=>{
  const s=createService('t',[
    {id:'p1',player:true,x:100,y:200,speed:110,can:['clean'],auto:[]},
    {id:'acaymo',player:false,x:200,y:300,speed:110,can:['clean'],auto:['clean']},
  ],[{id:'table0',state:'dirty'}]);
  const id=requestTask(s,{kind:'clean',target:'table0',requestedBy:null,legs:[{x:400,y:400,duration:1.8}]});
  assignTasks(s,(a,p)=>[{x:p.x,y:p.y}]);
  assert.equal(s.tasks.find(x=>x.id===id).actor,'acaymo');
  let guard=0;const t=s.tasks.find(x=>x.id===id);
  while(t.state!=='done'&&guard++<5000)stepTasks(s,0.05,(a,p)=>[{x:p.x,y:p.y}]);
  assert.equal(s.tables[0].state,'free');
});

// Encadenado propio del usuario, ejecutado: termina la primera limpieza, pide la
// segunda mientras "vuelve a casa", el juego interrumpe el retorno (como hace
// updateFloor), limpia la segunda mesa y solo entonces vuelve caminando a casa.
test('limpieza encadenada del usuario ejecutada de principio a fin',()=>{
  const s=createService('t',[{id:'p1',player:true,x:400,y:400,speed:110,can:['clean'],auto:[]}],
    [{id:'table0',state:'dirty'},{id:'table1',state:'dirty'}]);
  const p1=s.actors[0];
  const plan=(a,p)=>[{x:p.x,y:p.y}];
  const walkUntil=(task,until,guard=5000)=>{let g=0;while(!until(task)&&g++<guard)stepTasks(s,0.05,plan);};
  // 1) limpieza manual de la mesa 0
  const id1=requestTask(s,{kind:'clean',target:'table0',requestedBy:'p1',legs:[{x:300,y:400,duration:1.8}]});
  assignTasks(s,plan);const t1=s.tasks.find(t=>t.id===id1);
  walkUntil(t1,t=>t.state==='done');
  assert.equal(s.tables[0].state,'free');
  // 2) terminada la primera, el usuario pide la segunda y empieza a volver
  const id2=requestTask(s,{kind:'clean',target:'table1',requestedBy:'p1',legs:[{x:600,y:500,duration:1.8}]});
  p1.returning=true;p1.home={x:265,y:470};p1.returnPath=plan(p1,p1.home);
  stepHome(p1,0.5,plan); // camina hacia casa un tramo
  assert.ok(p1.returning,'estaba volviendo a casa');
  // 3) updateFloor interrumpe el retorno porque hay tarea en cola pedida por p1
  if(s.tasks.some(t=>t.kind==='clean'&&t.state==='queued'&&t.requestedBy==='p1'&&s.tables.find(x=>x.id===t.target)?.state==='dirty')){p1.returning=false;p1.returnPath=[];}
  assert.equal(p1.returning,false,'el retorno se interrumpe');
  // 4) limpia la segunda mesa
  assignTasks(s,plan);const t2=s.tasks.find(t=>t.id===id2);
  assert.equal(t2.actor,'p1');
  walkUntil(t2,t=>t.state==='done');
  assert.equal(s.tables[1].state,'free');
  // 5) ya sin tareas, vuelve a casa caminando (sin saltos)
  p1.returning=true;p1.returnPath=null;p1.returnPath=plan(p1,p1.home);
  let g=0;
  while(p1.returning&&g++<500){const ox=p1.x,oy=p1.y;stepHome(p1,0.25,plan);
    assert.ok(Math.hypot(p1.x-ox,p1.y-oy)<=110*0.25+1e-6);}
  assert.ok(!p1.returning);assert.equal(p1.x,p1.home.x);assert.equal(p1.y,p1.home.y);
  assert.ok(g>1,'la vuelta a casa debe ser gradual');
});

// Cooperativo: dos usuarios piden cada uno su mesa; cada tarea queda para quien la pidió.
test('cooperativo: p1 y p2 limpian cada uno su mesa',()=>{
  const s=createService('t',[
    {id:'p1',player:true,x:100,y:200,speed:110,can:['clean'],auto:[]},
    {id:'p2',player:true,x:900,y:300,speed:110,can:['clean'],auto:[]},
  ],[{id:'table0',state:'dirty'},{id:'table1',state:'dirty'}]);
  const plan=(a,p)=>[{x:p.x,y:p.y}];
  const id1=requestTask(s,{kind:'clean',target:'table0',requestedBy:'p1',legs:[{x:200,y:250,duration:1.8}]});
  const id2=requestTask(s,{kind:'clean',target:'table1',requestedBy:'p2',legs:[{x:800,y:350,duration:1.8}]});
  assignTasks(s,plan);
  assert.equal(s.tasks.find(t=>t.id===id1).actor,'p1','la mesa de p1 la limpia p1');
  assert.equal(s.tasks.find(t=>t.id===id2).actor,'p2','la mesa de p2 la limpia p2');
  let g=0;
  while(s.tasks.some(t=>t.state!=='done')&&g++<5000)stepTasks(s,0.05,plan);
  assert.equal(s.tables[0].state,'free');assert.equal(s.tables[1].state,'free');
  // y cada uno puede volver a casa sin saltos
  for(const id of ['p1','p2']){const a=s.actors.find(x=>x.id===id);
    a.returning=true;a.home=a.id==='p1'?{x:100,y:200}:{x:900,y:300};a.returnPath=plan(a,a.home);
    let h=0;while(a.returning&&h++<500){const ox=a.x,oy=a.y;stepHome(a,0.25,plan);
      assert.ok(Math.hypot(a.x-ox,a.y-oy)<=110*0.25+1e-6,'salto de '+id);}
    assert.ok(!a.returning);assert.equal(a.x,a.home.x);assert.equal(a.y,a.home.y);}
});
