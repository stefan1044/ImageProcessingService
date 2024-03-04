import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import multer from 'multer';

import { env } from '../../shared/utils/config';
import { PersistentStorageModule } from '../storage/persistentStorageModule';

export type DestinationCallback = (error: Error | null, destination: string) => void;

/**
 * Service which provides functionality for uploading images,
 */
export class ImageUploadService {
  private static readonly mimetypeToExtensionMap = new Map<string, string>([
    ['image/png', 'png'],
    ['image/jpg', 'jpg'],
    ['image/jpeg', 'jpeg'],
  ]);
  // We keep all the response types here to facilitate editing them and/or generating swagger.
  // private static readonly validationFailedResponse = () => {
  //   return {
  //     message: 'Error validating input!',
  //   };
  // };
  private static readonly uploadSuccessfulResponse = (uploadedFileName: string) => {
    return {
      fileName: uploadedFileName,
    };
  };
  private static readonly unknownErrorResponse = () => {
    return {
      message: 'Unknown error occurred during image upload!',
    };
  };

  private readonly allowNaming: boolean;
  private readonly fileField: string;
  private readonly imageNameField: string;
  private readonly multerInstance: multer.Multer;

  public constructor(fileField: string, imageNameField: string) {
    this.fileField = fileField;

    this.allowNaming = env.ALLOW_NAMING;
    this.imageNameField = imageNameField;

    const filename = (_req: Request, file: Express.Multer.File) => {
      let name: string;

      if (this.allowNaming) {
        const isNamePresentInRequest = _req.body[this.imageNameField] != undefined;

        name = isNamePresentInRequest ? _req.body[this.imageNameField] : this.generateFileName();
      } else {
        name = this.generateFileName();
      }

      // While technically the extension could be undefined, fileFilter only allows image types for which we have
      // extension names
      const extension = ImageUploadService.mimetypeToExtensionMap.get(file.mimetype);

      if (extension == undefined) throw new Error();

      return `${name}.${ImageUploadService.mimetypeToExtensionMap.get(file.mimetype)}`;
    };

    this.multerInstance = PersistentStorageModule.getMulterStorageEngine(filename);
  }

  private generateFileName(): string {
    const randomName = Math.round(Math.random() * 1e9);
    return randomName.toString();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private uploadImage(_request: Request, response: Response, _next: NextFunction) {
    const filename = _request.file?.filename;
    if (filename == undefined)
      return response.status(StatusCodes.INTERNAL_SERVER_ERROR).json(ImageUploadService.unknownErrorResponse());

    return response.status(StatusCodes.OK).json(ImageUploadService.uploadSuccessfulResponse(filename));
  }

  public getImageUploadMiddleware() {
    const middlewares = [this.multerInstance.single(this.fileField)];

    // We have to push this last since this assumes a succesfull upload
    middlewares.push(this.uploadImage);
    return middlewares;
  }
}
