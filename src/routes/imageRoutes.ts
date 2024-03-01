import express from 'express';
import Router from 'express-promise-router';

import { ImageUploadService } from '../modules/images/imageUploadService';

// The field on the upload request which will contain the image
const IMAGE_FIELD_NAME = 'image';
// The field on the upload request which will contain the name if renaming is allowed
const IMAGE_NAME_FIELD_NAME = 'name';

/**
 * Function which mounts the image upload and request routes
 * @param app
 */
export function mountImageRoutes(app: express.Application): void {
  const imageRouter = Router();
  const imageUploadService = new ImageUploadService(IMAGE_FIELD_NAME, IMAGE_NAME_FIELD_NAME);

  imageRouter.post('/image', imageUploadService.getImageUploadMiddleware());

  app.use(imageRouter);
}
