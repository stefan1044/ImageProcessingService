import * as fs from 'fs';
import { mkdirp } from 'mkdirp';
import path from 'node:path';
import { rimraf } from 'rimraf';

import { logger } from '../../server';
import { env } from '../../shared/utils/config';

import { Image } from './Image';

const STORAGE_DIRECTORY_NAME = 'storage';
const CACHE_DIRECTORY_NAME = 'temp';

class StorageModuleInitError extends Error {
  constructor() {
    super('Error creating the storage module!');
  }
}

/**
 * Module for managing file storage. Can be considered the "model" in an MVC-style app, since images do not have much
 * structure.
 */
export class StorageModule {
  private static _permanentStorageDirectoryPath = `${__dirname}/${STORAGE_DIRECTORY_NAME}/${env.DEST}`;
  private static _cacheStorageDirectoryPath = `${__dirname}/${STORAGE_DIRECTORY_NAME}/${CACHE_DIRECTORY_NAME}`;

  private static permanentImages: Array<Image> = [];

  private static async createDirectories(): Promise<void> {
    try {
      await rimraf(StorageModule.cacheStorageDirectoryPath);

      await Promise.all([
        mkdirp(StorageModule._permanentStorageDirectoryPath),
        mkdirp(StorageModule._cacheStorageDirectoryPath),
      ]);
    } catch (err) {
      logger.error(err);
      throw new StorageModuleInitError();
    }
  }

  private static async getExistingImages(): Promise<void> {
    fs.readdir(StorageModule.permanentStorageDirectoryPath, (_err, files) => {
      files.forEach((file) => {
        const extension = 'image/' + path.extname(`${StorageModule._permanentStorageDirectoryPath}/${file}`).slice(1);
        logger.info(extension);
        /*StorageModule.permanentImages.push({
          name: mergedFileName,
          extension: extension,
          memory: 0,
        });*/
      });
    });
  }

  public static async init(): Promise<void> {
    await StorageModule.createDirectories();
    await StorageModule.getExistingImages();
    logger.info(StorageModule.permanentImages);
  }

  static get cacheStorageDirectoryPath(): string {
    return this._cacheStorageDirectoryPath;
  }
  static get permanentStorageDirectoryPath(): string {
    return this._permanentStorageDirectoryPath;
  }
}
