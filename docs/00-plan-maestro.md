# CivicGuard PWA — Plan Maestro del Proyecto Integrador 2

**Universidad Tecnológica Metropolitana** · Ingeniería en Desarrollo y Gestión de Software
4 semanas · equipo de 4 personas

---

## 1. Resumen ejecutivo

CivicGuard es una PWA para reportar incidencias de infraestructura urbana
(baches, luminarias, fugas). Funciona sin conexión, captura GPS y foto,
sincroniza en segundo plano y notifica cuando el reporte se resuelve.

**Decisiones clave**

- **Arquitectura Headless:** PWA (Cloudflare Pages o Vercel) + API REST (Render)
  + PostgreSQL (Neon) + imágenes (Cloudinary).
- **ngrok** se mantiene en la Semana 1 como exige el PDF, para probar hardware
  real por HTTPS desde el celular.
- **APK generado desde el código** con Bubblewrap (Trusted Web Activity).
  Complementa a la PWA; no la reemplaza.
- **Patrones:** Singleton, Repository, Observer, Strategy, Facade, Outbox e
  idempotencia.
- **Trabajo:** ramas + Pull Requests + Conventional Commits + CI en GitHub
  Actions + Definition of Done.

## 2. Mejoras sobre el plan original

| # | Problema detectado | Mejora aplicada |
|---|---|---|
| 1 | Lighthouse 12+ eliminó la categoría PWA | Ejecutar Lighthouse 11 (`npx lighthouse@11 URL --only-categories=pwa,performance,accessibility`) para el puntaje PWA y Lighthouse actual para Rendimiento, Accesibilidad y Best Practices. Guardar capturas de ambos. Confirmar con el profesor la versión aceptada |
| 2 | Sin CORS, frontend y API en dominios distintos no se comunican | Middleware `cors()` con lista blanca de orígenes en Express; probar también el `fetch` desde `sw.js` |
| 3 | Las push no saben a qué dispositivo avisar | `deviceId` (UUID en IndexedDB) viaja con cada reporte y con la suscripción Push |
| 4 | Render Free se duerme tras ~15 min | Ping cada 10 min (UptimeRobot) y calentar el servidor antes de la demo |
| 5 | Vite genera archivos con hash que un `sw.js` manual no conoce | Script de build (~20 líneas) que lista `dist/` e inyecta `PRECACHE_URLS` y `CACHE_VERSION` en `sw.js`. El SW sigue siendo escrito a mano |
| 6 | ngrok free cambia de URL y muestra advertencia | Usarlo en Semana 1 (entregable) y como apoyo local; desde la Semana 2 desplegar en cada push |
| 7 | Carga desigual entre personas | Roles rebalanceados y revisión cruzada obligatoria (sección 6) |
| 8 | `PATCH /resolve` abierto a cualquiera | API key de administrador en cabecera `x-admin-key` (middleware) |
| 9 | Mapas con tiles pesan y no funcionan offline | Mostrar lat/lng y un enlace a Google Maps solo cuando hay red |
| 10 | Historial de commits desordenado | Ramas por feature, PR con revisión, Conventional Commits |
| 11 | iOS no soporta Background Sync | Fallback con los eventos `online` y `visibilitychange`; la demo completa se hace en Android/Chrome |
| 12 | Duplicados al reintentar envíos | `clientReportId` (UUID) con restricción UNIQUE en PostgreSQL: el backend responde 200 si ya existe |

## 3. Entrega como APK generado desde el código

### 3.1 Qué opción usar y por qué

| Opción | Cómo funciona | Service Worker, Push y Background Sync | Veredicto |
|---|---|---|---|
| **Bubblewrap (TWA)** | Empaqueta la PWA publicada en una Trusted Web Activity que corre sobre Chrome | Funcionan igual que en Chrome (incluye Push y Background Sync) | **Recomendada** |
| Capacitor | WebView propio con puente a plugins nativos | Service Worker sí; Push y Background Sync dependen de plugins nativos | Plan B si se quieren plugins nativos |
| PWABuilder | Interfaz web que genera el paquete | Igual que TWA | Alternativa rápida, pero no es «desde el código» |

