import db from '../config/db.js';

export const pushSubscriptionRepository = {
  /** @param {string} deviceId @param {{ endpoint: string, keys: { p256dh: string, auth: string } }} subscription */
  async upsert(deviceId, subscription) {
    const { rows } = await db.query(
      `INSERT INTO push_subscriptions (device_id, endpoint, keys)
       VALUES ($1, $2, $3)
       ON CONFLICT (endpoint) DO UPDATE
         SET device_id = EXCLUDED.device_id, keys = EXCLUDED.keys
       RETURNING id`,
      [deviceId, subscription.endpoint, JSON.stringify(subscription.keys)],
    );
    return rows[0];
  },

  /** @param {string} deviceId */
  async findByDeviceId(deviceId) {
    const { rows } = await db.query(
      `SELECT endpoint, keys FROM push_subscriptions WHERE device_id = $1`,
      [deviceId],
    );
    return rows;
  },

  /** @param {string} endpoint */
  async deleteByEndpoint(endpoint) {
    await db.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
  },
};

export default pushSubscriptionRepository;
