import { Request } from 'express';

export type FileNameCallback = (error: Error | null, filename: string) => void;
export type FileNameCustomizationCallback = (request: Request, file: Express.Multer.File) => string;
export type DestinationCallback = (error: Error | null, destination: string) => void;
