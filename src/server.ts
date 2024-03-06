import express, { Express } from 'express';

import { mountDefaultRoute } from './middlewares/fallbackRoute';
import { mountHealthCheck } from './middlewares/healthCheckRoute';
import { logger } from './middlewares/loggingMiddleware';
import { PersistentStorageModule } from './modules/storage/persistentStorageModule';
import { mountImageRoutes } from './routes/imageRoutes';
import { mountMiddlewares } from './routes/middlewareRoutes';
import { env } from './shared/utils/config';

const app: Express = express();

const STORAGE_DIRECTORY_NAME = 'storage';

// To get around building complex dependency injection features for all modules I will just initiate the storage one here
PersistentStorageModule.createInstance(STORAGE_DIRECTORY_NAME, env.DEST).then((persistentStorageModule) => {
  // Middlewares
  mountMiddlewares(app, logger);

  // Routes
  mountHealthCheck(app, persistentStorageModule);
  mountImageRoutes(app, persistentStorageModule);

  // Error handling
  mountDefaultRoute(app);
});

export { app };
