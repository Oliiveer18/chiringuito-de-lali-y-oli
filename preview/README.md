# Preview · rediseño visual v29 (congelado)

Esta carpeta **no** es la línea de producto activa del Chiringuito de Lali y Oli.

## Qué es

- **Instantánea congelada** del rediseño visual **v29** (p. ej. `style.css?v=29.3`, `version.js` → `v29.3`).
- Sirve como **referencia y vitrina** en GitHub Pages; **no** recibe mejoras de jugabilidad ni correcciones salvo que se reabra expresamente el rediseño.

## Juego oficial

- **Código y versión activos:** raíz del repositorio, rama **`main`**, versión en `version.js` (v28+).
- **Jugar:** https://oliiveer18.github.io/chiringuito-de-lali-y-oli/  
  (cache bust con `?v=` según `VERSION` en la raíz).
- **Solo preview (showcase):** https://oliiveer18.github.io/chiringuito-de-lali-y-oli/preview/index.html

## Mantenimiento

No corregir bugs ni evolucionar mecánicas aquí mientras el rediseño esté en pausa. Preferencia del Project **Kiosco Lali y Oli:** seguir en **`main` v28+**; preview v29 congelado hasta nueva orden.

## Desarrollo local

Desde la raíz del repo:

```bash
npm start
# Abrir http://localhost:8000/preview/index.html
```

Las pruebas automatizadas (`npm test`) ejecutan contra el juego en la **raíz**, no contra esta copia.
