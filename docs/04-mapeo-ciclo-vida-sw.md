# Mapeo del Ciclo de Vida del Service Worker — CivicGuard

**Entregable Sprint 2 · P1.** Documenta qué hace `sw.js` en cada fase del ciclo
de vida, cómo se actualiza la app sin borrar datos y cómo verificarlo.

Archivos implicados:

| Archivo | Rol |
|---|---|
| `pwa-frontend/public/sw.js` | Service Worker escrito a mano (se sirve tal cual, sin pasar por Vite) |
| `pwa-frontend/public/sw-strategies.js` | Estrategias de caché (patrón Strategy), cargadas con `importScripts()` |
| `pwa-frontend/src/core/swRegistrationManager.js` | Singleton que registra el SW y gestiona las actualizaciones |
| `pwa-frontend/scripts/inject-precache.js` | Inyecta `PRECACHE_URLS` y `CACHE_VERSION` en `dist/sw.js` durante el build |

---

## 1. Diagrama del ciclo de vida

```text
                    navigator.serviceWorker.register('/sw.js')
                                     │
                                     ▼
   ┌───────────────────────────  INSTALL  ───────────────────────────┐
   │ precacheShell()  → abre la caché civicguard-shell-<versión>      │
   │                    y descarga el shell (index.html, assets,      │
   │                    icons, manifest) con cache: 'reload'          │
   │ self.skipWaiting() → no espera a que se cierren las pestañas     │
   └─────────────────────────────────┬────────────────────────────────┘
                                     ▼
                            estado: installed
                    ¿ya había un SW controlando?
                       │                      │
                    no │                      │ sí
                       ▼                      ▼
            estado: activating        estado: WAITING  ←── se avisa por
                       │                                  EventBus
                       │                                  (sw:update-available)
                       │                                  y la app puede llamar a
                       │                                  activateUpdate()
                       │                                  → postMessage('SKIP_WAITING')
                       ▼
   ┌──────────────────────────  ACTIVATE  ───────────────────────────┐
   │ deleteOutdatedCaches() → borra civicguard-* que no sean la       │
   │                          versión actual                          │
   │ self.clients.claim()   → toma el control de las pestañas abiertas│
   └─────────────────────────────────┬────────────────────────────────┘
                                     ▼
                            estado: activated / running
                                     │
                                     ▼
   ┌───────────────────────────  FETCH  ─────────────────────────────┐
   │ Tabla ROUTES → primera coincidencia gana (patrón Strategy)       │
   │  · navigate        → CacheFirst (shell) + fallback /index.html   │
   │  · /assets/, /icons/, /manifest.json → CacheFirst (shell)        │
   │  · /api/**  (GET)  → NetworkFirst (caché civicguard-api-*)       │
   │  · resto del origen → StaleWhileRevalidate (civicguard-runtime-*)│
   └──────────────────────────────────────────────────────────────────┘
```

## 2. Fase por fase

### `install`

| Paso | Qué hace | Por qué |
|---|---|---|
| `precacheShell()` | Abre `civicguard-shell-<versión>` y descarga cada URL con `new Request(url, { cache: 'reload' })` | El shell debe estar en disco **antes** de que el usuario pierda la conexión |
| Tolerancia a fallos | Cada recurso se descarga con `Promise.allSettled`; un fallo no aborta la instalación | Un icono ausente no debe dejar la PWA sin Service Worker |
| `skipWaiting()` | La versión nueva no se queda esperando a que se cierren las pestañas | La app decide cuándo aplicarla (ver §3) |

`PRECACHE_URLS` viene **inyectado en el build**: Vite genera `assets/index-<hash>.js`
y `assets/index-<hash>.css`, nombres que el `sw.js` escrito a mano no puede
conocer. `scripts/inject-precache.js` recorre `dist/`, calcula la lista y la
escribe dentro del archivo.

### `activate`

| Paso | Qué hace | Por qué |
|---|---|---|
| `deleteOutdatedCaches()` | Borra toda caché `civicguard-*` que no sea de la versión actual | Evita que el disco del celular crezca sin control con cada despliegue |
| `clients.claim()` | El SW toma el control de las pestañas ya abiertas | La primera carga también funciona sin conexión, sin obligar a recargar |

