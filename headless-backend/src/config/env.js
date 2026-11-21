import dotenv from 'dotenv';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../../../.env.local', import.meta.url)) });
dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

/** @param {string | undefined} value @param {string[]} fallback */
function toList(value, fallback = []) {
  if (!value) return fallback;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const databaseUrl = process.env.DATABASE_URL?.trim() ?? '';
const databaseUrlUnpooled = process.env.DATABASE_URL_UNPOOLED?.trim() ?? '';
const isLocal = (url) => /(^|@)(localhost|127\.0\.0\.1)/.test(url);
const isLocalDatabase = isLocal(databaseUrl);
const isLocalUnpooled = isLocal(databaseUrlUnpooled);

/**
 * Configuración central. Único lugar del backend que lee process.env.
 * Nunca se registran los valores en logs.
 */
export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: (process.env.NODE_ENV ?? 'development') === 'production',
  port: Number(process.env.PORT ?? 3000),

  databaseUrl,
  /** Migraciones/dumps usan la URL directa (sin -pooler). */
  databaseUrlUnpooled,
  /** Neon exige TLS; se desactiva para Postgres local. */
  databaseSsl: databaseUrl && !isLocalDatabase ? { rejectUnauthorized: false } : undefined,
  databaseSslUnpooled:
    databaseUrlUnpooled && !isLocalUnpooled ? { rejectUnauthorized: false } : undefined,

  allowedOrigins: toList(process.env.ALLOWED_ORIGINS, ['http://localhost:5173']),
  adminApiKey: process.env.ADMIN_API_KEY?.trim() ?? '',

  // Sprint 2 — fotos de evidencia (Cloudinary)
  cloudinaryUrl: process.env.CLOUDINARY_URL?.trim() ?? '',
  cloudinaryFolder: process.env.CLOUDINARY_FOLDER?.trim() || 'civicguard/incidents',
  /** Límite de subida por foto (5 MB por defecto). */
  maxPhotoBytes: Number(process.env.MAX_PHOTO_BYTES ?? 5 * 1024 * 1024),
});
