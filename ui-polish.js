/* ui-polish v1: agenda de 7 días con clima, reseñas legibles y estilos profesionales. */
import { Game } from './state.js?v=27.6';
import { SEASON_DAYS, SPECIAL_DAYS, WEATHER } from './config.js?v=27.6';

const ICON = {
  sol: '<svg class="wicon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="#f5b82e"/><g stroke="#f5b82e" stroke-width="2" stroke-linecap="round"><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/></g></svg>',
  panza: '<svg class="wicon" viewBox="0 0 24 24"><circle cx="9" cy="9" r="4" fill="#f5b82e"/><path d="M7 18h10a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.5A3.5 3.5 0 0 0 7 18z" fill="#cfd8dc"/></svg>',
  calima: '<svg class="wicon" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="#e8b04a"/><path d="M3 15h18M5 18h14" stroke="#d9a24a" stroke-width="2" stroke-linecap="round"/></svg>',
  viento: '<svg class="wicon" viewBox="0 0 24 24"><path d="M3 8h11a3 3 0 1 0-3-3M3 13h15a3 3 0 1 1-3 3M3 18h8" stroke="#7fb7c9" stroke-width="2" fill="none" stroke-linecap="round"/></svg>'
};
const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : '';

function agenda() {
  const fc = document.getElementById('forecast');
  if (!fc || Game.mode !== 'plan') return;
  let html = '<div class="agenda">';
  for (let i = 0; i < 8; i++) {
    const d = Game.day - 1 + i;
    if (d >= SEASON_DAYS) break;
    const w = (Game.forecast && Game.forecast[d]) || 'sol';
    const ev = SPECIAL_DAYS[Game.day + i];
    const W = WEATHER[w] || { label: cap(w), desc: '' };
    html += `<div class="fc${i === 0 ? ' today' : ''}${ev ? ' event' : ''}"><div class="k">${i === 0 ? 'Hoy' : 'Día ' + i}</div><div class="v">${ICON[w] || ICON.sol}<span>${esc(W.label)}</span></div><div class="d">${esc(ev ? ev.title : (W.desc || ''))}</div></div>`;
  }
  html += '</div>';
  if (fc.dataset.polish !== html) { fc.dataset.polish = html; fc.innerHTML = html; }
}

function polishReviews() {
  const rep = document.getElementById('rep-body');
  if (!rep || Game.mode !== 'report') return;
  const seen = new Set();
  rep.querySelectorAll('.review').forEach(card => {
    const txt = card.querySelector('.rev-text');
    if (!txt) return;
    const starsEl = card.querySelector('.rev-head span');
    if (starsEl && !starsEl.dataset.polished) {
      const m = (starsEl.textContent.match(/★|☆/g) || []);
      const filled = m.filter(c => c === '★').length;
      starsEl.dataset.polished = '1';
      starsEl.innerHTML = `<span class="stars"><b>${'★'.repeat(filled)}</b><span>${'☆'.repeat(5 - filled)}</span></span>`;
    }
    card.querySelectorAll('.net-actions .btn').forEach(b => {
      const t = b.textContent || '';
      if (t.includes('Disculparte')) b.classList.add('primary');
      else if (t.includes('Invitar')) b.classList.add('teal');
    });
    const k = txt.textContent.trim().toLowerCase();
    if (seen.has(k)) card.classList.add('dup'); else seen.add(k);
  });
}

const CSS = `
.agenda{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:10px;padding:14px 24px}
.agenda .fc{width:auto;flex:none}
.fc .wicon{width:24px;height:24px;flex:none}
.fc .v{display:flex;align-items:center;gap:8px}
.fc.today{background:#e6f4f2;border-color:#9fd4cf}
.info-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;padding:14px 24px}
.info-card{background:var(--sand);border:1px solid var(--line);border-radius:16px;padding:14px;min-width:0}
.info-card .k{font-size:10.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--teal)}
.info-card .v{font:600 18px/1.25 var(--font-d);margin:4px 0;color:var(--ink);overflow-wrap:anywhere}
.info-card .d{font-size:12.5px;color:var(--ink-2);line-height:1.45;overflow-wrap:anywhere}
.info-section{padding:0 24px 8px}
.reviews-grid{display:grid;gap:12px;padding:0 24px 12px}
.review{background:var(--sand);border:1px solid var(--line);border-radius:16px;padding:14px;min-width:0}
.review.dup{display:none}
.rev-head{display:flex;justify-content:space-between;align-items:center;gap:10px}
.rev-text{margin:8px 0 10px;color:var(--ink);line-height:1.5;overflow-wrap:anywhere}
.stars b{color:#f5b82e;font-weight:400}.stars span{color:#d8cbb2;font-weight:400}
.net-actions{display:flex;gap:8px;flex-wrap:wrap}
.net-actions .btn.primary{background:linear-gradient(180deg,#ee6d49,var(--coral));border-color:var(--coral-d);color:#fff}
.net-actions .btn.teal{background:var(--teal);border-color:var(--teal-d);color:#fff}
`;

function injectCss() {
  if (document.getElementById('ui-polish-css')) return;
  const s = document.createElement('style');
  s.id = 'ui-polish-css';
  s.textContent = CSS;
  document.head.append(s);
}

injectCss();
setInterval(() => { agenda(); polishReviews(); }, 400);
