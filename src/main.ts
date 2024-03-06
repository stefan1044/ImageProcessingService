import { logger } from './middlewares/loggingMiddleware';
import { env } from './shared/utils/config';
import { app } from './server';

const server = app.listen(env.PORT, () => {
  logger.info(`Server running on port ${env.PORT}`);
});

const onShutdown = () => {
  logger.info(`Shutting down due to signal after ${process.uptime()} seconds`);
  server.close(() => {
    logger.info('Shut down');
    process.exit(1);
  });
  setTimeout(() => process.exit(2), 10000).unref();
};

process.on('SIGINT', onShutdown);
process.on('SIGTERM', onShutdown);
