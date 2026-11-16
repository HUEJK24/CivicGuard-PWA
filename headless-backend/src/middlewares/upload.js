import multer from 'multer';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

/** Tipos de imagen aceptados como evidencia. */
export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export const MAX_PHOTO_BYTES = env.maxPhotoBytes;
export const MAX_PHOTO_MB = Math.round((MAX_PHOTO_BYTES / (1024 * 1024)) * 10) / 10;

/**
 * Subida de la foto de evidencia.
 *
 * `memoryStorage` mantiene el archivo en RAM porque solo se reenvía a Cloudinary
 * (nunca se escribe en el disco efímero de Render). Las peticiones que no son
 * `multipart/form-data` (por ejemplo el POST en JSON) pasan de largo sin error.
 */
const singlePhoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES, files: 1, fields: 20 },
  fileFilter(_req, file, callback) {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(
        new HttpError(
          415,
          'UNSUPPORTED_MEDIA_TYPE',
          `Formato no soportado (${file.mimetype}). Usa JPEG, PNG, WebP o HEIC.`,
        ),
      );
      return;
    }
    callback(null, true);
  },
}).single('photo');

/** Envuelve multer para traducir sus errores al formato { ok, data, error }. */
export function uploadPhoto(req, res, next) {
  singlePhoto(req, res, (error) => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof HttpError) {
      next(error);
      return;
    }
    if (error.code === 'LIMIT_FILE_SIZE') {
      next(
        new HttpError(413, 'PHOTO_TOO_LARGE', `La foto supera el límite de ${MAX_PHOTO_MB} MB.`),
      );
      return;
    }
    next(new HttpError(400, 'INVALID_UPLOAD', `No se pudo leer la foto: ${error.message}`));
  });
}

export default uploadPhoto;