Se elige **Bubblewrap**: genera el proyecto Android desde `manifest.json`, así
que el APK se produce con comandos reproducibles y versionados en el
repositorio. Conserva todas las APIs que pide el PDF.

### 3.2 Aclaración importante para la evaluación

El PDF exige URL pública HTTPS en producción y Lighthouse sobre esa URL. El APK
es un TWA que carga esa misma URL, por lo tanto depende de la PWA desplegada. Se
presenta como canal de distribución adicional: instalable como app nativa sin
pasar por tienda. Esto suma valor, pero **la URL HTTPS sigue siendo el
entregable principal**.

### 3.3 Pipeline del APK

1. **Requisitos:** JDK 17, Android SDK (Bubblewrap los descarga al primer init), Node 18+.
2. **Inicializar:** `npx @bubblewrap/cli init --manifest=https://TU-DOMINIO/manifest.json`.
   Define `applicationId` (p. ej. `mx.edu.utm.civicguard`), nombre, iconos maskable y color de tema.
3. **Firmar:** generar un keystore (`civicguard.keystore`). **No subirlo a GitHub**; guardarlo en un gestor de secretos del equipo.
4. **Digital Asset Links:** obtener el SHA-256 (`bubblewrap fingerprint`) y publicar `/.well-known/assetlinks.json` en el hosting. Sin este archivo la app muestra una barra de URL de Chrome.
5. **Compilar:** `npx @bubblewrap/cli build` produce `app-release-signed.apk` (y `.aab`).
6. **Distribuir:** subir el APK a GitHub Releases con etiqueta `v1.0.0` y agregar un código QR de descarga en el reporte.
7. **Automatizar (opcional):** workflow de GitHub Actions que compila el APK al crear una etiqueta `v*`, con el keystore en GitHub Secrets (base64).

### 3.4 Checklist de calidad del APK

- [ ] Abre en pantalla completa sin barra de URL (`assetlinks` correcto).
- [ ] Splash screen e icono adaptativo (maskable) correctos.
- [ ] Funciona en modo avión tras la primera carga.
- [ ] GPS y cámara piden permiso y funcionan dentro del TWA.
- [ ] Las notificaciones push llegan con la app instalada.
- [ ] Probado en al menos 2 dispositivos Android reales.

## 4. Arquitectura de software

### 4.1 Vista general

```text
[Celular: APK (TWA) o navegador]
   └─ PWA (Vanilla JS ES6 modules)
        ├─ UI (Shell inmutable + CSR)
        ├─ Servicios (GPS, Cámara, Push, Sync)
        ├─ Repositorios (IncidentRepository, OutboxRepository)
        ├─ IndexedDB  (outbox, cached_incidents, meta)
        └─ Service Worker /sw.js (Cache API, Network-First, Sync, Push)
                │  HTTPS + CORS
                ▼
   API REST Node + Express (Render)
        routes → controllers → services → repositories
                ▼
   PostgreSQL (Neon)   Cloudinary (fotos)   web-push (VAPID)
```

### 4.2 Patrones de diseño (frontend)

