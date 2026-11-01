/* Prueba de interrupción de red en plena partida (el objetivo "sin interrupción").
   Lleva a ambas jugadoras al modo servicio y luego corta la red de la invitada
   varios segundos: el juego debe pausarse, avisar y recuperar la partida solo.
   Uso: node tools/e2e-interruption.mjs [direct|relay] */
import pkg from 'playwright';
const { chromium } = pkg;

const URL = process.env.E2E_URL || 'https://oliiveer18.github.io/chiringuito-de-lali-y-oli/';
const MODE = process.argv[2] || 'direct';

const browser = await chromium.launch({ headless: true });
const hostCtx = await browser.newContext();
const guestCtx = await browser.newContext();
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
  // capturar los WebSockets del relé de la invitada para poder cortarlos
  // en plena partida (simula pérdida de red del móvil)
  await guestCtx.addInitScript(() => {
    window.__relays = [];
    const Orig = WebSocket;
    window.WebSocket = class extends Orig {
      constructor(...a) {
        super(...a);
        if (String(a[0]).includes(':8084')) window.__relays.push(this);
      }
    };
  });
}

const host = await hostCtx.newPage();
const guest = await guestCtx.newPage();
host.on('pageerror', e => console.log('[host pageerror]', e.message));
guest.on('pageerror', e => console.log('[guest pageerror]', e.message));

const t0 = Date.now();
const log = (m) => console.log(`+${((Date.now() - t0) / 1000).toFixed(1)}s ${m}`);
const mode = () => guest.evaluate(() => JSON.parse(window.render_game_to_text()).mode);

await host.goto(URL, { waitUntil: 'load' });
await guest.goto(URL, { waitUntil: 'load' });
await host.waitForSelector('#btn-coop', { state: 'visible' });

async function openLobby(page, kind) {
  await page.click('#btn-coop');
  await page.waitForSelector('.save-browser:not([hidden])');
  await page.click(`.save-browser .save-action:has-text("${kind}")`);
  await page.waitForSelector('#lobby.show');
}
await openLobby(host, 'Nueva partida');
await host.fill('#lobby-name', 'Lali');
await host.click('#btn-create');
await host.waitForFunction(() => {
  const el = document.querySelector('#lobby-code');
  return el && el.textContent && el.textContent !== '····';
});
const code = (await host.textContent('#lobby-code')).trim();
await openLobby(guest, 'Unirme con código');
await guest.fill('#lobby-name', 'Oli');
await guest.fill('#lobby-join-code', code);
await guest.click('#btn-join');
await host.waitForFunction(() => {
  const b = document.querySelector('#btn-lobby-go');
  return b && !b.disabled;
}, null, { timeout: 45000 });
log(`pareja conectada (${MODE})`);

// Empezar temporada y abrir el chiringuito (ambas listas)
await host.click('#btn-lobby-go');
await host.waitForSelector('#plan.show', { timeout: 30000 });
await guest.waitForSelector('#plan.show', { timeout: 30000 });
await guest.evaluate(() => window.__test.pressReady());
await host.evaluate(() => window.__test.pressReady());
await host.waitForFunction(() => document.querySelector('#hud') && !document.querySelector('#hud').classList.contains('hidden'), null, { timeout: 30000 });
await guest.waitForFunction(() => document.querySelector('#hud') && !document.querySelector('#hud').classList.contains('hidden'), null, { timeout: 30000 });
log('partida en servicio, día ' + await guest.evaluate(() => JSON.parse(window.render_game_to_text()).day));

// Acción de la invitada para confirmar ida y vuelta de mensajes
const ackBefore = await guest.evaluate(() => { window.__test.guestClean(0); return window.__api.netStats().ackLog.length; });
await guest.waitForFunction(() => window.__api.netStats().ackLog.length > 0, null, { timeout: 15000 });
log('acciones invitada→anfitriona confirmadas (acks)');

// ---- Corte de red de la invitada: matar su WebSocket del relé en plena partida ----
await guest.evaluate(() => window.__relays.forEach(ws => { try { ws.close(); } catch (e) {} }));
log('relé de la invitada cortado en plena partida');
await guest.waitForSelector('#netmsg.show', { timeout: 20000 });
log('aviso de reconexión visible (correcto)');
await guest.waitForTimeout(3000); // 3 s sin conexión

// El juego debe recuperar la sesión solo: el aviso desaparece y siguen en servicio
await guest.waitForFunction(() => !document.querySelector('#netmsg').classList.contains('show'), null, { timeout: 60000 });
log('sesión recuperada sin recargar la página');
const m = await mode();
if (m !== 'service') throw new Error('Modo tras recuperación: ' + m + ' (esperaba service)');
log('siguen en modo servicio');

// ¿Vuelven a fluir acciones tras la recuperación?
const ackCount = await guest.evaluate(() => window.__api.netStats().ackLog.length);
await guest.evaluate(() => window.__test.guestClean(1));
await guest.waitForFunction(n => window.__api.netStats().ackLog.length > n, ackCount, { timeout: 20000 });
log('acciones confirmadas tras la recuperación (E2E OK)');
await browser.close();
console.log('RESULTADO: OK');
