# Contrato de API — CivicGuard (v1)

Acordado en Sprint 1 · P3. Base URL de desarrollo `http://localhost:3000`; en
producción, la URL HTTPS del servicio en Render.

Todas las respuestas usan el mismo sobre:

```jsonc
{ "ok": true,  "data": {}, "error": null }
{ "ok": false, "data": null, "error": { "code": "CODIGO", "message": "…", "details": null } }
```

Cabeceras relevantes: `Content-Type: application/json`,
`x-admin-key` (rutas de administración), `x-device-id` (trazabilidad).

---

## 1. `GET /health` — Estado del servicio

- **Autenticación:** ninguna.
- **Sprint:** 1 · **Estado:** implementado.
- Siempre responde `200` mientras el proceso viva (Render lo usa como health check).
  El detalle de la base de datos va en `data.dependencies`.

```jsonc
// 200
{
  "ok": true,
  "data": {
    "status": "ok",              // ok | degraded
    "service": "civicguard-headless-backend",
    "environment": "production",
    "uptimeSeconds": 123,
    "timestamp": "2026-11-16T03:52:06.646Z",
    "dependencies": {
      "database": { "status": "up", "latencyMs": 12 } // up | down | not_configured
    }
  },
  "error": null
}
```

---

## 2. `GET /api/incidents` — Lista de incidencias

- **Autenticación:** ninguna (Sprint 3 añade el panel de administración).
- **Sprint:** 1 (lectura) · **Estado:** implementado.
- **Query:** `status` (`pending` | `synced` | `resolved`, opcional), `limit` (1…100, por defecto 50).
- Validación con `validate(rules, 'query')`: un `status` o `limit` inválido responde `400 VALIDATION_ERROR`.

```jsonc
// 200
{ "ok": true, "data": { "incidents": [ /* … */ ], "count": 3 }, "error": null }
```

---

## 3. `POST /api/incidents` — Crear incidencia (idempotente)

- **Sprint:** 2 · **Estado:** implementado.
- **Cuerpo:** `multipart/form-data` (con el archivo opcional `photo`) o JSON.
- **Foto:** se sube a Cloudinary desde memoria (`multer.memoryStorage`), nunca al disco de Render. Si `CLOUDINARY_URL` no está configurada la incidencia se guarda igual con `photo_url = null` y la respuesta lo indica con `photoStorageEnabled: false`.

| Campo | Tipo | Requerido | Notas |
| --- | --- | --- | --- |
| `clientReportId` | UUID | sí | Generado en el dispositivo; **UNIQUE** en PostgreSQL |
| `deviceId` | UUID | sí | UUID persistido en IndexedDB (`meta`) |
| `title` | string | sí | 3…120 |
| `description` | string | no | máx. 600 |
| `lat` | number | sí | −90…90 |
| `lng` | number | sí | −180…180 |
| `photo` | file | no | JPEG/PNG/WebP/HEIC, máx. 5 MB (`MAX_PHOTO_BYTES`); JPEG comprimido en Canvas (~800 px, calidad 0.7) |

**Idempotencia:** si `clientReportId` ya existe, el backend **no** crea un
duplicado y responde `200` con el registro existente (`data.created = false`).
Un envío nuevo responde `201` con `data.created = true`.

```jsonc
// 201 (o 200 si ya existía)
{
  "ok": true,
  "data": {
    "created": true,
    "photoStored": true,
    "photoStorageEnabled": true,
    "incident": { "id": 12, "status": "synced", "photo_url": "https://res.cloudinary.com/…", "…": "…" }
  },
  "error": null
}
```

| Error | Código | Cuándo |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Falta un campo obligatorio o tiene formato inválido |
| 413 | `PHOTO_TOO_LARGE` | La foto supera `MAX_PHOTO_BYTES` |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | El archivo no es JPEG/PNG/WebP/HEIC |

---

## 4. `PATCH /api/incidents/:id/resolve` — Marcar como resuelta

- **Autenticación:** `x-admin-key` (obligatoria).
- **Sprint:** 3 (endpoint) y 4 (disparo de la push) · **Estado:** pendiente.
- Idempotente: si ya estaba resuelta, devuelve el registro sin error.
- En Sprint 4 dispara la notificación push al `device_id` del reporte.

```jsonc
// 200
{ "ok": true, "data": { "id": 12, "status": "resolved", "resolved_at": "2026-11-20T18:00:00Z" }, "error": null }

// 401 — falta la llave
{ "ok": false, "data": null, "error": { "code": "UNAUTHORIZED", "message": "Se requiere una x-admin-key válida.", "details": null } }
```

---

## 5. `POST /api/subscribe` — Guardar suscripción Push

- **Sprint:** 4 · **Estado:** pendiente.
- **Cuerpo:** `{ deviceId, subscription: { endpoint, keys: { p256dh, auth } } }`.
- `endpoint` es **UNIQUE**: volver a suscribirse actualiza la fila.

---

## 6. `GET /api/vapid-public-key` — Llave pública VAPID

- **Sprint:** 4 · **Estado:** pendiente.
- **Respuesta:** `{ "ok": true, "data": { "publicKey": "BEl…" }, "error": null }`.

---

## Códigos de error

| `code` | HTTP | Cuándo |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Entrada inválida (incluye `details` por campo) |
| `UNAUTHORIZED` | 401 | Falta o no coincide `x-admin-key` |
| `CORS_BLOCKED` | 403 | Origen fuera de la lista blanca |
| `NOT_FOUND` | 404 | Ruta inexistente |
| `INCIDENT_NOT_FOUND` | 404 | `id` inexistente |
| `ADMIN_KEY_NOT_CONFIGURED` | 503 | El servidor no tiene `ADMIN_API_KEY` |
| `INTERNAL_ERROR` | 500 | Error no controlado (mensaje genérico en producción) |

## Variables de entorno del backend

`DATABASE_URL`, `ALLOWED_ORIGINS`, `ADMIN_API_KEY`, `VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CLOUDINARY_URL`, `PORT`, `NODE_ENV`.
**Ninguna se versiona:** crear `headless-backend/.env` solo en local.
