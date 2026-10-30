/* Prueba e2e del cooperativo (v28.16): anfitrión crea sala, invitado se une con
   el código, y la partida arranca en los dos lados. Necesita el servidor local:
   start_server python3 -m http.server 8123 → node rt-test.mjs */
import pw from '/home/user/node_modules/playwright-core/index.mjs';
const { chromium } = pw;

const base = process.env.RT_BASE || 'http://localhost:8123';
const log = (...a) => console.log(new Date().toLocaleTimeString('es-ES'), ...a);

const browser = await chromium.launch({ headless: true });
const mk = async (tag) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(tag + ' PAGEERROR: ' + String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(tag + ' CONSOLE: ' + m.text()); });
  return { ctx, page, errs };
};
const A = await mk('A'), B = await mk('B');

log('abriendo anfitrión…');
await A.page.goto(base + '/?fresh=' + Date.now(), { waitUntil: 'domcontentloaded' });
await A.page.click('#btn-coop');
await A.page.getByRole('button', { name: 'Nueva partida' }).click(); // pantalla de partidas → nueva
await A.page.fill('#lobby-name', 'Anfitrion');
await A.page.click('#btn-create');
await A.page.waitForFunction(() => /^[A-Z]{4}$/.test(document.querySelector('#lobby-code')?.textContent || ''), null, { timeout: 20000 });
const code = (await A.page.textContent('#lobby-code')).trim();
log('código de sala:', code);

log('abriendo invitado…');
await B.page.goto(base + '/?fresh=' + Date.now(), { waitUntil: 'domcontentloaded' });
await B.page.click('#btn-coop');
await B.page.getByRole('button', { name: 'Unirme con código' }).click();
await B.page.fill('#lobby-name', 'Invitada');
await B.page.fill('#lobby-join-code', code);
await B.page.click('#btn-join');

let connected = false;
try {
  await A.page.waitForFunction(() => { const b = document.querySelector('#btn-lobby-go'); return b && !b.disabled && !b.classList.contains('hidden'); }, null, { timeout: 30000 });
  connected = true;
} catch {}
log(connected ? '✔ CONECTADOS en el lobby.' : '✘ NO CONECTARON en 30 s.');

let started = false;
if (connected) {
  await A.page.click('#btn-lobby-go'); // empezar la temporada
  try {
    await A.page.waitForFunction(() => document.querySelector('#plan')?.classList.contains('show'), null, { timeout: 15000 });
    await B.page.waitForFunction(() => document.querySelector('#plan')?.classList.contains('show'), null, { timeout: 15000 });
    started = true;
  } catch {}
}
log(started ? '✔ PARTIDA ARRANCADA en los dos jugadores (pantalla de plan sincronizada).' : '✘ La partida no llegó a arrancar en ambos.');
log('errores A:', A.errs.slice(0, 6));
log('errores B:', B.errs.slice(0, 6));
await browser.close();
process.exit(started ? 0 : 1);
