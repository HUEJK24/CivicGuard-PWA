import { Router } from 'express';
import { createIncident, listIncidents } from '../controllers/incidentController.js';
import { uploadPhoto } from '../middlewares/upload.js';
import { validate } from '../middlewares/validate.js';

const router = Router();

const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const listRules = {
  status: { type: 'string', enum: ['pending', 'synced', 'resolved'] },
  limit: { type: 'number', min: 1, max: 100, default: 50 },
};

const createRules = {
  clientReportId: { type: 'string', required: true, pattern: UUID_PATTERN },
  deviceId: { type: 'string', required: true, pattern: UUID_PATTERN },
  title: { type: 'string', required: true, min: 3, max: 120 },
  description: { type: 'string', max: 600 },
  lat: { type: 'number', required: true, min: -90, max: 90 },
  lng: { type: 'number', required: true, min: -180, max: 180 },
};

// Sprint 1: lectura (permite verificar la capa completa contra Neon).
// Sprint 2: alta con subida de la foto de evidencia a Cloudinary.
// Sprint 3: PATCH /:id/resolve con adminAuth.
router.get('/', validate(listRules, 'query'), listIncidents);
router.post('/', uploadPhoto, validate(createRules), createIncident);

export default router;
