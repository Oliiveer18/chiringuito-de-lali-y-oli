/* Prueba de regresión v28.14.9: consistencia de la versión de módulos.
   El release v28.14.7 subió el sufijo de versión solo en los archivos raíz y olvidó
   sim/ y render/, que quedaron en 28.14.6. El navegador cargó DOS copias de
   cada módulo (dos objetos Game) y los flujos que cruzaban ambas copias fallaban:
   - "Cannot read properties of undefined (reading 'label')" (pronóstico en el plan)
   - "Cannot set properties of null (setting 'ledgerDay')" (beginLedgerDay)
   Esta prueba obliga a que TODOS los imports activos usen exactamente la versión
   declarada en version.js, para que no pueda repetirse. Uso: node version-consistency.test.mjs */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const version = readFileSync('version.js', 'utf8').match(/VERSION='(v[0-9.]+)'/)?.[1];
assert.ok(version, 'version.js debe declarar VERSION');

// carpetas que no forman parte del juego cargado por index.html
const SKIP = new Set(['node_modules', 'legacy', 'preview', 'camera-beta', '.git', '.github', 'diagnostics', 'tools']);
const files = [];
(function walk(dir){
  for (const name of readdirSync(dir)){
    if (name.startsWith('.') && name !== '.gitignore') continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()){ if (!SKIP.has(name)) walk(p); }
    else if (/\.(js|mjs|html|css)$/.test(name)) files.push(p);
  }
})('.');

const bad = new Set();
for (const f of files){
  const src = readFileSync(f, 'utf8');
  // cualquier sufijo de versión en imports/links del juego activo debe ser la versión actual
  for (const m of src.matchAll(/\?v=(v?[0-9]+(?:\.[0-9]+)*)/g)){
    const v = m[1].startsWith('v') ? m[1] : 'v' + m[1];
    if (v !== version) bad.add(f + ' usa la versión ' + m[1] + ' (esperada ' + version + ')');
  }
}

if (bad.size){
  console.error('version-consistency FALLÓ: versiones mezcladas en los módulos del juego');
  for (const b of bad) console.error('  ' + b);
  console.error('\nSube TODOS los sufijos de versión a ' + version + ' (incluidos sim/ y render/), o el navegador cargará copias duplicadas del estado.');
  process.exit(1);
}
console.log('version-consistency OK (' + files.length + ' archivos, todos los sufijos de versión coherentes con ' + version + ')');
