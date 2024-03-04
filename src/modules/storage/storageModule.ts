import checkDiskSpace from 'check-disk-space';
import { Request } from 'express';
import * as fs from 'fs';
import { mkdirp } from 'mkdirp';
import multer, { FileFilterCallback } from 'multer';
import * as Path from 'path';
import { rimraf } from 'rimraf';
import sharp, { Channels, Color } from 'sharp';
import getSizeTransform from 'stream-size';

import { logger } from '../../server';
import { env } from '../../shared/utils/config';

import { CachedImage, Image, isExtensionType, Resolution } from './Image';

const STORAGE_DIRECTORY_NAME = 'storage';
const CACHE_DIRECTORY_NAME = 'temp';

class StorageModuleInitError extends Error {
  constructor(details?: string) {
    super(`Error creating the storage module!\n${details ?? ''}`);
  }
}

export type FileNameCallback = (error: Error | null, filename: string) => void;
export type FileNameCustomizationCallback = (request: Request, file: Express.Multer.File) => string;

export enum CanUploadFileResponse {
  POSSIBLE,
  NEEDS_CACHE_CLEAR,
  NOT_POSSIBLE,
}

export type StorageStatistics = {
  permanentImages: number;
  cachedImages: number;
};

// These are the settings which are default for all images
type PartialSharpSettings = {
  channels: Channels;
  background: Color;
};

/**
 * Module for managing file storage. Can be considered the "model" in an MVC-style app, since images do not have much
 * structure.
 */
export class StorageModule {
  private static sharpSettings: PartialSharpSettings = {
    channels: 4,
    background: {
      r: 255,
      g: 255,
      b: 255,
    },
  };

  private static _permanentStorageDirectoryPath = `${__dirname}/${STORAGE_DIRECTORY_NAME}/${env.DEST}`;
  private static _cacheStorageDirectoryPath = `${__dirname}/${STORAGE_DIRECTORY_NAME}/${CACHE_DIRECTORY_NAME}`;

  private static fileNameCustomizationCallback: FileNameCustomizationCallback;

  private static totalDiskSize: number;

  private static permanentImageDiskSize: number = 0;
  private static readonly permanentImages: Array<Image> = [];

  private static cachedImageDiskSize: number = 0;
  private static readonly cachedImages: Array<CachedImage> = [];

  private static async createDirectories(): Promise<void> {
    try {
      await rimraf(StorageModule._cacheStorageDirectoryPath);

      await Promise.all([
        mkdirp(StorageModule._permanentStorageDirectoryPath),
        mkdirp(StorageModule._cacheStorageDirectoryPath),
      ]);
    } catch (err) {
      logger.error(err);
      throw new StorageModuleInitError();
    }
  }

  /**
   *
   * @param fullFileName
   * @param size If the size was precomputed (e.g. when we try to add the file before writing it to disk) we can pass
   * the size directly to avoid calculating it
   * @private
   */
  private static async addImageToPermanentStorage(fullFileName: string, size?: number): Promise<void> {
    const filePath = `${StorageModule._permanentStorageDirectoryPath}/${fullFileName}`;
    const file = Path.parse(filePath);

    // We slice from 1 since the first char is the dot
    const extension = 'image/' + file.ext.slice(1);
    if (!isExtensionType(extension)) return;

    // const fileName = fullFileName.slice(0, fullFileName.lastIndexOf(file.ext));
    let memory = 0;
    try {
      memory = size == undefined ? (await fs.promises.stat(filePath)).size : size;
    } catch (err) {
      logger.error(err);
    }

    const image = {
      name: fullFileName,
      contentType: extension,
      size: memory,
    };

    this.permanentImageDiskSize += image.size;
    this.permanentImages.push(image);
  }

