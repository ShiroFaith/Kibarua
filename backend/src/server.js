import app from './app.js';
import config from './config/index.js';
import db from './db/connection.js';
import { applySchema } from './db/applySchema.js';

// Ensure the schema exists before serving traffic. schema.sql is fully
// idempotent (CREATE TABLE IF NOT EXISTS), so this runs on every start and
// only does real work on a fresh database.
applySchema(db);

const server = app.listen(config.port, () => {
  console.log(`🚀 Kibarua API listening on http://localhost:${config.port} (${config.env})`);
  console.log(`   Health check: http://localhost:${config.port}/api/health`);
});

// Graceful shutdown so the SQLite WAL is checkpointed cleanly.
function shutdown(signal) {
  console.log(`\n${signal} received - shutting down.`);
  server.close(() => {
    try {
      db.close();
    } catch {
      /* already closed */
    }
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export default server;
