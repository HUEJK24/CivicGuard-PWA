import { timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

/** @param {string} a @param {string} b */
function safeEquals(a, b) {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Protege las rutas de administración con la cabecera `x-admin-key`.
 * PATCH /api/incidents/:id/resolve no queda abierto a cualquiera.
 */
export function adminAuth(req, _res, next) {
  if (!env.adminApiKey) {
    return next(
      new HttpError(
        503,
        'ADMIN_KEY_NOT_CONFIGURED',
        'La variable ADMIN_API_KEY no está configurada en el servidor.',
      ),
    );
  }

  const provided = req.get('x-admin-key');
  if (!provided || !safeEquals(provided, env.adminApiKey)) {
    return next(new HttpError(401, 'UNAUTHORIZED', 'Se requiere una x-admin-key válida.'));
  }

  return next();
}
