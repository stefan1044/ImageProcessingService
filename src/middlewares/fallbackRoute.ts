import express, { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

function fallbackRoute(req: Request, res: Response): void {
  res.status(StatusCodes.NOT_FOUND).json({
    info: `Path ${req.originalUrl} does not exist`,
  });
}

/**
 * Mounts a default route which give http status 404 when a route which doesn't exist is requested.
 * @param app
 */
export function mountDefaultRoute(app: express.Application) {
  app.use(fallbackRoute);
}
