import fs from 'fs';
import { mkdirp } from 'mkdirp';
import { rimraf } from 'rimraf';

import { logger } from '../../middlewares/loggingMiddleware';
import PriorityQueue from '../../shared/priorityQueue/priorityQueue';
import { CachedImage, Image, Resolution } from '../../shared/utils/types/Image';

import { ICacheModule } from './ICacheModule';

export type CacheStatistics = {
  cachedImages: number;
  cacheHitRatio: number;
  cacheMissRatio: number;
};

export class OnDiskCacheModule implements ICacheModule {
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
  private getCacheImagePath(cachedImage: CachedImage): string {
    return `${this._cacheStorageDirectoryPath}/${cachedImage.resolution.height}x${cachedImage.resolution.width}${cachedImage.originalName}`;
  }

  // We use this to calculate what the path of an image will be once cached.
  private calculateImagePath(image: Image, resolution: Resolution): string {
    return `${this._cacheStorageDirectoryPath}/${resolution.height}x${resolution.width}${image.name}`;
  }

  // Since this is also stored on disk, we need a way to clear this storage in case we want to add more permanent images
  public async requestMemoryClear(size: number): Promise<boolean> {
    let currentFreedSize = 0;

    while (currentFreedSize < size && this.priorityQueue.getSize() != 0) {
      // We know this is not undefined since we checked for length at the beginning of the loop
      const cachedImage = this.priorityQueue.dequeue()!;
      const cachedImageIndex = this.cachedImages.indexOf(cachedImage);

      this.cachedImages.splice(cachedImageIndex, 1);
      try {
        await fs.promises.unlink(this.getCacheImagePath(cachedImage));
      } catch (err) {
        logger.error(err);
        // Since we can't know for sure if the image was removed, we won't count its memory towards the freed size
        continue;
      }
      this._cachedImageDiskSize -= cachedImage.size;
      currentFreedSize += cachedImage.size;
    }

    // If we emptied the cache but didn't manage to free enough memory we return false
    return !(this.priorityQueue.getSize() == 0 && currentFreedSize < size);
  }

  public async cacheImage(image: Image, resolution: Resolution, buffer: Buffer): Promise<void> {
    const isImageCached = this.cachedImages.some(
      (cachedImage) => cachedImage.originalName == image.name && cachedImage.resolution == resolution,
    );
    if (isImageCached) return;

    const filePath = this.calculateImagePath(image, resolution);
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

      this._cachedImageDiskSize += size;
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

  public async getImage(image: Image, resolution: Resolution): Promise<Buffer | undefined> {
    const cachedImage = this.cachedImages.find((cachedImageInstance) => {
      return cachedImageInstance.originalName == image.name && cachedImageInstance.resolution.isEqual(resolution);
    });

    if (cachedImage == undefined) {
      this.cacheMissRatio++;

      return undefined;
    }

    const cachedImageFilePath = this.calculateImagePath(image, resolution);
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

  // Since we store everything on the same disk, we need this to check the available size
  get cachedImageDiskSize(): number {
    return this._cachedImageDiskSize;
  }
}
