import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';
import { sendError } from '../utils/response.js';

/** Manejador central de errores: toda respuesta de error sale con el mismo formato. */
export function errorHandler(error, _req, res, _next) {
  const status = error instanceof HttpError ? error.status : 500;
  const code = error instanceof HttpError ? error.code : 'INTERNAL_ERROR';

  if (status >= 500) {
    console.error('[CivicGuard API] Error no controlado:', error);
  }

  const message =
    status >= 500 && env.isProduction ? 'Error interno del servidor.' : error.message;

  return sendError(res, status, code, message, error.details ?? null);
}

/** 404 uniforme. */
export function notFoundHandler(req, _res, next) {
  next(new HttpError(404, 'NOT_FOUND', `Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}
