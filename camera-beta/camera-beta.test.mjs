import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
for (const f of ['camera-beta/camera-beta.js','camera-beta/gamefeel.js','camera-beta/player.js','camera-beta/netplayer.js','camera-beta/balance.js','camera-beta/game.js','camera-beta/index.html']) assert.ok(readFileSync(f,'utf8').length>0, f+' vacío');
const g=readFileSync('camera-beta/game.js','utf8');
assert.ok(g.includes('initCamBeta()')&&g.includes('betaLoop')&&g.includes('playerTick(dt)')&&g.includes('fxTick(dt)')&&g.includes('netPlayerTick(dt)')&&g.includes('applyBalance()')&&g.includes('pointerdown'));
assert.ok(g.includes("'../"), 'la copia debe importar el núcleo desde la raíz');
const cam=readFileSync('camera-beta/camera-beta.js','utf8');
assert.ok(cam.includes('autoDelay')&&cam.includes('zones'));
console.log('OK camera-beta: copia en carpeta, integrada en el bucle y con imports relativos correctos.');
