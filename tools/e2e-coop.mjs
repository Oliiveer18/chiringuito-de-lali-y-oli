/* Prueba end-to-end del cooperativo contra el sitio desplegado (GitHub Pages).
   Dos contextos de navegador independientes = dos móviles distintos.
   Modo 'direct' (WebRTC normal) y modo 'relay' (sin candidatos ICE: simula
   dos redes distintas sin ruta directa, el caso NAT estricto/CGNAT). */
import pkg from 'playwright';
const { chromium } = pkg;

const URL = process.env.E2E_URL || 'https://oliiveer18.github.io/chiringuito-de-lali-y-oli/';
const MODE = process.argv[2] || 'direct'; // direct | relay

const browser = await chromium.launch({ headless: true });
const ctxOpts = MODE === 'relay' ? { hasTouch: true } : {};
const hostCtx = await browser.newContext(ctxOpts);
const guestCtx = await browser.newContext(ctxOpts);

// En modo relay: bloquear todos los candidatos ICE en ambos lados para que
// la conexión directa WebRTC no pueda abrirse (como con CGNAT en ambos móviles).
if (MODE === 'relay') {
  for (const ctx of [hostCtx, guestCtx]) {
    await ctx.addInitScript(() => {
      const orig = RTCPeerConnection.prototype.addIceCandidate;
      RTCPeerConnection.prototype.addIceCandidate = function (c, ...rest) {
        if (c && c.candidate && c.candidate !== 'end-of-candidates') return Promise.resolve();
        return orig.call(this, c, ...rest);
      };
    });
  }
}

const host = await hostCtx.newPage();
const guest = await guestCtx.newPage();
host.on('pageerror', e => console.log('[host pageerror]', e.message));
guest.on('pageerror', e => console.log('[guest pageerror]', e.message));
const sockets = { host: [], guest: [] };
host.on('websocket', ws => sockets.host.push(ws.url()));
guest.on('websocket', ws => sockets.guest.push(ws.url()));

const t0 = Date.now();
const log = (m) => console.log(`+${((Date.now() - t0) / 1000).toFixed(1)}s ${m}`);

await host.goto(URL, { waitUntil: 'load' });
await guest.goto(URL, { waitUntil: 'load' });
await host.waitForSelector('#btn-coop', { state: 'visible' });
log('páginas cargadas');

// El botón del coop abre primero la biblioteca de partidas guardadas (saves.js):
// hay que elegir "Nueva partida" (anfitrión) o "Unirme con código" (invitada).
async function openLobby(page, kind) {
  await page.click('#btn-coop');
  await page.waitForSelector('.save-browser:not([hidden])', { timeout: 10000 });
  await page.click(`.save-browser .save-action:has-text("${kind}")`);
  await page.waitForSelector('#lobby.show', { timeout: 10000 });
}

// Anfitrión crea la sala
await openLobby(host, 'Nueva partida');
await host.fill('#lobby-name', 'Lali');
await host.click('#btn-create');
await host.waitForFunction(() => {
  const el = document.querySelector('#lobby-code');
  return el && el.textContent && el.textContent !== '····';
}, null, { timeout: 30000 });
const code = (await host.textContent('#lobby-code')).trim();
log(`sala creada, código ${code}`);

// Invitada se une
await openLobby(guest, 'Unirme con código');
await guest.fill('#lobby-name', 'Oli');
await guest.fill('#lobby-join-code', code);
await guest.click('#btn-join');

// Esperar a que la anfitriona vea a la invitada (botón de empezar habilitado)
await host.waitForFunction(() => {
  const b = document.querySelector('#btn-lobby-go');
  return b && !b.disabled;
}, null, { timeout: 45000 });
const hostPeerText = (await host.textContent('#lobby-peer')).trim();
log(`invitada unida (host ve: "${hostPeerText}")`);

// Estado del lobby de la invitada
const guestInfo = (await guest.textContent('#guest-info')).trim();
log(`invitada ve: "${guestInfo}"`);

// Empezar la temporada
await host.click('#btn-lobby-go');
await host.waitForSelector('#plan.show', { timeout: 30000 });
log('anfitriona en el menú de temporada');

await guest.waitForSelector('#plan.show', { timeout: 30000 });
log('invitada en el menú de temporada (E2E OK)');

// ¿Qué camino se usó? El badge del lobby/host lo cuenta en el estado
const relayUsed = await host.evaluate(() => document.documentElement.dataset.version || '');
const status = (await host.textContent('#lobby-status') || '').trim();
console.log('modo probado:', MODE, '| status tras conexión:', status || '(vacío)');
console.log('WebSockets anfitriona:', sockets.host.join(' · ') || 'ninguno');
console.log('WebSockets invitada:', sockets.guest.join(' · ') || 'ninguno');
console.log('vía relé MQTT:', sockets.host.some(u => u.includes('8084')) && sockets.guest.some(u => u.includes('8084')) ? 'SÍ' : 'no');
await browser.close();
console.log('RESULTADO: OK');
