import express from 'express';
import { corsMiddleware } from './middlewares/cors.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { requestLogger } from './middlewares/requestLogger.js';
import routes from './routes/index.js';

/** Construye la aplicación Express (sin abrir el puerto: facilita las pruebas). */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(requestLogger);
  app.use(corsMiddleware);
  app.use(express.json({ limit: '1mb' }));

  app.use(routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
