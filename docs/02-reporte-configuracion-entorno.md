# Reporte de Configuración del Entorno — CivicGuard

**Entregable Sprint 1 · P4.** Documenta cómo se levanta el entorno de
desarrollo, cómo se prueba en un celular real por HTTPS (ngrok), la política de
caché y la validación de contexto seguro.

> Completa las casillas marcadas con `⟨…⟩` con los datos de tu equipo
> (URLs, versiones, capturas) antes de exportar a PDF.

---

## 1. Requisitos de software

| Herramienta | Versión usada | Comando para verificar |
|---|---|---|
| Node.js | `v24.18.1` (mínimo 20) | `node -v` |
| npm | `11.16.0` | `npm -v` |
| Git | `2.50.1` | `git --version` |
| ngrok | `3.39.13` | `ngrok version` |
| Android (para la demo) | Chrome Android actual | — |

## 2. Instalación

```bash
git clone https://github.com/HUEJK24/CivicGuard-PWA.git
cd CivicGuard-PWA
npm run install:all          # instala pwa-frontend y headless-backend
# Crear headless-backend/.env con las variables de la tabla siguiente
```

Editar `headless-backend/.env`:

| Variable | Para qué | Ejemplo |
|---|---|---|
| `PORT` | Puerto de la API | `3000` |
| `DATABASE_URL` | Cadena de conexión de Neon | `postgresql://…@ep-xxx.neon.tech/civicguard?sslmode=require` |
| `ALLOWED_ORIGINS` | Lista blanca de CORS | `http://localhost:5173,https://xxxx.ngrok-free.app` |
| `ADMIN_API_KEY` | Protege `PATCH …/resolve` | cadena aleatoria larga |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Push (Sprint 4) | — |
| `CLOUDINARY_URL` | Fotos (Sprint 2) | — |

## 3. Puertos

| Servicio | Puerto | Cómo se levanta |
|---|---|---|
| PWA en desarrollo (Vite) | **5173** | `npm run dev` |
| PWA previsualización (build) | **4173** | `npm run preview` |
| API REST (Express) | **3000** | `npm run dev:api` |
| PostgreSQL | **5432** | Neon (nube), no local |

Vite se configura con `host: true` y `strictPort: true` (`pwa-frontend/vite.config.js`),
así que el servidor es accesible desde la red local y no cambia de puerto.

## 4. Política de caché

Requisito del PDF: **`Cache-Control: no-store, max-age=0`** en desarrollo.

| Entorno | Recurso | Cabecera |
|---|---|---|
| Desarrollo (`npm run dev`, puerto 5173) | Todo | `Cache-Control: no-store, max-age=0`, `Pragma: no-cache`, `Expires: 0` |
| Vista previa del build (`npm run preview`, puerto 4173) | Todo | `Cache-Control: no-cache` |
| Producción | `/sw.js` | `public, max-age=0, must-revalidate` |
| Producción | `/manifest.json` | `public, max-age=0, must-revalidate` |
| Producción | `/assets/*` (con hash) | `public, max-age=31536000, immutable` |

> **Por qué `preview` no usa `no-store`:** `npm run preview` sirve el build de
> producción, así que imita sus cabeceras. Una respuesta `no-store` **no se puede
> guardar en la Cache API**, y el Service Worker (Sprint 2) se quedaría sin el
> Application Shell precargado. `no-store` se mantiene donde el PDF lo pide: en
> el servidor de **desarrollo**.

Configurado en `pwa-frontend/vite.config.js` (desarrollo y preview),
`pwa-frontend/vercel.json` (Vercel) y `pwa-frontend/public/_headers`
(Cloudflare Pages).

Verificación:

```bash
curl -sI http://localhost:5173/ | grep -i cache-control
# Cache-Control: no-store, max-age=0
```

## 5. Contexto seguro (`window.isSecureContext`)

GPS, cámara, Service Worker y Push **solo** funcionan en contexto seguro:
`https://` o `http://localhost`.

| Escenario | `isSecureContext` | GPS / Cámara / SW |
|---|---|---|
| `http://localhost:5173` | `true` | Funcionan |
| `https://xxxx.ngrok-free.app` | `true` | Funcionan |
| `http://192.168.1.20:5173` (IP de la LAN) | **`false`** | **Bloqueados por el navegador** |

