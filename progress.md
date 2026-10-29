Original prompt: Sí, empieza las correcciones en una rama nueva de mi copia 3D.

# Service integrity work

- Branch: fix/3d-service-integrity, based on e011f02.
- Preserve main and experiment/vfx-clientes-3d; no production deployment.
- First package: canonical prepared units, one stock debit, delivery without legacy re-preparation,
  payment-time quality tips, simulation-time stations, cancellation and day reset.
- Include regression coverage and browser QA. Full co-op movement and product-selection redesign
  remain outside this package.

## Implemented

- Added pure serializable service-3d-model.mjs and authoritative command adapter.
- Replaced visual tray state as source of truth; removed preparation-time money and slot acceleration.
- Integrated stock-backed prepared delivery, deferred quality tips and idempotent payment.
- Moved station time into simulation; froze movement and cleaning mutation while paused.
- Fixed contextual identity, coordinates, pointer cancellation, repeated cleaning and selective washing.
- Snapshots include station/tray ownership and deduplicate guest command sequences per service.
- Added 19 pure regression tests and a real-input browser regression runner.
- Added an optional in-memory preview build for Computer. Production saves remain unchanged.

## Validation notes

- npm test passed, including the 19 new model tests.
- Additional management, market, service-v24, tab-persist and v25 suites passed.
- Final browser run passed all 10 integration flows with zero page errors: actual preparation,
  mixed delivery/payment, pause, cancellation, opposite movement, speed changes, target changes,
  washing, host/snapshot checks, day reset, responsive resize and report.
- Inspected desktop 1280×720, portrait 390×844, landscape 844×390 and report screenshots.
- Required reference Playwright game client completed; screenshot and text-state capture inspected.
- Hosted preview boot, new game, planning, service and pause verified in a fresh cloud browser.
- DPR 2 overlay diagnostic observed a 2× transform for a CSS-coordinate fixture on a 780px canvas
  displayed at 390px, matching the required scaling.
- Existing camera-beta.test.mjs failure belongs to the baseline and remains documented.
