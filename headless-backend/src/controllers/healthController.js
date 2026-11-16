import healthService from '../services/healthService.js';
import { sendOk } from '../utils/response.js';

/**
 * GET /health
 * Siempre responde 200 mientras el proceso esté vivo (Render lo usa como
 * health check); el detalle de la base de datos va en `data.dependencies`.
 */
export async function getHealth(_req, res, next) {
  try {
    return sendOk(res, await healthService.check());
  } catch (error) {
    return next(error);
  }
}

export default { getHealth };
