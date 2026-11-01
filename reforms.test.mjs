/* Pruebas de las reformas v30 (sin navegador). Uso: node reforms.test.mjs
   Cubre: precios y cadena de requisitos, capacidad de la cola por reforma,
   reparto de colas por intención, geometría (parcela y banda protegida),
   concierto determinista y nivel visual del kiosco. */
globalThis.window = globalThis;
const store = {};
globalThis.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };

const { Game } = await import('./state.js?v=31.0.0');
const S = await import('./state.js?v=31.0.0');
const cfg = await import('./config.js?v=31.0.0');
const world = await import('./world.js?v=31.0.0');

let ok = 0, ko = 0;
const check = (name, cond, extra) => { if (cond) { ok++; console.log('  ok  ' + name); } else { ko++; console.log('  FALLO  ' + name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); } };
const fresh = () => { Game.upgrades = {}; Game.money = 400; Game.day = 1; Game.tables = []; Game.customers = []; };

console.log('Reformas: datos y cadena');
fresh();
const byId = id => cfg.UPGRADES.find(u => u.id === id);
check('existen las tres reformas', !!byId('palapa') && !!byId('terraza') && !!byId('escenario'));
check('la Palapa no exige nada previo', !byId('palapa').req);
check('la Terraza exige la Palapa', byId('terraza').req === 'palapa');
check('el Escenario exige la Terraza', byId('escenario').req === 'terraza');
check('precios crecientes', byId('palapa').levels[0] < byId('terraza').levels[0] && byId('terraza').levels[0] < byId('escenario').levels[0]);
check('no hay candado de temporada: solo req y dinero', !byId('palapa').season && !byId('terraza').season && !byId('escenario').season);

console.log('Capacidad de la cola');
fresh();
check('cola base: 6 puestos', S.queueSpots() === 6);
Game.upgrades.palapa = 1;
check('con la Palapa: 8 puestos', S.queueSpots() === 8);
check('la geometría define exactamente 8 posiciones', world.QUEUE_POS.length === 8 && cfg.QUEUE_SPOTS === 8);
check('dos filas de 4 (y 598 y 652)', world.QUEUE_POS.filter(p => p.y === 598).length === 4 && world.QUEUE_POS.filter(p => p.y === 652).length === 4);

console.log('Geometría protegida');
const GEO = { PARCEL: { x0: 40, x1: 540 }, BAND_TOP: 186 };
check('la cola vive dentro del área jugable', world.QUEUE_POS.every(p => p.x >= 40 && p.x <= 1276 && p.y > GEO.BAND_TOP && p.y <= 700));
check('la ventanilla express vive junto al mostrador, en parcela', world.EXPRESS_POS.every(p => p.x >= 490 && p.x <= 560 && p.y > 450));
check('las mesas siguen en su sitio (sin reformas)', (fresh(), world.TABLE_POS.length === 10));
check('nivel visual del kiosco: 1 base', (fresh(), S.reformLevel() === 1));
Game.upgrades.palapa = 1; check('nivel 2 con la Palapa', S.reformLevel() === 2);
Game.upgrades.terraza = 1; check('nivel 3 con la Terraza', S.reformLevel() === 3);
Game.upgrades.escenario = 1; check('nivel 4 con el Escenario', S.reformLevel() === 4);

console.log('Mesas y Terraza');
fresh();
check('mesas base: 3', S.tableCount() === 3);
Game.upgrades.terraza = 1;
check('la Terraza añade 2 mesas (hasta 10 con los niveles)', S.tableCount() === 5);

console.log('Concierto (Escenario)');
check('sin escenario no hay concierto nunca', [1, 2, 3, 4, 5].every(d => cfg.concertDay(d, false) === false));
const days = []; for (let d = 1; d <= 60; d++) if (cfg.concertDay(d, true)) days.push(d);
check('con escenario hay días de concierto (≈12%)', days.length >= 4 && days.length <= 12, days.length);
check('el concierto es determinista (mismo día, mismo resultado)', cfg.concertDay(17, true) === cfg.concertDay(17, true));
check('el evento de concierto sube la afluencia', cfg.CONCERT_EVENT.arr > 1);

console.log('Imperio (v31)');
fresh();
check('sin locales, el imperio no ingresa', S.empireIncome().total === 0 && S.empireIncome().owned.length === 0);
Game.rep = 3;
check('existen los dos locales del imperio', !!byId('elmedano') && !!byId('loscristianos'));
check('El Médano exige el Escenario', byId('elmedano').req === 'escenario');
check('Los Cristianos exige El Médano', byId('loscristianos').req === 'elmedano');
Game.upgrades.elmedano = 1;
const e1 = S.empireIncome();
check('un local ingresa cada noche (400+150·rep)', e1.total === 400 + 150 * 3 && e1.owned.length === 1, e1);
Game.rep = 4.5;
const e1b = S.empireIncome();
check('mejor reputación = más ingreso por local', e1b.total === Math.round(400 + 150 * 4.5), e1b);
Game.upgrades.loscristianos = 1;
const e2 = S.empireIncome();
check('dos locales = doble ingreso', e2.total === 2 * Math.round(400 + 150 * 4.5) && e2.owned.length === 2, e2);

console.log(ok + ' ok · ' + ko + ' fallos');
if (ko) process.exit(1);
