import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateGlbBuffer,
  safeGlbFilename,
  assetIdFromTask,
  readManifest,
  writeManifest,
  upsertAsset,
} from './server/tripo-assets.mjs';
import { mockGlbBuffer } from './server/tripo-mock.mjs';
import { GENERATED_DIR } from './server/tripo-paths.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let ok = 0;
let ko = 0;
const check = (n, c, x) => {
  if (c) {
    ok++;
    console.log('  ok  ' + n);
  } else {
    ko++;
    console.log('  FALLO  ' + n + (x !== undefined ? ' → ' + x : ''));
  }
};

const good = mockGlbBuffer();
check('validateGlbBuffer acepta mock GLB', validateGlbBuffer(good).ok === true);
check('validateGlbBuffer rechaza basura', validateGlbBuffer(Buffer.from('nope')).ok === false);
check('safeGlbFilename sanitiza', /^mock-task/.test(safeGlbFilename('mock-task-00000000-0000-4000-8000-000000000001')));
check('assetId estable', assetIdFromTask('abc-123') === 'tripo_abc-123');

await fs.mkdir(GENERATED_DIR, { recursive: true });
const manifestPath = path.join(GENERATED_DIR, 'manifest.json');
const backup = await fs.readFile(manifestPath).catch(() => null);

try {
  await writeManifest({ assets: [] });
  const a = await upsertAsset({
    taskId: 'unit-task-1',
    displayName: 'Prueba · objeto',
    category: 'objeto',
    state: 'validado',
    glbPath: '/generated/tripo/unit-task-1.glb',
  });
  const m = await readManifest();
  check('manifest persiste activo', m.assets.some(x => x.id === a.id));
  check('estado validado en manifest', m.assets.find(x => x.id === a.id).state === 'validado');
} finally {
  if (backup) await fs.writeFile(manifestPath, backup);
  else await fs.unlink(manifestPath).catch(() => {});
}

console.log('\nTripo assets unit: ' + ok + ' ok, ' + ko + ' fallos');
if (ko) process.exit(1);
