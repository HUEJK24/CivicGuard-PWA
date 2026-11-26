# Page override — Flujo de reporte

Este archivo aplica a `pwa-frontend/index.html` y al shell renderizado por
`src/ui/shellComponents.js`. Sustituye el patrón genérico «Trust & Authority +
Conversion» del `MASTER.md`: CivicGuard es una herramienta de uso, no una landing
comercial.

## Estructura

1. **Encabezado**: marca + promesa breve + distintivo «Privado». Sin navegación
   compleja.
2. **Así de fácil**: tres pasos numerados, antes del formulario. Reduce la carga
   cognitiva y explica qué pasa con los datos.
3. **Nuevo reporte**: un campo por idea, con nombre visible, pista, contador y
   error junto al campo.
4. **Avisos**: beneficio explicado en una frase; el permiso es claramente
   opcional.
5. **Tus reportes**: resumen, filtros y estados con texto + color.
6. **Navegación inferior**: tres destinos, 58 px de alto, área segura incluida.

## Reglas visuales

- Un solo acento de acción: verde (`--accent`). El teal reserva identidad,
  enlaces y estados informativos.
- Sin degradados, sin sombras fuertes, sin imágenes decorativas, sin emojis.
- Radio de 12–16 px; 16 px de padding lateral en móvil.
- Todo texto secundario ≥ 14 px; campos a 16 px para evitar zoom en iOS.
- Los estados nunca dependen solo del color: siempre llevan etiqueta e icono.

## Interacción (Emil Kowalski)

- `transform: scale(0.985)` en `:active`, 160 ms.
- Hover solo dentro de `@media (hover: hover) and (pointer: fine)`.
- `transition` de propiedades concretas, nunca `all`.
- `prefers-reduced-motion` elimina movimiento y conserva cambios de color.
- `-webkit-tap-highlight-color: transparent` + feedback propio en cada botón.
