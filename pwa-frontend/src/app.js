import { eventBus, EVENTS } from './core/eventBus.js';
import { reportEnvironment } from './core/environment.js';
import indexedDbManager from './db/indexedDbManager.js';

/**
 * Punto de entrada de la PWA.
 * Sprint 1: valida el contexto seguro (HTTPS o localhost) e inicializa el
 * Singleton de IndexedDB. El shell visual vive en index.html.
 */
async function bootstrap() {
  const environment = reportEnvironment();

  try {
    const db = await indexedDbManager.open();
    console.info(`[CivicGuard] IndexedDB "${db.name}" v${db.version} lista`);
    eventBus.emit(EVENTS.APP_READY, { environment, dbName: db.name, dbVersion: db.version });
  } catch (error) {
    console.error('[CivicGuard] No se pudo abrir IndexedDB', error);
    eventBus.emit(EVENTS.APP_ERROR, { error });
  }
}

bootstrap();

export { bootstrap };
