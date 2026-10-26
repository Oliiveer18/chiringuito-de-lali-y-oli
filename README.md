# Chiringuito de Lali y Oli

Juego de gestión de un chiringuito en Tenerife, con modo individual y cooperativo online para dos móviles.

## Jugar

El juego está publicado en GitHub Pages: https://oliiveer18.github.io/chiringuito-de-lali-y-oli/

El cooperativo usa PeerJS (WebRTC), así que no necesita servidor propio. Necesita conexión a internet para cargar PeerJS y las fuentes.

También puede servirse en local con Node 18 o superior:

```bash
node server.js
```

Luego abrid en ambos móviles la dirección del servidor.

## Estructura

Todos los módulos ES están en la raíz del repositorio. `game.js` es el punto de entrada.

- Núcleo: `state.js`, `config.js`, `sim.js`, `ui.js`, `render.js`, `report.js`, `net.js`, `world.js`.
- Guardado y fiabilidad: `saves.js`, `reliability.js`, `layout.js`.
- Ampliaciones cargadas por `game.js` con captura de errores: `features.js` (v11: algodonera, shows, gestión), `v12.js` (v13: incidentes, repartidor y red social Chiringo), `v14.js` (clima cambiante, productos nuevos, reservas, misiones e informe).
- Ayudas: `tabguard.js` (evita bucles al repintar las pestañas) y `coopguard.js` (acciones solo del anfitrión).

Si una ampliación falla al cargar, el juego sigue funcionando y el título indica qué módulos están activos.

## Pruebas

Test de latencia del cooperativo:

```bash
npm install ws
node coop-latency.test.js
```
