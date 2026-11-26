import { Router } from 'express';
import healthRoutes from './health.routes.js';
import incidentRoutes from './incident.routes.js';
import pushRoutes from './push.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/api/incidents', incidentRoutes);
router.use('/api', pushRoutes);

export default router;
