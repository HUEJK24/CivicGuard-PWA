/**
 * EventBus — Observer / Pub-Sub (Singleton).
 *
 * Desacopla emisores y receptores: el banner offline, el contador de
 * pendientes y la lista de reportes se suscriben aquí sin conocerse entre sí.
 *
 * Eventos previstos: online, offline, outbox:changed, sync:done, app:ready,
 * app:error.
 */
class EventBus extends EventTarget {
  static #instance = null;

  constructor() {
    super();
    if (EventBus.#instance) return EventBus.#instance;
    EventBus.#instance = this;
  }

  static getInstance() {
    return (EventBus.#instance ??= new EventBus());
  }

  /**
   * @param {string} type
   * @param {(event: CustomEvent) => void} handler
   * @param {AddEventListenerOptions} [options]
   * @returns {() => void} función para desuscribirse
   */
  on(type, handler, options) {
    this.addEventListener(type, handler, options);
    return () => this.off(type, handler, options);
  }

  /** @param {string} type @param {(event: CustomEvent) => void} handler */
  off(type, handler, options) {
    this.removeEventListener(type, handler, options);
  }

  /** @param {string} type @param {any} [detail] */
  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
}

export const eventBus = EventBus.getInstance();
export const EVENTS = Object.freeze({
  APP_READY: 'app:ready',
  APP_ERROR: 'app:error',
  ONLINE: 'online',
  OFFLINE: 'offline',
  OUTBOX_CHANGED: 'outbox:changed',
  SYNC_DONE: 'sync:done',
  // Ciclo de vida del Service Worker
  SW_READY: 'sw:ready',
  SW_UPDATE_AVAILABLE: 'sw:update-available',
  SW_ERROR: 'sw:error',
  // Formulario (el outbox real llega en el Sprint 3)
  DRAFT_CHANGED: 'draft:changed',
});

export default eventBus;
