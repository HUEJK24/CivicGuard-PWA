import indexedDbManager from '../db/indexedDbManager.js';

const OUTBOX_STORE = 'outbox';
const CACHED_INCIDENTS_STORE = 'cached_incidents';

export const incidentRepository = {
  getPending() {
    return indexedDbManager.getAll(OUTBOX_STORE);
  },

  getCached() {
    return indexedDbManager.getAll(CACHED_INCIDENTS_STORE);
  },

  savePending(incident) {
    return indexedDbManager.put(OUTBOX_STORE, incident);
  },

  removePending(clientReportId) {
    return indexedDbManager.delete(OUTBOX_STORE, clientReportId);
  },

  saveCached(incident) {
    return indexedDbManager.put(CACHED_INCIDENTS_STORE, incident);
  },

  replaceCached(incidents) {
    return indexedDbManager.run(CACHED_INCIDENTS_STORE, 'readwrite', (tx) => {
      const store = tx.objectStore(CACHED_INCIDENTS_STORE);
      store.clear();
      for (const incident of incidents) store.put(incident);
      return store.getAll();
    });
  },
};

export default incidentRepository;
