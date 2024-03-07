import express from 'express';
import { pino } from 'pino';

export function mountOnMountLogger(app: express.Application, logger: pino.Logger): void {
  function onMount(parent: express.Application) {
    logger.info(`Mounted route ${parent.mountpath}`);
  }

  app.on('mount', onMount);
}
