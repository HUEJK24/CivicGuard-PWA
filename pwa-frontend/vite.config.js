import { defineConfig } from 'vite';

/**
 * En desarrollo el shell NUNCA debe quedar cacheado: si el navegador guarda
 * index.html, los cambios no se ven y el Service Worker sirve versiones viejas.
 * Requisito del PDF: Cache-Control: no-store, max-age=0.
 */
const noStoreHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

export default defineConfig({
  // `host: true` expone el servidor en la red local para probarlo desde el
  // celular (ngrok apunta a este puerto).
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    headers: noStoreHeaders,
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
    headers: noStoreHeaders,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});
