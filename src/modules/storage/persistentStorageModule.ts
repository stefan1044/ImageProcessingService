import checkDiskSpace from 'check-disk-space';
import { Request } from 'express';
import * as fs from 'fs';
import { mkdirp } from 'mkdirp';
import multer, { FileFilterCallback } from 'multer';
import * as Path from 'path';
import sharp from 'sharp';
import getSizeTransform from 'stream-size';

import { logger } from '../../server';
import { env } from '../../shared/utils/config';
import { Image, isExtensionType, Resolution } from '../../shared/utils/types/Image';
import { CacheModule, CacheStatistics } from '../cacheModule/cacheModule';

export const STORAGE_DIRECTORY_NAME = 'storage';
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
};

/**
 * Module for managing file storage. Can be considered the "model" in an MVC-style app, since images do not have much
 * structure.
 */
export class PersistentStorageModule {
  private static _permanentStorageDirectoryPath = `${__dirname}/${STORAGE_DIRECTORY_NAME}/${env.DEST}`;

  private static cacheModule: CacheModule;
  private static fileNameCustomizationCallback: FileNameCustomizationCallback;

  private static totalDiskSize: number;

  private static permanentImageDiskSize: number = 0;
  private static readonly permanentImages: Array<Image> = [];

  private static async createDirectories(): Promise<void> {
    try {
      await mkdirp(PersistentStorageModule._permanentStorageDirectoryPath);
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
    const filePath = `${PersistentStorageModule._permanentStorageDirectoryPath}/${fullFileName}`;
    const file = Path.parse(filePath);

    // We slice from 1 since the first char is the dot
    const extension = 'image/' + file.ext.slice(1);
    if (!isExtensionType(extension)) return;

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
      files = await fs.promises.readdir(PersistentStorageModule._permanentStorageDirectoryPath);
    } catch (err) {
      logger.error(err);
      return false;
    }

    for (const fullFileName of files) {
      await PersistentStorageModule.addImageToPermanentStorage(fullFileName);
    }

    return true;
  }

  private static async initMemory(): Promise<void> {
    const diskSpace = await checkDiskSpace(PersistentStorageModule._permanentStorageDirectoryPath);

    PersistentStorageModule.totalDiskSize = diskSpace.size;
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
    const canUploadFile = PersistentStorageModule.canUploadFile(sizedStream.sizeInBytes);

    if (canUploadFile == CanUploadFileResponse.NOT_POSSIBLE) {
      callback(new Error('Insufficient size available!'));
      return;
    }
    const fileName = PersistentStorageModule.fileNameCustomizationCallback(request, file);

    if (canUploadFile == CanUploadFileResponse.NEEDS_CACHE_CLEAR) {
      PersistentStorageModule.cacheModule
        .clearCacheToFit(sizedStream.sizeInBytes)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .then((_) => {
          callback(null);

          const fileWriteStream = fs.createWriteStream(
            `${PersistentStorageModule._permanentStorageDirectoryPath}/${fileName}`,
          );
          sizedStream
            .pipe(fileWriteStream)
            .on('error', (err) => {
              fileWriteStream.end();
              callback(err);
            })
            .on('finish', async () => {
              await PersistentStorageModule.addImageToPermanentStorage(fileName);
              callback(null, { filename: fileName });
            });
        })
        .catch((err) => callback(err));

      return;
    }

    const fileWriteStream = fs.createWriteStream(
      `${PersistentStorageModule._permanentStorageDirectoryPath}/${fileName}`,
    );
    sizedStream
      .pipe(fileWriteStream)
      .on('error', (err) => {
        fileWriteStream.end();
        callback(err, { filename: fileName });
      })
      .on('finish', async () => {
        await PersistentStorageModule.addImageToPermanentStorage(fileName);
        callback(null, { filename: fileName });
      });
  }

  private static multerRemoveFile(
    _request: Request,
    file: Express.Multer.File & { filename: string },
    callback: (error: Error | null) => void,
  ): void {
    fs.promises
      .unlink(`${PersistentStorageModule._permanentStorageDirectoryPath}/${file.filename}`)
      .then(() => callback(null));
  }

