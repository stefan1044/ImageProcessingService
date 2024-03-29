import fs from 'fs';

import { OnDiskCacheModule } from '../src/modules/cacheModule/OnDiskCacheModule';
import { Image, Resolution } from '../src/shared/utils/types/Image';

const STORAGE_DIRECTORY_NAME = 'storage';
const CACHE_DIRECTORY_NAME = 'temp';

test('Create storage directory', async () => {
  const uniqueDirectoryName = 'test1';

  const storageDirectoryName = STORAGE_DIRECTORY_NAME + uniqueDirectoryName;
  const cacheDirectoryName = CACHE_DIRECTORY_NAME + uniqueDirectoryName;
  const cacheModule = new OnDiskCacheModule(storageDirectoryName, cacheDirectoryName);
  await cacheModule.init();

  expect(fs.existsSync(`${__dirname}/${storageDirectoryName}/${cacheDirectoryName}`));
});

test('Should return stats', async () => {
  const uniqueDirectoryName = 'test2';

  const storageDirectoryName = STORAGE_DIRECTORY_NAME + uniqueDirectoryName;
  const cacheDirectoryName = CACHE_DIRECTORY_NAME + uniqueDirectoryName;
  const cacheModule = new OnDiskCacheModule(storageDirectoryName, cacheDirectoryName);
  await cacheModule.init();

  const stats = cacheModule.getStats();

  expect(stats).toBeDefined();
});

describe('Tests regarding image storage', () => {
  let cacheModule: OnDiskCacheModule;

  beforeEach(async () => {
    const randomString = Math.floor(Math.random() * 10e9).toString() + Date.now().toString();
    const uniqueDirectoryName = 'test' + randomString;

    const storageDirectoryName = STORAGE_DIRECTORY_NAME + uniqueDirectoryName;
    const cacheDirectoryName = CACHE_DIRECTORY_NAME + uniqueDirectoryName;
    cacheModule = new OnDiskCacheModule(storageDirectoryName, cacheDirectoryName);

    return await cacheModule.init();
  });

  test("Should return undefined if image doesn't exist", async () => {
    const cachedImage = await cacheModule.getImage(
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
    const testImagePath = `${__dirname}/test_image_1.jpg`;
    const testImageBuffer = await fs.promises.readFile(testImagePath);
    const testImage: Image = {
      name: 'testImage.jpg',
      contentType: 'image/jpg',
      size: (await fs.promises.stat(testImagePath)).size,
    };
    const testImageRequestedResolution = new Resolution(600, 600);
    await cacheModule.cacheImage(testImage, testImageRequestedResolution, testImageBuffer);

    expect(
      fs.existsSync(Object.getPrototypeOf(cacheModule).calculateImagePath(testImage, testImageRequestedResolution)),
    );
  });

  test('Should get image from cache', async () => {
    const testImagePath = `${__dirname}/test_image_1.jpg`;
    const testImageBuffer = await fs.promises.readFile(testImagePath);
    const testImage: Image = {
      name: 'testImage.jpg',
      contentType: 'image/jpg',
      size: (await fs.promises.stat(testImagePath)).size,
    };
    const testImageRequestedResolution = new Resolution(600, 600);
    await cacheModule.cacheImage(testImage, testImageRequestedResolution, testImageBuffer);
    const cachedImage = await cacheModule.getImage(testImage, testImageRequestedResolution);

    expect(cachedImage).toBeDefined();
    expect(cacheModule.getStats().cachedImages).toBe(1);
  });

  test('Should delete image to make room', async () => {
    const testImagePath = `${__dirname}/test_image_1.jpg`;
    const testImageBuffer = await fs.promises.readFile(testImagePath);
    const testImage: Image = {
      name: 'testImage2.jpg',
      contentType: 'image/jpg',
      size: (await fs.promises.stat(testImagePath)).size,
    };
    const testImageRequestedResolution = new Resolution(600, 600);
    await cacheModule.cacheImage(testImage, testImageRequestedResolution, testImageBuffer);

    const wasClearSuccessful = await cacheModule.requestMemoryClear(1);
    expect(wasClearSuccessful).toBe(true);

    expect(cacheModule.getStats().cachedImages).toBe(0);
    expect(
      fs.existsSync(Object.getPrototypeOf(cacheModule).calculateImagePath(testImage, testImageRequestedResolution)),
    ).toBe(false);
  });
});
