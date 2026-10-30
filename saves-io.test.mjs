/* Pruebas de las utilidades puras de guardado (exportar/importar, v28.15). */
import { encode, decode, copy, uid, valid, parseLibrary, mergeImported, exportFileName } from './saves-io.mjs?v=28.17.0';

let ok = 0, ko = 0;
const check = (name, cond, extra) => {
  if (cond) { ok++; console.log('  ok  ' + name); }
  else { ko++; console.log('  FALLO  ' + name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); }
};

console.log('encode/decode');
const withSet = { regulars: { juan: { loyalty: new Set(['a', 'b']) } } };
const round = decode(encode(withSet));
check('roundtrip conserva Sets', round.regulars.juan.loyalty instanceof Set && round.regulars.juan.loyalty.has('b'));
check('copy es independiente', copy(withSet) !== withSet && copy(withSet).regulars.juan.loyalty instanceof Set);
check('uid no vacío y único-ish', uid() !== uid() && uid().length >= 8);

console.log('valid');
const base = () => ({ kind: 'solo', phase: 'plan', data: { day: 5, money: 100, rep: 50, forecast: ['sol'], stock: {}, prices: {}, enabled: {}, upgrades: {}, staff: {}, season: {}, regulars: {} } });
check('guardado válido', valid(base()));
check('sin day no vale', !valid({ ...base(), data: { ...base().data, day: 0 } }));
check('día fuera de rango no vale', !valid({ ...base(), data: { ...base().data, day: 31 } }));
check('kind raro no vale', !valid({ ...base(), kind: 'mal' }));
check('report sin ui no vale', !valid({ ...base(), phase: 'report' }));
check('report con ui sí vale', valid({ ...base(), phase: 'report', ui: { body: 'x' }, data: { ...base().data, dayStats: {}, revModel: {} } }));
check('null no vale', !valid(null));

console.log('parseLibrary');
check('biblioteca válida pasa', parseLibrary(encode([base()])).length === 1);
check('biblioteca corrupta lanza', (() => { try { parseLibrary('{"a":1}'); return false; } catch (e) { return true; } })());
check('biblioteca con un guardado malo lanza', (() => { try { parseLibrary(encode([base(), { basura: true }])); return false; } catch (e) { return true; } })());

console.log('mergeImported (v28.15)');
const s1 = { ...base(), id: 'uno' };
const s2 = { ...base(), id: 'dos', data: { ...base().data, day: 9 } };
check('añade un guardado nuevo', mergeImported([s1], s2).length === 2);
check('re-importar sustituye por id', (() => { const merged = mergeImported([s1], { ...s1, data: { ...s1.data, day: 7 } }); return merged.length === 1 && merged[0].data.day === 7; })());
check('guardado inválido lanza', (() => { try { mergeImported([s1], { mal: true }); return false; } catch (e) { return true; } })());

console.log('exportFileName');
const named = exportFileName({ ...base(), date: '2026-10-30T12:34:56.000Z' });
check('nombre descriptivo', /^chiringuito-solo-dia5-\d{8}-\d{4}\.json$/.test(named), named);
check('coop en el nombre', exportFileName({ ...base(), kind: 'coop' }).includes('coop'));
check('sin date no explota', exportFileName(base()).startsWith('chiringuito-solo-dia5-'));

console.log('\n' + ok + ' ok, ' + ko + ' fallos');
if (ko) process.exit(1);
