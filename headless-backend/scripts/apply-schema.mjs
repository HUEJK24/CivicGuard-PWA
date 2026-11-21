#!/usr/bin/env node
/**
 * Aplica db/schema.sql a la base indicada en DATABASE_URL (o DATABASE_URL_UNPOOLED).
 * Es idempotente (usa CREATE TABLE IF NOT EXISTS).
 *
 *   cd headless-backend && npm run db:apply
 */
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../src/config/env.js';

async function main() {
  const connectionString = env.databaseUrlUnpooled || env.databaseUrl;
  if (!connectionString) {
    console.error('✖ DATABASE_URL no está configurada (copia .env.example a .env).');
    process.exit(1);
  }

  const schemaPath = path.join(import.meta.dirname, '..', 'db', 'schema.sql');
  const sql = await readFile(schemaPath, 'utf8');
  const client = new pg.Client({
    connectionString,
    ssl: env.databaseSslUnpooled ?? env.databaseSsl,
  });

  await client.connect();
  try {
    await client.query(sql);
    const { rows } = await client.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' ORDER BY table_name`,
    );
    console.log('✔ Esquema aplicado. Tablas:', rows.map((r) => r.table_name).join(', '));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('✖ No se pudo aplicar el esquema:', error.message);
  process.exit(1);
});
