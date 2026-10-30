/* Configuración WebRTC / ICE y mensajes de error del cooperativo (sin PeerJS). */
// v28.16: los TURN públicos gratuitos (openrelay.metered.ca) están muertos — el
// dominio resuelve a una dirección falsa y no asigna candidatos relay desde
// 2025/26. Quedan los STUN (directos y con IP pública, cubren la inmensa
// mayoría de casos, incluidos dos móviles en la misma red) y el gancho
// window.TURN_CONFIG por si algún día se configura un TURN propio.
const ICE_SERVERS = [
  {
    urls: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302',
      'stun:global.stun.twilio.com:3478',
      'stun:stun.cloudflare.com:3478'
    ]
  }
];

export function peerRtcConfig(turnConfig){
  const t = turnConfig ?? (typeof globalThis !== 'undefined' && globalThis.window && globalThis.window.TURN_CONFIG);
  const ice = ICE_SERVERS.map(s => ({ ...s, urls: Array.isArray(s.urls) ? s.urls.slice() : s.urls }));
  if (t && t.urls) ice.push({ urls: t.urls, username: t.username, credential: t.credential });
  return { iceServers: ice, iceCandidatePoolSize: 10 };
}

export const LOBBY_PREFIX = 'chiringuito-lali-oli-';

export function hostPeerId(code){
  return LOBBY_PREFIX + String(code || '').toUpperCase();
}

/** Errores PeerJS que el enlace reintenta solo; no mostrar fallo definitivo en la sala. */
export function isTransientJoinPeerError(e){
  const t = e && (e.type || e.message);
  return t === 'peer-unavailable' || t === 'network' || t === 'server-error';
}

export function guestSearchStatus(cloudTry, cloudsTotal, attemptSec){
  const srv = cloudsTotal > 1 ? ` (servidor ${cloudTry + 1}/${cloudsTotal})` : '';
  const wait = attemptSec > 0 ? ` · ${attemptSec}s` : '';
  return `Buscando anfitrión…${srv}${wait} Comprueba el código. Si tu pareja tiene el juego en segundo plano, que lo abra un momento.`;
}

/** Reintento del invitado: el anfitrión puede (re)registrarse en cualquier momento
    (móvil en segundo plano, reconexión del servidor de señalización), así que
    peer-unavailable nunca es definitivo mientras el jugador siga en la sala. */
export const GUEST_RETRY = { firstMs: 3000, maxMs: 6000, maxAttempts: 40 };

/** v28.16.0: qué hacer al volver a primer plano. Si el móvil pasó el juego a
    segundo plano, el servidor de señalización puede haber soltado el registro de
    la sala mientras el peer local quedó "zombi": aparenta estar sano pero su
    socket lleva muerto un rato y ni 'disconnected' ni 'close' se dispararon.
    Por eso, sin partida en marcha (hasConn), lo fiable es re-registrar SIEMPRE
    la sala con el MISMO código (el anfitrión) o reanudar la búsqueda (el
    invitado). Con la partida en marcha no se destruye el peer (mataría el
    enlace de datos WebRTC): solo se reanima la señalización con reconnect(). */
export function visibilityRecovery({ peerAlive, peerDisconnected, role, code, hasConn }){
  if (hasConn) return (!peerAlive || peerDisconnected) ? 'reconnect' : null;
  if (role === 'host' && code) return 'host-relisten';
  if (role === 'guest' && code) return 'guest-rejoin';
  return null;
}
/** v28.16.0: retroceso exponencial para reconstruir el enlace tras la muerte del
    peer. Reintentar cada 1.5s para siempre (red inestable, servidor saturado)
    martillea el servidor; cada muerte consecutiva dobla la espera (1.5s → 3s →
    6s → … → 30s máx.). */
export function restartBackoffMs(restarts){
  return Math.min(1500 * Math.pow(2, Math.max(restarts - 1, 0)), 30000);
}

export function nextGuestRetryMs(attempt){
  return Math.min(GUEST_RETRY.firstMs + Math.min(Math.max(attempt, 0), 10) * 300, GUEST_RETRY.maxMs);
}

export function peerErrorMessage(e, role = 'guest'){
  const t = (e && (e.type || e.message)) || 'error';
  if (t === 'peer-unavailable') {
    return role === 'guest'
      ? 'No hay ninguna partida con ese código todavía. Comprueba las 4 letras o pide al anfitrión que pulse «Crear partida» de nuevo.'
      : 'Tu pareja no ha podido localizar la sala. Dile el código otra vez.';
  }
  if (t === 'unavailable-id') return 'Ese código ya está en uso. Pulsa «Crear partida» otra vez.';
  if (t === 'network' || t === 'socket-error' || t === 'socket-closed' || t === 'server-error') {
    return 'Problema de red o del servidor de señalización. Comprueba la conexión a internet e inténtalo en unos segundos.';
  }
  if (t === 'browser-incompatible') return 'Tu navegador no admite la conexión cooperativa. Prueba Chrome o Safari actualizados.';
  if (t === 'connection-error' || t === 'negotiation-failed') {
    return 'No se pudo abrir el enlace entre redes distintas (WebRTC). Prueba otra red Wi‑Fi, desactiva VPN o espera un minuto y vuelve a unirte.';
  }
  return role === 'guest'
    ? 'No se pudo unir a la partida (' + t + '). Revisa el código e inténtalo otra vez.'
    : 'No se pudo crear la sala (' + t + '). Inténtalo de nuevo.';
}
