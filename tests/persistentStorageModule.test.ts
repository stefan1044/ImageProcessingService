import express from 'express';
import fs from 'fs';
import { StatusCodes } from 'http-status-codes';
import request from 'supertest';

import { ImageUploadService } from '../src/modules/images/imageUploadService/ImageUploadService';
import { PersistentStorageModule } from '../src/modules/storage/PersistentStorageModule';

test('Should create storage directories', async () => {
  const storageDirectoryName = 'permanentStorage1';
  const permanentStorageDirectoryName = 'test1';
  await PersistentStorageModule.createInstance(storageDirectoryName, permanentStorageDirectoryName);

  expect(fs.existsSync(`${__dirname}/${storageDirectoryName}/${permanentStorageDirectoryName}`));
});

test('Should return stats', async () => {
  const storageDirectoryName = 'permanentStorage2';
  const permanentStorageDirectoryName = 'test2';
  const persistentStorageModule = await PersistentStorageModule.createInstance(
    storageDirectoryName,
    permanentStorageDirectoryName,
  );

  expect(persistentStorageModule.getStats()).toBeDefined();
});

describe('Image storage middleware', () => {
  const app = express();
  let currentPort = 0;

  beforeEach(async () => {
    const randomString = Math.floor(Math.random() * 10e9).toString() + Date.now().toString();
    const storageDirectoryName = 'permanentStorage2' + randomString;
    const permanentStorageDirectoryName = 'test2' + randomString;
    const persistentStorageModule = await PersistentStorageModule.createInstance(
      storageDirectoryName,
      permanentStorageDirectoryName,
    );

    const imageUploadService = new ImageUploadService('image', persistentStorageModule, '');
    app.post('/image', imageUploadService.getImageUploadMiddleware());

    currentPort = Math.floor(Math.random() * 2000 + 2000);
    app.listen(currentPort);
  });

  test('Successfully stores an image', async () => {
    // const imageBuffer = await fs.promises.readFile(`${__dirname}/test_image_1.jpg`);
    const response = await request(app)
      .post(`/image`)
      .set('Content-Type', 'multipart/form-data')
      .attach('image', `${__dirname}/test_image_1.jpg`);

    expect(response.status).toBe(StatusCodes.OK);
  });
});
test('Should store image', () => {});
