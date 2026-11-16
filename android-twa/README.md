# android-twa — APK por Trusted Web Activity (Sprint 4)

Este directorio guarda el proyecto Android generado por **Bubblewrap** a partir
de `twa-manifest.json`. El APK no reemplaza a la PWA: es un canal de
distribución adicional que carga la misma URL HTTPS.

## Requisitos

- JDK 17
- Node 18+
- Android SDK (Bubblewrap lo descarga en el primer `init`)

## Flujo

```bash
# 1. Inicializar (ya existe twa-manifest.json; --directory . para reutilizarlo)
npx @bubblewrap/cli init --manifest=https://TU-DOMINIO/manifest.json

# 2. Generar la llave de firma (NO se sube al repositorio)
npx @bubblewrap/cli build   # la primera vez pide crear civicguard.keystore

# 3. Obtener el SHA-256 para assetlinks.json
npx @bubblewrap/cli fingerprint

# 4. Compilar
npx @bubblewrap/cli build
# → app-release-signed.apk  y  app-release-bundle.aab
```

5. Publicar `/.well-known/assetlinks.json` en el hosting de la PWA:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "mx.edu.utm.civicguard",
      "sha256_cert_fingerprints": ["AA:BB:…"]
    }
  }
]
```

6. Subir el APK a **GitHub Releases** con etiqueta `v1.0.0` y compartir el QR.

## Reglas del equipo

- El keystore (`civicguard.keystore`) **nunca** se versiona (ver `.gitignore`).
  Respaldarlo cifrado en el gestor de secretos del equipo.
- El SHA-256 debe ser el de la firma de **release**, no la de debug.
- Sin `assetlinks.json` correcto, el TWA muestra la barra de URL de Chrome.