| Patrón | Dónde se aplica | Para qué |
|---|---|---|
| Singleton | `IndexedDbManager`, `ApiClient`, `SwRegistrationManager`, `EventBus` | Una sola conexión a IndexedDB y una sola instancia de cliente HTTP |
| Repository | `IncidentRepository`, `OutboxRepository` | La UI no conoce IndexedDB ni `fetch` |
| Observer / Pub-Sub | `EventBus` (`online`, `offline`, `outbox:changed`, `sync:done`) | Desacopla banner offline, contador de pendientes y lista |
| Strategy | `cacheStrategies.js` (CacheFirst, NetworkFirst) | Elegir estrategia por ruta sin `if` anidados |
| Facade | `HardwareFacade` (GPS + cámara) | La UI llama a `captureEvidence()` y recibe `{lat, lng, photoBlob}` |
| Adapter | `cameraService` con `getUserMedia` y respaldo `input capture` | Misma interfaz, dos implementaciones |
| Factory | `IncidentFactory.create()` | Construye el reporte con `clientReportId`, `deviceId`, fecha y estado `pending` |
| Outbox | Store `outbox` + Background Sync | Garantiza que ningún reporte offline se pierde |
| Idempotencia | `clientReportId` UNIQUE | Reintentos sin duplicados |

> **Nota:** el Service Worker corre en otro contexto de ejecución, así que tiene
> su propia instancia del Singleton. Ambos contextos comparten los mismos datos
> porque apuntan a la misma base de IndexedDB.

### 4.3 Estructura de carpetas

```text
civicguard-project/
├── docs/
├── .github/workflows/        # ci.yml, apk.yml
├── pwa-frontend/
│   ├── public/ (manifest.json, sw.js, icons/, .well-known/assetlinks.json)
│   ├── scripts/inject-precache.js
│   ├── index.html, vercel.json (o _headers)
│   └── src/
│       ├── app.js
│       ├── core/        (eventBus.js, swRegistrationManager.js)
│       ├── db/          (indexedDbManager.js)
│       ├── repositories/(incidentRepository.js, outboxRepository.js)
│       ├── factories/   (incidentFactory.js)
│       ├── hardware/    (geolocationService.js, cameraService.js, hardwareFacade.js)
│       ├── network/     (apiClient.js, backgroundSync.js)
│       ├── notifications/(pushSubscriber.js)
│       └── ui/          (shellComponents.js, offlineBanner.js)
├── android-twa/              # twa-manifest.json (sin keystore)
└── headless-backend/
    └── src/
        ├── config/ (db.js, webPush.js, cloudinary.js, env.js)
        ├── middlewares/ (cors, adminAuth, errorHandler, validate)
        ├── routes/, controllers/, services/, repositories/
        └── server.js
```

### 4.4 Arquitectura del backend

- **Capas:** `routes → controllers → services → repositories`. Los controladores no tocan SQL.
- **Singleton:** pool de conexiones de PostgreSQL y cliente de Cloudinary (una instancia por proceso).
- **Middlewares:** CORS con lista blanca, `x-admin-key`, validación de entrada, manejador central de errores.
- **Tablas:** `incidents` y `push_subscriptions`.
- **Variables de entorno:** `DATABASE_URL`, `CLOUDINARY_URL`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `ADMIN_API_KEY`, `ALLOWED_ORIGINS`. Nunca en el repositorio.

### 4.5 Contrato de API

Ver [`03-contrato-api.md`](./03-contrato-api.md).

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Estado del servicio |
| GET | `/api/incidents` | Lista de incidencias |
| POST | `/api/incidents` | Crea incidencia (idempotente por `clientReportId`) |
| PATCH | `/api/incidents/:id/resolve` | Marca como resuelta y dispara push (requiere `x-admin-key`) |
| POST | `/api/subscribe` | Guarda la suscripción Push ligada a `deviceId` |
| GET | `/api/vapid-public-key` | Entrega la llave pública para suscribirse |

Todas las respuestas usan el formato `{ ok, data, error }`.

## 5. Estrategia de trabajo del equipo

