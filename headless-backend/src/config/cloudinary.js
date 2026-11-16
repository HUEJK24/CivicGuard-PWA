import { v2 as cloudinarySdk } from 'cloudinary';
import { env } from './env.js';

/**
 * CloudinaryClient — Singleton (patrón Singleton).
 *
 * Se configura una sola vez por proceso. Si `CLOUDINARY_URL` no está definida
 * el cliente queda deshabilitado y la API sigue funcionando: los reportes se
 * guardan con `photo_url = null`. Así el backend arranca sin credenciales
 * (Sprint 1) y basta con añadirlas en Render para activar las fotos.
 */
class CloudinaryClient {
  static #instance = null;

  #configured = false;

  constructor() {
    if (CloudinaryClient.#instance) return CloudinaryClient.#instance;
    CloudinaryClient.#instance = this;
  }

  static getInstance() {
    return (CloudinaryClient.#instance ??= new CloudinaryClient());
  }

  get isEnabled() {
    return Boolean(env.cloudinaryUrl);
  }

  get client() {
    if (!this.isEnabled) {
      throw new Error('CLOUDINARY_URL no está configurada.');
    }
    if (!this.#configured) {
      cloudinarySdk.config({ cloudinary_url: env.cloudinaryUrl, secure: true });
      this.#configured = true;
    }
    return cloudinarySdk;
  }
}

export const cloudinaryClient = CloudinaryClient.getInstance();
export { CloudinaryClient };
export default cloudinaryClient;
