import incidentService from '../services/incidentService.js';
import photoService from '../services/photoService.js';
import pushService from '../services/pushService.js';
import { sendOk } from '../utils/response.js';

/** GET /api/incidents */
export async function listIncidents(req, res, next) {
  try {
    const { status, limit } = req.validated ?? {};
    const incidents = await incidentService.list({ status, limit });
    return sendOk(res, { incidents, count: incidents.length });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/incidents
 *
 * Acepta `multipart/form-data` (con el campo opcional `photo`) o JSON.
 * Idempotente por `clientReportId`: el reintento del outbox devuelve 200 con la
 * incidencia ya existente en lugar de duplicarla.
 */
export async function createIncident(req, res, next) {
  try {
    const { created, incident } = await incidentService.create(req.validated, {
      photo: req.file,
    });

    if (created) {
      await pushService.notifyDevice(incident.device_id, {
        title: 'Reporte recibido',
        body: `Tu reporte «${incident.title}» está en revisión.`,
        url: `/?reportId=${incident.id}`,
        incidentId: incident.id,
      });
    }

    return sendOk(
      res,
      {
        incident,
        created,
        photoStored: Boolean(incident.photo_url),
        photoStorageEnabled: photoService.isEnabled,
      },
      created ? 201 : 200,
    );
  } catch (error) {
    return next(error);
  }
}

/** PATCH /api/incidents/:id/resolve */
export async function resolveIncident(req, res, next) {
  try {
    const { incident, changed } = await incidentService.resolve(req.params.id);
    if (changed) {
      await pushService.notifyDevice(incident.device_id, {
        title: 'Reporte resuelto',
        body: `La incidencia «${incident.title}» fue resuelta.`,
        url: `/?reportId=${incident.id}`,
        incidentId: incident.id,
      });
    }
    return sendOk(res, { incident });
  } catch (error) {
    return next(error);
  }
}

export default { listIncidents, createIncident, resolveIncident };
