/* Repro v29.2: traza el recorrido del personaje al limpiar dos mesas seguidas.
   Uso: node tools/repro-camino.mjs [urlBase] */
let chromium;
try { ({ chromium } = await import('playwright')); }
catch { ({ chromium } = await import('/tmp/node_modules/playwright/index.mjs')); }
const BASE = process.argv[2] || 'http://localhost:8000';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#title.show');
await page.locator('#btn-start').click();
const nueva = page.locator('.save-browser').getByRole('button', { name: 'Nueva partida', exact: true });
try { await nueva.waitFor({ state: 'visible', timeout: 4000 }); await nueva.click(); } catch { }
await page.waitForSelector('#plan.show');
await page.locator('#btn-open').click();
await page.waitForSelector('#hud:not(.hidden)');
await page.waitForTimeout(800);

const api = await page.evaluate(() => window.__api);

async function trace(label, requestBWhen) {
  // mesa 0 (600,528) sucia → limpiar; mesa 9 (1192,640) sucia → limpiar durante la vuelta
  const out = await page.evaluate(async (args) => {
    const { Game } = await import('./state.js?v=29.2.0');
    const sim = await import('./sim.js?v=29.2.0');
    const api = window.__api;
    const log = [];
    const a = () => Game.floor?.actors.find(x => x.id === 'p1');
    const tables = Game.tables;
    // limpiar la mesa 0
    tables[0].state = 'dirty'; tables[0].cust = null;
    api.clean(tables[0]);
    const t0 = performance.now();
    let requested = false;
    const iv = setInterval(() => {
      const p = a();
      if (p) log.push([Math.round(performance.now() - t0), Math.round(p.x), Math.round(p.y), p.returning ? 'ret' : (p.task ? 'task' : 'idle')]);
      if (!requested && p && p.returning) {
        requested = true;
        // pedir la segunda limpieza YA (mesa 9, abajo a la derecha)
        tables[tables.length-1].state = 'dirty'; tables[tables.length-1].cust = null;
        api.clean(tables[tables.length-1]);
      }
      if (log.length > 400) clearInterval(iv);
    }, 120);
    // esperar a que la segunda tarea termine (mesa 9 limpia y sin tarea)
    await new Promise(res => {
      const chk = setInterval(() => {
        if (tables[tables.length-1].state === 'free' && !a()?.task && !a()?.returning) { clearInterval(chk); clearInterval(iv); res(); }
      }, 200);
      setTimeout(() => { clearInterval(chk); res(); }, 40000);
    });
    return { log, home: a() ? { x: a().home.x, y: a().home.y } : null, t9: { x: tables[tables.length-1].x, y: tables[tables.length-1].y }, requested };
  }, {});
  console.log('== ' + label + ' == home:', JSON.stringify(out.home), 'mesa9:', JSON.stringify(out.t9), 'segunda tarea pedida durante vuelta:', out.requested);
  for (const row of out.log) console.log(row.join('\t'));
}

await trace('limpieza A (mesa 0) y B (mesa 9) pedida al volver');
await browser.close();
