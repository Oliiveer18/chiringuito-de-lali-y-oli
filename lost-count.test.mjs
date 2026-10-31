import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tableStateAfterMeal} from './sim/lost.js?v=29.4.3';
import {createService,requestTask,couldTake,assignTasks} from './service-tasks.mjs?v=29.4.3';

/* ============================================================
   v29.2 — reglas de jornada.
   Sin información extra en el informe: los perdidos del cierre
   forzado y los "sin mesa" no se cuentan (el jugador no quiere
   ruido en el parte). Lo que sí son reglas del juego se prueba
   aquí sin navegador.
   ============================================================ */

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
