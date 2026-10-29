/* Pruebas del modelo de seguidores (puro, sin navegador). Uso: node social-model.test.mjs */
import { settle, postEffect, reachFactor, engagement, churnRate, postBrief, chiringoRivalLine } from './social-model.js';

let ok = 0, ko = 0;
const check = (name, cond, extra) => { if (cond) { ok++; console.log('  ok  ' + name); } else { ko++; console.log('  FALLO  ' + name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); } };

console.log('Alcance e interacción');
check('con 50 seguidores el alcance es neutro', reachFactor(50) === 1, reachFactor(50));
check('el alcance está acotado entre 0,7 y 1,8', reachFactor(0) === 0.7 && reachFactor(1e6) === 1.8);
check('más seguidores nunca reducen el alcance', reachFactor(80) >= reachFactor(60) && reachFactor(300) >= reachFactor(80));
check('valoración 3 es neutra y 5 mejora', engagement({ rating: 3 }) === 1 && engagement({ rating: 5 }) > 1.3);
check('la tendencia suma interacción', engagement({ rating: 3, match: true }) > engagement({ rating: 3 }));
const P = { arr: 0.08, followers: 3 };
const a = postEffect({ id: 'papas', P, f: 50, rating: 3, trendId: null, prevId: null });
const b = postEffect({ id: 'papas', P, f: 50, rating: 3, trendId: null, prevId: 'papas' });
const c = postEffect({ id: 'papas', P, f: 50, rating: 3, trendId: 'papas', prevId: null });
check('repetir la publicación de ayer reduce el efecto', b.arr < a.arr && b.followers <= a.followers, [a, b]);
check('encajar con la tendencia aumenta el efecto', c.arr > a.arr, [a, c]);
check('una publicación puede no sumar seguidores con mala nota', postEffect({ id: 'x', P: { arr: 0.05, followers: 1 }, f: 0, rating: 1, prevId: 'x' }).followers >= 0);

console.log('Planificación Chiringo (sin números garantizados)');
const brief = postBrief({ id: 'show', P: { desc: 'Show esta tarde' }, match: false, fat: 1 });
check('postBrief incluye promesa y riesgo alto en show', brief.promesa && brief.riesgo === 'alto', brief);
check('rival line determinista', chiringoRivalLine({ npcs: [{ id: 'n0', name: 'La Brisa · Pueblo', area: 0 }] }, 3, 'seed')?.text?.includes('La Brisa'));

console.log('Abandono');
check('1 estrella pierde 4 % y 5 estrellas 0,5 %', Math.abs(churnRate(1) - 0.04) < 1e-9 && Math.abs(churnRate(5) - 0.005) < 1e-9);
const quiet = settle({ f: 1000, rep: 3, idle: 3 });
check('sin publicar y con reputación media se pierden seguidores', quiet.net < 0 && quiet.losses.some(l => l.k === 'Sin publicar'), quiet);
const good = settle({ f: 1000, rep: 5, pend: [{ k: 'Atardecer', n: 40, post: true }] });
check('una buena publicación con 5 estrellas crece', good.net > 0 && good.gains[0].k === 'Atardecer', good);

console.log('Promesas y quejas');
const broken = settle({ f: 200, rep: 3, pend: [{ k: 'Show', n: 5, post: true }], postOk: false });
check('promesa incumplida: no se cobra y se pierde', !broken.gains.some(g => g.k === 'Show') && broken.losses.some(l => l.k === 'Promesa incumplida' && l.n === 5), broken);
const quej = settle({ f: 200, rep: 3, sinResp: true });
check('queja sin responder resta seguidores', quej.losses.some(l => l.k === 'Queja sin responder'));
const pr = settle({ f: 200, rep: 3, prestados: { n: 100, dias: 5 } });
check('los seguidores prestados se van más rápido', pr.losses.some(l => l.k === 'Seguidores prestados' && l.n === 6), pr.losses);

console.log('Robustez');
const tiny = settle({ f: 3, rep: 1, idle: 9, sinResp: true, prestados: { n: 500, dias: 7 } });
check('nunca baja de cero', tiny.total >= 0, tiny);
const weird = settle({ f: undefined, rep: NaN, pend: [{ k: 'x', n: NaN }], extra: [{ k: 'y', n: undefined }] });
check('entradas raras no producen NaN', Object.values(weird).every(v => Array.isArray(v) || Number.isFinite(v)), weird);
let f = 50;
for (let d = 1; d <= 60; d++) f = settle({ f, rep: 3, idle: d }).total;
check('60 días sin publicar no dejan la cuenta en negativo y la reducen', f >= 0 && f < 50, f);
f = 50;
for (let d = 1; d <= 60; d++) f = settle({ f, rep: 4.5, pend: [{ k: 'Post', n: 6, post: true }], extra: [{ k: 'Boca a boca', n: 3 }] }).total;
check('60 días publicando con buena nota crecen y siguen acotados', f > 50 && f <= 99999, f);

console.log('\n' + (ko ? 'FALLOS: ' + ko : 'TODOS LOS TESTS OK') + ' · superados: ' + ok);
process.exit(ko ? 1 : 0);
