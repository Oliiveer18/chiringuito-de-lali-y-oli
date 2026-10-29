/* =========================================================
   controls-3d.js · Controles Ergonómicos de Pulgares Móviles AAA
   Joystick virtual flotante (pulgar izquierdo) + Botón contextual gigante (pulgar derecho)
   con respuesta háptica y detección inteligente de proximidad.
   ========================================================= */
import { Game } from './state.js?v=28.16.0-vfx3d';
import { cleanTable, servable, tryServe } from './sim.js?v=28.16.0-vfx3d';
import { Audio } from './audio.js?v=28.16.0-vfx3d';
import { tablePosTo3D } from './world.js?v=28.16.0-vfx3d';
import {
  startBeerPour,
  updateBeerPour,
  releaseBeerPour,
  startGrillCook,
  collectGrillDish,
  deliverTrayItemToCustomer,
  trayAddItem,
  trayClear,
  trayGetItems,
  initStationUI,
  STATIONS_LOGIC
} from './stations-3d.js?v=28.16.0-vfx3d';

export const CONTROLS3D = {
  // Estado del joystick virtual
  joyActive: false,
  joyTouchId: null,
  joyStartX: 0,
  joyStartY: 0,
  joyCurX: 0,
  joyCurY: 0,
  inputX: 0, // -1 .. +1
  inputZ: 0, // -1 .. +1
  // Estado del teclado (WASD / Flechas)
  keys: { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false },
  // Estado de la acción contextual
  currentAction: null,
  isHoldingAction: false,
  // Callbacks
  onActionTrigger: null
};

// Coordenadas 3D exactas en el espacio mundial de las estaciones de trabajo
const STATIONS_3D = [
  { id: 'beer',   name: 'TIRAR CAÑA',     ico: '🍺', class: 'act-gold',  x: -3.8, z: 2.8, r: 2.2 },
  { id: 'coffee', name: 'HACER CAFÉ',     ico: '☕', class: 'act-coral', x: -1.4, z: 2.8, r: 2.2 },
  { id: 'grill',  name: 'PLANCHA',        ico: '🍳', class: 'act-fire',  x: -0.1, z: 2.8, r: 2.2 },
  { id: 'cooler', name: 'NEVERA',         ico: '🥤', class: 'act-teal',  x: -4.8, z: -1.4, r: 2.4 },
  { id: 'sink',   name: 'FREGAR PLATOS',  ico: '🧼', class: 'act-teal',  x: -1.4, z: -0.9, r: 2.2 }
];

let joyBaseEl = null;
let joyThumbEl = null;
let actBtnEl = null;
let actIcoEl = null;
let actLblEl = null;
const JOY_MAX_DIST = 44; // Radio máximo en px