- **Ramas:** `main` (protegida, siempre desplegable), `develop` (integración) y `feature/<persona>-<tarea>`. Cada PR necesita 1 aprobación de otra persona.
- **Conventional Commits:** `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`. Ejemplo: `feat(sw): add network-first strategy for incidents`.
- **CI (GitHub Actions):** en cada PR ejecuta lint y un paso que falla si encuentra `localStorage` o `sessionStorage` en `src/` y `public/`.
- **Ceremonias:** planeación al inicio de cada sprint (30 min), standup de 10 min dos veces por semana, demo de integración el último día y retrospectiva breve.
- **Tablero:** GitHub Projects con columnas Backlog, En curso, En revisión, Hecho.
- **Definition of Done:**
  1. Funciona en Chrome Android real, no solo en escritorio.
  2. Sin `localStorage` ni `sessionStorage`.
  3. PR aprobado y fusionado en `develop`.
  4. Probado con la API desplegada, no solo local.
  5. Documentado en `docs/` si afecta un entregable.

## 6. Roles del equipo

| Rol | Responsabilidad principal | Apoya a |
|---|---|---|
| **P1 · Core SW y Offline** | `sw.js`, Cache API, IndexedDB, Network-First, Background Sync, evento push | P2 (integración de outbox) |
| **P2 · UI, Hardware y Manifest** | Shell, renderizado mixto, manifest, iconos maskable, GPS, cámara, accesibilidad, `pushSubscriber.js` | P1 (estado offline en UI) |
| **P3 · Backend, BD y Push** | API Express, Neon, Cloudinary, VAPID, idempotencia, panel admin | P4 (despliegue backend, pruebas de API) |
| **P4 · DevOps, QA, Lighthouse y APK** | Entorno seguro, ngrok, CI, despliegues, Lighthouse, APK, documentos | P1 y P2 (pruebas en dispositivo) |

## 7. Sprints detallados

### Sprint 1 · Semana 1: Arquitectura, entorno y base

**Meta:** repositorio ordenado, entorno seguro probado en celular real, shell y
manifest listos, tabla comparativa y reporte de entorno entregados.

| Persona | Tareas |
|---|---|
| P1 | Definir estructura de `pwa-frontend/`. Crear `indexedDbManager.js` como Singleton con los stores `outbox`, `cached_incidents`, `meta`. Crear `eventBus.js`. Agregar el chequeo anti-localStorage al CI junto con P4 |
| P2 | Diseñar y vincular `manifest.json` (`name`, `short_name`, `start_url`, `display: standalone`, `theme_color`, `scope`). Maquetar el Application Shell inmutable en `index.html` con CSS crítico en línea, fuentes del sistema y HTML semántico |
| P3 | Crear `headless-backend/` con capas y Singleton de BD. Configurar Neon (tablas `incidents` y `push_subscriptions`). Activar `/health`, CORS y despliegue inicial en Render. Redactar el contrato de API |
| P4 | Crear el repositorio con ramas protegidas y plantilla de PR. Configurar servidor local (Vite) con `Cache-Control: no-store, max-age=0` y validar `window.isSecureContext`. Configurar ngrok y probar en celular real. Publicar un «hola mundo» en Cloudflare Pages o Vercel. Redactar la Tabla Comparativa y el Reporte de Configuración del Entorno |

**Entregables:** Tabla Comparativa, Reporte de Entorno, repo con CI, shell
visible en el celular por ngrok y por URL HTTPS.
**Criterios de aceptación:** `/health` responde 200 desde el celular; el shell
carga en 3G simulado; el CI bloquea un PR de prueba que contenga `localStorage`.

### Sprint 2 · Semana 2: Service Worker y renderizado mixto

**Meta:** `sw.js` controla el scope `/`, el shell carga sin red y la app es instalable.

