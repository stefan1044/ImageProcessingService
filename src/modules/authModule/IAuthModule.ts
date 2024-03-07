/**
 * Interface meant to mimic a third-party auth service. Can be used to quickly switch authentication methods.
 *
 * @method verify Should return true if the request passed authentication, false otherwise
 */
export interface IAuthModule {
  verify(token: string): Promise<boolean>;
}