> **Importante:** solo se borran las **cachés**. IndexedDB (`civicguard` con
> `outbox`, `cached_incidents`, `meta`) nunca se toca, así que una actualización
> no pierde reportes pendientes.

### `fetch`

Se ignoran las peticiones que no son `GET`, las de otros orígenes y `/sw.js` +
`/sw-strategies.js` (nunca se cachea el propio Service Worker). La estrategia se
elige con una tabla, no con `if` anidados:

```js
const ROUTES = [
  { name: 'shell-navigation', match: (req) => req.mode === 'navigate',              handle: cacheFirst },
  { name: 'shell-assets',     match: (_req, url) => url.pathname.startsWith('/assets/'), handle: cacheFirst },
  { name: 'api-read',         match: (_req, url) => url.pathname.startsWith('/api/'),    handle: networkFirst },
  { name: 'same-origin-other', match: () => true,                                   handle: staleWhileRevalidate },
];
```

| Estrategia | Comportamiento | Se usa en |
|---|---|---|
| **CacheFirst** | Responde del caché; solo va a la red si no lo tiene | Shell (`/`, `/index.html`, `/assets/*`, `/icons/*`, `/manifest.json`) |
| **NetworkFirst** | Intenta la red con *timeout* de 5 s y cae al caché | `GET /api/incidents` |
| **StaleWhileRevalidate** | Responde del caché y actualiza en segundo plano | Resto de recursos del mismo origen |

### `message`

| Mensaje | Efecto |
|---|---|
| `{ type: 'SKIP_WAITING' }` | Activa de inmediato la versión en `waiting` |
| `{ type: 'GET_VERSION' }` (con `MessageChannel`) | Devuelve `{ version, caches }` para depuración |

## 3. Actualización sin perder datos

```text
Despliegue nuevo (CACHE_VERSION distinto)
        │
        ▼
El navegador detecta que sw.js cambió (updateViaCache: 'none')
        │
        ▼
install → precarga el shell nuevo en civicguard-shell-<nueva>
        │
        ▼
El SW nuevo queda en WAITING  ──► EventBus: 'sw:update-available'
        │                                   │
        │                                   ▼
        │                        La UI puede mostrar "Hay una versión nueva"
        │                                   │
        │                                   ▼
        │                        activateUpdate() → SKIP_WAITING
        ▼
activate → borra las cachés viejas · clients.claim()
        │
        ▼
'controllerchange' → recarga la página (solo si ya había un SW controlando)
        │
        ▼
IndexedDB intacta: los reportes pendientes siguen en `outbox`
```

La recarga no se dispara en la **primera** instalación: el manager guarda si ya
existía un `navigator.serviceWorker.controller` antes de registrar.

## 4. Verificación

```bash
cd pwa-frontend
npm run build     # vite build + inject-precache → dist/sw.js con la versión real
npm run preview   # http://localhost:4173
```

En **DevTools → Application**:

| Qué revisar | Resultado esperado |
|---|---|
| Service Workers | `/sw.js` en estado **activated and is running** |
| Cache Storage | `civicguard-shell-<versión>`, `civicguard-api-<versión>`, `civicguard-runtime-<versión>` |
| Cache Storage → shell | `index.html`, `assets/index-*.js`, `icons/*`, `manifest.json` |
| Manifest | Instalable, sin errores de iconos |

Prueba de modo avión:

1. Cargar `http://localhost:4173` y esperar el log `[SW] activate completado`.
2. DevTools → Network → **Offline**.
3. Recargar: el shell debe arrancar (sale del `CacheFirst`).
4. Volver a **Online**: `NetworkFirst` repone `GET /api/incidents`.

Consola esperada en el primer arranque:

```text
[SW] install · versión <hash>
[SW] Precarga <hash>: N/N recursos
[SW] install completado · skipWaiting()
[SW] activate · versión <hash>
[SW] activate completado · clients.claim()
[CivicGuard] Service Worker registrado (scope: http://localhost:4173/)
[CivicGuard] Service Worker instalado y activo (primera vez)
```

