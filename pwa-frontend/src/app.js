import { eventBus, EVENTS } from './core/eventBus.js';
import { reportEnvironment } from './core/environment.js';
import swRegistrationManager from './core/swRegistrationManager.js';
import indexedDbManager from './db/indexedDbManager.js';
import { mountShell, renderList, setApiStatus } from './ui/shellComponents.js';
import offlineBanner from './ui/offlineBanner.js';
import { mountPushNotifications } from './notifications/pushNotifications.js';
import {
  createIncident,
  refreshIncidents,
} from './services/incidentSyncService.js';
import { apiBaseUrl } from './core/apiClient.js';

/**
 * Punto de entrada de la PWA.
 * Sprint 1: contexto seguro + Singleton de IndexedDB.
 * Sprint 2: shell con renderizado mixto, banner offline y Service Worker.
 */
async function bootstrap() {
  const environment = reportEnvironment();
  console.info('[CivicGuard] Diagnóstico de API', {
    apiBaseUrl: apiBaseUrl || 'no configurada',
    browserOnline: navigator.onLine,
  });

  // El shell se monta antes de tocar IndexedDB: la UI aparece aunque la base
  // de datos tarde (o falle), y sigue funcionando sin conexión.
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
    setApiStatus(`No se pudo abrir el almacenamiento local: ${error.message}`, 'error');
  }

  eventBus.on(EVENTS.ONLINE, () => {
    setApiStatus('Conexión restablecida; sincronizando reportes…');
    refreshReportList().catch((error) => {
      console.error('[CivicGuard] No se pudieron sincronizar los reportes:', error);
      setApiStatus(`No se pudieron sincronizar los reportes: ${error.message}`, 'error');
    });
  });
  eventBus.on(EVENTS.OFFLINE, () => {
    setApiStatus('Sin conexión; los reportes nuevos se guardarán en este dispositivo.');
  });

  await registerServiceWorker(environment);
  mountPushNotifications();
}

async function submitIncident(report) {
  const result = await createIncident(report);
  renderList(result.incidents);
  if (result.synced) {
    console.info('[CivicGuard] Reporte sincronizado con la API.');
    setApiStatus('API conectada; reporte sincronizado.', 'ok');
  } else if (result.error) {
    console.error('[CivicGuard] Reporte conservado en IndexedDB; falló la sincronización.', {
      apiBaseUrl: apiBaseUrl || 'no configurada',
      browserOnline: navigator.onLine,
      reason: result.error.message,
    });
    setApiStatus(`Reporte pendiente: ${result.error.message}`, 'error');
  } else {
    console.info('[CivicGuard] Reporte conservado en IndexedDB: el navegador está sin conexión.');
    setApiStatus('Sin conexión; el reporte se enviará al reconectar.');
  }
  return result;
}

async function refreshReportList() {
  const result = await refreshIncidents();
  renderList(result.incidents);
  if (result.connected) {
    console.info('[CivicGuard] API conectada; reportes recibidos:', result.incidents.length);
    setApiStatus('API conectada; reportes actualizados.', 'ok');
  } else if (result.error) {
    console.error('[CivicGuard] Reportes locales: falló la comunicación con la API.', {
      apiBaseUrl: apiBaseUrl || 'no configurada',
      browserOnline: navigator.onLine,
      reason: result.error.message,
    });
    setApiStatus(`API no disponible; se muestran datos locales. ${result.error.message}`, 'error');
  } else {
    console.info('[CivicGuard] Reportes locales: el navegador está sin conexión.');
    setApiStatus('Sin conexión; se muestran los reportes guardados en este dispositivo.');
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
