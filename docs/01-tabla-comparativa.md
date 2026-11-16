# Tabla Comparativa — CivicGuard

**Entregable Sprint 1 · P4.** Compara las alternativas tecnológicas evaluadas
antes de decidir la arquitectura de CivicGuard. Complementa al Reporte de
Configuración del Entorno (`02-reporte-configuracion-entorno.md`).

---

## 1. Tipo de aplicación

| Criterio | PWA (elegida) | App nativa (Kotlin/Swift) | Híbrida (Capacitor / React Native) |
|---|---|---|---|
| Instalación | Desde el navegador («Agregar a pantalla de inicio»), sin tienda | Play Store / App Store | Tienda o APK directo |
| Actualizaciones | Automáticas al recargar (Service Worker) | Revisión de tienda (días) | Revisión de tienda |
| Funciona sin conexión | Sí (Cache API + IndexedDB + Outbox) | Sí | Sí |
| Acceso a hardware | GPS, cámara, notificaciones vía Web APIs | Acceso total | Acceso total vía plugins |
| Push | Web Push (VAPID) | FCM / APNs | FCM / APNs |
| Background Sync | Sí en Android/Chrome; **no en iOS** | Sí | Depende del plugin |
| Tamaño de distribución | 0 MB (la app vive en el servidor) | 10-50 MB | 15-60 MB |
| Costo de publicación | $0 | $25 (Play) / $99 al año (App Store) | $25 / $99 |
| Curva de aprendizaje del equipo | Baja (HTML, CSS, JS) | Alta (2 lenguajes + 2 IDEs) | Media |
| Lighthouse / PWA auditable | **Sí, es el requisito del PDF** | No aplica | No aplica |
| Multiproyecto en 4 semanas | **Sí** | No | Riesgoso |

**Decisión:** PWA con arquitectura headless. Es lo que pide el PDF y lo único
alcanzable en 4 semanas con un equipo de 4 personas.

---

## 2. Cómo generar el APK

| Criterio | Bubblewrap (TWA) — elegida | Capacitor | PWABuilder |
|---|---|---|---|
| Cómo funciona | Empaqueta la PWA publicada en una Trusted Web Activity sobre Chrome | WebView propio con puente a plugins nativos | Interfaz web que genera el paquete |
| Service Worker | Igual que en Chrome | Sí | Igual que en TWA |
| Push | Sí (incluido) | Requiere plugin nativo | Sí |
| Background Sync | Sí (incluido) | Requiere plugin nativo | Sí |
| Generado «desde el código» | **Sí** (`init` + `build` reproducibles y versionados) | Sí | No (interfaz web) |
| Requiere Android Studio | No (usa Android SDK + Gradle) | Sí | No |
| Pantalla completa real | Sí, con `assetlinks.json` correcto | Sí | Sí, con `assetlinks.json` |
| Riesgo | Firma y `assetlinks` mal configurados | Plugins desactualizados | Poca trazabilidad del proceso |

**Decisión:** **Bubblewrap**, por ser reproducible desde el código y conservar
todas las APIs que exige el PDF. Ver `android-twa/README.md`.

---

## 3. Hosting de la PWA

| Criterio | Cloudflare Pages | Vercel | Netlify |
|---|---|---|---|
| Capa gratuita | Ilimitada (500 builds/mes) | 100 GB de ancho de banda | 100 GB de ancho de banda |
| HTTPS automático | Sí | Sí | Sí |
| Cabeceras personalizadas | `_headers` | `vercel.json` | `_headers` / `netlify.toml` |
| Dominio propio | Sí | Sí | Sí |
| CDN | Red global de Cloudflare | Edge global | Edge global |
| Configuración para `sw.js` | Soportada | Soportada | Soportada |

**Decisión:** cualquiera de las tres sirve; se deja configurado **Cloudflare
Pages** (`public/_headers`) y **Vercel** (`vercel.json`) para no depender de una
sola cuenta. La decisión final se toma en el Sprint 4 según quién tenga la
cuenta activa.

---

## 4. Base de datos

| Criterio | Neon (elegida) | Supabase | Railway |
|---|---|---|---|
| Motor | PostgreSQL serverless | PostgreSQL + extras | PostgreSQL |
| Capa gratuita | 0.5 GB, *scale to zero* | 500 MB | Crédito limitado |
| TLS obligatorio | Sí | Sí | Sí |
| Latencia en frío | Alta (se despierta) | Baja | Media |
| Compatible con `pg` (Node) | Sí | Sí | Sí |

**Decisión:** **Neon** por simplicidad y porque el driver `pg` funciona sin
cambios. Se mitiga la latencia en frío calentando el servidor antes de la demo.

---

## 5. Almacenamiento de fotos y notificaciones

| Necesidad | Opción elegida | Alternativa | Motivo |
|---|---|---|---|
| Fotos de evidencia | Cloudinary (capa gratuita) | Disco local de Render / S3 | Render Free no tiene disco persistente |
| Push | Web Push con VAPID (`web-push`) | FCM | VAPID no requiere cuenta de Google y funciona en Chrome Android |
| API | Render (capa gratuita) | Railway / Fly.io | Blueprint `render.yaml` listo |

---

## 6. Resumen de la arquitectura elegida

| Capa | Tecnología | Costo |
|---|---|---|
| Frontend | PWA Vanilla JS ES6 modules + Vite | $0 |
| Hosting de la PWA | Cloudflare Pages o Vercel | $0 |
| API | Node + Express en Render | $0 |
| Base de datos | PostgreSQL en Neon | $0 |
| Fotos | Cloudinary | $0 |
| Push | Web Push (VAPID) | $0 |
| Distribución Android | APK por Bubblewrap (TWA) | $0 |
| CI/CD | GitHub Actions | $0 |

**Costo total del proyecto: $0.** Toda la pila cabe en capas gratuitas, lo que
era un requisito implícito para un proyecto escolar de 4 semanas.
