import express, { Express } from 'express';
import { pino } from 'pino';

import { mountDefaultRoute } from './middlewares/fallbackRoute';
import { mountHealthCheck } from './middlewares/healthCheckRoute';
import { mountMiddlewares } from './routes/middlewareRoutes';

const logger = pino({ name: 'server start' });
const app: Express = express();

// Middlewares
mountMiddlewares(app, logger);

// Routes
mountHealthCheck(app);

// Error handling
mountDefaultRoute(app);

export { app, logger };
