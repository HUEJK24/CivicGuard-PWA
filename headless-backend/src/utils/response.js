/**
 * Formato único de respuesta: { ok, data, error }.
 * @param {import('express').Response} res
 * @param {unknown} data
 * @param {number} [status]
 */
export function sendOk(res, data, status = 200) {
  return res.status(status).json({ ok: true, data, error: null });
}

/**
 * @param {import('express').Response} res
 * @param {number} status
 * @param {string} code
 * @param {string} message
 * @param {unknown} [details]
 */
export function sendError(res, status, code, message, details = null) {
  return res.status(status).json({ ok: false, data: null, error: { code, message, details } });
}
