/** Constantes compartidas cliente (espejo del manifest servidor). */
export const TRIPO_MANIFEST_VERSION = 1;

export const TRIPO_CATEGORIES = [
  'personaje',
  'vehículo',
  'arma',
  'objeto',
  'mobiliario',
  'escenario',
];

/** Estados del pipeline de activos (no marcar integrado sin acción explícita). */
export const TRIPO_ASSET_STATES = {
  pendiente: 'pendiente',
  generado: 'generado',
  validado: 'validado',
  integrado: 'integrado',
  sustituido: 'sustituido',
  retirado: 'retirado',
};

/** Ranuras opcionales de vinculación (no reemplazan personajes jugables por defecto). */
export const TRIPO_ENTITY_SLOTS = {
  prop_generico: {
    label: 'Prop genérico (posición manual)',
    replacesPlayer: false,
  },
  decor_terrace_a: {
    label: 'Decoración terraza A',
    position: { x: 3.2, y: 0, z: 4.5 },
    replacesPlayer: false,
  },
  decor_bar: {
    label: 'Decoración barra',
    position: { x: -2.1, y: 0, z: 1.8 },
    replacesPlayer: false,
  },
  decor_beach: {
    label: 'Decoración playa',
    position: { x: 5.5, y: 0, z: -3.5 },
    replacesPlayer: false,
  },
  exhibicion_personaje: {
    label: 'Figura exposición (no sustituye a Lali/Oli)',
    position: { x: 0.5, y: 0, z: -4.2 },
    replacesPlayer: false,
  },
};

export const REG_KEY = 'chiringuito.tripo.assets';
export const PLACED_KEY = 'chiringuito.tripo.placed';

export function defaultTransform(category = 'objeto') {
  const scale = category === 'vehículo' || category === 'escenario' ? 0.85 : 1;
  return {
    scale,
    rotationY: 0,
    position: { x: 4.5, y: 0, z: -2 },
  };
}

export function makeDisplayName(description, category) {
  const d = String(description || 'Modelo').trim().slice(0, 48);
  const c = category ? ` · ${category}` : '';
  return (d || 'Modelo Tripo') + c;
}

export function stableAssetId(taskId) {
  const safe = String(taskId).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 64);
  return `tripo_${safe}`;
}
