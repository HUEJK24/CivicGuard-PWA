import db from '../config/db.js';

const COLUMNS = `
  id,
  client_report_id,
  device_id,
  title,
  description,
  lat,
  lng,
  photo_url,
  status,
  created_at,
  resolved_at
`;

/**
 * IncidentRepository (patrón Repository).
 * Única capa que conoce SQL: los controladores y servicios nunca escriben queries.
 */
export const incidentRepository = {
  /** @param {{ status?: string, limit?: number }} [options] */
  async findAll({ status, limit = 50 } = {}) {
    const params = [];
    let where = '';
    if (status) {
      params.push(status);
      where = `WHERE status = $${params.length}`;
    }
    params.push(limit);

    const { rows } = await db.query(
      `SELECT ${COLUMNS} FROM incidents ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
      params,
    );
    return rows;
  },

  /** @param {number|string} id */
  async findById(id) {
    const { rows } = await db.query(`SELECT ${COLUMNS} FROM incidents WHERE id = $1`, [id]);
    return rows[0] ?? null;
  },

  /**
   * Crea la incidencia de forma idempotente: si `client_report_id` ya existe,
   * no inserta de nuevo y devuelve el registro existente.
   * @param {object} payload
   */
  async createIdempotent(payload) {
    const { rows } = await db.query(
      `INSERT INTO incidents
         (client_report_id, device_id, title, description, lat, lng, photo_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'synced')
       ON CONFLICT (client_report_id) DO NOTHING
       RETURNING ${COLUMNS}`,
      [
        payload.clientReportId,
        payload.deviceId,
        payload.title,
        payload.description ?? null,
        payload.lat,
        payload.lng,
        payload.photoUrl ?? null,
      ],
    );

    if (rows[0]) return { created: true, incident: rows[0] };

    const existing = await db.query(
      `SELECT ${COLUMNS} FROM incidents WHERE client_report_id = $1`,
      [payload.clientReportId],
    );
    return { created: false, incident: existing.rows[0] ?? null };
  },

  /** @param {number|string} id */
  async resolve(id) {
    const { rows } = await db.query(
      `UPDATE incidents
          SET status = 'resolved', resolved_at = now()
        WHERE id = $1 AND status <> 'resolved'
        RETURNING ${COLUMNS}`,
      [id],
    );
    return rows[0] ?? null;
  },
};

export default incidentRepository;
