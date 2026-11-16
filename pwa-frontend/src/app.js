import { eventBus, EVENTS } from './core/eventBus.js';
import { reportEnvironment } from './core/environment.js';
import swRegistrationManager from './core/swRegistrationManager.js';
import indexedDbManager from './db/indexedDbManager.js';
import { mountShell } from './ui/shellComponents.js';
import offlineBanner from './ui/offlineBanner.js';

/**
 * Punto de entrada de la PWA.
 * Sprint 1: contexto seguro + Singleton de IndexedDB.
 * Sprint 2: shell con renderizado mixto, banner offline y Service Worker.
 */
async function bootstrap() {
  const environment = reportEnvironment();

  // El shell se monta antes de tocar IndexedDB: la UI aparece aunque la base
  // de datos tarde (o falle), y sigue funcionando sin conexión.
  mountShell();
  offlineBanner.mount();

  try {
    const db = await indexedDbManager.open();
    console.info(`[CivicGuard] IndexedDB "${db.name}" v${db.version} lista`);
    eventBus.emit(EVENTS.APP_READY, { environment, dbName: db.name, dbVersion: db.version });
  } catch (error) {
    console.error('[CivicGuard] No se pudo abrir IndexedDB', error);
    eventBus.emit(EVENTS.APP_ERROR, { error });
  }

  await registerServiceWorker(environment);
}

/** @param {ReturnType<typeof reportEnvironment>} environment */
async function registerServiceWorker(environment) {
  if (!environment.secureContext) {
    console.warn('[CivicGuard] Sin contexto seguro no se registra el Service Worker');
    return;
  }

  // En desarrollo el servidor responde `Cache-Control: no-store` y el Service
  // Worker solo estorbaría (serviría versiones viejas al recargar). El ciclo de
  // vida se prueba con: npm run build && npm run preview
  if (!import.meta.env.PROD) {
    console.info(
      '[CivicGuard] Modo desarrollo: Service Worker no registrado. Usa "npm run build && npm run preview".',
    );
    return;
  }

  await swRegistrationManager.register();
}

bootstrap();

export { bootstrap };
