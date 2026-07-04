import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import config from '../config/index.js';

// Ensure the directory that holds the SQLite file exists.
const dbDir = path.dirname(config.databaseFile);
fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(config.databaseFile);

// Pragmas: WAL for better concurrency, enforce foreign keys, sane sync level.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

export default db;
