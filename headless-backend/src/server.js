import { createApp } from './app.js';
import { env } from './config/env.js';
import db from './config/db.js';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`[CivicGuard API] escuchando en el puerto ${env.port} (${env.nodeEnv})`);
  console.log(
    `[CivicGuard API] base de datos: ${db.isConfigured ? 'configurada' : 'NO configurada (DATABASE_URL vacía)'}`,
  );
  console.log(`[CivicGuard API] orígenes permitidos: ${env.allowedOrigins.join(', ')}`);
});

/** Apagado ordenado: Render envía SIGTERM al reiniciar el servicio. */
async function shutdown(signal) {
  console.log(`[CivicGuard API] ${signal} recibido, cerrando…`);
  server.close(async () => {
    await db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default server;
