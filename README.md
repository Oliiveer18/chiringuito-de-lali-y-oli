# Chiringuito de Lali y Oli

Juego de gestión de un chiringuito en Tenerife, con modo individual y cooperativo online para dos móviles.

## Jugar online

```bash
node server.js
```

Luego abrid en ambos móviles la dirección del servidor. Para publicarlo en internet, despliega este repositorio en Render, Railway o similar; el proceso debe ejecutar `node server.js`.

## Desarrollo

El juego usa módulos ES en `js/`. Para probar el test de latencia:

```bash
npm install ws
node test/coop-latency.test.js
```
