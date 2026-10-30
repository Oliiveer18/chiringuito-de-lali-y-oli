/* Pruebas del enlace cooperativo (ICE, mensajes de error) sin WebRTC real. */
import { readFileSync } from 'node:fs';
import {
  peerRtcConfig, peerErrorMessage, hostPeerId, isTransientJoinPeerError, guestSearchStatus,
  GUEST_RETRY, nextGuestRetryMs, visibilityRecovery, restartBackoffMs
} from './net-rtc.js?v=28.21.0';

let ok = 0, ko = 0;
const check = (name, cond, extra) => {
  if (cond) { ok++; console.log('  ok  ' + name); }
  else { ko++; console.log('  FALLO  ' + name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); }
};

console.log('peerRtcConfig');
const cfg = peerRtcConfig();
check('iceServers presentes', Array.isArray(cfg.iceServers) && cfg.iceServers.length >= 1);
check('incluye STUN Google', cfg.iceServers.some(s => String(s.urls).includes('stun.l.google.com')));
// v28.16: los TURN públicos de openrelay están muertos (dominio a dirección falsa,
// sin candidatos relay); no deben volver a la lista. Quedan STUN + TURN_CONFIG.
check('sin TURN muertos', !cfg.iceServers.some(s => String(s.urls).includes('metered.ca')));
check('pool ICE > 0', cfg.iceCandidatePoolSize >= 4);

console.log('forma del constructor de Peer (regresión v28.16)');
// La sala se rompió en v28.14.3 al pasar el id DENTRO del objeto de opciones:
// PeerJS ignora options.id (asigna un UUID) y el invitado recibía
// "peer-unavailable" para siempre. El id debe ir como primer argumento.
const netLinkSrc = readFileSync('net-link.js', 'utf8');
check('makePeer pasa el id como primer argumento', /new Peer\(id \|\| undefined, peerOptions\(\)\)/.test(netLinkSrc));
check('ya no usa options.id', !/new Peer\(peerOptions\(id\)\)/.test(netLinkSrc));
check('peerOptions ya no inyecta id', !/opts\.id = id/.test(netLinkSrc));
check('hostListen registra con el id de la sala', /makePeer\(hostPeerId\(code\)/.test(netLinkSrc));

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

console.log('reintento del invitado (v28.16.0)');
check('hay límite de intentos', Number.isInteger(GUEST_RETRY.maxAttempts) && GUEST_RETRY.maxAttempts >= 20, GUEST_RETRY.maxAttempts);
check('primer reintento ≥ 2s', nextGuestRetryMs(0) >= 2000, nextGuestRetryMs(0));
check('primer reintento ≤ 6s', nextGuestRetryMs(0) <= 6000, nextGuestRetryMs(0));
check('retroceso suave y acotado', nextGuestRetryMs(1) >= nextGuestRetryMs(0) && nextGuestRetryMs(5) >= nextGuestRetryMs(1), [nextGuestRetryMs(0), nextGuestRetryMs(1), nextGuestRetryMs(5)]);
check('techo máximo de espera', nextGuestRetryMs(50) <= GUEST_RETRY.maxMs, nextGuestRetryMs(50));
check('no dispara en 0ms ni negativo', nextGuestRetryMs(-3) > 0 && nextGuestRetryMs(0) > 0);

console.log('recuperación al volver a primer plano (v28.16.0)');
const vr = visibilityRecovery;
check('anfitrión sin partida, peer sano → re-registra igualmente (por si es zombi)', vr({ peerAlive: true, peerDisconnected: false, role: 'host', code: 'NNED', hasConn: false }) === 'host-relisten');
check('partida en marcha y peer sano → nada', vr({ peerAlive: true, peerDisconnected: false, role: 'host', code: 'NNED', hasConn: true }) === null);
check('partida en marcha con peer desconectado → solo reconnect (no matar el enlace de datos)', vr({ peerAlive: true, peerDisconnected: true, role: 'host', code: 'NNED', hasConn: true }) === 'reconnect');
check('anfitrión con peer muerto → re-registra la MISMA sala', vr({ peerAlive: false, peerDisconnected: false, role: 'host', code: 'NNED', hasConn: false }) === 'host-relisten');
check('invitado sin conexión y peer sano → reanuda búsqueda con el mismo código', vr({ peerAlive: true, peerDisconnected: false, role: 'guest', code: 'NNED', hasConn: false }) === 'guest-rejoin');
check('invitado con peer muerto y sin conexión → reintenta el mismo código', vr({ peerAlive: false, peerDisconnected: false, role: 'guest', code: 'NNED', hasConn: false }) === 'guest-rejoin');
check('invitado jugando con peer muerto → solo reconnect', vr({ peerAlive: false, peerDisconnected: false, role: 'guest', code: 'NNED', hasConn: true }) === 'reconnect');
check('invitado jugando y peer sano → nada', vr({ peerAlive: true, peerDisconnected: false, role: 'guest', code: 'NNED', hasConn: true }) === null);
check('sin rol ni código → nada', vr({ peerAlive: false, peerDisconnected: false, role: 'solo', code: null, hasConn: false }) === null);
check('anfitrión sin código → nada', vr({ peerAlive: false, peerDisconnected: false, role: 'host', code: null, hasConn: false }) === null);

console.log('retroceso de reconstrucción (v28.16.0)');
check('primera muerte espera 1.5s', restartBackoffMs(1) === 1500, restartBackoffMs(1));
check('segunda muerte dobla a 3s', restartBackoffMs(2) === 3000, restartBackoffMs(2));
check('tercera muerte 6s', restartBackoffMs(3) === 6000, restartBackoffMs(3));
check('techo de 30s', restartBackoffMs(10) === 30000 && restartBackoffMs(100) === 30000, restartBackoffMs(10));
check('crece siempre', restartBackoffMs(4) > restartBackoffMs(3) && restartBackoffMs(5) > restartBackoffMs(4));

console.log('\n' + ok + ' ok, ' + ko + ' fallos');
if (ko) process.exit(1);
