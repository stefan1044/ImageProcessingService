import dotenv from 'dotenv';
import { bool, cleanEnv, port, str } from 'envalid';
import { num } from 'envalid/dist/validators';

const NODE_ENV_CHOICES = ['dev', 'test', 'prod'];

dotenv.config();

export const env = cleanEnv(process.env, {
  NODE_ENV: str({ choices: NODE_ENV_CHOICES }),
  PORT: port(),
  DEST: str(),
  MAX_NAME_SIZE: num(),
  MAX_FILE_SIZE: num(),
  ALLOW_NAMING: bool(),

  MAX_RESOLUTION_HEIGHT: num(),
  MAX_RESOLUTION_WIDTH: num(),
  MIN_RESOLUTION_HEIGHT: num(),
  MIN_RESOLUTION_WIDTH: num(),

  ENABLE_RATE_LIMITER: bool(),
  RATE_LIMITER_MAX: num(),
  RATE_LIMITER_WINDOW_MS: num(),
});
