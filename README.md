# CivicGuard PWA

PWA para **reportar incidencias de infraestructura urbana** (baches, luminarias,
fugas de agua). Funciona sin conexión: captura GPS y foto, guarda el reporte en
el dispositivo, sincroniza en segundo plano al recuperar la conexión y notifica
cuando el reporte se resuelve.

**Universidad Tecnológica Metropolitana** · Ingeniería en Desarrollo y Gestión de
Software · Proyecto Integrador 2 · 4 sprints · equipo de 4 personas.

## Arquitectura (headless)

```text
PWA (Vanilla JS + Vite)  →  API REST (Node + Express, Render)  →  PostgreSQL (Neon)
        │                              │
   IndexedDB (outbox)            Cloudinary (fotos)
        │                              │
   Service Worker /sw.js         Web Push (VAPID)
```

| Capa | Tecnología | Dónde |
|---|---|---|
| Frontend | Vanilla JS ES6 modules + Vite | `pwa-frontend/` |
| API | Node + Express (por capas) | `headless-backend/` |
| Base de datos | PostgreSQL | Neon |
| APK | Trusted Web Activity (Bubblewrap) | `android-twa/` |
| Documentación | Markdown → PDF | `docs/` |

## Puesta en marcha

```bash
npm run install:all
cp headless-backend/.env.example headless-backend/.env   # completar variables

npm run dev          # PWA en http://localhost:5173
npm run dev:api      # API en http://localhost:3000
npm run verify       # lint + chequeo anti-localStorage + build
```

Requisitos: Node 20+, npm. Para el APK: JDK 17 y Android SDK.

## Estructura

```text
├── .github/workflows/ci.yml     # lint, build y chequeo anti-localStorage
├── docs/                        # plan maestro, comparativa, entorno, contrato de API
├── pwa-frontend/                # PWA (Vite)
├── headless-backend/            # API REST por capas
├── android-twa/                 # proyecto Android del APK (Sprint 4)
└── scripts/                     # check-storage.mjs, generate-icons.mjs
```

## Estado de los sprints

| Sprint | Alcance | Estado |
|---|---|---|
| **1** | Arquitectura, entorno seguro, shell + manifest, `/health`, CI | ✅ Completado |
| **2** | Service Worker, renderizado mixto, `POST /api/incidents` con Cloudinary | ✅ Completado |
| 3 | Offline avanzado, GPS y cámara, outbox, idempotencia | Pendiente |
| 4 | Push, Lighthouse, APK, producción | Pendiente |

## Documentación

- [Plan Maestro](docs/00-plan-maestro.md)
- [Tabla Comparativa](docs/01-tabla-comparativa.md)
- [Reporte de Configuración del Entorno](docs/02-reporte-configuracion-entorno.md)
- [Contrato de API](docs/03-contrato-api.md)
- [Mapeo del Ciclo de Vida del Service Worker](docs/04-mapeo-ciclo-vida-sw.md)

## Reglas del proyecto

- Ramas: `main` (protegida) ← `develop` (integración) ← `feature/<persona>-<tarea>`.
- Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- Cada PR pasa por CI y por revisión de otra persona antes de fusionarse en `develop`.
- **Prohibido** `localStorage` y `sessionStorage`: se usa IndexedDB a través de
  `IndexedDbManager`. El CI lo verifica automáticamente.

## Configuración local no versionada

`skills/` y `opencode.jsonc` (herramientas de IA del equipo) están en
`.gitignore` y **no** forman parte de la entrega.
