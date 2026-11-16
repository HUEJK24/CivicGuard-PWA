import cors from 'cors';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

const allowedOrigins = new Set(env.allowedOrigins);

/** En desarrollo se aceptan túneles ngrok y localhost de cualquier puerto. */
const DEV_ORIGIN_PATTERNS = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/[a-z0-9-]+\.ngrok(-free)?\.app$/,
  /^https:\/\/[a-z0-9-]+\.ngrok\.io$/,
];

/**
 * CORS con lista blanca de orígenes.
 * Sin esta capa, la PWA (dominio A) no puede llamar a la API (dominio B).
 * Las peticiones sin cabecera Origin (curl, health checks, mismo origen) pasan.
 */
export const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin)) return callback(null, true);
    if (!env.isProduction && DEV_ORIGIN_PATTERNS.some((re) => re.test(origin))) {
      return callback(null, true);
    }
    return callback(
      new HttpError(403, 'CORS_BLOCKED', `Origen no permitido: ${origin}`),
    );
  },
  methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-admin-key', 'x-device-id'],
  exposedHeaders: ['RateLimit-Remaining'],
  maxAge: 86_400,
  credentials: false,
});
