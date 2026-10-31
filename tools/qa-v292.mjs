/* QA visual v29.2: inventario al pie, personal dentro del kiosco y reparto
   sobre la franja. Uso: node tools/qa-v292.mjs [urlBase] (por defecto :8000).
   Requiere playwright instalado (npm i playwright, en local o en /tmp). */
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('/tmp/node_modules/playwright/index.mjs')); }

const BASE = process.argv[2] || 'http://localhost:8000';
const browser = await chromium.launch();
const shots = 'diagnostics/qa-v29.2/qa-v292';
const fs = await import('node:fs');
fs.mkdirSync('diagnostics/qa-v29.2', { recursive: true });

async function play(page, hires) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#title.show', { timeout: 15000 });
  await page.locator('#btn-start').click();
  const nueva = page.locator('.save-browser').getByRole('button', { name: 'Nueva partida', exact: true });
  try { await nueva.waitFor({ state: 'visible', timeout: 4000 }); await nueva.click(); } catch { }
  await page.waitForSelector('#plan.show', { timeout: 15000 });
  await page.evaluate(async () => {
    const { Game } = await import('./state.js?v=29.2.0');
    // plantilla completa y terraza al máximo para ver el personal y las mesas
    Game.staff.camarero = true; Game.staff.cocinero = true; Game.staff.limpiador = true;
    Game.upgrades.mesas = 3; Game.upgrades.terraza = 3;
    for (const id of Object.keys(Game.stock)) Game.stock[id] = 25;
    Game.stock.papas = 4; Game.stock.queso = 0; Game.stock.refresco = 8;
  });
  await page.locator('#btn-open').click();
  await page.waitForSelector('#hud:not(.hidden)', { timeout: 15000 });
  await page.waitForTimeout(1500);
}

const checks = [];
const check = (name, ok, detail) => { checks.push(`${ok ? 'OK' : 'FALLO'} · ${name}${detail ? ' — ' + detail : ''}`); };

// ---------- escritorio ----------
let ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
let page = await ctx.newPage();
await play(page);
await page.screenshot({ path: `${shots}-escritorio-servicio.png` });

let qa = await page.evaluate(() => {
  const out = {};
  const sb = document.querySelector('#stockbar');
  const hud = document.querySelector('#hud');
  const r = sb.getBoundingClientRect();
  out.sbRect = { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) };
  out.sbInBody = sb.parentElement === document.body;
  out.inHud = !!hud.querySelector('#stockbar');
  out.hudH = Math.round(hud.getBoundingClientRect().height);
  const chip = sb.querySelector('.stock');
  const cr = chip.getBoundingClientRect();
  out.chip = { w: Math.round(cr.width), h: Math.round(cr.height) };
  const img = chip.querySelector('img');
  out.icon = { w: img.getBoundingClientRect().width };
  out.actors = (Game.floor?.actors || []).map(a => ({ id: a.id, home: a.home, x: Math.round(a.x), y: Math.round(a.y) }));
  out.invH = getComputedStyle(document.documentElement).getPropertyValue('--inv-h');
  out.bottomUi = getComputedStyle(document.documentElement).getPropertyValue('--bottom-ui');
  out.camView = { top: Math.round(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--scene-top'))), bottom: Math.round(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--scene-bottom'))) };
  return out;
});
check('la franja vive en el body, fuera del HUD', qa.sbInBody && !qa.inHud);
check('la franja está pegada abajo (bottom≈alto de ventana)', Math.abs(qa.sbRect.bottom - 800) < 4, JSON.stringify(qa.sbRect));
check('la franja mide ~54 px de alto', qa.sbRect.h >= 50 && qa.sbRect.h <= 66, String(qa.sbRect.h));
check('chips grandes: 40 px de alto, icono 24 px', qa.chip.h >= 39 && qa.chip.h <= 42 && qa.icon.w >= 23, JSON.stringify(qa.chip) + ' icon:' + qa.icon.w);
check('la cámara reserva el margen inferior', qa.invH.trim() !== '' && parseFloat(qa.invH) > 40 && qa.camView.bottom !== null && qa.camView.bottom < 790, `inv-h:${qa.invH} bottom-ui:${qa.bottomUi} escena:${JSON.stringify(qa.camView)}`);
const yeray = qa.actors.find(a => a.id === 'yeray'), carmela = qa.actors.find(a => a.id === 'carmela');
check('yeray (camarero) vive dentro del kiosco (y=450)', yeray && yeray.home.y === 450, JSON.stringify(yeray));
check('carmela (cocinera) vive dentro del kiosco (y=450)', carmela && carmela.home.y === 450, JSON.stringify(carmela));

