import dotenv from 'dotenv';
import { cleanEnv, port, str } from 'envalid';

const NODE_ENV_CHOICES = ['dev', 'test', 'prod'];

dotenv.config();

export const env = cleanEnv(process.env, {
  NODE_ENV: str({ choices: NODE_ENV_CHOICES }),
  PORT: port(),
});
