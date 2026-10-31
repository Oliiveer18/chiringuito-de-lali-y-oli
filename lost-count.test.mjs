import {test} from 'node:test';
import assert from 'node:assert/strict';
import {countStranded, tableStateAfterMeal} from './sim/lost.js?v=29.2.0';
import {createService,requestTask,couldTake,assignTasks} from './service-tasks.mjs?v=29.2.0';

/* ============================================================
   v29.2 — contar correctamente los clientes perdidos.
   Antes del cierre forzado los clientes de barra sin resolver
   (llegando, en cola, esperando mesa o en preparación) se
   descartaban sin sumar al informe.
   ============================================================ */

test('cierre forzado: los clientes de barra varados cuentan como perdidos por cierre',()=>{
  const stats={lost:0};
  const visits=[];const outcomes=[];
  const customers=[
    {id:1,state:'queue',floorTableId:null},
    {id:2,state:'arrive',floorTableId:null},
    {id:3,state:'waitTable',floorTableId:null},
    {id:4,state:'prep',inPrep:1,floorTableId:null},
  ];
  const n=countStranded(customers,stats,c=>visits.push(c.id),c=>outcomes.push(c.id));
  assert.equal(n,4,'deben contarse los 4 varados');
  assert.equal(stats.lost,4);
  assert.equal(stats.lostClose,4);
  assert.deepEqual(visits,[1,2,3,4],'cada uno queda registrado como visita perdida');
  assert.deepEqual(outcomes,[1,2,3,4]);
});

test('cierre forzado: no cuentan los ya resueltos, los de terraza ni los repetidos',()=>{
  const stats={lost:0};
  const customers=[
    {id:1,state:'eat',floorTableId:null},          // pagó y está comiendo
    {id:2,state:'leave',floorTableId:null},        // ya resuelto
    {id:3,state:'queue',floorTableId:2},           // terraza: los cuenta abortFloor
    {id:4,state:'queue',floorTableId:null,lostCounted:true}, // ya contado antes
    {id:5,state:'gone',floorTableId:null},
  ];
  const n=countStranded(customers,stats);
  assert.equal(n,0);
  assert.equal(stats.lost,0);
});

test('cierre forzado: idempotente, no duplica aunque se llame dos veces',()=>{
  const stats={lost:0};
  const customers=[{id:1,state:'queue',floorTableId:null}];
  assert.equal(countStranded(customers,stats),1);
  assert.equal(countStranded(customers,stats),0);
  assert.equal(stats.lost,1);
});

test('todo cliente que come en mesa deja la mesa sucia (sin lotería del 75%)',()=>{
  for(let i=0;i<25;i++) assert.equal(tableStateAfterMeal(),'dirty');
});

/* ============================================================
   v29.2 — couldTake: la base del relevo al volver a casa.
   El personal ya no camina hasta su puesto para volver a salir:
   si hay tarea en cola que pueda tomar, corta el regreso.
   ============================================================ */

test('couldTake: jugador@ solo tareas pedidas por ella',()=>{
  const p1={id:'p1',player:true,can:['clean'],auto:[],busy:false,task:null};
  const cleanSelf={kind:'clean',target:'table0',state:'queued',requestedBy:'p1'};
  const cleanOther={kind:'clean',target:'table1',state:'queued',requestedBy:'p2'};
  const cleanAuto={kind:'clean',target:'table2',state:'queued',requestedBy:null};
  assert.equal(couldTake(p1,cleanSelf),true);
  assert.equal(couldTake(p1,cleanOther),false);
  assert.equal(couldTake(p1,cleanAuto),false);
});

test('couldTake: el personal con auto toma las tareas sin solicitante',()=>{
  const acaymo={id:'acaymo',player:false,role:'limpiador',can:['clean'],auto:['clean'],busy:false,task:null};
  const cleanAuto={kind:'clean',target:'table0',state:'queued',requestedBy:null};
  const cleanP1={kind:'clean',target:'table1',state:'queued',requestedBy:'p1'};
  assert.equal(couldTake(acaymo,cleanAuto),true);
  assert.equal(couldTake(acaymo,cleanP1),false,'la limpieza pedida por jugador@ es suya');
  assert.equal(couldTake(acaymo,{...cleanAuto,state:'walking'}),false,'solo tareas en cola');
  assert.equal(couldTake(acaymo,null),false);
});

test('couldTake: respeta el can del actor y el tipo de tarea',()=>{
  const carmela={id:'carmela',player:false,role:'cocinero',can:['clean'],auto:[],busy:false,task:null};
  assert.equal(couldTake(carmela,{kind:'escort',target:'table0',state:'queued',requestedBy:null}),false,'no puede escoltar');
  const terraza={id:'terraza',player:false,role:'terraza',can:['escort','takeOrder','deliver'],auto:['escort'],busy:false,task:null};
  assert.equal(couldTake(terraza,{kind:'escort',target:'table0',state:'queued',requestedBy:null}),true);
  assert.equal(couldTake(terraza,{kind:'deliver',target:'table0',state:'queued',requestedBy:null}),false,'deliver no está en su auto');
});

test('couldTake: integración, el actor que vuelve corta el regreso y se queda la tarea',()=>{
  const s=createService('t',[
    {id:'acaymo',player:false,x:880,y:578,speed:110,can:['clean'],auto:['clean']},
  ],[{id:'table0',state:'dirty'},{id:'table1',state:'dirty'}]);
  // el limpiador termina la mesa 0 y empieza a volver; hay una mesa 1 sucia en cola
  const id0=requestTask(s,{kind:'clean',target:'table0',requestedBy:null,legs:[{x:646,y:562,duration:0.1}]});
  const id1=requestTask(s,{kind:'clean',target:'table1',requestedBy:null,legs:[{x:686,y:674,duration:0.1}]});
  assignTasks(s,(a,p)=>[{x:p.x,y:p.y}]);
  const t1=s.tasks.find(t=>t.id===id1);
  const t0=s.tasks.find(t=>t.id===id0);
  assert.equal(t0.actor,'acaymo');
  assert.equal(t0.state,'walking');
  assert.equal(t1.state,'queued','la segunda mesa espera');
  // con couldTake, el actor que "vuelve" sabe que puede quedarse la tarea 1
  const a=s.actors[0];
  assert.equal(couldTake(a,t1),true,'el limpiador podría tomar la mesa 1 al vuelo');
  assert.equal(couldTake(a,t0),false,'la mesa 0 ya está asignada (walking)');
});
