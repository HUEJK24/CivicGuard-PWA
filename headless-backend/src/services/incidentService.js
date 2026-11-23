import incidentRepository from '../repositories/incidentRepository.js';
import photoService from './photoService.js';
import { HttpError } from '../utils/httpError.js';

/**
 * Sube la foto de evidencia y devuelve su URL pública.
 * @param {{ buffer?: Buffer } | undefined} photo
 * @returns {Promise<string | null>}
 */
async function uploadEvidence(photo) {
  if (!photo?.buffer) return null;
  const uploaded = await photoService.upload(photo.buffer);
  return uploaded?.url ?? null;
}

/** Reglas de negocio de incidencias. No conoce Express ni SQL. */
export const incidentService = {
  /** @param {{ status?: string, limit?: number }} [filters] */
  list(filters) {
    return incidentRepository.findAll(filters);
  },

  /** @param {number|string} id */
  async getById(id) {
    const incident = await incidentRepository.findById(id);
    if (!incident) {
      throw new HttpError(404, 'INCIDENT_NOT_FOUND', `No existe la incidencia ${id}.`);
    }
    return incident;
  },

  /**
   * Idempotente: reintentar el mismo `clientReportId` no crea duplicados.
   *
   * La foto se sube a Cloudinary **antes** del INSERT. Si Cloudinary no está
   * configurado la incidencia se guarda igual con `photo_url = null`.
   *
   * @param {object} payload
   * @param {{ photo?: { buffer?: Buffer } }} [options]
   */
  async create(payload, { photo } = {}) {
    const photoUrl = await uploadEvidence(photo);

    const { created, incident } = await incidentRepository.createIdempotent({
      ...payload,
      photoUrl,
    });
    if (!incident) {
      throw new HttpError(500, 'INCIDENT_NOT_PERSISTED', 'No se pudo guardar la incidencia.');
    }
    return { created, incident };
  },

  /**
   * Marca como resuelta. En Sprint 4 este método disparará la notificación push.
   * @param {number|string} id
   */
  async resolve(id) {
    const incident = await incidentRepository.resolve(id);
    if (incident) return { incident, changed: true };

    const current = await incidentRepository.findById(id);
    if (!current) {
      throw new HttpError(404, 'INCIDENT_NOT_FOUND', `No existe la incidencia ${id}.`);
    }
    return { incident: current, changed: false }; // ya estaba resuelta: respuesta idempotente
  },
};

export default incidentService;
