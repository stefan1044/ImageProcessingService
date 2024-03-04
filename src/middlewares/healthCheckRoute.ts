import express, { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { PersistentStorageModule } from '../modules/storage/persistentStorageModule';

const HEALTH_CHECK_ROUTE = '/healthCheck';

function healthCheck(_req: Request, res: Response) {
  const storageDetails = PersistentStorageModule.getStats();
  return res.status(StatusCodes.OK).json({
    status: 'ok',
    uptime: process.uptime(),
    ...storageDetails,
  });
}

export function mountHealthCheck(app: express.Application): void {
  app.get(HEALTH_CHECK_ROUTE, healthCheck);
}
