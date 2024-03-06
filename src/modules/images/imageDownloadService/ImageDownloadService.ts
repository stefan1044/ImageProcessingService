import { NextFunction, Request, Response } from 'express';
import { param, query, validationResult } from 'express-validator';
import { StatusCodes } from 'http-status-codes';

import { logger } from '../../../middlewares/loggingMiddleware';
import { Resolution } from '../../../shared/utils/types/Image';
import { IPersistentStorageModule } from '../../storage/IPersistentStorageModule';

import { GeneralErrorRetrievingImageDto } from './dto/GeneralErrorRetrievingImageDto';
import { ImageNotFoundDto } from './dto/ImageNotFoundDto';
import { ValidationErrorDto } from './dto/ValidationErrorDto';
import { WrongResolutionDto } from './dto/WrongResolutionDto';

export class ImageDownloadService {
  private readonly fileNameParameter: string;
  private readonly resolutionQueryParameter: string;
  private readonly storageModule: IPersistentStorageModule;

  constructor(fileNameParameter: string, resolutionQueryParameter: string, storageModule: IPersistentStorageModule) {
    this.storageModule = storageModule;
    this.fileNameParameter = fileNameParameter;
    this.resolutionQueryParameter = resolutionQueryParameter;
  }

  private async downloadImage(request: Request, response: Response) {
    try {
      // We can be sure that request.params[this.fileNameParameter] is a string because to get here it must have passed
      // validation
      const imageData = await this.storageModule.getImage(
        request.params[this.fileNameParameter] as string,
        request.body[this.resolutionQueryParameter],
      );

      if (imageData == undefined) {
        return response.status(StatusCodes.NOT_FOUND).json(ImageNotFoundDto());
      }

      return response.contentType(imageData.image.contentType).send(imageData.buffer);
    } catch (err) {
      logger.error(err);
      return response.status(StatusCodes.INTERNAL_SERVER_ERROR).json(GeneralErrorRetrievingImageDto());
    }
  }

  private parseResolution(queryParam: string): Resolution | undefined {
    const splitQueryParam = queryParam.split('x');

    if (splitQueryParam.length != 2) return undefined;
    if (splitQueryParam[0] == undefined || splitQueryParam[1] == undefined) return undefined;

    const height = parseInt(splitQueryParam[0]);
    const width = parseInt(splitQueryParam[1]);

    return new Resolution(height, width);
  }

  private validateInput(request: Request, response: Response, next: NextFunction) {
    const result = validationResult(request);

    if (!result.isEmpty()) {
      return response.status(StatusCodes.BAD_REQUEST).json(ValidationErrorDto());
    }

    const resolutionQueryParam = request.query[this.resolutionQueryParameter];
    // This means the resolution was not provided, so we only need to get the original image
    if (resolutionQueryParam == undefined) {
      return next();
    }

    if (typeof resolutionQueryParam != 'string') {
      return response.status(StatusCodes.BAD_REQUEST).json(ValidationErrorDto());
    }

    try {
      // We will attach the correct resolution to the body, however first we set the body to an empty object to be sure
      // that no malicious data was sent.
      request.body = {};
      request.body[this.resolutionQueryParameter] = this.parseResolution(resolutionQueryParam);
    } catch (err) {
      logger.error(err);

      return response.status(StatusCodes.BAD_REQUEST).json(WrongResolutionDto());
    }

    return next();
  }

  public getImageDownloadMiddleware() {
    return [
      param(this.fileNameParameter),
      query('resolution').optional({
        values: 'undefined',
      }),
      (request: Request, response: Response, next: NextFunction) => this.validateInput(request, response, next),
      (request: Request, response: Response) => this.downloadImage(request, response),
    ];
  }
}
