import express from 'express';
import Router from 'express-promise-router';

import { ImageDownloadService } from '../modules/images/imageDownloadService';
import { ImageUploadService } from '../modules/images/imageUploadService';

// The field on the upload request which will contain the image
const IMAGE_FIELD_NAME = 'image';
// The field on the upload request which will contain the name if renaming is allowed
const IMAGE_NAME_FIELD_NAME = 'name';

// The parameter name on the download request which will contain the name of request file
const IMAGE_PARAM_FIELD_NAME = 'filename';
// The query parameter on the download request which will contain the resolution of the request file
const RESOLUTION_QUERY_FIELD_NAME = 'resolution';

/**
 * Function which mounts the image upload and request routes
 * @param app
 */
export function mountImageRoutes(app: express.Application): void {
  const imageRouter = Router();
  const imageUploadService = new ImageUploadService(IMAGE_FIELD_NAME, IMAGE_NAME_FIELD_NAME);
  const imageDownloadService = new ImageDownloadService(IMAGE_PARAM_FIELD_NAME, RESOLUTION_QUERY_FIELD_NAME);

  imageRouter.post('/image', imageUploadService.getImageUploadMiddleware());
  imageRouter.get(`/image/:${IMAGE_PARAM_FIELD_NAME}`, imageDownloadService.getImageDownloadMiddleware());

  app.use(imageRouter);
}
