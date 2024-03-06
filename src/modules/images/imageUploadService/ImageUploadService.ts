import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { env } from '../../../shared/utils/config';
import { IPersistentStorageModule } from '../../storage/IPersistentStorageModule';

import { UnknownErrorDto } from './dto/UnknownErrorDto';
import { UploadSuccessfulResponseDto } from './dto/UploadSuccessfulResponseDto';

/**
 * Service which provides functionality for uploading images, by providing a middleware stack which consumes form-data
 * to upload an image to an IPersistenceStorageModule
 */
export class ImageUploadService {
  private static readonly mimetypeToExtensionMap = new Map<string, string>([
    ['image/png', 'png'],
    ['image/jpg', 'jpg'],
    ['image/jpeg', 'jpeg'],
  ]);

  private readonly allowNaming: boolean;
  private readonly fileField: string;
  private readonly imageNameField: string;
  private readonly storageModule: IPersistentStorageModule;

  public constructor(fileField: string, imageNameField: string, storageModule: IPersistentStorageModule) {
    this.fileField = fileField;
    this.storageModule = storageModule;

    this.allowNaming = env.ALLOW_NAMING;
    this.imageNameField = imageNameField;
  }

  private fileNameCustomizationCallback(_request: Request, file: Express.Multer.File): string {
    let name: string;

    if (this.allowNaming) {
      const isNamePresentInRequest = _request.body[this.imageNameField] != undefined;

      name = isNamePresentInRequest ? _request.body[this.imageNameField] : this.generateFileName();
    } else {
      name = this.generateFileName();
    }

    // While technically the extension could be undefined, fileFilter only allows image types for which we have
    // extension names
    const extension = ImageUploadService.mimetypeToExtensionMap.get(file.mimetype);

    if (extension == undefined) throw new Error();

    return `${name}.${ImageUploadService.mimetypeToExtensionMap.get(file.mimetype)}`;
  }

  private generateFileName(): string {
    const randomName = Math.round(Math.random() * 1e9);
    return randomName.toString() + Date.now().toString();
  }

  private uploadImage(request: Request, response: Response) {
    const filename = request.file?.filename;

    if (filename == undefined) return response.status(StatusCodes.INTERNAL_SERVER_ERROR).json(UnknownErrorDto());

    return response.status(StatusCodes.OK).json(UploadSuccessfulResponseDto(filename));
  }

  public getImageUploadMiddleware() {
    const middlewares = [
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
