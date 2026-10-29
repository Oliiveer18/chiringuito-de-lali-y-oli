/* Serializable active-service state. No DOM, renderer, networking or money side effects. */
export const TRAY_CAPACITY = 4;
const players = new Set(['p1', 'p2']);
const products = {
  beer: ['cerveza'],
  coffee: ['barraquito'],
  grill: ['papas', 'queso', 'pescado'],
  cooler: ['agua', 'refresco', 'batido', 'helado']
};

export function createPlayers3D(){
  return {
    p1:{x:-1.8,z:1.8,heading:0,seq:0,correctionSeq:0},
    p2:{x:.5,z:1.8,heading:0,seq:0,correctionSeq:0}
  };
}

export function createService3D() {
  return {
    nextUnit: 0, trays: { p1: [], p2: [] }, commands: {}, players:createPlayers3D(),
    stations: {
      beer: { state: 'idle', owner: null, progress: 0, sweetSpotMin: .72, sweetSpotMax: .92, pourTime: 1.35 },
      grill: { state: 'idle', owner: null, progress: 0, itemCooking: null, cookTime: 2.1, greenMin: .65, greenMax: .90 },
      coffee: { state: 'idle', owner: null, progress: 0, brewTime: 1.15 },
      cooler: { state: 'idle', owner: null, progress: 0 }
    }
  };
}

export function service3D(game) {
  return game.service3D || (game.service3D = createService3D());
}

export function serviceRunning(game) {
  return game.mode === 'service' && Number.isFinite(game.speed) && game.speed > 0;
}

export function trayUnits(game, who = 'p1') {
  return service3D(game).trays[who] || [];
}

export function trayHasRoom(game, who) {
  if (!players.has(who)) return false;
  const reserved = Object.values(service3D(game).stations)
    .filter(s => s.owner === who && s.state !== 'idle').length;
  return trayUnits(game, who).length + reserved < TRAY_CAPACITY;
}

function idle(station) {
  Object.assign(station, { state: 'idle', owner: null, progress: 0, itemCooking: null });
}

export function beginPreparation(game, stationId, who = 'p1', itemId = products[stationId]?.[0]) {
  if (!serviceRunning(game) || game.closing || !players.has(who)) return false;
  if (!products[stationId]?.includes(itemId) || game.enabled?.[itemId] === false) return false;
  const station = service3D(game).stations[stationId];
  if (station.state !== 'idle' || !trayHasRoom(game, who)) return false;
  if (!Number.isFinite(game.stock[itemId]) || game.stock[itemId] < 1) return false;
  game.stock[itemId]--;
  Object.assign(station, {
    state: stationId === 'beer' ? 'pouring' : stationId === 'grill' ? 'cooking' : 'brewing',
    owner: who, itemCooking: itemId, progress: 0
  });
  return true;
}

function putPreparedUnit(game, station, quality, bonusTip = 0) {
  const tray = trayUnits(game, station.owner);
  if (tray.length >= TRAY_CAPACITY) return false;
  const s = service3D(game);
  const unit = { uid: ++s.nextUnit, id: station.itemCooking, quality, bonusTip };
  tray.push(unit);
  idle(station);
  return unit;
}

export function finishBeer(game, who = 'p1') {
  const b = service3D(game).stations.beer;
  if (!serviceRunning(game) || b.state !== 'pouring' || b.owner !== who) return false;
  // A click/repeated key event cannot fabricate an empty glass.
  if (b.progress <= 0) return false;
  const perfect = b.progress >= b.sweetSpotMin && b.progress <= b.sweetSpotMax;
  return putPreparedUnit(game, b, perfect ? 'perfect' : b.progress > b.sweetSpotMax ? 'over' : 'under', perfect ? .5 : 0);
}

export function cancelPreparation(game, stationId, who = 'p1') {
  const station = service3D(game).stations[stationId];
  if (!station || station.owner !== who || station.state === 'idle') return false;
  // Only an interrupted pour is reversible. Cooked/ready food is not refunded.
  if (stationId !== 'beer') return false;
  game.stock[station.itemCooking] = (game.stock[station.itemCooking] || 0) + 1;
  idle(station);
  return true;
}

export function collectGrill(game, who = 'p1') {
  const g = service3D(game).stations.grill;
  if (!serviceRunning(game) || g.owner !== who || !['done', 'burnt'].includes(g.state)) return false;
  if (g.progress < g.greenMin) return false;
  const perfect = g.progress >= g.greenMin && g.progress <= g.greenMax;
  return putPreparedUnit(game, g, g.state === 'burnt' ? 'burnt' : perfect ? 'perfect' : 'over', perfect ? .4 : 0);
}

