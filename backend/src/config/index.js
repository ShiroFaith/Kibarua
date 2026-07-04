import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// backend/ root is two levels up from src/config/
const ROOT_DIR = path.resolve(__dirname, '..', '..');

function resolveFromRoot(p) {
  return path.isAbsolute(p) ? p : path.resolve(ROOT_DIR, p);
}

const config = {
  rootDir: ROOT_DIR,
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,

  jwt: {
    secret: process.env.JWT_SECRET || 'kibarua-dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  corsOrigins: (process.env.CORS_ORIGINS || '*')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  databaseFile: resolveFromRoot(process.env.DATABASE_FILE || './data/kibarua.sqlite'),

  uploadDir: resolveFromRoot(process.env.UPLOAD_DIR || './uploads'),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES) || 5 * 1024 * 1024,
};

export default config;
