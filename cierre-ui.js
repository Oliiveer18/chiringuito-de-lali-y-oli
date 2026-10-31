/* v25: bloque «Chiringo · balance de hoy» en el informe de cierre.
   El balance de seguidores se resuelve una sola vez al cerrar la jornada y se aplica en ese momento: al abrir el día siguiente no se repite. */
import { Game, Net } from './state.js?v=29.1.0';
import { escapeHtml, eur } from './util.js?v=29.1.0';
import { closeSocialDay } from './v12.js?v=29.1.0';

function closeHtml() {
  const u = Game.upgrades;
  if (!u || u.socialFollowers == null || !Game.dayStats) return '';
  let r = u.socialReport;
  if (Net.role !== 'guest') { try { r = closeSocialDay() || r; } catch (e) { } }
  if (!r || r.dia !== Game.day) return '';
  const rows = (a, sg) => a.length ? a.map(x => '<li><span>' + escapeHtml(x.k) + '</span><b>' + sg + x.n + '</b></li>').join('') : '<li class="rd-mut">Nada</li>';
  const net = (r.net >= 0 ? '+' : '−') + Math.abs(r.net), st = u.socialStats;
  return '<div class="rd-close"><div class="rd-close-h">Chiringo · balance de hoy</div>' +
    '<p class="rd-close-p">👥 <b>' + r.before + '</b> seguidores al abrir → <b>' + r.total + '</b> definitivos (' + net + ')</p>' +
    '<div class="rd-close-grid"><div><h5 class="g">Ganados +' + r.gainSum + '</h5><ul>' + rows(r.gains, '+') + '</ul></div>' +
    '<div><h5 class="b">Perdidos −' + r.lossSum + '</h5><ul>' + rows(r.losses, '−') + '</ul></div></div>' +
    '<p class="rd-close-n">Variación neta ' + net + ' · total definitivo ' + r.total + '. ' +
    (st ? 'Alcance ' + st.reach + ' · interacciones ' + st.interactions + ' (❤️ ' + st.likes + ' · 💬 ' + st.comments + '). ' : '') +
    (r.resp ? 'Respuesta del público a lo publicado: ×' + String(r.resp).replace('.', ',') + '. ' : '') +
    'Este balance ya está aplicado y no se repetirá al abrir mañana. Caja: ' + eur(Game.money) + '.</p></div>';
}

const rb = document.getElementById('rep-body');
if (rb) {
  new MutationObserver(() => {
    if (Game.mode !== 'report' || rb.querySelector('.rd-close')) return;
    let h = ''; try { h = closeHtml(); } catch (e) { }
    if (!h) return;
    const rv = rb.querySelector('.reviews');
    if (rv) rv.insertAdjacentHTML('beforebegin', h); else rb.insertAdjacentHTML('beforeend', h);
  }).observe(rb, { childList: true });
}

const css = `
.rd-close{margin:0 24px 14px;padding:12px 14px;border-radius:14px;background:var(--sand);border:1px solid var(--line)}
.rd-close-h{font:800 11px var(--font);letter-spacing:.14em;text-transform:uppercase;color:var(--ink-2)}
.rd-close-p{margin:6px 0 8px;font-size:14px}
.rd-close-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.rd-close-grid h5{margin:0 0 4px;font:600 14px var(--font-d)}
.rd-close-grid h5.g{color:var(--good)}.rd-close-grid h5.b{color:var(--bad)}
.rd-close-grid ul{list-style:none;margin:0;padding:0;display:grid;gap:3px;font-size:12.5px}
.rd-close-grid li{display:flex;justify-content:space-between;gap:8px}
.rd-close .rd-mut{color:var(--ink-2);font-size:12px}
.rd-close-n{margin:8px 0 0;font-size:12px;color:var(--ink-2)}
@media (max-width:640px){.rd-close{margin:0 16px 14px}.rd-close-grid{grid-template-columns:1fr}}
`;
const st = document.createElement('style'); st.id = 'rd-close-style'; st.textContent = css; document.head.append(st);
