/* QA visual v29.1: capturas en móvil vertical, horizontal y escritorio contra el
   servidor local. Uso: node tools/qa-v291.mjs [urlBase] (por defecto :8000).
   Requiere playwright instalado (npm i playwright, en local o en /tmp). */
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('/tmp/node_modules/playwright/index.mjs')); }

const BASE = process.argv[2] || 'http://localhost:8000';
const browser = await chromium.launch();
const shots = 'diagnostics/qa-v29.1/qa-v291';

async function play(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#title.show', { timeout: 15000 });
  await page.locator('#btn-start').click();
  // navegador de partidas guardadas (si aparece): nueva partida
  const nueva = page.locator('.save-browser').getByRole('button', { name: 'Nueva partida', exact: true });
  try { await nueva.waitFor({ state: 'visible', timeout: 4000 }); await nueva.click(); } catch { }
  await page.waitForSelector('#plan.show', { timeout: 15000 });
  // stock variado para ver estados: normal, bajo y agotado
  await page.evaluate(async () => {
    const { Game } = await import('./state.js?v=29.2.0');
    for (const id of Object.keys(Game.stock)) Game.stock[id] = 25;
    Game.stock.papas = 4; Game.stock.queso = 0;
  });
  await page.locator('#btn-open').click();
  await page.waitForSelector('#hud:not(.hidden)', { timeout: 15000 });
  await page.waitForTimeout(1200);
}

// ---------- móvil vertical ----------
let ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
let page = await ctx.newPage();
await play(page);
await page.screenshot({ path: `${shots}-vertical-servicio.png` });
await page.locator('#stock-toggle').click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${shots}-vertical-plegado.png` });
await page.locator('#stock-toggle').click(); // desplegar de nuevo
await page.locator('#btn-delivery').click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${shots}-vertical-reparto.png` });
await ctx.close();

// ---------- móvil horizontal ----------
ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
page = await ctx.newPage();
await play(page);
await page.screenshot({ path: `${shots}-horizontal-servicio.png` });
await page.locator('#btn-delivery').click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${shots}-horizontal-reparto.png` });
await ctx.close();

// ---------- escritorio ----------
ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
page = await ctx.newPage();
await play(page);
await page.screenshot({ path: `${shots}-escritorio-servicio.png` });
await ctx.close();

await browser.close();
console.log('QA v29.1: capturas escritas con prefijo ' + shots);
