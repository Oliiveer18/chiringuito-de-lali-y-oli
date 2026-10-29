# Integridad del servicio 3D

Rama `fix/3d-service-integrity`, basada en `experiment/vfx-clientes-3d` en
`e011f02b1b623cf8861603e76907520c08744e4a`. Identificador de versión:
`v28.16.3-service-fix`.

## Cambios

- **Estado único:** `Game.service3D` contiene bandejas, unidades con calidad y
  estaciones temporizadas. El modelo es serializable y no depende del renderer.
- **Stock:** reservar una preparación consume una unidad una sola vez; las
  preparaciones en marcha reservan hueco en bandeja. Sin stock o capacidad se
  rechaza la acción antes de descontar género.
- **Preparación:** café con tiempo real de simulación, cerveza con calidad
  persistente y plancha que no entrega crudo y sigue avanzando hasta quemarse.
  Una caña interrumpida devuelve su reserva una sola vez, sin premio.
- **Entrega:** una unidad preparada completa una línea pendiente. No activa
  `startPart()`, no cobra otro ingrediente y no se retira si la entrega falla.
  Las líneas en preparación automática no admiten otra entrega duplicada.
- **Dinero:** la calidad se recompensa al cobrar la comanda completada, no al
  producir. El cobro y la finalización de comanda tienen protección contra
  duplicados; caja, ingresos y propinas de calidad se registran juntos.
- **Tiempo:** estaciones fuera del render; pausa y velocidades usan el reloj de
  simulación. El avance determinista respeta la pausa, conserva fracciones de
  tiempo y actualiza el mundo 3D sin dibujar todos los pasos intermedios.
- **Control:** objetivo contextual actualizado aunque conserve el mismo tipo;
  posición tomada del cliente visible; Espacio sin doble acción heredada;
  captura de puntero y cancelación por desenfoque, pausa o salida de alcance.
- **Limpieza:** la vajilla se añade al finalizar la tarea, no al solicitarla;
  fregar conserva la comida y el renderer del limpiador no libera mesas.
- **Transiciones:** vaciado de bandejas y estaciones; preparados descartados
  registrados como merma al cierre, sin reembolsar género ya utilizado.
- **Representación:** reinicio de posición al cambiar la jornada, bandejas
  visuales derivadas del estado compartido y escala DPR del overlay corregida.
- **Cooperativo:** intenciones del invitado resueltas por el anfitrión, id de
  servicio, deduplicación de secuencias y snapshots de bandejas/estaciones.
  La secuencia se recupera del snapshot para evitar bloqueos al reconectar.

## Pruebas

```sh
npm test
npm run test:service3d
npm run test:service3d:browser
```

`service-3d.test.mjs` incluye 19 regresiones del modelo puro. El recorrido de
navegador prueba menús, preparación con eventos reales, entrega y cobro,
cancelación, pausa, controles opuestos, velocidades, limpieza, snapshots,
reinicio, redimensionado y cierre. Es posible definir `TEST_URL` para comprobar
una vista alojada y `TEST_ARTIFACTS` para guardar sus capturas fuera del repo.

Las suites adicionales de gestión, mercado, servicio, persistencia y reputación
se conservan. `camera-beta.test.mjs` sigue siendo una prueba heredada incompatible
con el bootstrap de esta rama; ya fallaba en el commit de partida y no se presenta
como una regresión nueva.

## Límites de este paquete

Se conserva la preparación automática anterior cuando se usa la acción de
atender sin una unidad preparada compatible. No se ha convertido todavía toda
la jornada a un circuito manual exclusivo.

La plancha contextual sigue iniciando papas; la selección de otros platos, el
panel de comandas y la reorganización de HUD son trabajo posterior. Tampoco se
ha unificado aún la posición del jugador libre con el actor de tareas de sala.

Los comandos y snapshots del cooperativo tienen cobertura de integración, pero
eso no equivale a una prueba WebRTC en dos dispositivos. El movimiento remoto y
la validación de distancias en el anfitrión necesitan otro paquete. No se afirma
que el cooperativo 3D esté terminado ni se han medido FPS en un móvil físico.

## Vista de pruebas de Computer

```sh
node tools/build-service-preview.mjs /ruta/absoluta/de/salida
```

El constructor copia solo los archivos de ejecución y adapta almacenamiento a
memoria para el iframe de pruebas, que no admite las APIs de persistencia del
juego. También desactiva pantalla completa en ese entorno.

Esta adaptación no modifica los archivos originales ni la publicación de
GitHub. En la vista de pruebas se pierde el guardado al recargar; la versión
normal conserva su mecanismo de guardado. No se ha hecho merge ni despliegue
a la rama de producción.
