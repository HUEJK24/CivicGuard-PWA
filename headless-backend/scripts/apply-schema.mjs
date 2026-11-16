#!/usr/bin/env node
/**
 * Aplica db/schema.sql a la base indicada en DATABASE_URL.
 * Es idempotente (usa CREATE TABLE IF NOT EXISTS).
 *
 *   cd headless-backend && npm run db:apply
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import db from '../src/config/db.js';
import { env } from '../src/config/env.js';

async function main() {
  if (!env.databaseUrl) {
    console.error('✖ DATABASE_URL no está configurada (copia .env.example a .env).');
    process.exit(1);
  }

  const schemaPath = path.join(import.meta.dirname, '..', 'db', 'schema.sql');
  const sql = await readFile(schemaPath, 'utf8');

  await db.query(sql);
  const { rows } = await db.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name`,
  );

  console.log('✔ Esquema aplicado. Tablas:', rows.map((r) => r.table_name).join(', '));
  await db.close();
}

main().catch(async (error) => {
  console.error('✖ No se pudo aplicar el esquema:', error.message);
  await db.close();
  process.exit(1);
});
