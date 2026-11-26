import { eventBus, EVENTS } from './core/eventBus.js';
import { reportEnvironment } from './core/environment.js';
import swRegistrationManager from './core/swRegistrationManager.js';
import indexedDbManager from './db/indexedDbManager.js';
import { mountShell, renderList, setApiStatus } from './ui/shellComponents.js';
import { mountViewNavigation } from './ui/viewNavigation.js';
import offlineBanner from './ui/offlineBanner.js';
import { mountPushNotifications } from './notifications/pushNotifications.js';
import {
  createIncident,
  refreshIncidents,
} from './services/incidentSyncService.js';

/**
 * Punto de entrada de la PWA.
 * Sprint 1: contexto seguro + Singleton de IndexedDB.
 * Sprint 2: shell con renderizado mixto, banner offline y Service Worker.
 */
async function bootstrap() {
  const environment = reportEnvironment();

  // El shell se monta antes de tocar IndexedDB: la UI aparece aunque la base
  // de datos tarde (o falle), y sigue funcionando sin conexión.
  mountViewNavigation();
  mountShell(submitIncident);
  offlineBanner.mount();

  try {
    const db = await indexedDbManager.open();
    console.info(`[CivicGuard] IndexedDB "${db.name}" v${db.version} lista`);
    eventBus.emit(EVENTS.APP_READY, { environment, dbName: db.name, dbVersion: db.version });
    await refreshReportList();
  } catch (error) {
    console.error('[CivicGuard] No se pudo abrir IndexedDB', error);
    eventBus.emit(EVENTS.APP_ERROR, { error });
    setApiStatus(`No se pudo abrir el almacenamiento de este dispositivo: ${error.message}`, 'error');
  }

  eventBus.on(EVENTS.ONLINE, () => {
    setApiStatus('Conexión restablecida. Actualizando reportes…');
    refreshReportList().catch((error) => {
      console.error('[CivicGuard] No se pudieron sincronizar los reportes:', error);
      setApiStatus(`No pudimos actualizar los reportes: ${error.message}`, 'error');
    });
  });
  eventBus.on(EVENTS.OFFLINE, () => {
    setApiStatus('Sin conexión. Los reportes nuevos se guardan en este dispositivo.');
  });

  await registerServiceWorker(environment);
  mountPushNotifications();
}

async function submitIncident(report) {
  const result = await createIncident(report);
  renderList(result.incidents);
  if (result.synced) {
    setApiStatus('Tu reporte se envió correctamente.', 'ok');
  } else if (result.error) {
    setApiStatus(`Reporte guardado. No pudimos enviarlo: ${result.error.message}`, 'error');
  } else {
    setApiStatus('Reporte guardado. Se enviará al recuperar la conexión.');
  }
  return result;
}

async function refreshReportList() {
  const result = await refreshIncidents();
  renderList(result.incidents);
  if (result.connected) {
    setApiStatus('Tus reportes están al día.', 'ok');
  } else if (result.error) {
    console.warn('[CivicGuard] No se pudo consultar la API:', result.error);
    setApiStatus(
      `No pudimos conectar con el servidor. Mostramos tus reportes guardados. ${result.error.message}`,
      'error',
    );
  } else {
    setApiStatus('Sin conexión. Mostramos los reportes guardados en este dispositivo.');
  }
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
