import { Image, Resolution } from '../../shared/utils/types/Image';

import { CacheStatistics } from './onDiskCacheModule';

/**
 * Interface for providing a caching module for storage.
 *
 * @method init Allows dynamic initialization of the cache.
 *
 * @method cacheImage Caches an image
 *
 * @method getImage Allows retrieval of images with a given name and resolution.
 *
 * @method getStats Offers insights about the state of the cache module.
 */
export interface ICacheModule {
  init(): Promise<void>;
  cacheImage(image: Image, resolution: Resolution, buffer: Buffer): Promise<void>;
  getImage(image: Image, resolution: Resolution): Promise<Buffer | undefined>;
  getStats(): CacheStatistics;
}
