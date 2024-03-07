import checkDiskSpace from 'check-disk-space';
import { Request } from 'express';
import * as fs from 'fs';
import { mkdirp } from 'mkdirp';
import multer, { FileFilterCallback } from 'multer';
import * as Path from 'path';
import sharp from 'sharp';
import getSizeTransform from 'stream-size';

import { logger } from '../../middlewares/LoggingMiddleware';
import { env } from '../../shared/utils/config';
import { MimetypeToExtensionMap } from '../../shared/utils/MimetypeToExtensionMap';
import { FileNameCustomizationCallback } from '../../shared/utils/types/Callbacks';
import { Image, isExtensionType, Resolution } from '../../shared/utils/types/Image';
import { CacheStatistics, OnDiskCacheModule } from '../cacheModule/OnDiskCacheModule';

import { IPersistentStorageModule } from './IPersistentStorageModule';

const CACHE_DIRECTORY_NAME = 'temp';

class StorageModuleInitError extends Error {
  constructor(details?: string) {
    super(`Error creating the storage module!\n${details ?? ''}`);
  }
}

export type GetImageType = {
  image: Image;
  buffer: Buffer;
};

export enum CanUploadFileResponse {
  POSSIBLE,
  NEEDS_CACHE_CLEAR,
  NOT_POSSIBLE,
}

export type StorageStatistics = {
  permanentImages: number;
};

/**
 * Module for managing file storage on disk. Can be considered the "model" in an MVC-style app, since images do not have
 * much structure.
 */
export class PersistentStorageModule implements IPersistentStorageModule {
  private readonly _permanentStorageDirectoryPath: string;
  private fileNameCustomizationCallback: FileNameCustomizationCallback = () => 'default';

  private cacheModule: OnDiskCacheModule;
  private totalDiskSize: number = 0;

  private permanentImageDiskSize: number = 0;
  private readonly permanentImages: Array<Image> = [];

  private constructor(storageDirectoryName: string, permanentStorageDirectoryName: string) {
    this._permanentStorageDirectoryPath = `${__dirname}/${storageDirectoryName}/${permanentStorageDirectoryName}`;
    this.cacheModule = new OnDiskCacheModule(storageDirectoryName, CACHE_DIRECTORY_NAME);
  }

  private async initMemory(): Promise<void> {
    const diskSpace = await checkDiskSpace(this._permanentStorageDirectoryPath);

    this.totalDiskSize = diskSpace.size;
  }

  private async init(): Promise<void> {
    await this.createDirectories();
    await this.initMemory();
    await this.cacheModule.init();

    const wasSuccessful = await this.getExistingImages();
    logger.info(this.permanentImages);

    if (!wasSuccessful) {
      throw new Error();
    }
  }

  /**
   * Factory method to create an instance of PersistentStorageModule.
   * @param storageDirectoryName The base directory for storage. Inside, the directory for permanent storage and cache
   * storage will be made.
   * @param permanentStorageDirectoryName The name of the permanent storage directory.
   */
  public static async createInstance(
    storageDirectoryName: string,
    permanentStorageDirectoryName: string,
  ): Promise<PersistentStorageModule> {
    const instance = new PersistentStorageModule(storageDirectoryName, permanentStorageDirectoryName);
    await instance.init();

    return instance;
  }

