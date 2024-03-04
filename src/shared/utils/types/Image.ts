import { env } from '../config';

export type ExtensionType = 'image/png' | 'image/jpg' | 'image/jpeg';

export function isExtensionType(extension: string): extension is ExtensionType {
  return extension == 'image/png' || extension == 'image/jpg' || extension == 'image/jpeg';
}

export class InvalidResolutionError extends Error {
  constructor() {
    super('Parameters provided for resolution are invalid');
  }
}

export class Resolution {
  private static readonly MAX_HEIGHT = env.MAX_RESOLUTION_HEIGHT;
  private static readonly MIN_HEIGHT = env.MIN_RESOLUTION_HEIGHT;

  private static readonly MAX_WIDTH = env.MAX_RESOLUTION_WIDTH;
  private static readonly MIN_WIDTH = env.MIN_RESOLUTION_WIDTH;

  private readonly _height: number;
  private readonly _width: number;

  constructor(height: number, width: number) {
    if (
      Resolution.MIN_HEIGHT > height ||
      height > Resolution.MAX_HEIGHT ||
      Resolution.MIN_WIDTH > width ||
      width > Resolution.MAX_WIDTH
    ) {
      throw new InvalidResolutionError();
    }

    this._height = height;
    this._width = width;
  }

  public isEqual(resolution: Resolution): boolean {
    return this._height == resolution.height && this._width == resolution.width;
  }

  public get height(): number {
    return this._height;
  }
  public get width(): number {
    return this._width;
  }
}

export type Image = {
  name: string;
  contentType: ExtensionType;
  size: number;
};

export type CachedImage = {
  originalName: string;
  contentType: ExtensionType;
  size: number;
  resolution: Resolution;
};
