import fs from 'fs';

import { PersistentStorageModule } from '../src/modules/storage/persistentStorageModule';

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
