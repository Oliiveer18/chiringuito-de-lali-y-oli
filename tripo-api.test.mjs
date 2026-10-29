/* Tests del proxy Tripo (sin créditos; TRIPO_MOCK=1). */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertNoSecretsInSource } from './server/tripo-routes.mjs';
import { MOCK_TASK_ID, mockGlbBuffer } from './server/tripo-mock.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let ok = 0;
let ko = 0;
const check = (name, cond, extra) => {
  if (cond) {
    ok++;
    console.log('  ok  ' + name);
  } else {
    ko++;
    console.log('  FALLO  ' + name + (extra !== undefined ? ' → ' + extra : ''));
  }
};

function get(port, pathname) {
  return new Promise((resolve, reject) => {
    http.get({ port, path: pathname }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () =>
        resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) })
      );
    }).on('error', reject);
  });
}

function post(port, pathname, json) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(json);
    const req = http.request(
      {
        port,
        path: pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      },
      res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () =>
          resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') })
        );
      }
    );
    req.on('error', reject);
    req.end(body);
  });
}

// ---------- sin secretos en frontend ----------
for (const rel of ['tripo-client.js', 'tripo-panel.js', 'game.js']) {
  const src = fs.readFileSync(path.join(__dirname, rel), 'utf8');
  try {
    assertNoSecretsInSource(src, rel);
    check('sin claves en ' + rel, true);
  } catch (e) {
    check('sin claves en ' + rel, false, e.message);
  }
}
check('tripo-client no usa openapi.tripo3d.ai', !fs.readFileSync(path.join(__dirname, 'tripo-client.js'), 'utf8').includes('openapi.tripo3d.ai'));

// ---------- servidor mock ----------
process.env.TRIPO_MOCK = '1';
process.env.PORT = '0';
delete process.env.TRIPO_API_KEY;
const { default: server } = await import('./dev-server.mjs');
await new Promise(r => server.once('listening', r));
const port = server.address().port;

try {
  const cfg = await get(port, '/api/tripo/config');
  check('config mock', cfg.status === 200 && JSON.parse(cfg.body.toString()).mock === true);

  const bal = await get(port, '/api/tripo/balance');
  const balJ = JSON.parse(bal.body.toString());
  check('balance mock', bal.status === 200 && balJ.data.balance === 9999);

  const gen = await post(port, '/api/tripo/generate', {
    description: 'una concha marina',
    category: 'objeto',
    style: 'juego',
  });
  const genJ = JSON.parse(gen.body);
  check('generate mock task_id', gen.status === 200 && genJ.data.task_id === MOCK_TASK_ID);

  const task = await get(port, `/api/tripo/tasks/${MOCK_TASK_ID}`);
  const taskJ = JSON.parse(task.body.toString());
  check('task success mock', taskJ.data.status === 'success');

  const dl = await get(port, `/api/tripo/download/${MOCK_TASK_ID}`);
  check('download GLB mock', dl.status === 200 && dl.body.slice(0, 4).equals(mockGlbBuffer().slice(0, 4)));
  check(
    'GLB guardado en generated/tripo',
    fs.existsSync(path.join(__dirname, 'generated', 'tripo', `mock-task-00000000-0000-4000-8000-000000000001.glb`))
  );

  const manifest = await get(port, '/api/tripo/manifest');
  const manJ = JSON.parse(manifest.body.toString());
  check('manifest mock incluye activo', manJ.assets?.some(a => a.taskId === MOCK_TASK_ID));

  const reg = await post(port, '/api/tripo/assets/register', {
    taskId: MOCK_TASK_ID,
    displayName: 'Mock · objeto',
    category: 'objeto',
    description: 'test',
    style: 'juego',
  });
  check('register mock', reg.status === 200);

  const noKey = await get(port, '/api/tripo/balance');
  check('mock balance sin TRIPO_API_KEY', noKey.status === 200);
} finally {
  server.close();
}

console.log('\nTripo tests: ' + ok + ' ok, ' + ko + ' fallos');
if (ko) process.exit(1);
