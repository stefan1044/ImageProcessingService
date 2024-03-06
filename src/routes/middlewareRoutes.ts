import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pino } from 'pino';

import { mountLoggingMiddleware } from '../middlewares/loggingMiddleware';
import { mountOnMountLogger } from '../middlewares/onMountMiddleware';
import { env } from '../shared/utils/config';

/**
 * Function used to mount general middleware onto our app.
 * @param app
 * @param logger
 */
export function mountMiddlewares(app: express.Application, logger: pino.Logger): void {
  app.use(cors());
  app.use(helmet());
  if (env.ENABLE_RATE_LIMITER) {
    app.use(
      rateLimit({
        legacyHeaders: true,
        limit: env.RATE_LIMITER_MAX,
        windowMs: env.RATE_LIMITER_WINDOW_MS,
      }),
    );
  }

  mountOnMountLogger(app, logger);
  mountLoggingMiddleware(app);
}
