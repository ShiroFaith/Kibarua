import db from '../db/connection.js';

/**
 * Create the auxiliary rows a new user needs: a role-specific profile and a
 * wallet. Idempotent - uses INSERT OR IGNORE.
 */
export function provisionUser(user) {
  const tx = db.transaction((u) => {
    if (u.role === 'worker') {
      db.prepare('INSERT OR IGNORE INTO worker_profiles (user_id) VALUES (?)').run(u.id);
    } else if (u.role === 'employer') {
      db.prepare('INSERT OR IGNORE INTO employer_profiles (user_id) VALUES (?)').run(u.id);
    }
    db.prepare('INSERT OR IGNORE INTO wallets (user_id) VALUES (?)').run(u.id);
  });
  tx(user);
}
