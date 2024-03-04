import fs from 'fs';
import { mkdirp } from 'mkdirp';
import { rimraf } from 'rimraf';

import { logger } from '../../server';
import PriorityQueue from '../../shared/priorityQueue/priorityQueue';
import { CachedImage, Image, Resolution } from '../../shared/utils/types/Image';

export type CacheStatistics = {
  cachedImages: number;
  cacheHitRatio: number;
  cacheMissRatio: number;
};

export class CacheModule {
  private readonly cacheDirectoryName: string;
  private readonly storageDirectoryName: string;
  private readonly _cacheStorageDirectoryPath: string;

  private _cachedImageDiskSize: number = 0;
  private readonly priorityMap: Map<string, number> = new Map<string, number>();
  private readonly cachedImages: Array<CachedImage> = [];
  private readonly priorityQueue: PriorityQueue<CachedImage> = new PriorityQueue();

  private cacheHitRatio: number = 0;
  private cacheMissRatio: number = 0;

  constructor(storageDirectoryName: string, cacheDirectoryName: string) {
    this.cacheDirectoryName = cacheDirectoryName;
    this.storageDirectoryName = storageDirectoryName;
    this._cacheStorageDirectoryPath = `${__dirname}/${this.storageDirectoryName}/${this.cacheDirectoryName}`;
  }

  private async createDirectory(): Promise<void> {
    await rimraf(this._cacheStorageDirectoryPath);
    await mkdirp(this._cacheStorageDirectoryPath);
  }

  public async init(): Promise<void> {
    await this.createDirectory();
  }

  // We can use this to get what the path of an existing cached image is. This does not guarantee that the image
  // actually exists, it just calculates the path.
  private getCacheImagePath(image: Image, resolution: Resolution): string {
    return `${this._cacheStorageDirectoryPath}/${resolution.height}x${resolution.width}${image.name}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async clearCacheToFit(_size: number): Promise<void> {}

  public async cacheImage(image: Image, resolution: Resolution, buffer: Buffer): Promise<void> {
    const isImageCached = this.cachedImages.some(
      (cachedImage) => cachedImage.originalName == image.name && cachedImage.resolution == resolution,
    );
    if (isImageCached) return;

    const filePath = this.getCacheImagePath(image, resolution);
    try {
      await fs.promises.writeFile(filePath, buffer);
      logger.info('Cached image');

      const size = (await fs.promises.stat(filePath)).size;
      const cachedImage: CachedImage = {
        originalName: image.name,
        contentType: image.contentType,
        size: size,
        resolution: resolution,
      };

      this.cachedImages.push(cachedImage);

      const currentPriority = this.priorityMap.get(cachedImage.originalName);
      if (currentPriority == undefined) {
        this.priorityMap.set(cachedImage.originalName, 0);
        this.priorityQueue.enqueue(cachedImage, 0);
      } else {
        this.priorityMap.set(cachedImage.originalName, currentPriority + 1);
        this.priorityQueue.modifyPriority((image) => image.originalName == cachedImage.originalName, 1);

        this.priorityQueue.enqueue(cachedImage, currentPriority + 1);
      }
    } catch (err) {
      logger.error(err);
    }
  }

  public async getImageFromCache(image: Image, resolution: Resolution): Promise<Buffer | undefined> {
    const cachedImage = this.cachedImages.find((cachedImageInstance) => {
      return cachedImageInstance.originalName == image.name && cachedImageInstance.resolution.isEqual(resolution);
    });

    if (cachedImage == undefined) {
      this.cacheMissRatio++;

      return undefined;
    }

    const cachedImageFilePath = this.getCacheImagePath(image, resolution);
    try {
      this.cacheHitRatio++;
      this.priorityQueue.modifyPriority(
        (cachedImage) => cachedImage.originalName == image.name && cachedImage.resolution == resolution,
        1,
      );

      return await fs.promises.readFile(cachedImageFilePath);
    } catch (err) {
      logger.error(err);

      return undefined;
    }
  }

  public getStats(): CacheStatistics {
    return {
      cachedImages: this.cachedImages.length,
      cacheHitRatio: this.cacheHitRatio,
      cacheMissRatio: this.cacheMissRatio,
    };
  }

  get cachedImageDiskSize(): number {
    return this._cachedImageDiskSize;
  }
}
