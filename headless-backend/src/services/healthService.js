import db from '../config/db.js';
import { env } from '../config/env.js';

/** Estado del servicio y de sus dependencias. */
export const healthService = {
  async check() {
    const database = await db.health();
    const healthy = database.status !== 'down';

    return {
      status: healthy ? 'ok' : 'degraded',
      service: 'civicguard-headless-backend',
      environment: env.nodeEnv,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      dependencies: { database },
    };
  },
};

export default healthService;