export function initControls3D(playerMesh) {
  if (typeof document === 'undefined') return;

  joyBaseEl = document.getElementById('joy-base');
  joyThumbEl = document.getElementById('joy-thumb');
  actBtnEl = document.getElementById('btn-action-main');
  actIcoEl = document.getElementById('action-ico');
  actLblEl = document.getElementById('action-lbl');

  const zone = document.getElementById('joystick-zone') || document.body;

  // ---------- GESTOS TÁCTILES DEL JOYSTICK (Pulgar Izquierdo) ----------
  zone.addEventListener('touchstart', e => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      // Activación en el cuadrante inferior izquierdo
      if (!CONTROLS3D.joyActive && t.clientX < window.innerWidth * 0.48 && t.clientY > window.innerHeight * 0.25) {
        CONTROLS3D.joyActive = true;
        CONTROLS3D.joyTouchId = t.identifier;
        CONTROLS3D.joyStartX = t.clientX;
        CONTROLS3D.joyStartY = t.clientY;
        CONTROLS3D.joyCurX = t.clientX;
        CONTROLS3D.joyCurY = t.clientY;

        if (joyBaseEl && joyThumbEl) {
          joyBaseEl.style.left = `${t.clientX}px`;
          joyBaseEl.style.top = `${t.clientY}px`;
          joyThumbEl.style.transform = `translate(0px, 0px)`;
          joyBaseEl.classList.remove('hidden');
        }
        break;
      }
    }
  }, { passive: true });

  window.addEventListener('touchmove', e => {
    if (!CONTROLS3D.joyActive) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === CONTROLS3D.joyTouchId) {
        let dx = t.clientX - CONTROLS3D.joyStartX;
        let dy = t.clientY - CONTROLS3D.joyStartY;
        const dist = Math.hypot(dx, dy);

        if (dist > JOY_MAX_DIST) {
          dx = (dx / dist) * JOY_MAX_DIST;
          dy = (dy / dist) * JOY_MAX_DIST;
        }

        CONTROLS3D.inputX = dx / JOY_MAX_DIST;
        CONTROLS3D.inputZ = dy / JOY_MAX_DIST; // Y de pantalla = Z del mundo 3D

        if (joyThumbEl) {
          joyThumbEl.style.transform = `translate(${dx}px, ${dy}px)`;
        }
        break;
      }
    }
  }, { passive: true });

  const endJoy = e => {
    if (!CONTROLS3D.joyActive) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === CONTROLS3D.joyTouchId) {
        CONTROLS3D.joyActive = false;
        CONTROLS3D.joyTouchId = null;
        CONTROLS3D.inputX = 0;
        CONTROLS3D.inputZ = 0;
        if (joyBaseEl) joyBaseEl.classList.add('hidden');
        if (joyThumbEl) joyThumbEl.style.transform = `translate(0px, 0px)`;
        break;
      }
    }
  };

  window.addEventListener('touchend', endJoy, { passive: true });
  window.addEventListener('touchcancel', endJoy, { passive: true });

  initStationUI();

  // ---------- TECLADO EN ESCRITORIO (WASD / Flechas) ----------
  window.addEventListener('keydown', e => {
    if (e.key in CONTROLS3D.keys) {
      CONTROLS3D.keys[e.key] = true;
      updateKeyboardInput();
    }
    // Barra espaciadora o Enter ejecuta la acción contextual
    if (e.code === 'Space' && !e.target.matches('input, textarea') && !CONTROLS3D.isHoldingAction) {
      e.preventDefault();
      CONTROLS3D.isHoldingAction = true;
      if (CONTROLS3D.currentAction && CONTROLS3D.currentAction.type === 'beer') {
        startBeerPour('p1');
      } else {
        triggerCurrentAction();
      }
    }
  });

  window.addEventListener('keyup', e => {
    if (e.key in CONTROLS3D.keys) {
      CONTROLS3D.keys[e.key] = false;
      updateKeyboardInput();
    }
    if (e.code === 'Space') {
      CONTROLS3D.isHoldingAction = false;
      if (CONTROLS3D.currentAction && CONTROLS3D.currentAction.type === 'beer') {
        releaseBeerPour('p1');
      }
    }
  });

  // ---------- BOTÓN CONTEXTUAL GIGANTE (Pulgar Derecho) ----------
  if (actBtnEl) {
    actBtnEl.addEventListener('pointerdown', e => {
      e.preventDefault();
      CONTROLS3D.isHoldingAction = true;
      // Respuesta háptica suave
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(14);
      }
      actBtnEl.classList.add('act-press');
      if (CONTROLS3D.currentAction && CONTROLS3D.currentAction.type === 'beer') {
        startBeerPour('p1');
      } else {
        triggerCurrentAction();
      }
    });

    const endActionHold = () => {
      actBtnEl.classList.remove('act-press');
      if (CONTROLS3D.isHoldingAction) {
        CONTROLS3D.isHoldingAction = false;
        if (CONTROLS3D.currentAction && CONTROLS3D.currentAction.type === 'beer') {
          releaseBeerPour('p1');
        }
      }
    };

    actBtnEl.addEventListener('pointerup', endActionHold);
    actBtnEl.addEventListener('pointercancel', endActionHold);
  }
}

function updateKeyboardInput() {
  const k = CONTROLS3D.keys;
  const kx = (k.d || k.ArrowRight ? 1 : 0) - (k.a || k.ArrowLeft ? 1 : 0);
  const kz = (k.s || k.ArrowDown ? 1 : 0) - (k.w || k.ArrowUp ? 1 : 0);

  if (Math.hypot(kx, kz) > 0) {
    const len = Math.hypot(kx, kz);
    CONTROLS3D.inputX = kx / len;
    CONTROLS3D.inputZ = kz / len;
  } else if (!CONTROLS3D.joyActive) {
    CONTROLS3D.inputX = 0;
    CONTROLS3D.inputZ = 0;
  }
}