  private static async getExistingImages(): Promise<boolean> {
    let files: Array<string>;

    try {
      files = await fs.promises.readdir(StorageModule._permanentStorageDirectoryPath);
    } catch (err) {
      logger.error(err);
      return false;
    }

    for (const fullFileName of files) {
      await StorageModule.addImageToPermanentStorage(fullFileName);
    }

    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private static async clearCacheToFit(_size: number): Promise<void> {}

  private static async initMemory(): Promise<void> {
    const diskSpace = await checkDiskSpace(StorageModule._permanentStorageDirectoryPath);

    StorageModule.totalDiskSize = diskSpace.size;
  }

  private static multerFileFilter(_request: Request, file: Express.Multer.File, callback: FileFilterCallback): void {
    if (!(file.mimetype === 'image/png' || file.mimetype === 'image/jpg' || file.mimetype === 'image/jpeg')) {
      logger.info(`Received wrong format!\nFormat received was ${file.mimetype}`);
      callback(null, false);
      return;
    }

    callback(null, true);
  }

  private static multerHandleFile(
    request: Request,
    file: Express.Multer.File,
    callback: (error?: unknown, info?: Partial<Express.Multer.File>) => void,
  ): void {
    const sizedStream = file.stream.pipe(getSizeTransform(env.MAX_FILE_SIZE));
    const canUploadFile = StorageModule.canUploadFile(sizedStream.sizeInBytes);

    if (canUploadFile == CanUploadFileResponse.NOT_POSSIBLE) {
      callback(new Error('Insufficient size available!'));
      return;
    }
    const fileName = StorageModule.fileNameCustomizationCallback(request, file);

    if (canUploadFile == CanUploadFileResponse.NEEDS_CACHE_CLEAR) {
      StorageModule.clearCacheToFit(sizedStream.sizeInBytes)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .then((_) => {
          callback(null);

          const fileWriteStream = fs.createWriteStream(fileName);
          sizedStream
            .pipe(fileWriteStream)
            .on('error', (err) => {
              fileWriteStream.end();
              callback(err);
            })
            .on('finish', async () => {
              await StorageModule.addImageToPermanentStorage(fileName);
              callback(null, { filename: fileName });
            });
        })
        .catch((err) => callback(err));

      return;
    }

    const fileWriteStream = fs.createWriteStream(fileName);
    sizedStream
      .pipe(fileWriteStream)
      .on('error', (err) => {
        fileWriteStream.end();
        callback(err);
      })
      .on('finish', async () => {
        await StorageModule.addImageToPermanentStorage(fileName);
        callback(null, { filename: fileName });
      });
  }

  private static multerRemoveFile(
    _request: Request,
    _file: Express.Multer.File & { name: string },
    _callback: (error: Error | null) => void,
  ): void {}

  public static async init(): Promise<void> {
    await StorageModule.createDirectories();
    await StorageModule.initMemory();
    const wasSuccessful = await StorageModule.getExistingImages();
    logger.info(StorageModule.permanentImages);

    if (!wasSuccessful) {
      throw new Error();
    }
  }

  private static canUploadFile(size: number): CanUploadFileResponse {
    logger.info(
      `${StorageModule.permanentImageDiskSize}\n${StorageModule.cachedImageDiskSize}\n${StorageModule.totalDiskSize}\n${size}`,
    );
    if (StorageModule.permanentImageDiskSize + StorageModule.cachedImageDiskSize + size < StorageModule.totalDiskSize)
      return CanUploadFileResponse.POSSIBLE;

    if (StorageModule.permanentImageDiskSize + size < StorageModule.totalDiskSize)
      return CanUploadFileResponse.NEEDS_CACHE_CLEAR;

    return CanUploadFileResponse.NOT_POSSIBLE;
  }

  // We can use this to get what the path of an existing cached image is. This does not guarantee that the image
  // actually exists, it just calculates the path.
  private static getCacheImagePath(image: Image, resolution: Resolution): string {
    return `${StorageModule._cacheStorageDirectoryPath}/${resolution.height}x${resolution.width}${image.name}`;
  }

  private static async cacheImage(image: Image, resolution: Resolution, buffer: Buffer) {
    const filePath = StorageModule.getCacheImagePath(image, resolution);
    try {
      await fs.promises.writeFile(filePath, buffer);

      const size = (await fs.promises.stat(filePath)).size;
      const cachedImage: CachedImage = {
        originalName: image.name,
        contentType: image.contentType,
        size: size,
        resolution: resolution,
      };

      StorageModule.cachedImages.push(cachedImage);
    } catch (err) {
      logger.error(err);
    }
  }

  private static async getImageFromCache(image: Image, resolution: Resolution) {
    const cachedImage = StorageModule.cachedImages.find((cachedImage) => {
      return cachedImage.originalName == image.name && cachedImage.resolution == resolution;
    });

    if (cachedImage == undefined) return undefined;

    const cachedImageFilePath = StorageModule.getCacheImagePath(image, resolution);
    try {
      const cachedImageBuffer = await fs.promises.readFile(cachedImageFilePath);

      return cachedImageBuffer;
    } catch (err) {
      logger.error(err);

      return undefined;
    }
  }

  private static async getResizedImage(image: Image, resolution: Resolution) {
    const imageBuffer = await fs.promises.readFile(`${StorageModule._permanentStorageDirectoryPath}/${image.name}`);

    const resizedImage = sharp(imageBuffer, {
      // This is set to true in case there is some error with the validation so the memory doesn't get filled
      limitInputPixels: true,
    }).resize(resolution.width, resolution.height);

    // We do not have to await this since it would make the client wait for the caching process before returning.
    StorageModule.cacheImage(image, resolution, imageBuffer);

    return await resizedImage.toBuffer();
  }

  public static getStats(): StorageStatistics {
    return {
      permanentImages: StorageModule.permanentImages.length,
      cachedImages: StorageModule.cachedImages.length,
    };
  }

  public static getMulterStorageEngine(fileNameCustomizationCallback: FileNameCustomizationCallback): multer.Multer {
    StorageModule.fileNameCustomizationCallback = fileNameCustomizationCallback;

    const handleFile = StorageModule.multerHandleFile;
    const removeFile = StorageModule.multerRemoveFile;

    return multer({
      storage: {
        _handleFile: handleFile,
        _removeFile: removeFile,
      },
      limits: {
        fieldNameSize: env.MAX_NAME_SIZE,
        fileSize: env.MAX_FILE_SIZE,
      },
      fileFilter: StorageModule.multerFileFilter,
    });
  }

  /**
   * Gets an image from the disk. If image is not found, it returns undefined. This method can throw (from readFile) to
   * indicate that the image exists, but there was an issue retrieving it.
   * @param name
   * @param resolution
   */
  public static async getImage(name: string, resolution?: Resolution) {
    const image = StorageModule.permanentImages.find((image) => image.name == name);
    if (image == undefined) return undefined;

    if (resolution != undefined) {
      const resizedImage = await StorageModule.getResizedImage(image, resolution);

      return {
        image: image,
        buffer: resizedImage,
      };
    }

    const imageBuffer = await fs.promises.readFile(`${StorageModule._permanentStorageDirectoryPath}/${image.name}`);

    return {
      image: image,
      buffer: imageBuffer,
    };
  }
}
