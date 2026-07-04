import db from '../db/connection.js';

/** Insert a notification for a user. Best-effort; never throws to the caller. */
export function notify(userId, type, title, message, link = '') {
  try {
    db.prepare(`
      INSERT INTO notifications (user_id, notification_type, title, message, link)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, type, title, message, link);
  } catch (err) {
    console.error('notify() failed:', err.message);
  }
}
