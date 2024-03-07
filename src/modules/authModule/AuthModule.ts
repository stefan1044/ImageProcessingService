import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { InvalidTokenMessage, TokenNotPresentMessage } from '../../shared/utils/ErrorMessages';

export class AuthModule {
  private authMiddleware(request: Request, response: Response, next: NextFunction) {
    const authorizationHeader = request.header('Authorization');

    if (authorizationHeader == undefined)
      return response.status(StatusCodes.UNAUTHORIZED).json({
        message: TokenNotPresentMessage,
      });

    if (!authorizationHeader.startsWith('Bearer '))
      return response.status(StatusCodes.UNAUTHORIZED).json({
        message: InvalidTokenMessage,
      });

    // This means we remove the 'Bearer ' part
    const token = authorizationHeader.substring(7);
    if (!token)
      return response.status(StatusCodes.UNAUTHORIZED).json({
        message: InvalidTokenMessage,
      });
  }

  public getMiddleware() {
    return (request: Request, response: Response, next: NextFunction) => this.authMiddleware(request, response, next);
  }
}
