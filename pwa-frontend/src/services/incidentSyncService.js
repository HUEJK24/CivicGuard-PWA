import indexedDbManager from '../db/indexedDbManager.js';
import { apiRequest } from '../core/apiClient.js';
import incidentRepository from '../repositories/incidentRepository.js';

let syncPromise = null;

function toPendingIncident(report) {
  return {
    ...report,
    id: report.clientReportId,
    client_report_id: report.clientReportId,
    created_at: report.createdAt,
    status: 'pending',
    pendingSync: true,
  };
}

function sortByCreatedAt(incidents) {
  return incidents.sort(
    (left, right) => new Date(right.created_at) - new Date(left.created_at),
  );
}

export async function getIncidents() {
  const [pending, cached] = await Promise.all([
    incidentRepository.getPending(),
    incidentRepository.getCached(),
  ]);
  return sortByCreatedAt([...pending.map(toPendingIncident), ...cached]);
}

export async function syncPendingIncidents() {
  if (!navigator.onLine) {
    return { synced: 0, pending: true, error: null };
  }

  if (syncPromise) {
    const previous = await syncPromise;
    if (previous.error || !navigator.onLine) return previous;
    return syncPendingIncidents();
  }

  const currentSync = (async () => {
    const pending = await incidentRepository.getPending();
    let synced = 0;

    for (const report of pending) {
      try {
        const result = await apiRequest('/api/incidents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientReportId: report.clientReportId,
            deviceId: report.deviceId,
            title: report.title,
            description: report.description,
            lat: report.lat,
            lng: report.lng,
          }),
        });

        if (!result?.incident) {
          throw new Error('La API no confirmó el reporte.');
        }

        await incidentRepository.saveCached(result.incident);
        await incidentRepository.removePending(report.clientReportId);
        synced += 1;
      } catch (error) {
        return { synced, pending: true, error };
      }
    }

    return { synced, pending: false, error: null };
  })();

  syncPromise = currentSync;
  try {
    return await currentSync;
  } finally {
    if (syncPromise === currentSync) syncPromise = null;
  }
}

export async function refreshIncidents() {
  const sync = await syncPendingIncidents();
  if (sync.error) {
    return {
      incidents: await getIncidents(),
      connected: false,
      error: sync.error,
    };
  }

  try {
    const result = await apiRequest('/api/incidents?limit=100');
    if (!Array.isArray(result?.incidents)) {
      throw new Error('La API devolvió una lista de reportes inválida.');
    }
    await incidentRepository.replaceCached(result.incidents);
    return { incidents: await getIncidents(), connected: true, error: null };
  } catch (error) {
    return {
      incidents: await getIncidents(),
      connected: false,
      error,
    };
  }
}

export async function createIncident({ title, description, lat, lng }) {
  const report = {
    clientReportId: crypto.randomUUID(),
    deviceId: await indexedDbManager.getOrCreateDeviceId(),
    title,
    description,
    lat,
    lng,
    createdAt: new Date().toISOString(),
  };

  await incidentRepository.savePending(report);
  const sync = await syncPendingIncidents();

  return {
    synced: !sync.error && !sync.pending,
    error: sync.error,
    incidents: await getIncidents(),
  };
}

export default {
  createIncident,
  getIncidents,
  refreshIncidents,
  syncPendingIncidents,
};
