import db from '../db/connection.js';
import { ok, created, pageParams, paginate } from '../utils/response.js';
import { toBit } from '../utils/helpers.js';
import ApiError from '../utils/apiError.js';

const METHOD_TYPES = ['card', 'mobile_money', 'bank_transfer'];

/** Ensure a wallet row exists for the user, then return it. */
function ensureWallet(userId) {
  db.prepare('INSERT OR IGNORE INTO wallets (user_id) VALUES (?)').run(userId);
  return db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(userId);
}

// GET /payments/wallet
export async function wallet(req, res) {
  const w = ensureWallet(req.user.id);
  const data = {
    balance: w.balance || 0,
    currency: w.currency || 'KES',
    total_earned: w.total_earned || 0,
    total_spent: w.total_spent || 0,
    total_refunded: w.total_refunded || 0,
  };
  return ok(res, { message: 'OK', data, extra: { wallet: data } });
}

// GET /payments/methods
export async function methods(req, res) {
  const rows = db
    .prepare('SELECT * FROM payment_methods WHERE user_id = ? ORDER BY is_default DESC, id DESC')
    .all(req.user.id);
  return ok(res, { message: 'OK', data: rows, extra: { methods: rows } });
}

// POST /payments/method/add
export async function addMethod(req, res) {
  const b = req.body || {};
  const methodType = METHOD_TYPES.includes(b.method_type) ? b.method_type : 'card';
  const provider = String(b.provider || '').trim();
  const lastFour = String(b.last_four || '').replace(/\D/g, '').slice(-4);
  const isDefault = toBit(b.is_default);

  const tx = db.transaction(() => {
    if (isDefault) {
      db.prepare('UPDATE payment_methods SET is_default = 0 WHERE user_id = ?').run(req.user.id);
    }
    const info = db
      .prepare(
        `INSERT INTO payment_methods (user_id, method_type, provider, last_four, is_default)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(req.user.id, methodType, provider, lastFour, isDefault);
    return info.lastInsertRowid;
  });
  const id = tx();

  const method = db.prepare('SELECT * FROM payment_methods WHERE id = ?').get(id);
  return created(res, { message: 'Payment method added successfully', data: { method } });
}

// GET /payments/transactions?type=all|sent|received
export async function transactions(req, res) {
  const me = req.user.id;
  const type = ['sent', 'received'].includes(req.query.type) ? req.query.type : 'all';
  const { page, limit, offset } = pageParams(req.query, 10);

  let where = '(t.payer_id = @me OR t.payee_id = @me)';
  if (type === 'sent') where = 't.payer_id = @me';
  else if (type === 'received') where = 't.payee_id = @me';

  const total = db.prepare(`SELECT COUNT(*) AS n FROM transactions t WHERE ${where}`).get({ me }).n;
  const rows = db
    .prepare(
      `
      SELECT t.*,
             payer.full_name AS payer_name,
             payee.full_name AS payee_name
      FROM transactions t
      LEFT JOIN users payer ON payer.id = t.payer_id
      LEFT JOIN users payee ON payee.id = t.payee_id
      WHERE ${where}
      ORDER BY t.created_at DESC, t.id DESC
      LIMIT @limit OFFSET @offset
    `,
    )
    .all({ me, limit, offset })
    .map((t) => ({
      ...t,
      payer_name: t.payer_name || 'System',
      payee_name: t.payee_name || 'System',
      // Direction hint for the UI: outgoing when the caller paid.
      direction: t.payer_id === me ? 'sent' : 'received',
    }));

  return ok(res, {
    message: 'OK',
    data: rows,
    extra: { pagination: paginate(total, page, limit), transactions: rows },
  });
}

// GET /payments/invoices?type=all|sent|received
export async function invoices(req, res) {
  const me = req.user.id;
  const type = ['sent', 'received'].includes(req.query.type) ? req.query.type : 'all';
  const { page, limit, offset } = pageParams(req.query, 10);

  let where = '(issuer_id = @me OR recipient_id = @me)';
  if (type === 'sent') where = 'issuer_id = @me';
  else if (type === 'received') where = 'recipient_id = @me';

  const total = db.prepare(`SELECT COUNT(*) AS n FROM invoices WHERE ${where}`).get({ me }).n;
  const rows = db
    .prepare(
      `SELECT * FROM invoices WHERE ${where}
       ORDER BY issue_date DESC, id DESC LIMIT @limit OFFSET @offset`,
    )
    .all({ me, limit, offset });

  return ok(res, {
    message: 'OK',
    data: rows,
    extra: { pagination: paginate(total, page, limit), invoices: rows },
  });
}

// POST /payments/withdraw/request
export async function requestWithdrawal(req, res) {
  const b = req.body || {};
  const amount = Number(b.amount) || 0;
  const methodId = Number(b.payment_method_id) || null;

  if (amount < 100) throw ApiError.badRequest('Minimum withdrawal amount is 100');

  const w = ensureWallet(req.user.id);
  if (amount > (w.balance || 0)) {
    throw ApiError.badRequest('Withdrawal amount exceeds your available balance');
  }

  if (methodId) {
    const method = db
      .prepare('SELECT id FROM payment_methods WHERE id = ? AND user_id = ?')
      .get(methodId, req.user.id);
    if (!method) throw ApiError.badRequest('Invalid payment method');
  }

  const info = db
    .prepare(
      `INSERT INTO withdrawals (user_id, amount, payment_method_id, status)
       VALUES (?, ?, ?, 'pending')`,
    )
    .run(req.user.id, amount, methodId);

  return created(res, {
    message: 'Withdrawal request submitted successfully',
    data: { withdrawal_id: info.lastInsertRowid, status: 'pending' },
  });
}
