export type ExtensionType = 'image/png' | 'image/jpg' | 'image/jpeg';

export function isExtensionType(extension: string): extension is ExtensionType {
  return extension == 'image/png' || extension == 'image/jpg' || extension == 'image/jpeg';
}

export type Image = {
  name: string;
  extension: ExtensionType;
  memory: number;
};
