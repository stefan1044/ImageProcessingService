import express, { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { StorageModule } from '../modules/storage/storageModule';

const HEALTH_CHECK_ROUTE = '/healthCheck';

function healthCheck(_req: Request, res: Response) {
  const storageDetails = StorageModule.getStats();
  return res.status(StatusCodes.OK).json({
    status: 'ok',
    uptime: process.uptime(),
    ...storageDetails,
  });
}

export function mountHealthCheck(app: express.Application): void {
  app.get(HEALTH_CHECK_ROUTE, healthCheck);
}
