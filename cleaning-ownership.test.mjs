import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createService,requestTask,assignTasks,stepTasks} from './service-tasks.mjs';
test('exclusive player cleaning and idempotent clicks',()=>{
  const s=createService('test',[{id:'p1',player:true,x:0,y:0,speed:100,can:['clean']},{id:'p2',player:true,x:0,y:0,speed:100,can:['clean']}],[{id:'table0',state:'dirty'}]);
  const input={kind:'clean',target:'table0',requestedBy:'p1',legs:[{x:1,y:1,duration:1}]};
  const id=requestTask(s,input);
  assert.equal(requestTask(s,{...input,requestedBy:'p2'}),null);
  assert.equal(requestTask(s,input),id);assert.equal(s.tasks.length,1);
  assignTasks(s,(a,p)=>[p]);assert.equal(s.tasks[0].actor,'p1');
  assert.equal(requestTask(s,{...input,requestedBy:'p2'}),null);
  stepTasks(s,3,(a,p)=>[p]);assert.equal(s.tables[0].state,'free');
});