| Persona | Tareas |
|---|---|
| P1 | Programar `/sw.js` con `install` (precarga del shell en Cache API), `activate` (limpiar cachés viejas + `clients.claim()`) y `self.skipWaiting()`. Implementar `cacheStrategies.js` (Strategy) con CacheFirst para el shell. Crear `swRegistrationManager.js` (Singleton). Documentar el Mapeo del Ciclo de Vida del SW |
| P2 | Generar iconos maskable 192 y 512 con zona segura. Implementar renderizado mixto: placeholders estáticos en el HTML y CSR para formulario y lista. Crear `shellComponents.js` y `offlineBanner.js` (suscrito al EventBus) |
| P3 | Construir `POST /api/incidents` y `GET /api/incidents` con Cloudinary, validación y respuestas `{ ok, data, error }`. Redeploy en Render con CORS para el dominio de la PWA |
| P4 | Script `inject-precache.js` en el build. Configurar `Cache-Control: public, max-age=0, must-revalidate` para `/sw.js`. Verificar en DevTools y en celular real: `waiting → activated`, banner de instalación. Primera pasada de Lighthouse |

**Entregable:** código con el ciclo de vida completo del SW.
**Criterios de aceptación:** shell arranca en modo avión; se puede instalar la
PWA; al subir una versión nueva el SW se actualiza sin borrar datos.

### Sprint 3 · Semana 3: Offline avanzado, sincronización y hardware

**Meta:** flujo completo offline: capturar GPS y foto, guardar, cerrar la app,
reabrir y sincronizar.

| Persona | Tareas |
|---|---|
| P1 | `OutboxRepository` e `IncidentRepository` sobre IndexedDB. Network-First con fallback local para `GET /api/incidents`. Listener `sync` con etiqueta `sync-incidencias` que vacía la outbox. Reintentos con espera creciente |
| P2 | `geolocationService.js` (timeout, permisos denegados). `cameraService.js` con `getUserMedia` y respaldo `input capture`; compresión con Canvas (~800 px, JPEG 0.7) a Blob. `HardwareFacade`. `IncidentFactory`. UI con etiqueta «Pendiente de sincronizar». `backgroundSync.js` con fallback `online` |
| P3 | Idempotencia por `clientReportId` (UNIQUE + `ON CONFLICT DO NOTHING`). Límite de tamaño de foto y validaciones. Endpoint `/api/vapid-public-key`. Panel de administrador simple para listar y resolver incidencias |
| P4 | Pruebas en dispositivo real: arranque sin red → reporte con GPS y foto → cierre y reapertura → reconexión → sincronización. Pruebas de duplicados. Reporte de errores y bitácora de pruebas |

**Entregable:** Módulo Operativo Offline demostrable en modo avión.
**Criterios de aceptación:** cero reportes perdidos o duplicados en 10 ciclos de
prueba; la foto y las coordenadas llegan completas al servidor.

### Sprint 4 · Semana 4: Push, auditoría, APK y producción

**Meta:** push real, Lighthouse aprobado, APK firmado, documentación final.
Congelar funciones a mitad de semana.

| Persona | Tareas |
|---|---|
| P1 | Listeners `push` (`showNotification`) y `notificationclick`. Optimizar tamaño de caché y versión final del SW. Revisión final sin `localStorage` |
| P2 | `pushSubscriber.js` (botón «Activar alertas», permiso y envío al backend con `deviceId`). Accesibilidad: `aria-*`, contraste, `alt`, meta viewport, foco visible. Imágenes en WebP, CSS crítico, scripts diferidos |
| P3 | Llaves VAPID, `POST /api/subscribe`, `PATCH /api/incidents/:id/resolve` con `x-admin-key` que dispara la push al `deviceId`. Manejar suscripciones expiradas (410). Backend final en Render |
| P4 | Deploy final de la PWA con HTTPS. Lighthouse en producción con Throttling 3G. Generar el APK, subirlo a GitHub Releases y probarlo. Redactar el Reporte del Plan de Pruebas y Despliegue. Limpiar el historial de commits y el README |

**Entregables:** repositorio público, Reporte de Pruebas y Despliegue con
métricas Lighthouse y URL HTTPS, APK en Releases.
**Criterios de aceptación:** Lighthouse ≥ 90 en PWA, Rendimiento y Accesibilidad;
push recibida en celular con la app cerrada; APK instalado y funcionando offline.

