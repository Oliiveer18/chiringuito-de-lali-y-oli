/* Pestaña Mejoras del plan: secciones compactas. Importado desde ui.js */
import { UPGRADES } from './config.js?v=31.0.0';
import { escapeHtml, eur } from './util.js?v=31.0.0';
import { Game, empireIncome, lvl } from './state.js?v=31.0.0';

const MEJORAS_SECTIONS = [
  { title: 'Reformas del chiringuito', ids: ['palapa', 'terraza', 'escenario'] },
  { title: 'El imperio', ids: ['elmedano', 'loscristianos'] },
  { title: 'Sala y mesas', ids: ['mesas', 'altavoz', 'luces'] },
  { title: 'Cocina y carta', ids: ['nevera', 'plancha', 'cocina', 'refrescos', 'heladera', 'gofrera', 'coctelera', 'churrera', 'algodonera'] },
  { title: 'Playa', ids: ['sombrillas', 'hamacas'] },
  { title: 'Clientes y red', ids: ['redes'] },
  { title: 'Premium y eventos', ids: [] },
];

const BENEFIT_SHORT = {
  mesas: '+2 mesas por nivel',
  sombrillas: '+15% clientela con sol o calima',
  altavoz: 'Colas más pacientes, clientes más contentos',
  nevera: 'Menos merma y cerveza más fría',
  plancha: 'Desbloquea queso con mojo; cocina +20%',
  hamacas: 'Hamacas de alquiler e ingresos pasivos',
  redes: '+15% clientes vía Instagram',
  cocina: 'Pescado del día, plato más rentable',
  luces: 'Cierra hasta las 22:00',
  algodonera: 'Algodón de azúcar automático',
  escenario: 'Conciertos con pico de clientela y ventanilla express',
  terraza: '+2 mesas, dos colas organizadas y guirnaldas',
  palapa: 'Cola de 8, +clientela con sol/calima, rótulo a vuestro nombre',
  elmedano: 'Ingresos nocturnos según tu reputación',
  loscristianos: 'Más ingresos nocturnos de marca',
  refrescos: 'Agua y refrescos rápidos',
  heladera: 'Helados (se derriten si tardáis)',
  gofrera: 'Gofres dulces y rentables',
  coctelera: 'Cócteles tropicales, alto margen',
  churrera: 'Churros con chocolate por la tarde',
};

function upgradeById(id) {
  return UPGRADES.find(x => x.id === id);
}

function reqLabel(u) {
  if (!u.req || lvl(u.req)) return '';
  const req = upgradeById(u.req);
  return req ? `Requiere ${req.name.toLowerCase()}` : '';
}

function renderUpgradeRow(u) {
  const l = lvl(u.id);
  const max = u.levels.length;
  const owned = l >= max;
  const cost = u.levels[l];
  const locked = u.req && !lvl(u.req);
  const benefit = BENEFIT_SHORT[u.id] || u.desc.split(/[.:!]/)[0];
  const req = reqLabel(u);
  const lvlTxt = max > 1 ? `${Math.min(l, max)}/${max}` : l ? '1/1' : '0/1';
  let action = '';
  if (owned) {
    action = '<span class="tag good">Instalado</span>';
  } else if (locked) {
    action = '<span class="tag up-req-tag">Bloqueado</span>';
  } else {
    action = `<span class="up-price">${eur(cost)}</span><button type="button" class="btn sm primary" data-up="${u.id}" ${Game.money < cost ? 'disabled' : ''}>Comprar</button>`;
  }
  const pips = max > 1 ? u.levels.map((_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('') : '';
  return `<article class="up-row ${owned ? 'owned' : ''} ${locked ? 'locked' : ''}">
    <div class="up-row-top">
      <div class="up-row-title">
        <span class="up-row-name">${escapeHtml(u.name)}</span>
        ${pips ? `<span class="pips up-row-pips" aria-label="Nivel">${pips}</span>` : `<span class="up-row-lvl">${lvlTxt}</span>`}
      </div>
      <div class="up-row-action">${action}</div>
    </div>
    <p class="up-row-benefit">${escapeHtml(benefit)}</p>
    ${req && !owned ? `<p class="up-row-chain"><span class="up-chain-k">req</span> ${escapeHtml(req)}</p>` : ''}
    <details class="up-row-details"><summary>Detalle</summary><p>${escapeHtml(u.desc)}</p></details>
  </article>`;
}

export function renderMejorasTab() {
  const ownedLevels = UPGRADES.reduce((a, u) => a + Math.min(lvl(u.id), u.levels.length), 0);
  const maxLevels = UPGRADES.reduce((a, u) => a + u.levels.length, 0);
  /* v30: nivel visual del kiosco con las reformas compradas (1-4) */
  const reforms = Math.min(3, lvl('palapa') + lvl('terraza') + lvl('escenario'));
  const reformNames = ['Chiringo de madera', 'Palapa', 'Terraza techada', 'Chiringo de referencia'];
  /* v31: el imperio, con su ingreso nocturno previsto a la vista */
  const empire = empireIncome();
  let h = `<div class="up-summary" role="status">
    <span class="up-summary-cash">En caja <b>${eur(Game.money)}</b></span>
    <span class="up-summary-owned">${ownedLevels} de ${maxLevels} niveles instalados</span>
    <span class="up-summary-owned">Kiosco nivel ${1 + reforms}/4 · ${reformNames[reforms]}</span>
    ${empire.owned.length?`<span class="up-summary-owned">Imperio: ${empire.owned.length} local${empire.owned.length>1?'es':''} · +${eur(empire.total)}/noche</span>`:''}
  </div>`;
  for (const sec of MEJORAS_SECTIONS) {
    if (!sec.ids.some(id => upgradeById(id))) continue;
    h += `<section class="up-section"><h3 class="up-section-k">${escapeHtml(sec.title)}</h3><div class="up-grid up-grid-compact">`;
    for (const id of sec.ids) {
      const u = upgradeById(id);
      if (u) h += renderUpgradeRow(u);
    }
    h += '</div></section>';
  }
  return h;
}
