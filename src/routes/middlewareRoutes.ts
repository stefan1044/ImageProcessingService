import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pino } from 'pino';

import { mountLoggingMiddleware } from '../middlewares/loggingMiddleware';
import { mountOnMountLogger } from '../middlewares/onMountMiddleware';

export function mountMiddlewares(app: express.Application, logger: pino.Logger): void {
  app.use(cors());
  app.use(helmet());

  mountOnMountLogger(app, logger);
  mountLoggingMiddleware(app);
}