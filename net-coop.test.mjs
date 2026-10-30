/* Pruebas del enlace cooperativo (ICE, mensajes de error) sin WebRTC real. */
import {
  peerRtcConfig, peerErrorMessage, hostPeerId, isTransientJoinPeerError, guestSearchStatus,
  GUEST_RETRY, nextGuestRetryMs
} from './net-rtc.js?v=28.14.9';

let ok = 0, ko = 0;
const check = (name, cond, extra) => {
  if (cond) { ok++; console.log('  ok  ' + name); }
  else { ko++; console.log('  FALLO  ' + name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); }
};

console.log('peerRtcConfig');
const cfg = peerRtcConfig();
check('iceServers presentes', Array.isArray(cfg.iceServers) && cfg.iceServers.length >= 2);
check('incluye STUN Google', cfg.iceServers.some(s => String(s.urls).includes('stun.l.google.com')));
check('incluye TURN relay', cfg.iceServers.some(s => String(s.urls).includes('openrelay.metered.ca') || String(s.urls).includes('global.relay.metered.ca')));
check('TURN con credenciales', cfg.iceServers.some(s => s.username && s.credential));
check('pool ICE > 0', cfg.iceCandidatePoolSize >= 4);

console.log('hostPeerId');
check('CHAU → id esperado', hostPeerId('CHAU') === 'chiringuito-lali-oli-CHAU');
check('normaliza minúsculas', hostPeerId('chau') === 'chiringuito-lali-oli-CHAU');

console.log('peerErrorMessage');
check('peer-unavailable invitada', peerErrorMessage({ type: 'peer-unavailable' }, 'guest').includes('código'));
check('connection-error menciona redes', peerErrorMessage({ type: 'connection-error' }, 'guest').includes('redes'));
check('host unavailable-id', peerErrorMessage({ type: 'unavailable-id' }, 'host').includes('código'));

console.log('join helpers');
check('peer-unavailable es transitorio', isTransientJoinPeerError({ type: 'peer-unavailable' }));
check('browser-incompatible no transitorio', !isTransientJoinPeerError({ type: 'browser-incompatible' }));
check('texto buscando anfitrión', guestSearchStatus(0, 2, 5).includes('Buscando anfitrión'));

console.log('reintento del invitado (v28.14.9)');
check('hay límite de intentos', Number.isInteger(GUEST_RETRY.maxAttempts) && GUEST_RETRY.maxAttempts >= 20, GUEST_RETRY.maxAttempts);
check('primer reintento ≥ 2s', nextGuestRetryMs(0) >= 2000, nextGuestRetryMs(0));
check('primer reintento ≤ 6s', nextGuestRetryMs(0) <= 6000, nextGuestRetryMs(0));
check('retroceso suave y acotado', nextGuestRetryMs(1) >= nextGuestRetryMs(0) && nextGuestRetryMs(5) >= nextGuestRetryMs(1), [nextGuestRetryMs(0), nextGuestRetryMs(1), nextGuestRetryMs(5)]);
check('techo máximo de espera', nextGuestRetryMs(50) <= GUEST_RETRY.maxMs, nextGuestRetryMs(50));
check('no dispara en 0ms ni negativo', nextGuestRetryMs(-3) > 0 && nextGuestRetryMs(0) > 0);

console.log('\n' + ok + ' ok, ' + ko + ' fallos');
if (ko) process.exit(1);
