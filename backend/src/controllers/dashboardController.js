import db from '../db/connection.js';
import { ok } from '../utils/response.js';

/** Small helper to run a COUNT/scalar query and return the first column value. */
function scalar(sql, ...params) {
  const row = db.prepare(sql).get(...params);
  return row ? Object.values(row)[0] || 0 : 0;
}

// GET /dashboard/stats  - role-aware summary for the dashboard cards.
export async function stats(req, res) {
  const me = req.user.id;
  const role = req.user.role;

  const wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(me) || {};
  const unreadNotifications = scalar(
    'SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0',
    me,
  );
  const unreadMessages = scalar(
    'SELECT COUNT(*) FROM messages WHERE recipient_id = ? AND is_read = 0',
    me,
  );

  let data;
  if (role === 'employer') {
    data = {
      role,
      active_jobs: scalar("SELECT COUNT(*) FROM jobs WHERE employer_id = ? AND status IN ('open','in_progress')", me),
      completed_jobs: scalar("SELECT COUNT(*) FROM jobs WHERE employer_id = ? AND status = 'completed'", me),
      total_jobs: scalar('SELECT COUNT(*) FROM jobs WHERE employer_id = ?', me),
      proposals_received: scalar(
        'SELECT COUNT(*) FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.employer_id = ?',
        me,
      ),
      rating: (db.prepare('SELECT avg_rating FROM employer_profiles WHERE user_id = ?').get(me) || {}).avg_rating || 0,
      total_spent: wallet.total_spent || 0,
      balance: wallet.balance || 0,
      unread_notifications: unreadNotifications,
      unread_messages: unreadMessages,
    };
  } else {
    data = {
      role,
      active_jobs: scalar("SELECT COUNT(*) FROM hirings WHERE worker_id = ? AND status = 'active'", me),
      completed_jobs: scalar("SELECT COUNT(*) FROM hirings WHERE worker_id = ? AND status = 'completed'", me),
      applications: scalar('SELECT COUNT(*) FROM applications WHERE worker_id = ?', me),
      pending_applications: scalar("SELECT COUNT(*) FROM applications WHERE worker_id = ? AND status = 'pending'", me),
      rating: (db.prepare('SELECT avg_rating FROM worker_profiles WHERE user_id = ?').get(me) || {}).avg_rating || 0,
      total_earned: wallet.total_earned || 0,
      balance: wallet.balance || 0,
      unread_notifications: unreadNotifications,
      unread_messages: unreadMessages,
    };
  }

  return ok(res, { message: 'OK', data, extra: { stats: data } });
}

// GET /dashboard/activity  - recent notifications as a simple activity feed.
export async function activity(req, res) {
  const rows = db
    .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 10')
    .all(req.user.id);
  return ok(res, { message: 'OK', data: rows, extra: { activity: rows } });
}
