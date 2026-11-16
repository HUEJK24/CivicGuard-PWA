#!/usr/bin/env node
/**
 * Genera los iconos PNG de la PWA sin dependencias externas.
 *
 * Produce:
 *   public/icons/icon-192.png            (purpose: any)
 *   public/icons/icon-512.png            (purpose: any)
 *   public/icons/icon-maskable-192.png   (purpose: maskable, dentro de la zona segura)
 *   public/icons/icon-maskable-512.png   (purpose: maskable, dentro de la zona segura)
 *
 * Uso: node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'pwa-frontend', 'public', 'icons');

const BG = [11, 61, 145]; // #0B3D91 — azul institucional
const FG = [255, 255, 255];

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

/** Codifica un buffer RGBA como PNG (color type 6, 8 bits). */
function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filtro: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/**
 * Marca: anillo blanco + punto central (diana de reporte) sobre fondo azul.
 * @param {number} size
 * @param {number} outerRatio radio exterior como fracción del lado
 * @param {number} thicknessRatio grosor del anillo
 */
function drawMark(size, outerRatio, thicknessRatio) {
  const rgba = Buffer.alloc(size * size * 4);
  const center = size / 2;
  const rOuter = size * outerRatio;
  const rInner = rOuter - size * thicknessRatio;
  const rDot = size * 0.1;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x + 0.5 - center;
      const dy = y + 0.5 - center;
      const distance = Math.hypot(dx, dy);

      const ring = clamp01(Math.min(rOuter - distance, distance - rInner) + 0.5);
      const dot = clamp01(rDot - distance + 0.5);
      const coverage = Math.max(ring, dot);

      const offset = (y * size + x) * 4;
      for (let c = 0; c < 3; c += 1) {
        rgba[offset + c] = Math.round(BG[c] + (FG[c] - BG[c]) * coverage);
      }
      rgba[offset + 3] = 255;
    }
  }
  return rgba;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const targets = [
    { file: 'icon-192.png', size: 192, outer: 0.36, thickness: 0.08 },
    { file: 'icon-512.png', size: 512, outer: 0.36, thickness: 0.08 },
    { file: 'icon-maskable-192.png', size: 192, outer: 0.29, thickness: 0.07 },
    { file: 'icon-maskable-512.png', size: 512, outer: 0.29, thickness: 0.07 },
  ];

  for (const { file, size, outer, thickness } of targets) {
    const png = encodePng(size, size, drawMark(size, outer, thickness));
    await writeFile(path.join(OUT_DIR, file), png);
    console.log(`✔ ${file} (${size}×${size}, ${png.length} bytes)`);
  }
}

main().catch((error) => {
  console.error('No se pudieron generar los iconos:', error);
  process.exit(1);
});
