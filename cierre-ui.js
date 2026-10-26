/* v20: bloque «Chiringo» en el informe de cierre (previsión de seguidores para la próxima apertura).
   Se inserta en #rep-body cada vez que report.js lo repinta, también en el móvil de la invitada. */
import { Game } from './state.js';
import { escapeHtml, eur } from './util.js';
import { settle } from './social-model.js';

const FOL = 'socialFollowers';

function closeHtml() {
  const u = Game.upgrades;
  if (!u || u[FOL] == null || !Game.dayStats) return '';
  const f = u[FOL] || 0;
  const postedToday = u.socialPostDia === Game.day;
  const idle = postedToday ? 0 : (u.socialIdle || 0) + 1;
  const S = settle({
    f, rep: Game.rep, pend: u.socialPend || [], postOk: true, extra: [],
    sinResp: u.socialNegativo === 1 && !u.socialRespondido, idle, prestados: u.socialPrestados
  });
  const rows = (a, sg) => a.length ? a.map(x => '<li><span>' + escapeHtml(x.k) + '</span><b>' + sg + x.n + '</b></li>').join('') : '<li class="rd-mut">Nada</li>';
  const tips = [];
  if (!postedToday) tips.push('Hoy no publicasteis en Chiringo.');
  if (u.socialNegativo === 1 && !u.socialRespondido) tips.push('Hay una queja sin responder.');
  return '<div class="rd-close"><div class="rd-close-h">Chiringo · previsión para mañana</div>' +
    '<p class="rd-close-p">👥 <b>' + f + '</b> seguidores hoy → <b>' + S.total + '</b> (' + (S.net >= 0 ? '+' : '') + S.net + ')</p>' +
    '<div class="rd-close-grid"><div><h5 class="g">Ganaréis +' + S.gainSum + '</h5><ul>' + rows(S.gains, '+') + '</ul></div>' +
    '<div><h5 class="b">Perderéis −' + S.lossSum + '</h5><ul>' + rows(S.losses, '−') + '</ul></div></div>' +
    '<p class="rd-close-n">' + (tips.length ? tips.join(' ') + ' ' : '') + 'Es una previsión: si no se cumple lo prometido (algodón sin stock, show sin ver) se pierde más. Caja: ' + eur(Game.money) + '.</p></div>';
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