// ---------- Detección Inteligente de Proximidad ----------
export function updateContextualProximity(playerPos) {
  if (!playerPos || !actBtnEl) return;

  let best = null;
  let minDist = 1e9;
  const trayItems = trayGetItems('p1');
  const hasDirtyDishes = trayItems.includes('dirty');

  // 1. Si lleva platos sucios en la bandeja y está cerca del fregadero
  if (hasDirtyDishes) {
    const sink = STATIONS_3D.find(s => s.id === 'sink');
    if (sink) {
      const d = Math.hypot(playerPos.x - sink.x, playerPos.z - sink.z);
      if (d < sink.r) {
        best = { type: 'sink', name: sink.name, ico: sink.ico, class: sink.class };
        minDist = d;
      }
    }
  }

  // 2. Comprobar si hay una mesa sucia cerca (y no lleva ya el tope de platos)
  if (!best && Game && Game.tables) {
    Game.tables.forEach((t, i) => {
      if (t.state === 'dirty') {
        const p = tablePosTo3D(t);
        const d = Math.hypot(playerPos.x - p.x, playerPos.z - p.z);
        if (d < 2.6 && d < minDist) {
          minDist = d;
          best = { type: 'clean', table: t, tableIdx: i, name: 'LIMPIAR MESA', ico: '🧽', class: 'act-teal' };
        }
      }
    });
  }

  // 3. Comprobar clientes esperando (entrega directa si tenemos su producto en la bandeja)
  if (!best && Game && Game.customers) {
    for (const c of Game.customers) {
      if (!servable(c)) continue;
      const cp = c.table ? tablePosTo3D(c.table) : { x: ((c.x - 600) / 600) * 8.5, z: ((c.y - 500) / 220) * 3.5 };
      const cx = c.table ? cp.x + 0.55 : cp.x;
      const cz = cp.z;
      const d = Math.hypot(playerPos.x - cx, playerPos.z - cz);
      if (d < 3.2 && d < minDist) {
        minDist = d;
        // ¿Llevamos en la bandeja algún producto que pide este cliente?
        const match = trayItems.find(it => c.order && c.order.includes(it));
        if (match) {
          best = { type: 'deliver', customer: c, item: match, name: 'ENTREGAR', ico: '🍽️', class: 'act-green' };
        } else {
          best = { type: 'serve', customer: c, name: 'ATENDER', ico: '🛎️', class: 'act-green' };
        }
      }
    }
  }

  // 4. Comprobar estaciones de trabajo fijas (barra, plancha, cafetera, nevera, fregadero)
  if (!best) {
    for (const s of STATIONS_3D) {
      const d = Math.hypot(playerPos.x - s.x, playerPos.z - s.z);
      if (d < s.r && d < minDist) {
        minDist = d;
        if (s.id === 'grill' && STATIONS_LOGIC.grill.state !== 'idle') {
          best = { type: 'grill', name: 'RECOGER PLANCHA', ico: '🍳', class: 'act-fire' };
        } else {
          best = { type: s.id, name: s.name, ico: s.ico, class: s.class };
        }
      }
    }
  }

  // 5. Si no hay nada cerca, acción genérica o reposo elegante
  if (!best) {
    best = { type: 'idle', name: 'ATENDER', ico: '👋', class: 'act-idle' };
  }

  // Actualizar UI del botón
  if (!CONTROLS3D.currentAction || CONTROLS3D.currentAction.type !== best.type || CONTROLS3D.currentAction.name !== best.name) {
    CONTROLS3D.currentAction = best;
    if (actIcoEl) actIcoEl.textContent = best.ico;
    if (actLblEl) actLblEl.textContent = best.name;

    // Actualizar clases de color
    actBtnEl.className = 'btn-action-main ' + best.class;
    actBtnEl.classList.remove('hidden');
  }
}

// ---------- Ejecutar la Acción Contextual ----------
function triggerCurrentAction() {
  const act = CONTROLS3D.currentAction;
  if (!act) return;

  if (act.type === 'clean' && act.table) {
    cleanTable(act.table, false, 'p1');
    trayAddItem('p1', 'dirty');
    const tp = tablePosTo3D(act.table);
    if (typeof window !== 'undefined' && window.spawnCleanSparkles3D) {
      window.spawnCleanSparkles3D(tp.x, 0.15, tp.z);
    }
  } else if (act.type === 'sink') {
    trayClear('p1');
    if (typeof Audio !== 'undefined' && Audio._raw && Audio._raw.clean) {
      Audio._raw.clean();
    }
    if (Game && Game.floaters) {
      Game.floaters.push({ x: 420, y: 460, text: '✨ ¡Vajilla limpia!', t: 0, color: '#e0f7fa' });
    }
  } else if (act.type === 'deliver' && act.customer) {
    deliverTrayItemToCustomer(act.customer, 'p1');
  } else if (act.type === 'serve' && act.customer) {
    tryServe(act.customer, 'p1');
  } else if (act.type === 'beer') {
    // Si se invoca con un solo click sin mantener, dar un pulso corto
    startBeerPour('p1');
    setTimeout(() => releaseBeerPour('p1'), 950);
  } else if (act.type === 'grill') {
    collectGrillDish('p1');
  } else if (act.type === 'coffee') {
    trayAddItem('p1', 'barraquito');
    if (typeof Audio !== 'undefined' && Audio._raw && Audio._raw.start) {
      Audio._raw.start();
    }
    if (Game && Game.floaters) {
      Game.floaters.push({ x: 260, y: 480, text: '☕ Barraquito recién hecho', t: 0, color: '#ffd36b' });
    }
  } else if (act.type === 'cooler') {
    trayAddItem('p1', 'refresco');
    if (typeof Audio !== 'undefined' && Audio._raw && Audio._raw.pop) {
      Audio._raw.pop();
    }
    if (Game && Game.floaters) {
      Game.floaters.push({ x: 260, y: 480, text: '🥤 Refresco frío', t: 0, color: '#80deea' });
    }
  }

  // Efecto visual de rebote en el botón
  if (actBtnEl) {
    actBtnEl.classList.add('act-bounce');
    setTimeout(() => actBtnEl && actBtnEl.classList.remove('act-bounce'), 220);
  }

  if (CONTROLS3D.onActionTrigger) {
    CONTROLS3D.onActionTrigger(act);
  }
}
