#!/usr/bin/env node
/**
 * inject-precache — paso de build (Sprint 2 · P4).
 *
 * El Service Worker está escrito a mano, pero la lista de recursos del
 * Application Shell solo se conoce **después** de `vite build`: Vite genera
 * `assets/index-<hash>.js` y `assets/index-<hash>.css`, nombres imposibles de
 * predecir. Este script recorre `dist/`, calcula una versión de caché a partir
 * del contenido y reescribe `dist/sw.js`:
 *
 *   '__CACHE_VERSION__'   →  '<hash de 12 caracteres>'
 *   __PRECACHE_URLS__     →  '/index.html', '/assets/index-abc.js', …
 *
 * Si los marcadores no aparecen, el build falla: es preferible un error ruidoso
 * a un Service Worker que precarga una lista vacía y no funciona sin conexión.
 */
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = path.join(ROOT, 'dist');
const SW_PATH = path.join(DIST, 'sw.js');

/** No se precargan: el propio SW se sirve aparte y `_headers` es config del host. */
const EXCLUDED_FROM_PRECACHE = new Set(['sw.js', 'sw-strategies.js', '_headers']);

/** Solo configuración del host: ni se precarga ni influye en la versión. */
const EXCLUDED_FROM_BUILD = new Set(['_headers']);

const VERSION_PLACEHOLDER = "'__CACHE_VERSION__'";
const LIST_PLACEHOLDER = '/* __PRECACHE_URLS__ */';

/** @param {string} dir @param {string} [base] @returns {Promise<string[]>} */
async function walk(dir, base = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relative = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await walk(path.join(dir, entry.name), relative)));
    } else {
      files.push(relative);
    }
  }

  return files;
}

async function main() {
  const allFiles = (await walk(DIST)).filter((file) => !EXCLUDED_FROM_BUILD.has(file)).sort();
  const precacheFiles = allFiles.filter((file) => !EXCLUDED_FROM_PRECACHE.has(file));

  if (precacheFiles.length === 0) {
    throw new Error(`[inject-precache] ${DIST} está vacío: ejecuta "vite build" antes.`);
  }

  // La versión cambia si cambia cualquier byte del shell **o del propio Service
  // Worker**: si solo cambiara `sw.js` (por ejemplo al corregir una estrategia)
  // la versión se mantendría y la caché vieja seguiría viva.
  const digest = createHash('sha256');
  for (const file of allFiles) {
    digest.update(file);
    digest.update(await readFile(path.join(DIST, file)));
  }
  const version = digest.digest('hex').slice(0, 12);

  const urls = precacheFiles.map((file) => `/${file}`);
  const listLiteral = urls.map((url) => `  '${url}',`).join('\n');

  let sw = await readFile(SW_PATH, 'utf8');
  for (const placeholder of [VERSION_PLACEHOLDER, LIST_PLACEHOLDER]) {
    if (!sw.includes(placeholder)) {
      throw new Error(`[inject-precache] No se encontró el marcador ${placeholder} en dist/sw.js`);
    }
  }

  sw = sw
    .replace(VERSION_PLACEHOLDER, () => `'${version}'`)
    .replace(LIST_PLACEHOLDER, () => listLiteral);

  await writeFile(SW_PATH, sw, 'utf8');

  console.log(`[inject-precache] versión ${version} · ${urls.length} recursos precargados`);
  for (const url of urls) console.log(`[inject-precache]   ${url}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
