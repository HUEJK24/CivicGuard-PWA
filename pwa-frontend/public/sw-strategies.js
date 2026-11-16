/* CivicGuard — Estrategias de caché (patrón Strategy)
 *
 * Se carga desde `sw.js` con `importScripts()`. No usa módulos ES6 porque el
 * Service Worker se sirve tal cual (no pasa por Vite) y debe funcionar en
 * cualquier Chrome Android.
 *
 * Cada estrategia recibe una Request y devuelve una Response.
 */
(function attachStrategies(global) {
  /** Tiempo máximo de espera antes de caer al caché (NetworkFirst). */
  const DEFAULT_TIMEOUT_MS = 5000;

  /** @param {Request} request @param {number} timeoutMs */
  function fetchWithTimeout(request, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timer));
  }

  /**
   * Deja la respuesta lista para la Cache API.
   *
   * La Cache API respeta la cabecera `Vary`: si el servidor responde
   * `Vary: Origin` (Vite preview y varias CDN lo hacen), la entrada guardada
   * desde una petición del Service Worker **no** coincide con la petición real
   * del navegador y el recurso precargado nunca se sirve. Como este Service
   * Worker solo cachea recursos de su propio origen, la cabecera `Vary` no
   * aporta nada: se elimina antes de guardar.
   *
   * @param {Response} response
   * @returns {Response | null} respuesta lista para `cache.put`, o null si no
   *   debe guardarse.
   */
  function toCacheable(response) {
    if (!response || !response.ok || response.type === 'opaque') return null;

    const cacheControl = response.headers.get('Cache-Control') ?? '';
    if (cacheControl.includes('no-store')) return null;

    const headers = new Headers(response.headers);
    headers.delete('Vary');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  /** Guarda en caché solo respuestas válidas y cacheables. */
  async function putCacheable(cache, key, response) {
    const cacheable = toCacheable(response.clone());
    if (cacheable) await cache.put(key, cacheable);
  }

  const strategies = {
    /**
     * CacheFirst: responde del caché y solo va a la red si no lo tiene.
     * Es la estrategia del Application Shell: rápido y funciona sin conexión.
     * `fallbackUrl` sirve para las navegaciones (cualquier ruta → index.html).
     */
    async cacheFirst(request, { cacheName, fallbackUrl } = {}) {
      const cache = await caches.open(cacheName);
      const cached =
        (await cache.match(request)) ??
        (fallbackUrl ? await cache.match(fallbackUrl) : undefined);
      if (cached) return cached;

      const response = await fetch(request);
      await putCacheable(cache, request, response);
      return response;
    },

    /**
     * NetworkFirst: intenta la red y, si falla o tarda demasiado, responde del
     * caché. Es la estrategia de los datos (GET /api/incidents).
     */
    async networkFirst(request, { cacheName, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
      const cache = await caches.open(cacheName);
      try {
        const response = await fetchWithTimeout(request, timeoutMs);
        await putCacheable(cache, request, response);
        return response;
      } catch (error) {
        const cached = await cache.match(request);
        if (cached) return cached;
        throw error;
      }
    },

    /**
     * StaleWhileRevalidate: responde del caché al instante y actualiza en
     * segundo plano. Para recursos que cambian poco y no son críticos.
     */
    async staleWhileRevalidate(request, { cacheName } = {}) {
      const cache = await caches.open(cacheName);
      const cached = await cache.match(request);

      const network = fetch(request)
        .then(async (response) => {
          await putCacheable(cache, request, response);
          return response;
        })
        .catch(() => undefined);

      if (cached) {
        network.catch(() => undefined);
        return cached;
      }

      const response = await network;
      if (!response) throw new Error(`Sin red ni caché para ${request.url}`);
      return response;
    },

    /** NetworkOnly: nunca cachea (recursos sensibles o volátiles). */
    networkOnly(request) {
      return fetch(request);
    },
  };

  global.CivicGuardStrategies = strategies;
  global.CivicGuardCache = Object.freeze({ toCacheable, putCacheable });
})(self);
