import { eventBus, EVENTS } from './eventBus.js';

const SW_URL = '/sw.js';
const SW_SCOPE = '/';

/**
 * SwRegistrationManager — Singleton.
 *
 * Registra `/sw.js`, vigila las actualizaciones y aplica la versión nueva sin
 * borrar datos: cuando el Service Worker nuevo pasa a `waiting`, se avisa por
 * el EventBus; `activateUpdate()` envía `SKIP_WAITING` y el `controllerchange`
 * recarga la página (solo si ya había un SW controlando, para no recargar en la
 * primera instalación).
 */
class SwRegistrationManager {
  static #instance = null;

  #registration = null;
  #registering = null;
  #reloading = false;

  constructor() {
    if (SwRegistrationManager.#instance) return SwRegistrationManager.#instance;
    SwRegistrationManager.#instance = this;
  }

  static getInstance() {
    return (SwRegistrationManager.#instance ??= new SwRegistrationManager());
  }

  get isSupported() {
    return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  }

  get registration() {
    return this.#registration;
  }

  /** Registra el SW una sola vez y devuelve la ServiceWorkerRegistration. */
  async register() {
    if (!this.isSupported) {
      console.info('[CivicGuard] Este navegador no soporta Service Workers');
      return null;
    }
    if (!this.#registering) {
      this.#registering = this.#doRegister();
    }
    return this.#registering;
  }

  async #doRegister() {
    const hadController = Boolean(navigator.serviceWorker.controller);

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || this.#reloading) return;
      this.#reloading = true;
      console.info('[CivicGuard] Versión nueva activa: recargando para aplicarla');
      window.location.reload();
    });

    try {
      const registration = await navigator.serviceWorker.register(SW_URL, {
        scope: SW_SCOPE,
        // No queremos que el caché HTTP decida cuándo hay versión nueva de sw.js.
        updateViaCache: 'none',
      });
      this.#registration = registration;
      console.info(`[CivicGuard] Service Worker registrado (scope: ${registration.scope})`);
      this.#watchForUpdates(registration);
      return registration;
    } catch (error) {
      console.error('[CivicGuard] No se pudo registrar el Service Worker', error);
      eventBus.emit(EVENTS.SW_ERROR, { error });
      return null;
    }
  }

  /** @param {ServiceWorkerRegistration} registration */
  #watchForUpdates(registration) {
    if (registration.waiting) this.#announceUpdate(registration);

    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      if (!installing) return;

      installing.addEventListener('statechange', () => {
        if (installing.state !== 'installed') return;

        if (registration.waiting) {
          this.#announceUpdate(registration);
        } else {
          console.info('[CivicGuard] Service Worker instalado y activo (primera vez)');
          eventBus.emit(EVENTS.SW_READY, { scope: registration.scope });
        }
      });
    });
  }

  /** @param {ServiceWorkerRegistration} registration */
  #announceUpdate(registration) {
    console.info('[CivicGuard] Versión nueva en espera (waiting)');
    eventBus.emit(EVENTS.SW_UPDATE_AVAILABLE, {
      registration,
      activate: () => this.activateUpdate(),
    });
  }

  /** Activa de inmediato la versión en espera. @returns {boolean} */
  activateUpdate() {
    const waiting = this.#registration?.waiting;
    if (!waiting) return false;
    waiting.postMessage({ type: 'SKIP_WAITING' });
    return true;
  }

  /** Fuerza una comprobación de actualización. */
  async checkForUpdate() {
    return this.#registration?.update() ?? null;
  }
}

export const swRegistrationManager = SwRegistrationManager.getInstance();
export { SwRegistrationManager };
export default swRegistrationManager;
