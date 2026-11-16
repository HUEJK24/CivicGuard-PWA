import { eventBus, EVENTS } from '../core/eventBus.js';

/**
 * OfflineBanner — Singleton suscrito al EventBus.
 *
 * El banner (`#offline-banner`) es parte del shell estático; aquí solo se
 * muestra u oculta. Se reacciona a los eventos `online` / `offline` del
 * EventBus, así que en el Sprint 3 el monitor de red puede emitirlos sin tocar
 * este módulo. Mientras tanto, los eventos del navegador son la fuente.
 */

const BANNER_ID = 'offline-banner';

class OfflineBanner {
  static #instance = null;

  #element = null;
  #mounted = false;

  constructor() {
    if (OfflineBanner.#instance) return OfflineBanner.#instance;
    OfflineBanner.#instance = this;
  }

  static getInstance() {
    return (OfflineBanner.#instance ??= new OfflineBanner());
  }

  get isVisible() {
    return Boolean(this.#element && !this.#element.hidden);
  }

  mount() {
    if (this.#mounted) return this;
    this.#mounted = true;

    this.#element = document.getElementById(BANNER_ID);
    if (!this.#element) {
      console.warn(`[CivicGuard] No se encontró #${BANNER_ID}`);
      return this;
    }

    eventBus.on(EVENTS.OFFLINE, () => this.show());
    eventBus.on(EVENTS.ONLINE, () => this.hide());

    // Fuente de verdad mientras no exista un NetworkMonitor dedicado.
    globalThis.addEventListener('offline', () => eventBus.emit(EVENTS.OFFLINE));
    globalThis.addEventListener('online', () => eventBus.emit(EVENTS.ONLINE));

    this.#sync(navigator.onLine);
    return this;
  }

  show() {
    if (this.#element) this.#element.hidden = false;
  }

  hide() {
    if (this.#element) this.#element.hidden = true;
  }

  /** @param {boolean} online */
  #sync(online) {
    if (online) this.hide();
    else this.show();
  }
}

export const offlineBanner = OfflineBanner.getInstance();
export { OfflineBanner };
export default offlineBanner;
