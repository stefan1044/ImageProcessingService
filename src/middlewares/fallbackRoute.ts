import express, { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

function fallbackRoute(req: Request, res: Response): void {
  res.status(StatusCodes.NOT_FOUND).json({
    info: `Path ${req.originalUrl} does not exist`,
  });
}

export function mountDefaultRoute(app: express.Application) {
  app.use(fallbackRoute);
}