  private async createDirectories(): Promise<void> {
    try {
      await mkdirp(this._permanentStorageDirectoryPath);
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
  private async addImageToPermanentStorage(fullFileName: string, size?: number): Promise<void> {
    const filePath = `${this._permanentStorageDirectoryPath}/${fullFileName}`;
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

  private async getExistingImages(): Promise<boolean> {
    let files: Array<string>;

    try {
      files = await fs.promises.readdir(this._permanentStorageDirectoryPath);
    } catch (err) {
      logger.error(err);
      return false;
    }

    for (const fullFileName of files) {
      await this.addImageToPermanentStorage(fullFileName);
    }

    return true;
  }

  private multerFileFilter(_request: Request, file: Express.Multer.File, callback: FileFilterCallback): void {
    if (!(file.mimetype === 'image/png' || file.mimetype === 'image/jpg' || file.mimetype === 'image/jpeg')) {
      logger.info(`Received wrong format!\nFormat received was ${file.mimetype}`);
      callback(null, false);
      return;
    }

    callback(null, true);
  }

  private generateFileName(mimetype: string): string {
    return `${crypto.randomUUID()}.${MimetypeToExtensionMap.get(mimetype)}`;
  }

  private multerHandleFile(
    request: Request,
    file: Express.Multer.File,
    callback: (error?: unknown, info?: Partial<Express.Multer.File>) => void,
  ): void {
    const sizedStream = file.stream.pipe(getSizeTransform(env.MAX_FILE_SIZE));
    const canUploadFile = this.canUploadFile(sizedStream.sizeInBytes);

    if (canUploadFile == CanUploadFileResponse.NOT_POSSIBLE) {
      callback(new Error('Insufficient size available!'));
      return;
    }
    let fileName = this.fileNameCustomizationCallback(request, file);
    if (this.permanentImages.some((image) => image.name == fileName)) {
      fileName = this.generateFileName(file.mimetype);
    }

    if (canUploadFile == CanUploadFileResponse.NEEDS_CACHE_CLEAR) {
      this.cacheModule
        .requestMemoryClear(
          sizedStream.sizeInBytes + this.totalDiskSize + this.cacheModule.cachedImageDiskSize - this.totalDiskSize,
        )
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .then((_) => {
          callback(null);

          const fileWriteStream = fs.createWriteStream(`${this._permanentStorageDirectoryPath}/${fileName}`);
          sizedStream
            .pipe(fileWriteStream)
            .on('error', (err) => {
              fileWriteStream.end();
              callback(err);
            })
            .on('finish', async () => {
              await this.addImageToPermanentStorage(fileName);
              callback(null, { filename: fileName });
            });
        })
        .catch((err) => callback(err));

      return;
    }

    const fileWriteStream = fs.createWriteStream(`${this._permanentStorageDirectoryPath}/${fileName}`);
    sizedStream
      .pipe(fileWriteStream)
      .on('error', (err) => {
        fileWriteStream.end();
        callback(err, { filename: fileName });
      })
      .on('finish', async () => {
        await this.addImageToPermanentStorage(fileName);
        callback(null, { filename: fileName });
      });
  }

  private multerRemoveFile(
    _request: Request,
    file: Express.Multer.File & { filename: string },
    callback: (error: Error | null) => void,
  ): void {
    fs.promises.unlink(`${this._permanentStorageDirectoryPath}/${file.filename}`).then(() => callback(null));
  }

  private canUploadFile(size: number) {
    const permanentStorageNeeded = this.permanentImageDiskSize + size;
    if (permanentStorageNeeded + this.cacheModule.cachedImageDiskSize < this.totalDiskSize)
      return CanUploadFileResponse.POSSIBLE;

    if (permanentStorageNeeded < this.totalDiskSize) return CanUploadFileResponse.NEEDS_CACHE_CLEAR;

    return CanUploadFileResponse.NOT_POSSIBLE;
  }

  private async getResizedImage(image: Image, resolution: Resolution): Promise<Buffer> {
    const cachedImage = await this.cacheModule.getImage(image, resolution);
    if (cachedImage != undefined) {
      return cachedImage;
    }

    const imageBuffer = await fs.promises.readFile(`${this._permanentStorageDirectoryPath}/${image.name}`);

    const resizedImage = sharp(imageBuffer, {
      // This is set to true in case there is some error with the validation so the memory doesn't get filled
      limitInputPixels: true,
    }).resize(resolution.width, resolution.height);

    // We do not have to await this since it would make the client wait for the caching process before returning.
    this.cacheModule.cacheImage(image, resolution, imageBuffer);

    return await resizedImage.toBuffer();
  }

  public getStats(): StorageStatistics & CacheStatistics {
    return {
      permanentImages: this.permanentImages.length,
      ...this.cacheModule.getStats(),
    };
  }

  public getStoreImageMiddleware(fileNameCustomizationCallback: FileNameCustomizationCallback, fieldName: string) {
    this.fileNameCustomizationCallback = fileNameCustomizationCallback;

    const handleFile = (
      request: Request,
      file: Express.Multer.File,
      callback: (error?: unknown, info?: Partial<Express.Multer.File>) => void,
    ) => this.multerHandleFile(request, file, callback);
    const removeFile = (
      _request: Request,
      file: Express.Multer.File & { filename: string },
      callback: (error: Error | null) => void,
    ) => this.multerRemoveFile(_request, file, callback);

    return multer({
      storage: {
        _handleFile: handleFile,
        _removeFile: removeFile,
      },
      limits: {
        fieldNameSize: env.MAX_NAME_SIZE,
        fileSize: env.MAX_FILE_SIZE,
      },
      fileFilter: this.multerFileFilter,
    }).single(fieldName);
  }

  /**
   * Gets an image from the disk. If image is not found, it returns undefined. This method can throw (from readFile) to
   * indicate that the image exists, but there was an issue retrieving it.
   * @param name Name of the image we want to get
   * @param resolution If the resolution is specified, it means we want to resize the image, and we will try to get it
   * from the cache first before resizing.
   */
  public async getImage(name: string, resolution?: Resolution): Promise<GetImageType | undefined> {
    const image = this.permanentImages.find((image) => image.name == name);
    if (image == undefined) return undefined;

    if (resolution != undefined) {
      const resizedImage = await this.getResizedImage(image, resolution);

      return {
        image: image,
        buffer: resizedImage,
      };
    }

    const imageBuffer = await fs.promises.readFile(`${this._permanentStorageDirectoryPath}/${image.name}`);

    return {
      image: image,
      buffer: imageBuffer,
    };
  }
}
