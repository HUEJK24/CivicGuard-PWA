/* CivicGuard — Service Worker (escrito a mano)
 *
 * Ciclo de vida completo:
 *   install  → precarga el Application Shell en la Cache API y llama a skipWaiting()
 *   activate → borra las cachés de versiones anteriores y llama a clients.claim()
 *   fetch    → elige la estrategia según el tipo de ruta (patrón Strategy)
 *   message  → acepta { type: 'SKIP_WAITING' } para activar una versión nueva
 *
 * Los marcadores `__CACHE_VERSION__` y `__PRECACHE_URLS__` los reemplaza
 * `scripts/inject-precache.js` durante el build (npm run build), porque Vite
 * genera nombres con hash que este archivo no puede conocer de antemano.
 */
importScripts('./sw-strategies.js');

const { cacheFirst, networkFirst, staleWhileRevalidate } = self.CivicGuardStrategies;
const { putCacheable } = self.CivicGuardCache;

const CACHE_VERSION = '__CACHE_VERSION__';
const PRECACHE_URLS = [
/* __PRECACHE_URLS__ */
];

const CACHE_PREFIX = 'civicguard';
const CACHE_NAMES = Object.freeze({
  shell: `${CACHE_PREFIX}-shell-${CACHE_VERSION}`,
  runtime: `${CACHE_PREFIX}-runtime-${CACHE_VERSION}`,
  api: `${CACHE_PREFIX}-api-${CACHE_VERSION}`,
});
const ACTIVE_CACHES = Object.freeze(Object.values(CACHE_NAMES));

/** Documento que se sirve cuando una navegación no tiene red. */
const OFFLINE_URL = '/index.html';
const API_PREFIX = '/api/';

/** Nunca se cachea el propio Service Worker ni sus dependencias. */
const NEVER_CACHE = new Set(['/sw.js', '/sw-strategies.js']);

/* ── Tabla de rutas → estrategia (patrón Strategy) ───────────────────────────
 * Sin `if` anidados: se recorre la tabla y gana la primera coincidencia. */
const ROUTES = [
  {
    name: 'shell-navigation',
    match: (request) => request.mode === 'navigate',
    handle: (request) =>
      cacheFirst(request, { cacheName: CACHE_NAMES.shell, fallbackUrl: OFFLINE_URL }),
  },
  {
    name: 'shell-assets',
    match: (_request, url) =>
      url.pathname.startsWith('/assets/') ||
      url.pathname.startsWith('/icons/') ||
      url.pathname === '/manifest.json',
    handle: (request) => cacheFirst(request, { cacheName: CACHE_NAMES.shell }),
  },
  {
    name: 'api-read',
    match: (_request, url) => url.pathname.startsWith(API_PREFIX),
    handle: (request) => networkFirst(request, { cacheName: CACHE_NAMES.api }),
  },
  {
    name: 'same-origin-other',
    match: () => true,
    handle: (request) => staleWhileRevalidate(request, { cacheName: CACHE_NAMES.runtime }),
  },
];

/** @param {Request} request @param {URL} url */
function pickRoute(request, url) {
  return ROUTES.find((route) => route.match(request, url));
}

/* ── install: precarga del shell ──────────────────────────────────────────── */
async function precacheShell() {
  const cache = await caches.open(CACHE_NAMES.shell);
  const urls = [...new Set([OFFLINE_URL, '/', ...PRECACHE_URLS])];

  const results = await Promise.allSettled(
    urls.map(async (url) => {
      // `cache: 'reload'` fuerza la descarga: no queremos una copia vieja del
      // caché HTTP dentro del caché del Service Worker.
      const response = await fetch(new Request(url, { cache: 'reload' }));
      if (!response.ok) throw new Error(`${response.status} al precargar ${url}`);
      // `putCacheable` limpia `Vary`, que rompería el `match()` posterior.
      await putCacheable(cache, url, response);
    }),
  );

  const failed = results.filter((result) => result.status === 'rejected');
  for (const failure of failed) {
    console.warn('[SW] No se pudo precargar:', failure.reason?.message ?? failure.reason);
  }

  console.info(
    `[SW] Precarga ${CACHE_VERSION}: ${urls.length - failed.length}/${urls.length} recursos`,
  );
}

self.addEventListener('install', (event) => {
  console.info(`[SW] install · versión ${CACHE_VERSION}`);
  event.waitUntil(
    (async () => {
      await precacheShell();
      // No esperamos a que se cierren las pestañas: la versión nueva queda en
      // estado `waiting` hasta que la app pida activarla (o hasta el próximo
      // arranque en frío).
      await self.skipWaiting();
      console.info('[SW] install completado · skipWaiting()');
    })(),
  );
});

/* ── activate: limpieza y control inmediato ───────────────────────────────── */
async function deleteOutdatedCaches() {
  const keys = await caches.keys();
  const outdated = keys.filter(
    (key) => key.startsWith(`${CACHE_PREFIX}-`) && !ACTIVE_CACHES.includes(key),
  );
  await Promise.all(outdated.map((key) => caches.delete(key)));
  if (outdated.length > 0) {
    console.info('[SW] Cachés eliminadas:', outdated.join(', '));
  }
  return outdated;
}

self.addEventListener('activate', (event) => {
  console.info(`[SW] activate · versión ${CACHE_VERSION}`);
  event.waitUntil(
    (async () => {
      await deleteOutdatedCaches();
      // Toma el control de las pestañas ya abiertas sin recargarlas.
      await self.clients.claim();
      console.info('[SW] activate completado · clients.claim()');
    })(),
  );
});

/* ── fetch: estrategia por ruta ───────────────────────────────────────────── */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Solo GET y solo nuestro origen: no tocamos terceros ni escrituras.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER_CACHE.has(url.pathname)) return;

  const route = pickRoute(request, url);
  if (!route) return;

  event.respondWith(
    route.handle(request).catch(async (error) => {
      console.warn(`[SW] ${route.name} falló en ${url.pathname}:`, error?.message ?? error);

      if (request.mode === 'navigate') {
        const offline = await caches.match(OFFLINE_URL);
        if (offline) return offline;
      }
      return Response.error();
    }),
  );
});

/* ── message: activación de una versión nueva bajo demanda ────────────────── */
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    console.info('[SW] SKIP_WAITING recibido: activando la versión nueva');
    self.skipWaiting();
    return;
  }

  if (event.data?.type === 'GET_VERSION') {
    event.ports?.[0]?.postMessage({ version: CACHE_VERSION, caches: ACTIVE_CACHES });
  }
});

self.addEventListener('push', (event) => {
  let notification = {};
  try {
    notification = event.data?.json() ?? {};
  } catch (error) {
    console.warn('[SW] El contenido de la notificación push no es JSON válido:', error);
  }

  const title = notification.title || 'CivicGuard';
  const options = {
    body: notification.body || 'Hay una actualización en uno de tus reportes.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: notification.url || '/' },
    tag: notification.incidentId ? `incident-${notification.incidentId}` : 'civicguard-update',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin);
  if (targetUrl.origin !== self.location.origin) return;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) {
        return existing.navigate(targetUrl.href).then(() => existing.focus());
      }
      return self.clients.openWindow(targetUrl.href);
    }),
  );
});
