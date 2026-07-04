import db from '../db/connection.js';
import { ok, pageParams, paginate } from '../utils/response.js';
import ApiError from '../utils/apiError.js';

// GET /notifications/stats
export async function stats(req, res) {
  const me = req.user.id;
  const row = db
    .prepare(
      `
      SELECT
        SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END)                                    AS unread,
        SUM(CASE WHEN is_read = 0 AND notification_type = 'message'  THEN 1 ELSE 0 END) AS messages,
        SUM(CASE WHEN is_read = 0 AND notification_type = 'review'   THEN 1 ELSE 0 END) AS reviews,
        SUM(CASE WHEN is_read = 0 AND notification_type = 'payment'  THEN 1 ELSE 0 END) AS payments,
        SUM(CASE WHEN is_read = 0 AND notification_type = 'proposal' THEN 1 ELSE 0 END) AS proposals
      FROM notifications
      WHERE user_id = ?
    `,
    )
    .get(me);

  const data = {
    unread: row.unread || 0,
    messages: row.messages || 0,
    reviews: row.reviews || 0,
    payments: row.payments || 0,
    proposals: row.proposals || 0,
  };
  return ok(res, { message: 'OK', data, extra: { stats: data } });
}

// GET /notifications/list
export async function list(req, res) {
  const me = req.user.id;
  const { page, limit, offset } = pageParams(req.query, 10);

  const total = db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ?').get(me).n;
  const rows = db
    .prepare(
      `SELECT * FROM notifications WHERE user_id = ?
       ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    )
    .all(me, limit, offset);

  return ok(res, {
    message: 'OK',
    data: rows, // frontend reads the array directly at data.data
    extra: { pagination: paginate(total, page, limit), notifications: rows },
  });
}

/** Resolve a notification the caller owns, or throw. */
function ownedNotification(req) {
  const id = Number((req.body && req.body.notification_id) || req.query.notification_id || req.params.id);
  const n = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
  if (!n) throw ApiError.notFound('Notification not found');
  if (n.user_id !== req.user.id) throw ApiError.forbidden('Not allowed');
  return n;
}

// POST /notifications/read
export async function markRead(req, res) {
  const n = ownedNotification(req);
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(n.id);
  return ok(res, { message: 'Notification marked as read' });
}

// POST /notifications/read-all
export async function markAllRead(req, res) {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(req.user.id);
  return ok(res, { message: 'All notifications marked as read' });
}

// DELETE /notifications/delete
export async function remove(req, res) {
  const n = ownedNotification(req);
  db.prepare('DELETE FROM notifications WHERE id = ?').run(n.id);
  return ok(res, { message: 'Notification deleted' });
}

// DELETE /notifications/clear
export async function clear(req, res) {
  db.prepare('DELETE FROM notifications WHERE user_id = ?').run(req.user.id);
  return ok(res, { message: 'All notifications cleared' });
}
