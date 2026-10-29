/* Pruebas del enlace cooperativo (ICE, mensajes de error) sin WebRTC real. */
import { peerRtcConfig, peerErrorMessage } from './net-rtc.js?v=28.14.3';

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

console.log('peerErrorMessage');
check('peer-unavailable invitada', peerErrorMessage({ type: 'peer-unavailable' }, 'guest').includes('código'));
check('connection-error menciona redes', peerErrorMessage({ type: 'connection-error' }, 'guest').includes('redes'));
check('host unavailable-id', peerErrorMessage({ type: 'unavailable-id' }, 'host').includes('código'));

console.log('\n' + ok + ' ok, ' + ko + ' fallos');
if (ko) process.exit(1);
