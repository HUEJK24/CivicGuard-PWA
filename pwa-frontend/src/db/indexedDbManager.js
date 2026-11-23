/**
 * IndexedDbManager — Singleton (patrón Singleton).
 *
 * Única puerta de entrada a IndexedDB en el contexto de la ventana.
 * Nota: el Service Worker corre en otro contexto de ejecución y tiene su
 * propia instancia; ambos comparten los mismos datos porque apuntan a la
 * misma base `civicguard`.
 *
 * Stores:
 *  - outbox            (keyPath: clientReportId) reportes pendientes de sincronizar
 *  - cached_incidents  (keyPath: id)             copia local de los reportes del servidor
 *  - meta              (keyPath: key)            deviceId y otros valores de la app
 */
class IndexedDbManager {
  static #instance = null;
  #dbPromise = null;

  static DB_NAME = 'civicguard';
  static DB_VERSION = 1;

  constructor() {
    if (IndexedDbManager.#instance) return IndexedDbManager.#instance;
    IndexedDbManager.#instance = this;
  }

  static getInstance() {
    return (IndexedDbManager.#instance ??= new IndexedDbManager());
  }

  /**
   * Abre (o reutiliza) la conexión a IndexedDB.
   * @returns {Promise<IDBDatabase>}
   */
  open() {
    if (!this.#dbPromise) {
      this.#dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(IndexedDbManager.DB_NAME, IndexedDbManager.DB_VERSION);

        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('outbox')) {
            db.createObjectStore('outbox', { keyPath: 'clientReportId' });
          }
          if (!db.objectStoreNames.contains('cached_incidents')) {
            db.createObjectStore('cached_incidents', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('meta')) {
            db.createObjectStore('meta', { keyPath: 'key' });
          }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this.#dbPromise;
  }

  /**
   * Ejecuta una operación dentro de una transacción y devuelve el resultado
   * de la petición, envuelto en una Promise.
   * @param {string|string[]} storeNames
   * @param {IDBTransactionMode} mode
   * @param {(tx: IDBTransaction) => IDBRequest} operation
   */
  async run(storeNames, mode, operation) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeNames, mode);
      const request = operation(tx);
      tx.oncomplete = () => resolve(request?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('Transacción abortada'));
    });
  }

  /** @param {string} store @param {any} value */
  put(store, value) {
    return this.run(store, 'readwrite', (tx) => tx.objectStore(store).put(value));
  }

  /** @param {string} store @param {IDBValidKey} key */
  delete(store, key) {
    return this.run(store, 'readwrite', (tx) => tx.objectStore(store).delete(key));
  }

  /** @param {string} store @param {IDBValidKey} key */
  get(store, key) {
    return this.run(store, 'readonly', (tx) => tx.objectStore(store).get(key));
  }

  /** @param {string} store */
  getAll(store) {
    return this.run(store, 'readonly', (tx) => tx.objectStore(store).getAll());
  }

  /** Obtiene o crea el UUID estable que vincula este navegador con sus reportes. */
  async getOrCreateDeviceId() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('meta', 'readwrite');
      const store = tx.objectStore('meta');
      const request = store.get('deviceId');
      let deviceId;

      request.onsuccess = () => {
        deviceId = request.result?.value;
        if (!deviceId) {
          deviceId = crypto.randomUUID();
          store.put({ key: 'deviceId', value: deviceId });
        }
      };
      tx.oncomplete = () => resolve(deviceId);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('Transacción abortada'));
    });
  }

  /** @param {string} store */
  clear(store) {
    return this.run(store, 'readwrite', (tx) => tx.objectStore(store).clear());
  }
}

export default IndexedDbManager.getInstance();
export { IndexedDbManager };
