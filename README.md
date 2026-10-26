# Chiringuito de Lali y Oli

Juego de gestión de un chiringuito en Tenerife, con modo individual y cooperativo online para dos móviles.

## Jugar

El juego está publicado en GitHub Pages: https://oliiveer18.github.io/chiringuito-de-lali-y-oli/

El cooperativo usa PeerJS (WebRTC), así que no necesita servidor propio. Hace falta conexión a internet para cargar PeerJS y las fuentes.

Para probarlo en local (Node 18.19 o superior):

```bash
npm start        # node serve.js, en http://localhost:8000
```

## Estructura

Todos los módulos ES están en la raíz del repositorio. `game.js` es el punto de entrada.

- Núcleo: `state.js`, `config.js`, `sim.js`, `ui.js`, `render.js`, `report.js`, `net.js`, `world.js`.
- Guardado y fiabilidad: `saves.js`, `reliability.js`, `layout.js`.
- Ampliaciones cargadas por `game.js` con captura de errores: `features.js` (v11: algodonera, shows, gestión), `v12.js` (v13: incidentes, repartidor y red social Chiringo), `v14.js` (clima cambiante, productos nuevos, reservas, misiones e informe).
- Ayudas: `tabguard.js` (evita bucles al repintar las pestañas) y `coopbridge.js` (canal para que la invitada ejecute en el anfitrión las acciones de las ampliaciones).
- Herramientas: `serve.js` (servidor estático local) y `smoke.test.mjs` (prueba automática).

Si una ampliación falla al cargar, el juego sigue funcionando y el título indica qué módulos están activos.

## Cooperativo

El anfitrión simula la partida y la invitada recibe el estado. Ambas pueden comprar, mejorar, contratar personal y shows, reparar máquinas, publicar en Chiringo, contratar influencers, responder reseñas y pedir reparto: la invitada envía la acción y el anfitrión la valida y la ejecuta.

## Pruebas

```bash
npm test         # node smoke.test.mjs
```

La prueba carga los módulos reales de las ampliaciones (v11, v13, v14) y del canal cooperativo, simula 15 días y comprueba reglas como tendencias, comentarios, influencers, shows, reparto, misiones y acciones de la invitada. Sustituye solo lo que depende del navegador. No cubre el dibujo en pantalla ni la conexión PeerJS real.

## Archivos heredados

`server.js` y `coop-latency.test.js` son de una versión anterior del cooperativo con relevo por WebSocket. El juego actual usa PeerJS y `server.js` no sirve los módulos de la raíz, por lo que ya no se usan; `coop-latency.test.js` espera una estructura con carpetas `js/` y `test/` y no funciona con la actual.
