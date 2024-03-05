import fs from 'fs';

import { CacheModule } from '../src/modules/cacheModule/cacheModule';
import { Image, Resolution } from '../src/shared/utils/types/Image';

const STORAGE_DIRECTORY_NAME = 'storage';
const CACHE_DIRECTORY_NAME = 'temp';

test('Create storage directory', async () => {
  const uniqueDirectoryName = 'test1';

  const storageDirectoryName = STORAGE_DIRECTORY_NAME + uniqueDirectoryName;
  const cacheDirectoryName = CACHE_DIRECTORY_NAME + uniqueDirectoryName;
  const cacheModule = new CacheModule(storageDirectoryName, cacheDirectoryName);
  await cacheModule.init();

  expect(fs.existsSync(`${__dirname}/${storageDirectoryName}/${cacheDirectoryName}`));
});

test("Should return undefined if image doesn't exist", async () => {
  const uniqueDirectoryName = 'test2';

  const storageDirectoryName = STORAGE_DIRECTORY_NAME + uniqueDirectoryName;
  const cacheDirectoryName = CACHE_DIRECTORY_NAME + uniqueDirectoryName;
  const cacheModule = new CacheModule(storageDirectoryName, cacheDirectoryName);
  await cacheModule.init();

  const cachedImage = await cacheModule.getImageFromCache(
    {
      name: 'testImage',
      contentType: 'image/jpeg',
      size: 5,
    },
    new Resolution(5, 5),
  );

  expect(cachedImage == undefined);
});

test('Should not throw when caching', async () => {
  const uniqueDirectoryName = 'test3';

  const storageDirectoryName = STORAGE_DIRECTORY_NAME + uniqueDirectoryName;
  const cacheDirectoryName = CACHE_DIRECTORY_NAME + uniqueDirectoryName;
  const cacheModule = new CacheModule(storageDirectoryName, cacheDirectoryName);
  await cacheModule.init();

  const testImagePath = `${__dirname}/test_image_1.jpg`;
  const testImageBuffer = await fs.promises.readFile(testImagePath);
  const testImage: Image = {
    name: 'testImage.jpg',
    contentType: 'image/jpg',
    size: (await fs.promises.stat(testImagePath)).size,
  };
  const testImageRequestedResolution = new Resolution(600, 600);

  expect(
    async () => await cacheModule.cacheImage(testImage, testImageRequestedResolution, testImageBuffer),
  ).not.toThrow();
});

test('Should create image when caching', async () => {
  const uniqueDirectoryName = 'test4';

  const storageDirectoryName = STORAGE_DIRECTORY_NAME + uniqueDirectoryName;
  const cacheDirectoryName = CACHE_DIRECTORY_NAME + uniqueDirectoryName;
  const cacheModule = new CacheModule(storageDirectoryName, cacheDirectoryName);
  await cacheModule.init();

  const testImagePath = `${__dirname}/test_image_1.jpg`;
  const testImageBuffer = await fs.promises.readFile(testImagePath);
  const testImage: Image = {
    name: 'testImage.jpg',
    contentType: 'image/jpg',
    size: (await fs.promises.stat(testImagePath)).size,
  };
  const testImageRequestedResolution = new Resolution(600, 600);
  await cacheModule.cacheImage(testImage, testImageRequestedResolution, testImageBuffer);

  expect(fs.existsSync(Object.getPrototypeOf(cacheModule).getCacheImagePath(testImage, testImageRequestedResolution)));
});
