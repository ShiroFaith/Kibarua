import db from '../db/connection.js';

const SELECT = 'SELECT * FROM users';

export function findById(id) {
  return db.prepare(`${SELECT} WHERE id = ?`).get(id);
}

export function findByEmail(email) {
  return db.prepare(`${SELECT} WHERE email = ? COLLATE NOCASE`).get(email);
}

export function findByUsername(username) {
  return db.prepare(`${SELECT} WHERE username = ? COLLATE NOCASE`).get(username);
}

export function findByResetToken(token) {
  return db.prepare(`${SELECT} WHERE reset_token = ?`).get(token);
}

export function findByVerifyToken(token) {
  return db.prepare(`${SELECT} WHERE email_verify_token = ?`).get(token);
}

export function create(user) {
  const stmt = db.prepare(`
    INSERT INTO users (username, email, password_hash, full_name, role, phone, email_verify_token)
    VALUES (@username, @email, @password_hash, @full_name, @role, @phone, @email_verify_token)
  `);
  const info = stmt.run({
    phone: null,
    email_verify_token: null,
    ...user,
  });
  return findById(info.lastInsertRowid);
}

export function update(id, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return findById(id);
  const setClause = keys.map((k) => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE users SET ${setClause}, updated_at = datetime('now') WHERE id = @id`).run({
    ...fields,
    id,
  });
  return findById(id);
}

/** Strip sensitive columns before returning a user to the client. */
export function toPublic(user) {
  if (!user) return null;
  const {
    password_hash,
    email_verify_token,
    reset_token,
    reset_token_expires,
    ...safe
  } = user;
  return {
    ...safe,
    // aliases various frontend code expects
    name: safe.full_name,
    user_id: safe.id,
    user_metadata: {
      full_name: safe.full_name,
      role: safe.role,
    },
  };
}
