import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import config from '../config/index.js';
import { applySchema } from './applySchema.js';

/**
 * Apply the schema. Pass --fresh to delete the existing database file first
 * (used by `npm run db:reset`). Opens its own connection so --fresh takes
 * effect within a single process.
 */
function migrate() {
  const fresh = process.argv.includes('--fresh');

  if (fresh) {
    for (const suffix of ['', '-wal', '-shm', '-journal']) {
      const f = config.databaseFile + suffix;
      if (fs.existsSync(f)) fs.rmSync(f);
    }
    console.log('🗑️  Dropped existing database.');
  }

  fs.mkdirSync(path.dirname(config.databaseFile), { recursive: true });

  const db = new Database(config.databaseFile);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  applySchema(db);
  db.close();

  console.log(`✅ Migration complete → ${config.databaseFile}`);
}

migrate();
