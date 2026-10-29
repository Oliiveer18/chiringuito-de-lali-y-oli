# Tripo AI · configuración local

Integración de generación 3D vía [Tripo API](https://developers.tripo3d.ai/en/docs/quick-start). La clave **nunca** va en el código ni en el repositorio: solo la variable de entorno `TRIPO_API_KEY` en tu máquina.

## Requisitos

- Node.js ≥ 18.19
- Rama `feature/tripo-integration` (basada en `experiment/vfx-clientes-3d`, escena Three.js)
- Cuenta Tripo y API key desde la [consola de claves](https://developers.tripo3d.ai/en/keys)

## Configurar la clave

1. Copia el ejemplo:

   ```bash
   cp .env.example .env
   ```

2. Edita `.env` y asigna tu clave (sin comillas extra):

   ```bash
   TRIPO_API_KEY=sk-...
   ```

3. `.env` está en `.gitignore` — no lo subas a GitHub.

## Arrancar en local

El juego en GitHub Pages **no** puede llamar a Tripo directamente (la clave debe quedarse en el servidor). En local usa el servidor de desarrollo con proxy:

```bash
npm run dev
```

Abre **http://localhost:8000** (o el puerto de `PORT`).

- `npm start` sigue sirviendo solo estáticos (sin proxy Tripo).
- Sin `TRIPO_API_KEY`, el juego arranca igual; el panel Tripo muestra un aviso amable.

## Comprobar saldo (manual, con clave real)

Con `npm run dev` y `TRIPO_API_KEY` definida:

1. Entra al juego y pulsa **Tripo 3D** en el HUD (durante el servicio).
2. Pulsa **Actualizar** junto al saldo.

También puedes usar curl contra tu servidor local (no pegues la clave en el historial del shell compartido):

```bash
curl -s http://localhost:8000/api/tripo/balance
```

La ruta real de Tripo es `GET https://openapi.tripo3d.ai/v3/account/balance` con `Authorization: Bearer …` (el proxy lo hace por ti).

## Primera generación

1. `npm run dev` con clave configurada.
2. Juega hasta la escena 3D (servicio).
3. **Tripo 3D** → describe el modelo, elige categoría y estilo.
4. **Generar modelo 3D** (una petición por clic; hay protección anti-doble clic).
5. Cuando el estado sea **Completada**, revisa la vista previa.
6. **Añadir a escena** solo si quieres colocarlo en el diorama (acción explícita).
7. **Descargar GLB** guarda una copia; el servidor también guarda en `generated/tripo/{taskId}.glb`.

Los modelos usan `POST /v3/generation/text-to-model` con `model` según estilo (p. ej. `P2-20260801` para juego, `v3.1-20260211` para alta calidad). Consulta [modelos y versiones](https://developers.tripo3d.ai/en/docs/models-and-versions).

## GitHub Pages + backend externo

La publicación estática en Pages **no** incluye `dev-server.mjs`. Opciones:

- Jugar en Pages sin generación 3D (panel informativo).
- Desplegar `dev-server.mjs` (o un proxy equivalente) en Render, Fly.io, Railway, etc., y servir el juego desde el mismo origen o configurar CORS en el proxy.

## Tests sin créditos

```bash
TRIPO_MOCK=1 node tripo-api.test.mjs
```

Incluido en `npm test`. No llama a la API real ni requiere clave.

## Modo simulación

Para desarrollo sin consumir créditos:

```bash
TRIPO_MOCK=1 npm run dev
```

El panel indicará «Modo simulación».

## Rutas del proxy

| Ruta local | Tripo upstream |
|------------|----------------|
| `GET /api/tripo/config` | Estado (sin upstream) |
| `GET /api/tripo/balance` | `GET /v3/account/balance` |
| `GET /api/tripo/usage` | `GET /v3/account/usage` |
| `POST /api/tripo/generate` | `POST /v3/generation/text-to-model` |
| `GET /api/tripo/tasks/:id` | `GET /v3/tasks/{task_id}` |
| `GET /api/tripo/download/:id` | Descarga `output.model_url` y guarda GLB local |

## Registro local

Metadatos de modelos generados: `localStorage` (`chiringuito.tripo.models`) y `generated/tripo/manifest.json` en el servidor tras cada descarga.
