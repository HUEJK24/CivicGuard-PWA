import incidentService from '../services/incidentService.js';
import { sendOk } from '../utils/response.js';

/** GET /api/incidents */
export async function listIncidents(req, res, next) {
  try {
    const { status, limit } = req.query;
    const incidents = await incidentService.list({
      status: typeof status === 'string' ? status : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    return sendOk(res, { incidents, count: incidents.length });
  } catch (error) {
    return next(error);
  }
}

export default { listIncidents };