// panel de reparto: debe quedar por encima de la franja
await page.locator('#btn-delivery').click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${shots}-escritorio-reparto.png` });
qa = await page.evaluate(() => {
  const p = document.querySelector('#delivery-panel');
  const sb = document.querySelector('#stockbar');
  return { panelBottom: Math.round(p.getBoundingClientRect().bottom), sbTop: Math.round(sb.getBoundingClientRect().top) };
});
check('el panel de reparto queda sobre la franja', qa.panelBottom <= qa.sbTop + 2, JSON.stringify(qa));
await page.locator('[data-del-close]').click();

// plegado
await page.locator('#stock-toggle').click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${shots}-escritorio-plegado.png` });
qa = await page.evaluate(() => {
  const sb = document.querySelector('#stockbar');
  const r = sb.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height), centered: Math.abs((r.left + r.right) / 2 - 640) < 40 };
});
check('plegada es una píldora centrada y baja', qa.h <= 52 && qa.centered, JSON.stringify(qa));
await page.locator('#stock-toggle').click();
await ctx.close();

// ---------- móvil vertical ----------
ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
page = await ctx.newPage();
await play(page);
await page.screenshot({ path: `${shots}-vertical-servicio.png` });
qa = await page.evaluate(() => {
  const sb = document.querySelector('#stockbar');
  const r = sb.getBoundingClientRect();
  const list = sb.querySelector('.stock-list');
  return { w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(r.bottom), scrollW: list.scrollWidth, clientW: list.clientWidth, hidden: sb.classList.contains('hidden') };
});
check('vertical: franja abajo a lo ancho', qa.w >= 386 && Math.abs(qa.bottom - 844) < 6, JSON.stringify(qa));
check('vertical: los 13 productos caben con desplazamiento', qa.scrollW >= qa.clientW, JSON.stringify(qa));
await page.locator('#stock-toggle').click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${shots}-vertical-plegado.png` });
await page.locator('#stock-toggle').click();
await page.locator('#btn-delivery').click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${shots}-vertical-reparto.png` });
qa = await page.evaluate(() => {
  const p = document.querySelector('#delivery-panel');
  const sb = document.querySelector('#stockbar');
  return { panelBottom: Math.round(p.getBoundingClientRect().bottom), sbTop: Math.round(sb.getBoundingClientRect().top) };
});
check('vertical: reparto sobre la franja', qa.panelBottom <= qa.sbTop + 2, JSON.stringify(qa));
await ctx.close();

// ---------- móvil horizontal ----------
ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
page = await ctx.newPage();
await play(page);
await page.screenshot({ path: `${shots}-horizontal-servicio.png` });
qa = await page.evaluate(() => {
  const sb = document.querySelector('#stockbar');
  const r = sb.getBoundingClientRect();
  const chip = sb.querySelector('.stock');
  const hint = document.querySelector('#hint');
  return { h: Math.round(r.height), bottom: Math.round(r.bottom), chipH: Math.round(chip.getBoundingClientRect().height), hintTop: hint ? Math.round(hint.getBoundingClientRect().top) : null, hintBottom: hint ? Math.round(hint.getBoundingClientRect().bottom) : null };
});
check('horizontal: franja compacta (≤48 px) pegada abajo', qa.h <= 48 && Math.abs(qa.bottom - 390) < 6, JSON.stringify(qa));
check('horizontal: chips legibles (≥32 px)', qa.chipH >= 32, String(qa.chipH));
await page.locator('#btn-delivery').click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${shots}-horizontal-reparto.png` });
await ctx.close();

console.log(checks.join('\n'));
const fails = checks.filter(c => c.startsWith('FALLO')).length;
console.log(`\n${fails ? fails + ' COMPROBACIONES FALLIDAS' : 'QA v29.2: TODO OK'}`);
await browser.close();
process.exit(fails ? 1 : 0);