Por eso al probar en el celular se usa **ngrok**, no la IP de la LAN.
La validación está implementada en `pwa-frontend/src/core/environment.js`
(`reportEnvironment()`, `insecureContextReason()`) y se ejecuta en `src/app.js`.
En consola se ve:

```
[CivicGuard] entorno {secureContext: true, serviceWorkerSupported: true, indexedDbSupported: true, …}
```

## 6. ngrok — prueba en celular real (entregable de la Semana 1)

```bash
# Terminal 1: API
cd headless-backend && npm run dev

# Terminal 2: PWA
npm run dev                     # http://localhost:5173

# Terminal 3: túnel HTTPS hacia la PWA
ngrok http 5173
# → Forwarding  https://⟨subdominio⟩.ngrok-free.app -> http://localhost:5173

# Terminal 4 (opcional): túnel hacia la API
ngrok http 3000
```

1. Agregar la URL de ngrok de la PWA a `ALLOWED_ORIGINS` en
   `headless-backend/.env` y reiniciar la API (el CORS la bloquea si no).
2. Abrir `https://⟨subdominio⟩.ngrok-free.app` en Chrome Android.
3. Aceptar la pantalla de advertencia de ngrok free («Visit Site»).
4. Verificar en DevTools remoto (`chrome://inspect`) que
   `window.isSecureContext === true` y que IndexedDB `civicguard` existe con los
   stores `outbox`, `cached_incidents` y `meta`.

**Limitaciones de ngrok free:** la URL cambia en cada reinicio y muestra una
pantalla intermedia. Por eso, a partir del Sprint 2 se despliega en Cloudflare
Pages / Vercel en cada push, y ngrok queda solo como apoyo local.

## 7. Despliegue «hola mundo»

### Cloudflare Pages (recomendado)

```bash
cd pwa-frontend
npm run build
npx wrangler pages deploy dist --project-name civicguard
# → https://civicguard.pages.dev
```

Las cabeceras se toman de `public/_headers` (se copia a `dist/`).

### Vercel

```bash
cd pwa-frontend
npx vercel --prod
# las cabeceras se toman de vercel.json
```

### API en Render

Con el blueprint `render.yaml` del repositorio:
**Render → New → Blueprint → seleccionar el repo**. Luego capturar
`DATABASE_URL`, `ADMIN_API_KEY` y `ALLOWED_ORIGINS` en el panel
(están marcadas como `sync: false`).

### Base de datos en Neon

```bash
cd headless-backend
npm run db:apply        # aplica db/schema.sql (idempotente)
# ✔ Esquema aplicado. Tablas: incidents, push_subscriptions
```

## 8. Evidencia de verificación (Sprint 1)

### 8.1 API

```console
$ curl -s http://localhost:3000/health
{"ok":true,"data":{"status":"ok","service":"civicguard-headless-backend",
 "environment":"development","uptimeSeconds":2,
 "dependencies":{"database":{"status":"not_configured","latencyMs":null}}},"error":null}
# HTTP 200

$ curl -s http://localhost:3000/nope
{"ok":false,"data":null,"error":{"code":"NOT_FOUND","message":"Ruta no encontrada: GET /nope"}}
# HTTP 404

$ curl -s -H "Origin: https://evil.example.com" http://localhost:3000/health
{"ok":false,"data":null,"error":{"code":"CORS_BLOCKED","message":"Origen no permitido: https://evil.example.com"}}
# HTTP 403
```

### 8.2 Frontend

```console
$ npm run build
dist/index.html                7.37 kB │ gzip: 2.78 kB
dist/assets/index-*.js         2.63 kB │ gzip: 1.18 kB
✓ built in 667ms
```

### 8.3 Chequeo anti-localStorage (CI)

```console
$ npm run check:storage
✔ Sin localStorage ni sessionStorage en pwa-frontend/.
```

### 8.4 CI en GitHub Actions

Tres trabajos en cada PR a `develop`/`main`: `Frontend (lint + build)`,
`Backend (lint)` y `Prohibido localStorage / sessionStorage`.

