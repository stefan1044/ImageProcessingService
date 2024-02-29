import express, { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

const HEALTH_CHECK_ROUTE = '/healthCheck';

function healthCheck(_req: Request, res: Response) {
  return res.status(StatusCodes.OK).json({
    status: 'ok',
    uptime: process.uptime(),
  });
}

export function mountHealthCheck(app: express.Application): void {
  app.get(HEALTH_CHECK_ROUTE, healthCheck);
}