export function takeColdDrink(game, who, itemId = 'refresco') {
  if (!beginPreparation(game, 'cooler', who, itemId)) return false;
  return putPreparedUnit(game, service3D(game).stations.cooler, 'good');
}

export function updateService3D(game, dt) {
  if (!serviceRunning(game) || !Number.isFinite(dt) || dt <= 0) return;
  const { beer, coffee, grill } = service3D(game).stations;
  if (beer.state === 'pouring') {
    beer.progress += dt / beer.pourTime;
    if (beer.progress >= 1.05) finishBeer(game, beer.owner);
  }
  if (coffee.state === 'brewing') {
    coffee.progress = Math.min(1, coffee.progress + dt / coffee.brewTime);
    if (coffee.progress >= 1) putPreparedUnit(game, coffee, 'good');
  }
  if (['cooking', 'done'].includes(grill.state)) {
    grill.progress += dt / grill.cookTime;
    grill.state = grill.progress > 1.05 ? 'burnt' : grill.progress >= grill.greenMin ? 'done' : 'cooking';
  }
}

export function washDirtyUnits(game, who = 'p1') {
  if (!serviceRunning(game) || !players.has(who)) return false;
  const s = service3D(game), tray = trayUnits(game, who);
  const clean = tray.filter(unit => unit.id !== 'dirty');
  if (clean.length === tray.length) return false;
  s.trays[who] = clean;
  return true;
}

export function addDirtyUnit(game, who) {
  if (!players.has(who) || !trayHasRoom(game, who)) return false;
  trayUnits(game, who).push({ uid: ++service3D(game).nextUnit, id: 'dirty', quality: 'dirty', bonusTip: 0 });
  return true;
}

export function preparedMatch(game, customer, who = 'p1') {
  if (!customer || !game.customers.includes(customer) || customer.floorPaid || customer.orderCompleted) return null;
  if (!['queue', 'prep', 'floorWaitingPrep'].includes(customer.state)) return null;
  const tray = trayUnits(game, who);
  for (let line = 0; line < (customer.order?.length || 0); line++) {
    if (customer.itemSt?.[line] !== 0) continue;
    const index = tray.findIndex(unit => unit.id === customer.order[line] && unit.id !== 'dirty');
    if (index >= 0) return { line, index, unit: tray[index] };
  }
  return null;
}

export function commitPreparedDelivery(game, customer, who = 'p1') {
  if (!serviceRunning(game) || !players.has(who)) return false;
  const match = preparedMatch(game, customer, who);
  if (!match) return false;
  const price = customer.floorPrices?.[match.unit.id] ?? game.prices[match.unit.id];
  if (!Number.isFinite(price) || price < 0 || !game.dayStats) return false;
  // All preconditions precede the mutation. No stock debit or legacy startPart here.
  trayUnits(game, who).splice(match.index, 1);
  customer.itemSt[match.line] = 2;
  (customer.served || (customer.served = [])).push(match.unit.id);
  (customer.partT || (customer.partT = {}))[who] = game.t;
  customer.tServe ??= game.t;
  customer.preparedBonus = (customer.preparedBonus || 0) + match.unit.bonusTip;
  (customer.preparedQuality || (customer.preparedQuality = [])).push(match.unit.quality);
  const by = game.dayStats.by[who] || (game.dayStats.by[who] = { items: 0, rev: 0, clean: 0 });
  by.items++;
  by.rev += price + match.unit.bonusTip;
  if (customer.floorTableId == null) customer.state = 'prep';
  return match.unit;
}

export function discardService3D(game) {
  const s = service3D(game), waste = {};
  for (const units of Object.values(s.trays)) for (const unit of units) {
    if (unit.id !== 'dirty') waste[unit.id] = (waste[unit.id] || 0) + 1;
  }
  for (const station of Object.values(s.stations)) {
    if (station.state !== 'idle' && station.itemCooking) waste[station.itemCooking] = (waste[station.itemCooking] || 0) + 1;
  }
  if (game.dayStats) {
    game.dayStats.preparedWaste = { ...(game.dayStats.preparedWaste || {}) };
    for (const [id, n] of Object.entries(waste)) game.dayStats.preparedWaste[id] = (game.dayStats.preparedWaste[id] || 0) + n;
  }
  game.service3D = createService3D();
  return waste;
}
