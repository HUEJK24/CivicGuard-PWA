import pg from 'pg';
import { env } from './env.js';

/**
 * Database — Singleton (patrón Singleton).
 * Una sola instancia del pool de conexiones por proceso.
 */
class Database {
  static #instance = null;
  #pool = null;

  constructor() {
    if (Database.#instance) return Database.#instance;
    Database.#instance = this;
  }

  static getInstance() {
    return (Database.#instance ??= new Database());
  }

  get isConfigured() {
    return Boolean(env.databaseUrl);
  }

  get pool() {
    if (!this.#pool) {
      if (!this.isConfigured) {
        throw new Error('DATABASE_URL no está configurada.');
      }
      this.#pool = new pg.Pool({
        connectionString: env.databaseUrl,
        ssl: env.databaseSsl,
        max: 10,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 8_000,
      });
    }
    return this.#pool;
  }

  /** @param {string} text @param {unknown[]} [params] */
  query(text, params) {
    return this.pool.query(text, params);
  }

  /** Verifica la conexión sin lanzar excepción. */
  async health() {
    if (!this.isConfigured) {
      return { status: 'not_configured', latencyMs: null };
    }
    const startedAt = Date.now();
    try {
      await this.query('SELECT 1 AS ok');
      return { status: 'up', latencyMs: Date.now() - startedAt };
    } catch (error) {
      return { status: 'down', latencyMs: Date.now() - startedAt, reason: error.message };
    }
  }

  async close() {
    if (this.#pool) {
      await this.#pool.end();
      this.#pool = null;
    }
  }
}

export const db = Database.getInstance();
export default db;
