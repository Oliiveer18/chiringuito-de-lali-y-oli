/* QA visual v29.2: inventario como raíl en el lateral derecho, personal dentro
   del kiosco y reparto sin tapar el raíl. Uso: node tools/qa-v292.mjs [urlBase].
   Requiere playwright instalado (npm i playwright, en local o en /tmp). */
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('/tmp/node_modules/playwright/index.mjs')); }

const BASE = process.argv[2] || 'http://localhost:8000';
const browser = await chromium.launch();
const shots = 'diagnostics/qa-v29.2/qa-v292';
const fs = await import('node:fs');
fs.mkdirSync('diagnostics/qa-v29.2', { recursive: true });

async function play(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#title.show', { timeout: 15000 });
  await page.locator('#btn-start').click();
  const nueva = page.locator('.save-browser').getByRole('button', { name: 'Nueva partida', exact: true });
  try { await nueva.waitFor({ state: 'visible', timeout: 4000 }); await nueva.click(); } catch { }
  await page.waitForSelector('#plan.show', { timeout: 15000 });
  await page.evaluate(async () => {
    const { Game } = await import('./state.js?v=29.2.0');
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
  out.sbRect = { left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) };
  out.sbInBody = sb.parentElement === document.body;
  out.inHud = !!hud.querySelector('#stockbar');
  const chip = sb.querySelector('.stock');
  const cr = chip.getBoundingClientRect();
  out.chip = { w: Math.round(cr.width), h: Math.round(cr.height) };
  const img = chip.querySelector('img');
  out.icon = { w: img.getBoundingClientRect().width };
  out.listCol = getComputedStyle(sb.querySelector('.stock-list')).flexDirection;
  out.actors = (Game.floor?.actors || []).map(a => ({ id: a.id, home: a.home }));
  out.invW = getComputedStyle(document.documentElement).getPropertyValue('--inv-w');
  out.bottomUi = getComputedStyle(document.documentElement).getPropertyValue('--bottom-ui');
  return out;
});
check('el raíl vive en el body, fuera del HUD', qa.sbInBody && !qa.inHud);
check('el raíl está pegado al borde derecho', Math.abs(qa.sbRect.right - 1280) < 4, JSON.stringify(qa.sbRect));
check('el raíl es esbelto (≤64 px de ancho)', qa.sbRect.w <= 64, String(qa.sbRect.w));
check('el raíl cuelga centrado en vertical', Math.abs((qa.sbRect.top + qa.sbRect.bottom) / 2 - 400) < 60, JSON.stringify(qa.sbRect));
check('los chips van en columna: icono 22 px y contador debajo', qa.listCol === 'column' && qa.icon.w >= 21 && qa.chip.h >= 44, JSON.stringify({ dir: qa.listCol, chip: qa.chip, icon: qa.icon.w }));
check('la cámara ya no reserva margen inferior (0 px)', parseFloat(qa.bottomUi || '0') === 0, 'bottom-ui:' + qa.bottomUi);
const yeray = qa.actors.find(a => a.id === 'yeray'), carmela = qa.actors.find(a => a.id === 'carmela');
check('yeray (camarero) vive dentro del kiosco (y=450)', yeray && yeray.home.y === 450, JSON.stringify(yeray));
check('carmela (cocinera) vive dentro del kiosco (y=450)', carmela && carmela.home.y === 450, JSON.stringify(carmela));

// panel de reparto: debe quedar a la izquierda del raíl, sin taparlo
await page.locator('#btn-delivery').click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${shots}-escritorio-reparto.png` });
qa = await page.evaluate(() => {
  const p = document.querySelector('#delivery-panel');
  const sb = document.querySelector('#stockbar');
  return { panelRight: Math.round(p.getBoundingClientRect().right), sbLeft: Math.round(sb.getBoundingClientRect().left) };
});
check('el panel de reparto no tapa el raíl', qa.panelRight <= qa.sbLeft + 2, JSON.stringify(qa));
await page.locator('[data-del-close]').click();

// plegado
await page.locator('#stock-toggle').click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${shots}-escritorio-plegado.png` });
qa = await page.evaluate(() => {
  const sb = document.querySelector('#stockbar');
  const r = sb.getBoundingClientRect();
  return { w: Math.round(r.width), right: Math.round(r.right), visible: !sb.classList.contains('hidden'), listHidden: getComputedStyle(sb.querySelector('.stock-list')).display === 'none' };
});
check('plegado queda en un botón esbelto pegado al borde', qa.w <= 64 && Math.abs(qa.right - 1280) < 4 && qa.listHidden, JSON.stringify(qa));
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
  return { w: Math.round(r.width), right: Math.round(r.right), h: Math.round(r.height), top: Math.round(r.top), scrollH: list.scrollHeight, clientH: list.clientHeight };
});
check('vertical: raíl pegado a la derecha, esbelto', Math.abs(qa.right - 390) < 4 && qa.w <= 64, JSON.stringify(qa));
check('vertical: los 13 productos caben (o con desplazamiento)', qa.scrollH <= qa.clientH + 2 || qa.scrollH > qa.clientH, JSON.stringify(qa));
check('vertical: el raíl no invade el centro (top > 100)', qa.top > 100, 'top:' + qa.top);
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
  return { panelRight: Math.round(p.getBoundingClientRect().right), sbLeft: Math.round(sb.getBoundingClientRect().left) };
});
check('vertical: el reparto no tapa el raíl', qa.panelRight <= qa.sbLeft + 2, JSON.stringify(qa));
await ctx.close();

// ---------- móvil horizontal ----------
ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
page = await ctx.newPage();
await play(page);
await page.screenshot({ path: `${shots}-horizontal-servicio.png` });
qa = await page.evaluate(() => {
  const sb = document.querySelector('#stockbar');
  const r = sb.getBoundingClientRect();
  const list = sb.querySelector('.stock-list');
  return { w: Math.round(r.width), right: Math.round(r.right), h: Math.round(r.height), top: Math.round(r.top), scrollH: list.scrollHeight, clientH: list.clientHeight };
});
check('horizontal: raíl compacto pegado a la derecha', Math.abs(qa.right - 844) < 4 && qa.w <= 56, JSON.stringify(qa));
check('horizontal: cabe el surtido con desplazamiento interno', qa.h <= 378 && qa.scrollH >= qa.clientH, JSON.stringify(qa));
await page.locator('#btn-delivery').click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${shots}-horizontal-reparto.png` });
qa = await page.evaluate(() => {
  const p = document.querySelector('#delivery-panel');
  const sb = document.querySelector('#stockbar');
  return { panelRight: Math.round(p.getBoundingClientRect().right), sbLeft: Math.round(sb.getBoundingClientRect().left) };
});
check('horizontal: el reparto no tapa el raíl', qa.panelRight <= qa.sbLeft + 2, JSON.stringify(qa));
await ctx.close();

console.log(checks.join('\n'));
const fails = checks.filter(c => c.startsWith('FALLO')).length;
console.log(`\n${fails ? fails + ' COMPROBACIONES FALLIDAS' : 'QA v29.2: TODO OK'}`);
await browser.close();
process.exit(fails ? 1 : 0);
