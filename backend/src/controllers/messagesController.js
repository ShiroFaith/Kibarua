import db from '../db/connection.js';
import { ok, created, pageParams } from '../utils/response.js';
import { parseJson } from '../utils/helpers.js';
import ApiError from '../utils/apiError.js';
import { notify } from '../services/notificationService.js';

/**
 * Find (or create) the conversation between two users. Participants are stored
 * in a canonical order (smaller id in user_a) so the UNIQUE(user_a,user_b)
 * constraint dedupes regardless of who starts the thread.
 */
function getOrCreateConversation(userId, otherId) {
  const a = Math.min(userId, otherId);
  const b = Math.max(userId, otherId);
  let convo = db.prepare('SELECT * FROM conversations WHERE user_a = ? AND user_b = ?').get(a, b);
  if (!convo) {
    const info = db
      .prepare('INSERT INTO conversations (user_a, user_b) VALUES (?, ?)')
      .run(a, b);
    convo = db.prepare('SELECT * FROM conversations WHERE id = ?').get(info.lastInsertRowid);
  }
  return convo;
}

function assertParticipant(convo, userId) {
  if (!convo) throw ApiError.notFound('Conversation not found');
  if (convo.user_a !== userId && convo.user_b !== userId) {
    throw ApiError.forbidden('You are not part of this conversation');
  }
}

// GET /messages/conversations
export async function conversations(req, res) {
  const me = req.user.id;
  const { limit } = pageParams(req.query, 50);

  const rows = db
    .prepare(
      `
      SELECT c.id,
             CASE WHEN c.user_a = @me THEN c.user_b ELSE c.user_a END AS other_user_id,
             c.updated_at
      FROM conversations c
      WHERE c.user_a = @me OR c.user_b = @me
      ORDER BY c.updated_at DESC
      LIMIT @limit
    `,
    )
    .all({ me, limit });

  const lastMsgStmt = db.prepare(
    `SELECT message_body, created_at FROM messages
     WHERE conversation_id = ? ORDER BY created_at DESC, id DESC LIMIT 1`,
  );
  const unreadStmt = db.prepare(
    `SELECT COUNT(*) AS n FROM messages
     WHERE conversation_id = ? AND recipient_id = ? AND is_read = 0`,
  );
  const userStmt = db.prepare('SELECT id, full_name, avatar_url FROM users WHERE id = ?');

  const list = rows.map((r) => {
    const other = userStmt.get(r.other_user_id) || {};
    const last = lastMsgStmt.get(r.id);
    const unread = unreadStmt.get(r.id, me).n;
    return {
      id: r.id,
      other_user_id: r.other_user_id,
      other_user_name: other.full_name || 'Unknown user',
      other_user_avatar: other.avatar_url || '',
      last_message: last ? last.message_body : '',
      last_message_at: last ? last.created_at : r.updated_at,
      unread_count: unread,
    };
  });

  return ok(res, { message: 'OK', data: { conversations: list }, extra: { conversations: list } });
}

// GET /messages/thread?conversation_id=
export async function thread(req, res) {
  const me = req.user.id;
  const convoId = Number(req.query.conversation_id || req.params.conversation_id);
  const { limit } = pageParams(req.query, 50);

  const convo = db.prepare('SELECT * FROM conversations WHERE id = ?').get(convoId);
  assertParticipant(convo, me);

  // Newest N, then return chronological order for display.
  const rows = db
    .prepare(
      `SELECT * FROM messages WHERE conversation_id = ?
       ORDER BY created_at DESC, id DESC LIMIT ?`,
    )
    .all(convoId, limit)
    .reverse()
    .map((m) => ({ ...m, attachments: parseJson(m.attachments, []) }));

  // Mark everything addressed to me in this thread as read.
  db.prepare(
    `UPDATE messages SET is_read = 1
     WHERE conversation_id = ? AND recipient_id = ? AND is_read = 0`,
  ).run(convoId, me);

  return ok(res, { message: 'OK', data: { messages: rows }, extra: { messages: rows } });
}

// POST /messages/send
export async function send(req, res) {
  const me = req.user.id;
  const b = req.body || {};
  const body = String(b.message || b.message_body || '').trim();
  if (!body) throw ApiError.badRequest('Message cannot be empty');

  // Resolve the recipient: prefer an explicit recipient_id, otherwise derive
  // it from the conversation (the frontend sometimes only knows the thread).
  let recipientId = Number(b.recipient_id) || 0;
  let convo = null;

  const convoId = Number(b.conversation_id || req.query.conversation_id) || 0;
  if (convoId) {
    convo = db.prepare('SELECT * FROM conversations WHERE id = ?').get(convoId);
    assertParticipant(convo, me);
    recipientId = convo.user_a === me ? convo.user_b : convo.user_a;
  }

  if (!recipientId) throw ApiError.badRequest('A recipient is required');
  if (recipientId === me) throw ApiError.badRequest('You cannot message yourself');

  const recipient = db.prepare('SELECT id, full_name FROM users WHERE id = ?').get(recipientId);
  if (!recipient) throw ApiError.notFound('Recipient not found');

  if (!convo) convo = getOrCreateConversation(me, recipientId);

  const attachments = Array.isArray(b.attachments) ? b.attachments : [];

  const tx = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO messages (conversation_id, sender_id, recipient_id, message_body, attachments)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(convo.id, me, recipientId, body, JSON.stringify(attachments));
    db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(convo.id);
    return info.lastInsertRowid;
  });
  const msgId = tx();

  notify(recipientId, 'message', 'New message', `${req.user.full_name} sent you a message`,
    'dashboard/messages.html');

  const message = {
    ...db.prepare('SELECT * FROM messages WHERE id = ?').get(msgId),
    attachments,
  };
  return created(res, {
    message: 'Message sent',
    data: { message, conversation_id: convo.id },
    extra: { conversation_id: convo.id },
  });
}
