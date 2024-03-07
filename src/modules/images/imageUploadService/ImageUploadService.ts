import { NextFunction, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { StatusCodes } from 'http-status-codes';

import { env } from '../../../shared/utils/config';
import {
  ImageNotProvidedMessage,
  InvalidContentTypeMessage,
  UnknownErrorMessage,
} from '../../../shared/utils/ErrorMessages';
import { MimetypeToExtensionMap } from '../../../shared/utils/MimetypeToExtensionMap';
import { IPersistentStorageModule } from '../../storage/IPersistentStorageModule';

import { GetUploadSuccessfulResponse } from './dto/GetUploadSuccessfulResponse';

/**
 * Service which provides functionality for uploading images, by providing a middleware stack which consumes form-data
 * to upload an image to an IPersistenceStorageModule
 */
export class ImageUploadService {
  private readonly allowNaming: boolean;
  private readonly fileField: string;
  private readonly imageNameField: string;
  private readonly storageModule: IPersistentStorageModule;

  public constructor(fileField: string, storageModule: IPersistentStorageModule, imageNameField: string) {
    this.fileField = fileField;
    this.storageModule = storageModule;

    this.allowNaming = env.ALLOW_NAMING;
    this.imageNameField = imageNameField;
  }

  // Allows renaming of the file sent. However, this does not guarantee the availability of said name. If an image with
  // that name already exists, the file name will be randomized.
  private fileNameCustomizationCallback(_request: Request, file: Express.Multer.File): string {
    let name: string;

    if (this.allowNaming) {
      const isNamePresentInRequest = _request.body[this.imageNameField] != undefined;

      name = isNamePresentInRequest ? _request.body[this.imageNameField] : this.generateRandomImageName();
    } else {
      name = this.generateRandomImageName();
    }

    // While technically the extension could be undefined, fileFilter only allows image types for which we have
    // extension names
    const extension = MimetypeToExtensionMap.get(file.mimetype);

    if (extension == undefined) throw new Error();

    return `${name}.${MimetypeToExtensionMap.get(file.mimetype)}`;
  }

  private generateRandomImageName(): string {
    return crypto.randomUUID();
  }

  private uploadImage(request: Request, response: Response) {
    const filename = request.file?.filename;

    if (filename == undefined)
      return response.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: UnknownErrorMessage });

    return response.status(StatusCodes.OK).json(GetUploadSuccessfulResponse(filename));
  }

  private validateRequest(request: Request, response: Response, next: NextFunction) {
    if (!request.is('multipart/form-data'))
      return response.status(StatusCodes.BAD_REQUEST).json({ message: InvalidContentTypeMessage });

    const result = validationResult(request);
    if (!result.isEmpty()) {
      return response.status(StatusCodes.BAD_REQUEST).json({ message: ImageNotProvidedMessage });
    }

    return next();
  }

  public getImageUploadMiddleware() {
    const middlewares = [
      body(this.fileField),
      (request: Request, response: Response, next: NextFunction) => this.validateRequest(request, response, next),
      this.storageModule.getStoreImageMiddleware(
        (_request: Request, file: Express.Multer.File) => this.fileNameCustomizationCallback(_request, file),
        this.fileField,
      ),
    ];

    // We have to push this last since this assumes a succesfull upload
    middlewares.push((request: Request, response: Response) => this.uploadImage(request, response));
    return middlewares;
  }
}
