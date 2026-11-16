/**
 * Chequeo anti-localStorage (requisito del PDF).
 *
 * Falla con código 1 si encuentra localStorage o sessionStorage en el código
 * de la PWA. Se ejecuta en CI y también en local:
 *
 *   node scripts/check-storage.mjs
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const TARGET_DIR = path.join(ROOT, 'pwa-frontend');
const SKIP_DIRS = new Set(['node_modules', 'dist', '.vite', 'coverage', '.git']);
const EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.html', '.css', '.json', '.svg']);
const FORBIDDEN = [
  { pattern: /\blocalStorage\b/, label: 'localStorage' },
  { pattern: /\bsessionStorage\b/, label: 'sessionStorage' },
];

/** @param {string} dir */
async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walk(full);
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      yield full;
    }
  }
}

async function main() {
  const findings = [];

  for await (const file of walk(TARGET_DIR)) {
    const content = await readFile(file, 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const { pattern, label } of FORBIDDEN) {
        if (pattern.test(line)) {
          findings.push({
            file: path.relative(ROOT, file),
            line: index + 1,
            label,
            snippet: line.trim().slice(0, 120),
          });
        }
      }
    });
  }

  if (findings.length > 0) {
    console.error('✖ Se encontró almacenamiento web prohibido (localStorage/sessionStorage):\n');
    for (const f of findings) {
      console.error(`  ${f.file}:${f.line}  [${f.label}]  ${f.snippet}`);
    }
    console.error('\nUsa IndexedDB a través de IndexedDbManager (src/db/indexedDbManager.js).');
    process.exit(1);
  }

  console.log('✔ Sin localStorage ni sessionStorage en pwa-frontend/.');
}

main().catch((error) => {
  console.error('Error inesperado en el chequeo anti-localStorage:', error);
  process.exit(1);
});
