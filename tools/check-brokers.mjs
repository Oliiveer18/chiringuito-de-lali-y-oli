/* Comprueba en vivo los brokers MQTT del relé y los STUN usados por el juego. */
import pkg from 'playwright';
const { chromium } = pkg;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('console', m => console.log('[browser]', m.text()));

for (const url of [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.connectmq.com:8084/mqtt',
  'wss://broker.freemqtt.com:8084/mqtt',
]) {
  const ok = await page.evaluate(async (u) => {
    try {
      const ws = new WebSocket(u, 'mqtt');
      const res = await new Promise((resolve) => {
        const t = setTimeout(() => { ws.close(); resolve('timeout'); }, 7000);
        ws.onopen = () => { clearTimeout(t); ws.close(); resolve('open'); };
        ws.onerror = () => { clearTimeout(t); resolve('error'); };
      });
      return res;
    } catch (e) { return 'exception: ' + e.message; }
  }, url);
  console.log(url, '->', ok);
}
await browser.close();
