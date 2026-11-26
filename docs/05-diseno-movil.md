# 05 — Diseño móvil accesible

**Entregable de frontend · 2026-11-26.** Basado en `develop` con los cambios de
`feature/deploy-api` cargados. No se modifica el backend: la sincronización con
Render se resuelve en la configuración del build de Vercel y en el cliente HTTP.

## Skills utilizadas

| Skill | Aporte concreto |
|---|---|
| `ui-ux-pro-max` | Sistema **Accessible & Ethical**, paleta médica teal/verde, tipografía Figtree + Noto Sans (fallback local), focus visible de 3 px, 44 px de touch target, contraste ≥ 4.5:1 y `prefers-reduced-motion`. |
| `emilkowalski/skills` (`emil-design-eng`, `mobile-native`, `break-ui`) | Press feedback con `scale(0.985)` a 160 ms, hover encapsulado en `(hover: hover) and (pointer: fine)`, transiciones de propiedades concretas, `touch-action: manipulation`, `100dvh`, safe areas, inputs a 16 px y sin gray-flash al tocar. |
| `ui-ux-pro-max` (búsquedas UX) | Labels asociados, errores junto al campo y resumen `role="alert"`, confirmación de envío con loading → éxito/error, ARIA en botones con icono y navegación con `aria-current`. |

El patrón comercial «Hero + Proof + CTA» del sistema generado **no se aplica**:
`design-system/pages/reporte.md` lo sustituye por un flujo de herramienta de
cinco secciones dentro de una sola página.

## Estructura de una sola página

Todas las secciones viven en el mismo documento. `src/ui/viewNavigation.js`
cambia cuál está visible sin recargar, sin router y sin tocar IndexedDB ni el
Service Worker. El hash (`#resumen`, `#reportar`, `#reportes`, `#avisos`,
`#ayuda`) permite enlazar una sección concreta.

| Sección | Contenido |
|---|---|
| **Resumen** | Tres indicadores (guardados, enviados, pendientes), accesos rápidos, actividad reciente con los últimos tres reportes, pasos y estado de conexión. |
| **Reportar** | Formulario con pistas, contadores, errores y ubicación; panel lateral con consejos antes de enviar. |
| **Reportes** | Historial con resumen, filtros, estados y empty states; panel lateral explicando la sincronización. |
| **Avisos** | Activación opcional de notificaciones y explicación de qué avisos se reciben. |
| **Ayuda** | FAQ nativa con `<details>` y recordatorio de privacidad. |

### Navegación

- En móvil: barra inferior con cinco destinos de 58 px y safe area.
- En pantallas ≥ 900 px: barra lateral fija con los mismos cinco destinos y
  contenido más ancho (1120 px) en dos columnas.
- Al cambiar de sección se mueve el foco al título (`tabindex="-1"`), se actualiza
  `aria-current="page"` y se respeta `prefers-reduced-motion` en el scroll.
- La navegación usa delegación de eventos, así que también funciona en botones
  creados dinámicamente (por ejemplo «Crear el primero» en actividad reciente).

## Cambios visuales por sección

### Encabezado y estado
- Fondo neutro, marca con escudo y cruz en SVG, promesa «Reportes claros y
  seguros, paso a paso» y distintivo **Privado**.
- Banner offline con lenguaje llano y `role="status"`.

### Resumen
- Indicadores grandes con iconos SVG y cifras legibles.
- Accesos rápidos de 64 px a Reportar, Reportes y Avisos.
- Actividad reciente reutiliza los mismos datos del historial, sin duplicar IDs.

### Formulario
- Etiquetas numeradas («1. ¿Qué ocurrió?», «2. Más detalles», «3. ¿Dónde está?»).
- Pistas con ejemplo real, contadores `0 / 120` y `0 / 600`.
- Ubicación con botón SVG, `aria-busy` y estados claros.
- Resumen de errores arriba (`role="alert"`, enfocado al aparecer) y mensaje
  junto al campo con `aria-invalid`.
- Botón principal verde a ancho completo y confirmaciones sin jerga.

### Avisos y ayuda
- Permiso claramente opcional, con errores amigables si Render no tiene VAPID.
- FAQ con `<details>`: interactiva sin JavaScript adicional y accesible con teclado.

### Reportes
- Resumen «Guardados / Pendientes» y filtros **Todos / Pendientes / Enviados**
  con `aria-pressed`.
- Tarjetas con título, descripción, fecha y etiqueta de estado con texto + color.
- Empty states distintos por filtro, con ilustración SVG.

## Corrección funcional del frontend

- `vercel.json` inyecta `VITE_API_BASE_URL=https://civicguard-pwa.onrender.com`.
- `apiClient.js` usa ese valor o un fallback de producción, con timeout de 12 s
  y errores con `code`/`status`; ya no se llama a `/api/vapid-public-key` en el
  dominio de Vercel.
- `manifest.json` usa `#0891b2` / `#f0fdfa` para coincidir con el diseño.

## Verificación

| Comprobación | Resultado |
|---|---|
| `npm run verify` | lint frontend + backend, `check:storage`, build y precache en verde |
| Viewports 320 / 375 / 375 oscuro / 812×375 / 1440×900 | Sin scroll horizontal ni targets < 44 px |
| Navegación entre secciones | Cambia la vista visible, enfoca el título y marca `aria-current`; el formulario y la lista conservan su estado |
| Contraste medido | Mínimo claro 5.14:1, oscuro 9.85:1 (WCAG AA ≥ 4.5:1) |
| Formulario vacío | Resumen de errores enfocado; error junto a título y ubicación |
| Geolocalización + guardado sin API | Reporte en IndexedDB; resumen 1 / 0 / 1 y badge de pendiente |
| Filtros | `Pendientes` → 1 elemento; `Enviados` → empty state propio |
| Teclado | Skip link, `:focus-visible` y `<details>` operables con Enter/Espacio |
| Movimiento | `prefers-reduced-motion` desactiva transformaciones y scroll suave |

Para probar el diseño en local:

```bash
npm run install:all
npm run build --prefix pwa-frontend
npm run preview --prefix pwa-frontend -- --port 4180
```

Luego abre `http://localhost:4180`.