## 8. Matriz de cumplimiento del PDF (100%)

| Requisito del PDF | Dónde se cumple | Evidencia |
|---|---|---|
| Tabla Comparativa | Sprint 1 · P4 | `docs/01-...pdf` |
| Reporte de Configuración del Entorno (ngrok, puertos, caché, contexto seguro) | Sprint 1 · P4 | `docs/02-...pdf` |
| `manifest.json` + Application Shell inmutable | Sprint 1 · P2 | Archivos + Lighthouse |
| `sw.js` en la raíz con scope global | Sprint 2 · P1 | DevTools |
| Maskable Icons / splash / home-screen | Sprint 2 · P2 | Capturas en celular |
| Renderizado mixto (estático + CSR) | Sprint 2 · P2 | Código |
| `install`, `activate`, `skipWaiting` | Sprint 2 · P1 | Código + Mapeo del ciclo de vida |
| Cache API + IndexedDB | Sprint 3 · P1 | Código + DevTools |
| Geolocalización y Cámara | Sprint 3 · P2 | Demo en celular |
| Network-First con fallback | Sprint 3 · P1 | Prueba en modo avión |
| Background Sync | Sprint 3 · P1 | Prueba de reconexión |
| Notificaciones Push | Sprint 4 · P1, P2, P3 | Demo en celular |
| Prohibido `localStorage` | Todo el equipo | CI + búsqueda global |
| Arquitectura Headless | Backend separado | Diagrama + URLs |
| Lighthouse ≥ 90 con Throttling 3G | Sprint 4 · P4 | Reportes JSON y capturas |
| Hosting HTTPS en producción | Sprint 4 · P4 | URL pública |
| Repositorio con commits | Todo el equipo | GitHub |
| Reporte del Plan de Pruebas y Despliegue | Sprint 4 · P4 | `docs/03-...pdf` |
| Extra: APK desde el código | Sprint 4 · P4 | GitHub Releases |

## 9. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Render dormido durante la demo | Alta | UptimeRobot y calentar 5 min antes |
| Lighthouse bajo en 3G | Media | Sin frameworks, CSS crítico, WebP, `defer`, medir desde el Sprint 2 |
| Fallo en `assetlinks.json` del APK | Media | Verificar SHA-256 con la firma de release, no la de debug |
| Background Sync no dispara en pruebas | Media | Fallback `online` y botón manual «Sincronizar ahora» |
| Pérdida del keystore | Baja, impacto alto | Respaldo cifrado en un gestor de secretos del equipo |
| Integración tardía | Alta | Demo de integración cada semana, congelamiento a mitad del Sprint 4 |
| Límites de capas gratuitas (Neon, Cloudinary) | Baja | Compresión de fotos y datos de prueba mínimos |

## 10. Guion de demostración (Dictamen por Estudio de Casos)

1. Abrir la URL HTTPS en Android e instalar la PWA (o instalar el APK).
2. Mostrar Lighthouse y el checklist de instalabilidad.
3. Activar modo avión.
4. Abrir la app (arranca sin red) y crear un reporte con GPS y foto.
5. Mostrar el reporte con la etiqueta «Pendiente de sincronizar» en la lista.
6. Cerrar la app por completo y volver a abrirla sin red.
7. Desactivar modo avión y mostrar la sincronización automática.
8. En el panel de administrador, marcar el reporte como solucionado.
9. Recibir la notificación push en el celular y tocarla para abrir el reporte.
10. Mostrar el repositorio, el historial de commits y la búsqueda global sin `localStorage`.

## 11. Próximos pasos inmediatos

1. Crear el repositorio y las ramas protegidas.
2. Acordar el contrato de API en una reunión de 30 minutos.
3. P4 configura ngrok y el despliegue «hola mundo».
4. P1 y P2 arrancan `indexedDbManager.js` y el shell en paralelo.
5. P3 deja `/health` y la base de datos activos.
