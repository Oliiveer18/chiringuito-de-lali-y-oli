/* =========================================================
   camera.js — v29.0.0: cámara unificada.
   Antes existían DOS sistemas de encuadre: canvas.js (horizontal) y layout.js
   (vertical, modos barra/mesas). Ahora este módulo es la única fuente de verdad:
   calcula el encuadre para ambas orientaciones y los tres modos de vista.

   Es lógica pura (sin DOM, sin canvas): la escriben canvas.js/layout.js y la
   prueban camera.test.mjs y los tests de geometría. Reglas de encuadre:

   - 'todo' vertical: encaja el ancho del mundo (comportamiento histórico).
   - 'todo' horizontal (v29.4): el mundo se desplaza a su punto focal — el
     mostrador cae a ~1/3 del ancho de pantalla, con playa respirando a la
     izquierda del kiosco — y el borde jugable derecho (última mesa con su
     sombrilla) nunca se sale de pantalla. El fondo se extiende de forma
     natural: el renderizador ya pinta cielo/mar/arena a pantalla completa.
   - 'barra'/'mesas': zoom de 700 unidades centrado en el eje del kiosco o de
     las mesas. Desde v29 funcionan en AMBAS orientaciones.
   - Nunca se recorta más de MAX_SKY_CROP de cielo, y la banda jugable protegida
     (del rótulo y≈186 al suelo y=720) queda por debajo del HUD.
   ========================================================= */
import { W, H } from './config.js?v=29.4.4';

/* Geometría protegida del mundo. Los tests de geometría (camera.test.mjs)
   validan el encuadre contra estos valores: si una futura mejora del kiosco
   dibuja fuera de la parcela o por encima de la banda protegida, salta aquí. */
export const GEO = {
  W, H,
  /** Banda jugable protegida: del rótulo (y≈186) al suelo (y=720) => 530 uds. */
  BAND_TOP: 186,
  /** Alto de la banda jugable protegida (unidades de mundo que deben caber bajo el HUD). */
  BAND_H: 530,
  /** Nunca se recortan más de 140 unidades de cielo. */
  MAX_SKY_CROP: 140,
  /** Parcela del kiosco: mostrador, interior y tejado (x 40–540). */
  PARCEL: { x0: 40, x1: 540 },
  /** Playa extra visible a cada lado en horizontal, modo 'todo' (unidades de mundo). */
  LAND_MARGIN: 64,
  /* v29.4 — composición horizontal: en vez de centrar el mundo completo (que
     dejaba el kiosco pegado a la izquierda), el punto focal del kiosco cae a
     FOCUS_FRAC del ancho de pantalla y el borde jugable derecho siempre visible. */
  /** X del mundo que actúa de punto focal: el mostrador del kiosco. */
  FOCUS_X: 280,
  /** Fracción del ancho de pantalla donde cae el punto focal (~1/3). */
  FOCUS_FRAC: 0.35,
  /** Borde jugable derecho: última mesa con su sombrilla (x≈1276). */
  RIGHT_PLAYABLE: 1276,
};

/* Ancho de encuadre (span) y eje horizontal (cx) de cada modo de vista.
   El modo 'todo' es especial: su span depende de la orientación. */
export const CAM_MODES = {
  todo: { span: 0, cx: W / 2 },
  barra: { span: 700, cx: 270 },
  mesas: { span: 700, cx: 930 },
};

let mode = 'todo';
export function camMode(){ return mode; }
export function setCamMode(m){ if (CAM_MODES[m]) mode = m; }

/* Encuadre objetivo en px CSS (el llamador multiplica por dpr al escribir view).
   - width/height: viewport visual (visualViewport).
   - top/bottom: alto del HUD/stockbar que no debe tapar el juego.
   - safeL/safeR: márgenes laterales seguros (notch, etc.).
   Devuelve {s, ox, oy} en espacio CSS. */
export function computeView({ width, height, top = 0, bottom = 0, safeL = 0, safeR = 0, portrait, mode: m = mode }){
  const aw = Math.max(1, width - safeL - safeR);
  const ah = Math.max(1, height - top - bottom);
  let s, ox, oy;

  if (m === 'todo'){
    if (portrait){
      /* Vertical: encaja por ancho; reserva HUD/stockbar para no tapar el borde
         jugable (idéntico al comportamiento histórico de canvas.js). */
      s = aw / W;
      const worldH = H * s;
      const insetTop = top ? top + 6 : 0;
      const insetBottom = bottom ? bottom + 10 : 0;
      const playH = Math.max(1, height - insetTop - insetBottom);
      oy = insetTop + Math.max(0, (playH - worldH) / 2);
    } else {
      /* Horizontal: banda jugable protegida (rótulo y≈186 → suelo y=720) y
         recorte máximo de cielo (140 uds). Con margen de playa a ambos lados. */
      const span = W + 2 * GEO.LAND_MARGIN;
      s = Math.min(aw / span, height / (H - GEO.MAX_SKY_CROP), top ? (height - top) / GEO.BAND_H : Infinity);
      const worldH = H * s;
      /* Si el mundo no cabe en vertical: fondo anclado abajo (solo se pierde
         cielo). Si sobra pantalla: centrado (se extiende cielo y arena). */
      oy = worldH >= height ? (height - worldH) : (height - worldH) / 2;
    }
    /* v29.4 — composición: el mundo ya no se centra completo (dejaba el kiosco
       pegado a la izquierda). El punto focal (mostrador, FOCUS_X) cae a
       FOCUS_FRAC del ancho, con playa respirando a su izquierda, y el borde
       jugable derecho (última mesa + sombrilla, RIGHT_PLAYABLE) nunca se sale
       de pantalla. Si no hay holgura, se vuelve al centrado histórico. */
    const worldW = W * s;
    const centered = (aw - worldW) / 2;
    const focus = aw * GEO.FOCUS_FRAC - GEO.FOCUS_X * s;
    const maxOx = aw - GEO.RIGHT_PLAYABLE * s - 6;
    ox = safeL + Math.max(centered, Math.min(focus, maxOx));
  } else {
    /* Zoom (barra/mesas): span fijo centrado en el eje del modo, con la banda
       vertical completa protegida del HUD/stockbar. Funciona en ambas
       orientaciones desde v29. */
    const t = CAM_MODES[m];
    s = Math.min(aw / t.span, ah / H);
    oy = top + (ah - H * s) / 2;
    ox = safeL + aw / 2 - t.cx * s;
  }

  return { s, ox, oy };
}
