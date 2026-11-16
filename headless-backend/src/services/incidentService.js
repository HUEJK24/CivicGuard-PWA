import incidentRepository from '../repositories/incidentRepository.js';
import { HttpError } from '../utils/httpError.js';

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
   * @param {object} payload
   */
  async create(payload) {
    const { created, incident } = await incidentRepository.createIdempotent(payload);
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
    if (incident) return incident;

    const current = await incidentRepository.findById(id);
    if (!current) {
      throw new HttpError(404, 'INCIDENT_NOT_FOUND', `No existe la incidencia ${id}.`);
    }
    return current; // ya estaba resuelta: respuesta idempotente
  },
};

export default incidentService;
