import 'dotenv/config';
import process from 'node:process';

/** @param {string | undefined} value @param {string[]} fallback */
function toList(value, fallback = []) {
  if (!value) return fallback;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const databaseUrl = process.env.DATABASE_URL?.trim() ?? '';
const isLocalDatabase = /(^|@)(localhost|127\.0\.0\.1)/.test(databaseUrl);

/**
 * Configuración central. Único lugar del backend que lee process.env.
 * Nunca se registran los valores en logs.
 */
export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: (process.env.NODE_ENV ?? 'development') === 'production',
  port: Number(process.env.PORT ?? 3000),

  databaseUrl,
  /** Neon exige TLS; se desactiva para Postgres local. */
  databaseSsl: databaseUrl && !isLocalDatabase ? { rejectUnauthorized: false } : undefined,

  allowedOrigins: toList(process.env.ALLOWED_ORIGINS, ['http://localhost:5173']),
  adminApiKey: process.env.ADMIN_API_KEY?.trim() ?? '',
});