  private static canUploadFile(size: number): CanUploadFileResponse {
    logger.info(
      `${PersistentStorageModule.permanentImageDiskSize}\n${this.cacheModule.cachedImageDiskSize}\n${PersistentStorageModule.totalDiskSize}\n${size}`,
    );
    if (
      PersistentStorageModule.permanentImageDiskSize + this.cacheModule.cachedImageDiskSize + size <
      PersistentStorageModule.totalDiskSize
    )
      return CanUploadFileResponse.POSSIBLE;

    if (PersistentStorageModule.permanentImageDiskSize + size < PersistentStorageModule.totalDiskSize)
      return CanUploadFileResponse.NEEDS_CACHE_CLEAR;

    return CanUploadFileResponse.NOT_POSSIBLE;
  }

  private static async getResizedImage(image: Image, resolution: Resolution): Promise<Buffer> {
    const cachedImage = await this.cacheModule.getImageFromCache(image, resolution);
    if (cachedImage != undefined) {
      logger.info('Got from cache!');
      return cachedImage;
    }

    const imageBuffer = await fs.promises.readFile(
      `${PersistentStorageModule._permanentStorageDirectoryPath}/${image.name}`,
    );

    const resizedImage = sharp(imageBuffer, {
      // This is set to true in case there is some error with the validation so the memory doesn't get filled
      limitInputPixels: true,
    }).resize(resolution.width, resolution.height);

    // We do not have to await this since it would make the client wait for the caching process before returning.
    this.cacheModule.cacheImage(image, resolution, imageBuffer);

    return await resizedImage.toBuffer();
  }

  public static async init(): Promise<void> {
    await PersistentStorageModule.createDirectories();
    await PersistentStorageModule.initMemory();
    PersistentStorageModule.cacheModule = new CacheModule(STORAGE_DIRECTORY_NAME, CACHE_DIRECTORY_NAME);
    await PersistentStorageModule.cacheModule.init();
    const wasSuccessful = await PersistentStorageModule.getExistingImages();
    logger.info(PersistentStorageModule.permanentImages);

    if (!wasSuccessful) {
      throw new Error();
    }
  }

  public static getStats(): StorageStatistics & CacheStatistics {
    return {
      permanentImages: PersistentStorageModule.permanentImages.length,
      ...PersistentStorageModule.cacheModule.getStats(),
    };
  }

  public static getMulterStorageEngine(fileNameCustomizationCallback: FileNameCustomizationCallback): multer.Multer {
    PersistentStorageModule.fileNameCustomizationCallback = fileNameCustomizationCallback;

    const handleFile = PersistentStorageModule.multerHandleFile;
    const removeFile = PersistentStorageModule.multerRemoveFile;

    return multer({
      storage: {
        _handleFile: handleFile,
        _removeFile: removeFile,
      },
      limits: {
        fieldNameSize: env.MAX_NAME_SIZE,
        fileSize: env.MAX_FILE_SIZE,
      },
      fileFilter: PersistentStorageModule.multerFileFilter,
    });
  }

  /**
   * Gets an image from the disk. If image is not found, it returns undefined. This method can throw (from readFile) to
   * indicate that the image exists, but there was an issue retrieving it.
   * @param name Name of the image we want to get
   * @param resolution If the resolution is specified, it means we want to resize the image, and we will try to get it
   * from the cache first before resizing.
   */
  public static async getImage(name: string, resolution?: Resolution) {
    const image = PersistentStorageModule.permanentImages.find((image) => image.name == name);
    if (image == undefined) return undefined;

    if (resolution != undefined) {
      const resizedImage = await PersistentStorageModule.getResizedImage(image, resolution);

      return {
        image: image,
        buffer: resizedImage,
      };
    }

    const imageBuffer = await fs.promises.readFile(
      `${PersistentStorageModule._permanentStorageDirectoryPath}/${image.name}`,
    );

    return {
      image: image,
      buffer: imageBuffer,
    };
  }
}
