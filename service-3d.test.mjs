import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from './service-3d-model.mjs';

function game() {
  return {
    mode:'service',speed:1,closing:false,t:10,money:400,
    stock:{cerveza:10,barraquito:10,papas:10,refresco:10},
    prices:{cerveza:3,barraquito:2,papas:4,refresco:2},
    enabled:{cerveza:true,barraquito:true,papas:true,refresco:true},
    customers:[],dayStats:{revenue:0,tips:0,served:0,by:{}}
  };
}
function beer(g,who='p1',progress=.8) {
  assert.ok(M.beginPreparation(g,'beer',who));
  M.updateService3D(g,1.35*progress);
  return M.finishBeer(g,who);
}
function customer(g,order=['cerveza']) {
  const c={id:1,state:'queue',order,itemSt:order.map(()=>0),inPrep:0,served:[],partT:{},patience:20,maxPatience:30};
  g.customers.push(c);
  return c;
}

test('one ingredient debit and no preparation-time revenue or tip',()=>{
  const g=game(),unit=beer(g);
  assert.equal(g.stock.cerveza,9);
  assert.equal(g.money,400);
  assert.deepEqual(g.dayStats,{revenue:0,tips:0,served:0,by:{}});
  assert.equal(unit.quality,'perfect');
  assert.equal(unit.bonusTip,.5);
  assert.equal(M.finishBeer(g),false);
});
test('station cannot restart or be collected by another actor',()=>{
  const g=game();
  assert.ok(M.beginPreparation(g,'beer','p2'));
  assert.equal(M.beginPreparation(g,'beer','p1'),false);
  M.updateService3D(g,1);
  assert.equal(M.finishBeer(g,'p1'),false);
  assert.equal(g.stock.cerveza,9);
  assert.ok(M.finishBeer(g,'p2'));
  assert.equal(M.trayUnits(g,'p1').length,0);
  assert.equal(M.trayUnits(g,'p2').length,1);
});
test('no stock, invalid actor/product, disabled product and closing reject before mutation',()=>{
  const g=game();
  g.stock.cerveza=0;
  assert.equal(M.beginPreparation(g,'beer'),false);
  assert.equal(M.beginPreparation(g,'coffee','p3'),false);
  assert.equal(M.beginPreparation(g,'grill','p1','cerveza'),false);
  g.enabled.barraquito=false;
  assert.equal(M.beginPreparation(g,'coffee'),false);
  g.closing=true;
  assert.equal(M.beginPreparation(g,'grill'),false);
  assert.equal(g.stock.papas,10);
  assert.equal(M.takeColdDrink(g,'p1'),false);
});
test('full tray rejects production without consuming stock',()=>{
  const g=game();
  for(let i=0;i<4;i++) assert.ok(M.takeColdDrink(g,'p1'));
  assert.equal(M.beginPreparation(g,'beer'),false);
  assert.equal(M.beginPreparation(g,'coffee'),false);
  assert.equal(g.stock.cerveza,10);
  assert.equal(g.stock.barraquito,10);
  assert.equal(M.trayUnits(g).length,4);
});
test('in-flight preparation reserves tray capacity',()=>{
  const g=game();
  for(let i=0;i<3;i++) M.takeColdDrink(g,'p1');
  assert.ok(M.beginPreparation(g,'coffee'));
  assert.equal(M.beginPreparation(g,'beer'),false);
  assert.equal(M.takeColdDrink(g,'p1'),false);
  M.updateService3D(g,1.2);
  assert.equal(M.trayUnits(g).length,4);
});
test('coffee takes simulation time and consumes only once',()=>{
  const g=game();
  assert.ok(M.beginPreparation(g,'coffee'));
  M.updateService3D(g,1);
  assert.equal(M.trayUnits(g).length,0);
  assert.equal(M.beginPreparation(g,'coffee'),false);
  M.updateService3D(g,.16);
  assert.equal(M.trayUnits(g)[0].id,'barraquito');
  assert.equal(g.stock.barraquito,9);
  M.updateService3D(g,10);
  assert.equal(M.trayUnits(g).length,1);
});
test('raw grill collection rejects and ready food continues towards burnt',()=>{
  const g=game();
  assert.ok(M.beginPreparation(g,'grill'));
  assert.equal(M.collectGrill(g),false);
  M.updateService3D(g,1.5);
  assert.equal(M.service3D(g).stations.grill.state,'done');
  M.updateService3D(g,2);
  assert.equal(M.service3D(g).stations.grill.state,'burnt');
  assert.equal(M.collectGrill(g,'p2'),false);
  const dish=M.collectGrill(g);
  assert.equal(dish.quality,'burnt');
  assert.equal(dish.bonusTip,0);
  assert.equal(M.collectGrill(g),false);
  assert.equal(g.stock.papas,9);
});
test('perfect grill quality persists with deferred bonus',()=>{
  const g=game();
  M.beginPreparation(g,'grill');
  M.updateService3D(g,1.5);
  assert.equal(M.collectGrill(g).bonusTip,.4);
  assert.equal(g.money,400);
});
test('overflow finishes into the correct owner tray once',()=>{
  const g=game();
  M.beginPreparation(g,'beer','p2');
  M.updateService3D(g,2);
  M.updateService3D(g,10);
  assert.equal(M.trayUnits(g,'p1').length,0);
  assert.equal(M.trayUnits(g,'p2').length,1);
  assert.equal(M.trayUnits(g,'p2')[0].quality,'over');
});
test('pause freezes preparation and disallows production, delivery and washing',()=>{
  const g=game(),c=customer(g);
  beer(g);
  M.beginPreparation(g,'grill');
  M.addDirtyUnit(g,'p1');
  g.speed=0;
  const before=JSON.stringify(g);
  M.updateService3D(g,100);
  assert.equal(M.commitPreparedDelivery(g,c),false);
  assert.equal(M.washDirtyUnits(g),false);
  assert.equal(M.beginPreparation(g,'coffee'),false);
  assert.equal(JSON.stringify(g),before);
});
test('interrupted pour refunds reservation exactly once without a reward',()=>{
  const g=game();
  M.beginPreparation(g,'beer');
  M.updateService3D(g,.4);
  g.speed=0;
  assert.ok(M.cancelPreparation(g,'beer'));
  assert.equal(M.cancelPreparation(g,'beer'),false);
  assert.equal(g.stock.cerveza,10);
  assert.equal(M.trayUnits(g).length,0);
  assert.equal(g.money,400);
});
test('prepared delivery completes one pending line, without another stock debit or slot',()=>{
  const g=game(),c=customer(g);
  beer(g);
  g.slots=[{who:'p1',cust:{id:99}}];
  assert.ok(M.commitPreparedDelivery(g,c));
  assert.equal(g.stock.cerveza,9);
  assert.deepEqual(c.itemSt,[2]);
  assert.deepEqual(c.served,['cerveza']);
  assert.equal(c.inPrep,0);
  assert.equal(M.trayUnits(g).length,0);
  assert.equal(g.money,400);
  assert.equal(c.preparedBonus,.5);
});
test('duplicate delivery does not consume a second prepared unit',()=>{
  const g=game(),c=customer(g);
  beer(g);beer(g);
  assert.ok(M.commitPreparedDelivery(g,c));
  const before=JSON.stringify(g);
  assert.equal(M.commitPreparedDelivery(g,c),false);
  assert.equal(JSON.stringify(g),before);
});
test('repeated products deliver only to still-pending order lines',()=>{
  const g=game(),c=customer(g,['cerveza','cerveza']);
  beer(g);beer(g);
  M.commitPreparedDelivery(g,c);
  M.commitPreparedDelivery(g,c);
  assert.deepEqual(c.itemSt,[2,2]);
  assert.equal(c.preparedBonus,1);
  assert.equal(g.stock.cerveza,8);
});
test('wrong item, departed customer and in-progress line preserve tray',()=>{
  const g=game(),c=customer(g,['papas']);
  beer(g);
  const before=JSON.stringify(M.trayUnits(g));
  assert.equal(M.commitPreparedDelivery(g,c),false);
  c.order=['cerveza'];c.itemSt=[1];c.state='prep';
  assert.equal(M.commitPreparedDelivery(g,c),false);
  c.itemSt=[0];c.state='leave';
  assert.equal(M.commitPreparedDelivery(g,c),false);
  c.state='queue';g.customers=[];
  assert.equal(M.commitPreparedDelivery(g,c),false);
  assert.equal(JSON.stringify(M.trayUnits(g)),before);
});
test('washing preserves food and quality metadata',()=>{
  const g=game(),unit=beer(g);
  M.addDirtyUnit(g,'p1');
  assert.ok(M.washDirtyUnits(g));
  assert.deepEqual(M.trayUnits(g),[unit]);
  assert.equal(M.washDirtyUnits(g),false);
});
test('closing discards prepared/in-flight products without returning consumed stock',()=>{
  const g=game();
  beer(g);M.beginPreparation(g,'grill');
  assert.deepEqual(M.discardService3D(g),{cerveza:1,papas:1});
  assert.equal(M.trayUnits(g).length,0);
  assert.equal(M.service3D(g).stations.grill.state,'idle');
  assert.equal(g.stock.cerveza,9);
  assert.equal(g.stock.papas,9);
  assert.deepEqual(g.dayStats.preparedWaste,{cerveza:1,papas:1});
  assert.deepEqual(M.discardService3D(g),{});
});
test('state round trip preserves ownership, timed preparations and unit quality',()=>{
  const g=game();
  beer(g,'p2');M.beginPreparation(g,'coffee','p1');
  const clone=JSON.parse(JSON.stringify(g));
  M.updateService3D(clone,1.2);
  assert.equal(M.trayUnits(clone,'p2')[0].quality,'perfect');
  assert.equal(M.trayUnits(clone,'p1')[0].id,'barraquito');
});
test('non-finite and negative deltas cannot corrupt a station',()=>{
  const g=game();
  M.beginPreparation(g,'grill');
  for(const dt of [NaN,Infinity,-1,0]) M.updateService3D(g,dt);
  assert.equal(M.service3D(g).stations.grill.progress,0);
});