**Prueba exigida por el PDF — el CI bloquea un PR con `localStorage`.**

Se abrió el PR de prueba **#8** (`test/ci-localstorage-block`) que agrega
`pwa-frontend/src/prueba-localstorage.js` con `localStorage.setItem('prueba', '1')`.

Resultado de los checks (`gh pr checks 8`):

| Trabajo | Resultado |
|---|---|
| Prohibido localStorage / sessionStorage | **fail** (8 s) |
| Backend (lint) | pass |
| Frontend (lint + build) | pass |

Run: <https://github.com/HUEJK24/CivicGuard-PWA/actions/runs/43801367602>

Salida del chequeo:

```console
✖ Se encontró almacenamiento web prohibido (localStorage/sessionStorage):

  pwa-frontend/src/prueba-localstorage.js:3  [localStorage]  localStorage.setItem('prueba', '1');

Usa IndexedDB a través de IndexedDbManager (src/db/indexedDbManager.js).
# exit 1
```

Y el merge quedó bloqueado por la protección de ramas:

```console
$ gh pr merge 8 --merge
X Pull request #8 is not mergeable: the base branch policy prohibits the merge.
```

El PR se cerró sin fusionar y su rama se eliminó.

⟨Captura del PR #8 en rojo⟩

### 8.5 Celular real

⟨Captura 1: shell de CivicGuard abierto desde la URL de ngrok en Chrome Android⟩
⟨Captura 2: `window.isSecureContext` = true en DevTools remoto⟩
⟨Captura 3: IndexedDB `civicguard` con los stores outbox, cached_incidents y meta⟩

## 9. Problemas encontrados y solución

| Problema | Causa | Solución aplicada |
|---|---|---|
| El celular no podía llamar a la API | CORS bloqueaba el origen de ngrok | Lista blanca `ALLOWED_ORIGINS` + patrones `*.ngrok-free.app` en desarrollo |
| GPS/cámara no pedían permiso | La página se abrió por IP de LAN (`http://`) | Probar siempre por HTTPS (ngrok) o `localhost` |
| El shell mostraba versiones viejas | El navegador cacheaba `index.html` | `Cache-Control: no-store, max-age=0` en Vite |
| `npm ci` fallaba en CI | Faltaba `package-lock.json` versionado | Se versionan los dos `package-lock.json` |
| Advertencia de deprecación en el CI | `actions/checkout@v4` y `setup-node@v4` corren sobre Node 20 | Actualizado a `@v5` con Node 22 |

## 10. Protección de ramas

Configurada con `gh api` en `main` y `develop`:

| Regla | Valor |
|---|---|
| Requiere Pull Request antes de fusionar | Sí |
| Revisiones obligatorias | 0 (activar 1 al invitar al equipo) |
| Checks obligatorios | `Frontend (lint + build)`, `Backend (lint)`, `Prohibido localStorage / sessionStorage` |
| Conversación resuelta | Sí |
| Force push / borrado de la rama | Bloqueados |

Para exigir **1 aprobación de otra persona** (cuando el equipo esté como
colaborador del repositorio):

```bash
gh api -X PATCH repos/HUEJK24/CivicGuard-PWA/branches/develop/protection/required_pull_request_reviews \
  -F required_approving_review_count=1
```

## 11. Flujo de trabajo aplicado en el Sprint 1

| PR | Rama | Persona | Contenido |
|---|---|---|---|
| #1 | `feature/p1-core-offline` | P1 | Estructura, IndexedDB Singleton, EventBus, chequeo anti-localStorage |
| #2 | `feature/p2-ui-manifest` | P2 | manifest, iconos maskable, Application Shell |
| #3 | `feature/p3-backend` | P3 | Backend por capas, `/health`, CORS, contrato de API |
| #4 | `feature/p4-devops-qa` | P4 | CI, entorno seguro, caché, documentación |
| #5 | `develop` → `main` | equipo | Release del Sprint 1 |
| #6 | `chore/ci-actions-v5` | P4 | Actions v5 y Node 22 |
| #8 | `test/ci-localstorage-block` | P4 | **Cerrado sin fusionar**: prueba de que el CI bloquea |
