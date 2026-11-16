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

## 5. Pendiente para los siguientes sprints

| Sprint | Qué se añade a `sw.js` |
|---|---|
| 3 | Listener `sync` con la etiqueta `sync-incidencias` (vacía la outbox) y `NetworkFirst` con fallback a IndexedDB para `GET /api/incidents` |
| 4 | Listeners `push` (`showNotification`) y `notificationclick` (abrir el reporte resuelto) |
