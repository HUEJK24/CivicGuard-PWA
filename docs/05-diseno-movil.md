# 05 — Diseño móvil accesible

**Entregable de frontend · 2026-11-26.** Basado en `develop` con los cambios de
`feature/deploy-api` cargados (`23e6594`). No se modifica el backend: la
sincronización con Render se resuelve en la configuración del build de Vercel y
en el cliente HTTP.

## Skills utilizadas

| Skill | Aporte concreto |
|---|---|
| `ui-ux-pro-max` | Sistema **Accessible & Ethical**, paleta médica teal/verde, tipografía Figtree + Noto Sans (fallback local), focus visible de 3 px, 44 px de objetivo táctil, contraste ≥ 4.5:1, `prefers-reduced-motion`. |
| `emilkowalski/skills` (`emil-design-eng`, `mobile-native`, `break-ui`) | Press feedback con `scale(0.985)` a 160 ms, hover encapsulado en `(hover: hover) and (pointer: fine)`, transiciones de propiedades concretas, `touch-action: manipulation`, `100dvh`, safe areas, inputs a 16 px, sin gray-flash al tocar. |
| `ui-ux-pro-max` (búsquedas UX) | Labels asociados, errores junto al campo y resumen `role="alert"`, confirmación de envío con loading → éxito/error, ARIA en botones con icono. |

El patrón comercial «Hero + Proof + CTA» del sistema generado **no se aplica**:
`design-system/pages/reporte.md` lo sustituye por un flujo de herramienta
(encabezado → explicación → formulario → avisos → reportes).

## Cambios visuales por sección

### Encabezado y estado
- Fondo blanco/oscuro en lugar de azul sólido; marca con escudo y cruz en SVG.
- Promesa clara: «Reportes claros y seguros, paso a paso.»
- Distintivo **Privado** con icono de escudo, para generar confianza sin prometer
  nada que el producto no cumpla.
- Banner offline con lenguaje llano y `role="status"`.

### Así de fácil (sección nueva)
- Tres pasos numerados antes del formulario: **Cuéntalo → Ubícalo → Guárdalo**.
- Reduce incertidumbre en usuarios que nunca usaron la app.

### Formulario
- Etiquetas numeradas («1. ¿Qué ocurrió?», «2. Más detalles», «3. ¿Dónde está?»).
- Pistas con ejemplo real, contadores `0 / 120` y `0 / 600`.
- Ubicación con botón SVG, `aria-busy` y estados «Sin ubicación todavía»,
  «Buscando tu ubicación…», «Ubicación lista.» y error.
- Resumen de errores arriba (`role="alert"`, enfocado al aparecer) y mensaje
  junto al campo con `aria-invalid`.
- Botón principal verde a ancho completo, texto «Guardar y enviar reporte» y
  estado «Guardando…» mientras se escribe en IndexedDB.
- Confirmaciones sin jerga: «Listo. … se envió correctamente.»

### Avisos
- Tarjeta con icono de campana y frase: «Es opcional».
- Botón secundario con icono, no depende de permisos para reportar.
- Errores amigables: si Render no tiene VAPID configurado se indica que los
  avisos aún no están listos, sin mostrar `SyntaxError` ni HTML.

### Reportes
- Resumen «Guardados / Pendientes» y filtros **Todos / Pendientes / Enviados**
  con `aria-pressed`.
- Cada tarjeta muestra título, descripción, fecha y etiqueta de estado con
  texto + color (`Pendiente`, `Enviado`, `Resuelto`, `Recibido`).
- Empty states distintos por filtro, con ilustración SVG.

### Navegación y pie
- Barra inferior de tres destinos (`Reportar`, `Avisos`, `Reportes`), 58 px de
  alto y `env(safe-area-inset-bottom)`.
- El contenido reserva 92 px para que nada quede tapado.
- Pie: contador de pendientes y recordatorio de privacidad.

## Corrección funcional del frontend

- `vercel.json` inyecta `VITE_API_BASE_URL=https://civicguard-pwa.onrender.com`.
- `apiClient.js` usa ese valor o un fallback de producción, con timeout de 12 s
  y errores con `code`/`status`; ya no se llama a `/api/vapid-public-key` en el
  dominio de Vercel.
- `manifest.json` usa `#0891b2` / `#f0fdfa` para que el color del navegador
  coincida con el nuevo diseño.

## Verificación

| Comprobación | Resultado |
|---|---|
| `npm run verify` | lint frontend + backend, `check:storage`, build y precache en verde |
| Viewports 320 / 375 / 375 oscuro / 812×375 | Sin scroll horizontal ni targets < 44 px |
| Contraste medido | Mínimo claro 5.36:1, oscuro 8.55:1 (WCAG AA ≥ 4.5:1) |
| Formulario vacío | Resumen de errores enfocado; error junto a título y ubicación |
| Geolocalización + guardado sin API | Reporte en IndexedDB; resumen 1 / 0 / 1 y badge de pendiente |
| Filtros | `Pendientes` → 1 elemento; `Enviados` → empty state propio |
| Teclado | Skip link y `:focus-visible` en todos los controles |
| Movimiento | `prefers-reduced-motion` desactiva transformaciones y scroll suave |

Para probar el diseño en local:

```bash
npm run install:all
npm run build --prefix pwa-frontend
npm run preview --prefix pwa-frontend -- --port 4180
```

Luego abre `http://localhost:4180`.
