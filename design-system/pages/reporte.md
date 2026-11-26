# Page override — Aplicación de una sola página

Este archivo aplica a `pwa-frontend/index.html`, `src/ui/shellComponents.js` y
`src/ui/viewNavigation.js`. Sustituye el patrón genérico «Trust & Authority +
Conversion» del `MASTER.md`: CivicGuard es una herramienta de uso, no una landing
comercial.

## Estructura de la página

Un solo documento con cinco vistas conmutables por `data-view`:

1. **Resumen** — indicadores, accesos rápidos, actividad reciente y pasos.
2. **Reportar** — formulario + consejos laterales.
3. **Reportes** — historial, filtros y estado de sincronización.
4. **Avisos** — permiso opcional y explicación de notificaciones.
5. **Ayuda** — FAQ nativa con `<details>` y privacidad.

La navegación es inferior en móvil (5 destinos) y lateral en ≥ 900 px. El ancho
máximo del contenido pasa de 680 px a 1120 px y las tarjetas se organizan en dos
columnas en pantallas anchas.

## Reglas visuales

- Un solo acento de acción: verde (`--accent`). El teal reserva identidad,
  enlaces y estados informativos.
- Sin degradados, sin sombras fuertes, sin imágenes decorativas, sin emojis.
- Radio de 12–16 px; 16 px de padding lateral en móvil y 24 px en escritorio.
- Todo texto secundario ≥ 14 px; campos a 16 px para evitar zoom en iOS.
- Los estados nunca dependen solo del color: siempre llevan etiqueta e icono.
- Al cambiar de vista se enfoca el título y se actualiza `aria-current="page"`.

## Interacción (Emil Kowalski)

- `transform: scale(0.985)` en `:active`, 160 ms.
- Hover solo dentro de `@media (hover: hover) and (pointer: fine)`.
- `transition` de propiedades concretas, nunca `all`.
- `prefers-reduced-motion` elimina movimiento y conserva cambios de color.
- `-webkit-tap-highlight-color: transparent` + feedback propio en cada botón.
- El cambio de vista usa `hidden` y `history.replaceState`, sin recargar ni
  desmontar el formulario: no se pierde el estado offline.
