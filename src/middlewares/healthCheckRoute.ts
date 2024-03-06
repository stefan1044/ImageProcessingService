import express, { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { IPersistentStorageModule } from '../modules/storage/IPersistentStorageModule';

const HEALTH_CHECK_ROUTE = '/healthCheck';

function healthCheck(_request: Request, response: Response, storageModule: IPersistentStorageModule) {
  const storageDetails = storageModule.getStats();
  return response.status(StatusCodes.OK).json({
    status: 'ok',
    uptime: process.uptime(),
    ...storageDetails,
  });
}

export function mountHealthCheck(app: express.Application, storageModule: IPersistentStorageModule): void {
  app.get(HEALTH_CHECK_ROUTE, (request: Request, response: Response) => healthCheck(request, response, storageModule));
}