⟨Captura: DevTools → Application → Service Workers en `activated and is running`⟩
⟨Captura: Cache Storage con las tres cachés `civicguard-*`⟩
⟨Captura: recarga con Network en Offline mostrando el shell⟩

## 5. Dos detalles que rompen el precache si se ignoran

### `Vary` en la Cache API

La Cache API **respeta** la cabecera `Vary` al hacer `match()`. Vite preview
responde `Vary: Origin`, así que una respuesta guardada desde una petición del
Service Worker no coincide con la petición real del navegador y el recurso
precargado nunca se sirve (síntoma: sin conexión aparece `Cargando formulario…`
y en consola `net::ERR_FAILED` sobre `/assets/index-*.js`).

Como este Service Worker solo cachea recursos de su propio origen, `Vary` no
aporta nada: `toCacheable()` en `sw-strategies.js` la elimina antes de guardar.
Es la única función que decide qué se guarda, y la usan tanto las estrategias
como la precarga del `install`.

### `CACHE_VERSION` debe incluir el propio `sw.js`

La versión se calcula con el hash del contenido de `dist/`. Si solo se hasheara
el shell, una corrección en `sw.js` (por ejemplo la de `Vary`) mantendría la
versión anterior, `activate` no borraría la caché vieja y el error seguiría ahí.
Por eso el hash incluye `sw.js` y `sw-strategies.js`, aunque **no** entren en
`PRECACHE_URLS`.

## 6. Evidencia de la prueba de actualización

Secuencia ejecutada en Chrome con Playwright (build `b12548898663` → build
`dc9bc30d2ba5`):

```text
[info] [SW] install · versión dc9bc30d2ba5
[info] [SW] Precarga dc9bc30d2ba5: 8/8 recursos
[info] [SW] install completado · skipWaiting()
[info] [SW] activate · versión dc9bc30d2ba5
[info] [SW] Cachés eliminadas: civicguard-shell-b12548898663
[info] [SW] activate completado · clients.claim()
```

| Comprobación | Resultado |
|---|---|
| Cachés antes | `['civicguard-shell-b12548898663']` |
| Cachés después | `['civicguard-shell-dc9bc30d2ba5']` |
| Recursos precargados | 8/8 (7 archivos + `/`) |
| IndexedDB | intacta (solo se borran cachés `civicguard-*`) |
| Formulario tras la actualización | renderizado y funcional |

Prueba de modo avión (mismo build, red desconectada con `context.setOffline(true)`):

| Comprobación | Resultado |
|---|---|
| Navegación `/` | servida desde `civicguard-shell-<versión>` |
| Formulario CSR | renderizado |
| Banner «Sin conexión» | visible |
| `[SW] ... falló` en consola | ninguno |
| Al volver la conexión | el banner se oculta |

## 7. Primera pasada de Lighthouse (Sprint 2 · P4)

```bash
cd pwa-frontend
npm run build && npm run preview      # http://localhost:4173
npx lighthouse http://localhost:4173/ \
  --only-categories=performance,accessibility,best-practices,pwa \
  --chrome-flags="--headless=new"
```

| Categoría | Puntaje |
|---|---|
| Performance | 99 |
| Accessibility | 100 |
| Best Practices | 100 |
| **PWA** | **100** |

Auditorías de instalabilidad: `installable-manifest` ✔, `maskable-icon` ✔,
`themed-omnibox` ✔, `splash-screen` ✔.

Métricas: FCP 0.8 s · LCP 1.0 s · TBT 0 ms · CLS 0.065 · Speed Index 0.8 s.

> Lighthouse 12 eliminó la categoría **PWA**; el puntaje de 100 proviene de
> Lighthouse 11.7.1. En 12.8.2 el resultado es Performance 82 · Accessibility 100 ·
> Best Practices 100.

⟨Captura: reporte de Lighthouse con PWA 100⟩

## 8. Pendiente para los siguientes sprints

| Sprint | Qué se añade a `sw.js` |
|---|---|
| 3 | Listener `sync` con la etiqueta `sync-incidencias` (vacía la outbox) y `NetworkFirst` con fallback a IndexedDB para `GET /api/incidents` |
| 4 | Listeners `push` (`showNotification`) y `notificationclick` (abrir el reporte resuelto) |
