import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { logger } from '../../middlewares/LoggingMiddleware';
import { InvalidTokenMessage, TokenNotPresentMessage } from '../../shared/utils/ErrorMessages';
import { IAuthModule } from '../authModule/IAuthModule';

type NeededConfigType = {
  env: {
    JWT_SECRET_KEY: string;
    LOCAL_AUTH: boolean;
  };
};

export class AuthService {
  private readonly secretKey: string;
  private readonly useLocalAuth: boolean;
  private readonly authModule: IAuthModule;

  constructor(config: NeededConfigType, authModule: IAuthModule) {
    this.secretKey = config.env.JWT_SECRET_KEY;
    this.useLocalAuth = config.env.LOCAL_AUTH;
    this.authModule = authModule;
  }

  private authenticateLocally(token: string): boolean {
    try {
      // Since this is a POC, I have disabled jwt to facilitate testing.
      // const decoded = jwt.verify(token, this.secretKey);

      // Here we would do some sort of verification, add the user to the request to maybe store images differently based
      // on user etc.

      // return decoded.endsWith('a');

      // Instead we return true if the token ends with the secret key
      return token.endsWith(this.secretKey);
    } catch (err) {
      logger.error(err);

      return false;
    }
  }

  private async authMiddleware(request: Request, response: Response, next: NextFunction) {
    const authorizationHeader = request.header('Authorization');

    if (authorizationHeader == undefined)
      return response.status(StatusCodes.UNAUTHORIZED).json({
        message: TokenNotPresentMessage,
      });

    if (!this.useLocalAuth) {
      const isAuthenticated = await this.authModule.verify(authorizationHeader);

      if (!isAuthenticated)
        return response.status(StatusCodes.UNAUTHORIZED).json({
          message: InvalidTokenMessage,
        });

      return next();
    }

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

    const isAuthenticated = this.authenticateLocally(token);

    if (!isAuthenticated)
      return response.status(StatusCodes.UNAUTHORIZED).json({
        message: InvalidTokenMessage,
      });

    return next();
  }

  public getMiddleware() {
    return (request: Request, response: Response, next: NextFunction) => this.authMiddleware(request, response, next);
  }
}
