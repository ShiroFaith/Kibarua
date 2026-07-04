import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Apply schema.sql to a database connection. Every statement uses
 * `CREATE TABLE IF NOT EXISTS`, so this is idempotent and safe to run on every
 * boot - it creates the tables on a fresh install and is a no-op afterwards.
 */
export function applySchema(db) {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
}

export default applySchema;
