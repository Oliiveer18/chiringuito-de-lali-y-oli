# Tripo AI · configuración local

Integración de generación 3D vía [Tripo API](https://developers.tripo3d.ai/en/docs/quick-start). La clave **nunca** va en el código ni en el repositorio: solo la variable de entorno `TRIPO_API_KEY` en tu máquina.

## Requisitos

- Node.js ≥ 18.19
- Rama `feature/tripo-integration` (basada en `experiment/vfx-clientes-3d`, escena Three.js)
- Cuenta Tripo y API key desde la [consola de claves](https://developers.tripo3d.ai/en/keys)

## Mac · puesta en marcha rápida

```bash
git clone https://github.com/Oliiveer18/chiringuito-de-lali-y-oli.git
cd chiringuito-de-lali-y-oli
git checkout feature/tripo-integration
cp .env.example .env
# Edita .env y añade TRIPO_API_KEY (solo en local)
npm run dev
```

Abre **http://localhost:8000**, entra al **servicio** (escena 3D) y pulsa **Tripo 3D** en el HUD.

Simulación sin créditos:

```bash
TRIPO_MOCK=1 npm run dev
```

## Configurar la clave

1. `cp .env.example .env`
2. `TRIPO_API_KEY=…` en `.env` (sin comillas extra)
3. `.env` está en `.gitignore` — no lo subas a GitHub

## Arrancar en local

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | Juego + proxy Tripo (`dev-server.mjs`) |
| `npm start` | Solo estáticos (sin Tripo) |

Sin `TRIPO_API_KEY`, el juego arranca igual; el panel Tripo muestra un aviso.

## GitHub Pages / githack vs `npm run dev`

- **Preview estático** (p. ej. [raw.githack.com](https://raw.githack.com/) sobre `index.html` de la rama): sirve HTML/JS/CSS del juego; **no** hay `/api/tripo/*`, así que generación, saldo y manifest de servidor **no funcionan** (panel informativo).
- **`npm run dev`**: imprescindible para proxy Tripo, descarga GLB al disco y `generated/tripo/manifest.json`.

## Comprobar saldo (manual, con clave real)

1. `npm run dev` con `TRIPO_API_KEY`
2. HUD → **Tripo 3D** → **Actualizar saldo**

```bash
curl -s http://localhost:8000/api/tripo/balance
```

Upstream: `GET https://openapi.tripo3d.ai/v3/account/balance` con `Authorization: Bearer …`.

## Pipeline de activos (flujo en el panel)

Pasos en español (barra superior del panel):

1. **Generar** — una petición por clic (anti-doble clic ~800 ms); estado `pendiente` → `generado`
2. **Previsualizar** — vista Three.js en el panel
3. **Guardar** — valida cabecera GLB + registra en `generated/tripo/manifest.json` y `localStorage` (`chiringuito.tripo.assets`); estado `validado`
4. **Incorporar escena** — acción explícita; estado `integrado` (nunca automático al cargar tests)
5. **Asociar entidad** — ranura opcional (decoración / exposición; **no** sustituye a Lali/Oli jugables)
6. **Retirar** — quita de la escena; estado `retirado`

Ajustes antes de incorporar: **Escala** y **Rotación °** en el panel.

Persistencia tras recargar:

- Servidor: `generated/tripo/*.glb` + `manifest.json` (GLB en `.gitignore`)
- Cliente: `localStorage` activos + `chiringuito.tripo.placed` para modelos **integrados**

## Ranuras de entidad compatibles

| Clave | Uso |
|-------|-----|
| `prop_generico` | Posición manual (sin anclaje fijo) |
| `decor_terrace_a` | Decoración terraza |
| `decor_bar` | Decoración barra |
| `decor_beach` | Decoración playa |
| `exhibicion_personaje` | Figura decorativa (no reemplaza personajes jugables) |

## Primera generación real

1. `npm run dev` + `TRIPO_API_KEY`
2. Servicio 3D → **Tripo 3D**
3. Descripción + categoría + estilo → **Generar**
4. **Guardar** → **Incorporar escena** si procede

Modelos: `POST /v3/generation/text-to-model` con `model` según estilo ([modelos y versiones](https://developers.tripo3d.ai/en/docs/models-and-versions)).

## Tests sin créditos

```bash
npm test
# o solo Tripo:
node tripo-assets.test.mjs && TRIPO_MOCK=1 node tripo-api.test.mjs
```

No ejecutan generación real ni requieren clave.

## Rutas del proxy

| Ruta local | Tripo upstream / función |
|------------|---------------------------|
| `GET /api/tripo/config` | Estado local |
| `GET /api/tripo/manifest` | Manifest de activos |
| `POST /api/tripo/assets/register` | Validar + registrar GLB |
| `POST /api/tripo/assets/:id/validate` | Revalidar GLB |
| `PATCH /api/tripo/assets/:id` | Metadatos / estado |
| `GET /api/tripo/balance` | `/v3/account/balance` |
| `GET /api/tripo/usage` | `/v3/account/usage` |
| `POST /api/tripo/generate` | `/v3/generation/text-to-model` |
| `GET /api/tripo/tasks/:id` | `/v3/tasks/{task_id}` |
| `GET /api/tripo/download/:id` | Descarga y guarda GLB local |

## Estados de activo

`pendiente` · `generado` · `validado` · `integrado` · `sustituido` · `retirado`

`integrado` solo tras **Incorporar escena** explícito.
