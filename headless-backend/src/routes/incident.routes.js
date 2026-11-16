import { Router } from 'express';
import { listIncidents } from '../controllers/incidentController.js';

const router = Router();

// Sprint 1: lectura (permite verificar la capa completa contra Neon).
// Sprint 2: POST / con subida a Cloudinary.
// Sprint 3: PATCH /:id/resolve con adminAuth.
router.get('/', listIncidents);

export default router;
