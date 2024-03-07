import { IAuthModule } from './IAuthModule';

// This class Mocks an authentication microservice. It only validates tokens that end with the character 'a'.
// Config, remote server url could be passed in constructor
export class AuthModule implements IAuthModule {
  constructor() {}

  public async verify(token: string): Promise<boolean> {
    return token.endsWith('a');
  }
}
