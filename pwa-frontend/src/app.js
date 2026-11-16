import { eventBus, EVENTS } from './core/eventBus.js';
import indexedDbManager from './db/indexedDbManager.js';

/**
 * Punto de entrada de la PWA.
 * Sprint 1: inicializa el Singleton de IndexedDB y publica el estado en el
 * EventBus. El shell visual vive en index.html (Application Shell inmutable).
 */
async function bootstrap() {
  try {
    const db = await indexedDbManager.open();
    console.info(
      `[CivicGuard] IndexedDB "${db.name}" v${db.version} lista`,
    );
    eventBus.emit(EVENTS.APP_READY, { dbName: db.name, dbVersion: db.version });
  } catch (error) {
    console.error('[CivicGuard] No se pudo abrir IndexedDB', error);
    eventBus.emit(EVENTS.APP_ERROR, { error });
  }
}

bootstrap();

export { bootstrap };
