import { cloudinaryClient } from '../config/cloudinary.js';
import { env } from '../config/env.js';

/**
 * PhotoService — sube la foto de evidencia a Cloudinary.
 *
 * Si Cloudinary no está configurado (Sprint 1 / desarrollo sin credenciales) el
 * servicio devuelve `null` y la incidencia se guarda sin foto: la sincronización
 * de reportes nunca se cae por falta de almacenamiento.
 */
export const photoService = {
  get isEnabled() {
    return cloudinaryClient.isEnabled;
  },

  /**
   * @param {Buffer} buffer
   * @param {{ publicId?: string }} [options]
   * @returns {Promise<{ url: string, publicId: string } | null>}
   */
  async upload(buffer, { publicId } = {}) {
    if (!this.isEnabled) return null;
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinaryClient.client.uploader.upload_stream(
        {
          folder: env.cloudinaryFolder,
          public_id: publicId,
          resource_type: 'image',
          overwrite: false,
          // Normaliza el tamaño: suficiente para evidencia, barato de almacenar.
          transformation: [{ width: 1280, height: 1280, crop: 'limit', quality: 'auto' }],
        },
        (error, uploaded) => (error ? reject(error) : resolve(uploaded)),
      );
      stream.end(buffer);
    });

    return { url: result.secure_url, publicId: result.public_id };
  },
};

export default photoService;
