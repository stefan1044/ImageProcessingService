import { RequestHandler } from 'express';

import { FileNameCustomizationCallback } from '../../shared/utils/types/Callbacks';
import { Resolution } from '../../shared/utils/types/Image';

import { GetImageType, StorageStatistics } from './persistentStorageModule';

/**
 * Interface for providing a persistent storage mechanism for images. The module is static since there should be a
 * single. Allows for easily swapping out the storage mechanism for a different one.
 *
 * @method getStats Allows offering insights about the state of the storage module.
 *
 * @method getStoreImageMiddleware Middleware which should allow uploading an image through an express request using
 * multipart/form-data. The name of the uploaded image should be given by the fileNameCustomizationCallback callback,
 * and then it should be available on the request on the "fieldName" field.
 *
 * @method getImage Allows retrieval of images with a given name. Optionally, we can provide a resolution to resize the
 * image.
 */
export interface IPersistentStorageModule {
  getStats(): StorageStatistics;
  getStoreImageMiddleware(
    fileNameCustomizationCallback: FileNameCustomizationCallback,
    fieldName: string,
  ): RequestHandler;
  getImage(name: string, resolution?: Resolution): Promise<GetImageType | undefined>;
}
