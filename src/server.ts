import express, { Express } from 'express';
import { pino } from 'pino';

import { mountDefaultRoute } from './middlewares/fallbackRoute';
import { mountHealthCheck } from './middlewares/healthCheckRoute';
import { PersistentStorageModule } from './modules/storage/persistentStorageModule';
import { mountImageRoutes } from './routes/imageRoutes';
import { mountMiddlewares } from './routes/middlewareRoutes';

const logger = pino({ name: 'server start' });
const app: Express = express();

// To get around building complex dependency injection features for all modules I will just initiate the storage one here
PersistentStorageModule.init().then((_) => {
  // Middlewares
  mountMiddlewares(app, logger);

  // Routes
  mountHealthCheck(app);
  mountImageRoutes(app);

  // Error handling
  mountDefaultRoute(app);
});

export { app, logger };
