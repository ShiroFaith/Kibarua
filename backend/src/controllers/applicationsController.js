import db from '../db/connection.js';
import { ok, created } from '../utils/response.js';
import ApiError from '../utils/apiError.js';
import { notify } from '../services/notificationService.js';

// POST /applications/apply  (worker)
export async function apply(req, res) {
  if (req.user.role !== 'worker') throw ApiError.forbidden('Only workers can apply to jobs');
  const b = req.body || {};
  const jobId = Number(b.job_id || req.query.job_id);
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
  if (!job) throw ApiError.notFound('Job not found');
  if (job.status !== 'open') throw ApiError.badRequest('This job is no longer accepting applications');

  const existing = db
    .prepare('SELECT id FROM applications WHERE job_id = ? AND worker_id = ?')
    .get(jobId, req.user.id);
  if (existing) throw ApiError.conflict('You have already applied to this job');

  const tx = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO applications (job_id, worker_id, cover_letter, bid_amount)
      VALUES (?, ?, ?, ?)
    `).run(jobId, req.user.id, String(b.cover_letter || ''), Number(b.bid_amount) || 0);
    db.prepare('UPDATE jobs SET proposals_count = proposals_count + 1 WHERE id = ?').run(jobId);
    return info.lastInsertRowid;
  });
  const appId = tx();

  notify(job.employer_id, 'proposal', 'New proposal received',
    `${req.user.full_name} applied to "${job.title}"`, `dashboard/post-job.html`);

  const application = db.prepare('SELECT * FROM applications WHERE id = ?').get(appId);
  return created(res, { message: 'Application submitted', data: { application } });
}

// GET /applications/mine  (worker)
export async function mine(req, res) {
  const rows = db.prepare(`
    SELECT a.*, j.title AS job_title, j.status AS job_status, j.budget_type,
           j.budget_amount, u.full_name AS employer_name
    FROM applications a
    JOIN jobs j ON j.id = a.job_id
    JOIN users u ON u.id = j.employer_id
    WHERE a.worker_id = ?
    ORDER BY a.created_at DESC
  `).all(req.user.id);
  return ok(res, { message: 'OK', data: { applications: rows } });
}

// GET /applications/job?job_id=  (employer - applicants for one of their jobs)
export async function forJob(req, res) {
  const jobId = Number(req.query.job_id || req.params.job_id);
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
  if (!job) throw ApiError.notFound('Job not found');
  if (job.employer_id !== req.user.id && req.user.role !== 'admin') {
    throw ApiError.forbidden('You can only view applicants for your own jobs');
  }
  const rows = db.prepare(`
    SELECT a.*, u.full_name AS worker_name, u.email AS worker_email, u.avatar_url,
           wp.professional_title, wp.avg_rating, wp.hourly_rate
    FROM applications a
    JOIN users u ON u.id = a.worker_id
    LEFT JOIN worker_profiles wp ON wp.user_id = a.worker_id
    WHERE a.job_id = ?
    ORDER BY a.created_at DESC
  `).all(jobId);
  return ok(res, { message: 'OK', data: { applications: rows } });
}

// POST /applications/hire  (employer)
export async function hire(req, res) {
  const b = req.body || {};
  const appId = Number(b.application_id || b.id);
  const application = db.prepare('SELECT * FROM applications WHERE id = ?').get(appId);
  if (!application) throw ApiError.notFound('Application not found');

  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(application.job_id);
  if (job.employer_id !== req.user.id && req.user.role !== 'admin') {
    throw ApiError.forbidden('You can only hire for your own jobs');
  }

  const tx = db.transaction(() => {
    db.prepare("UPDATE applications SET status = 'hired', updated_at = datetime('now') WHERE id = ?").run(appId);
    db.prepare("UPDATE jobs SET status = 'in_progress', updated_at = datetime('now') WHERE id = ?").run(job.id);
    const info = db.prepare(`
      INSERT INTO hirings (job_id, employer_id, worker_id, amount, status)
      VALUES (?, ?, ?, ?, 'active')
    `).run(job.id, job.employer_id, application.worker_id, application.bid_amount || job.budget_amount || 0);
    return info.lastInsertRowid;
  });
  const hiringId = tx();

  notify(application.worker_id, 'proposal', 'You were hired!',
    `You have been hired for "${job.title}"`, 'dashboard/dashboard.html');

  return ok(res, { message: 'Worker hired', data: { hiring_id: hiringId } });
}

// GET /applications/hirings  (engagements for the current user, role-aware)
export async function hirings(req, res) {
  const me = req.user.id;
  let rows;
  if (req.user.role === 'employer') {
    rows = db.prepare(`
      SELECT h.*, j.title AS job_title, w.full_name AS worker_name, w.id AS worker_id,
             wp.professional_title,
             EXISTS (
               SELECT 1 FROM reviews r
               WHERE r.hiring_id = h.id AND r.reviewer_id = @me AND r.review_type = 'for_worker'
             ) AS has_reviewed
      FROM hirings h
      JOIN jobs j ON j.id = h.job_id
      JOIN users w ON w.id = h.worker_id
      LEFT JOIN worker_profiles wp ON wp.user_id = h.worker_id
      WHERE h.employer_id = @me
      ORDER BY h.created_at DESC
    `).all({ me });
  } else {
    rows = db.prepare(`
      SELECT h.*, j.title AS job_title, e.full_name AS employer_name, e.id AS employer_id,
             ep.company_name,
             EXISTS (
               SELECT 1 FROM reviews r
               WHERE r.hiring_id = h.id AND r.reviewer_id = @me AND r.review_type = 'for_employer'
             ) AS has_reviewed
      FROM hirings h
      JOIN jobs j ON j.id = h.job_id
      JOIN users e ON e.id = h.employer_id
      LEFT JOIN employer_profiles ep ON ep.user_id = h.employer_id
      WHERE h.worker_id = @me
      ORDER BY h.created_at DESC
    `).all({ me });
  }
  const list = rows.map((r) => ({ ...r, has_reviewed: !!r.has_reviewed }));
  return ok(res, { message: 'OK', data: { hirings: list }, extra: { hirings: list } });
}

// POST /applications/complete  (employer marks an engagement complete)
export async function complete(req, res) {
  const b = req.body || {};
  const hiringId = Number(b.hiring_id || b.id);
  const hiring = db.prepare('SELECT * FROM hirings WHERE id = ?').get(hiringId);
  if (!hiring) throw ApiError.notFound('Hiring not found');
  if (hiring.employer_id !== req.user.id && req.user.role !== 'admin') {
    throw ApiError.forbidden('Only the employer can complete this engagement');
  }
  if (hiring.status === 'completed') {
    throw ApiError.badRequest('This engagement is already completed');
  }

  const amount = Number(hiring.amount) || 0;

  const tx = db.transaction(() => {
    db.prepare("UPDATE hirings SET status = 'completed', completed_at = datetime('now') WHERE id = ?").run(hiringId);
    db.prepare("UPDATE jobs SET status = 'completed', updated_at = datetime('now') WHERE id = ?").run(hiring.job_id);
    db.prepare('INSERT OR IGNORE INTO employer_profiles (user_id) VALUES (?)').run(hiring.employer_id);
    db.prepare('UPDATE employer_profiles SET jobs_completed = jobs_completed + 1 WHERE user_id = ?').run(hiring.employer_id);

    // Settlement: record the payment and move funds employer → worker so the
    // earning/spending loop is closed (wallets, transactions, invoice).
    if (amount > 0) {
      db.prepare('INSERT OR IGNORE INTO wallets (user_id) VALUES (?)').run(hiring.worker_id);
      db.prepare('INSERT OR IGNORE INTO wallets (user_id) VALUES (?)').run(hiring.employer_id);

      const ref = `TXN-${hiringId}-${Date.now()}`;
      db.prepare(
        `INSERT INTO transactions (payer_id, payee_id, amount, transaction_type, status, reference, description)
         VALUES (?, ?, ?, 'payment', 'completed', ?, ?)`,
      ).run(hiring.employer_id, hiring.worker_id, amount, ref, 'Payment for completed job');

      db.prepare(
        "UPDATE wallets SET balance = balance + ?, total_earned = total_earned + ?, updated_at = datetime('now') WHERE user_id = ?",
      ).run(amount, amount, hiring.worker_id);
      db.prepare(
        "UPDATE wallets SET total_spent = total_spent + ?, updated_at = datetime('now') WHERE user_id = ?",
      ).run(amount, hiring.employer_id);

      db.prepare(
        `INSERT INTO invoices (invoice_number, issuer_id, recipient_id, job_id, amount, status, due_date)
         VALUES (?, ?, ?, ?, ?, 'paid', date('now'))`,
      ).run(`INV-${hiringId}-${Date.now()}`, hiring.worker_id, hiring.employer_id, hiring.job_id, amount);
    }
  });
  tx();

  if (amount > 0) {
    notify(hiring.worker_id, 'payment', 'Payment received',
      `You earned KES ${amount.toLocaleString()} for a completed job - it's now in your wallet.`,
      'dashboard/payments.html');
  }
  notify(hiring.worker_id, 'system', 'Job completed',
    'An engagement was marked complete. You can now leave a review.', 'dashboard/reviews.html');
  return ok(res, { message: 'Engagement completed and payment settled', data: { amount } });
}

// POST /applications/status  (employer updates an application's status)
export async function setStatus(req, res) {
  const b = req.body || {};
  const appId = Number(b.application_id || b.id);
  const status = String(b.status || '');
  if (!['pending', 'hired', 'rejected', 'withdrawn'].includes(status)) {
    throw ApiError.badRequest('Invalid status');
  }
  const application = db.prepare('SELECT * FROM applications WHERE id = ?').get(appId);
  if (!application) throw ApiError.notFound('Application not found');
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(application.job_id);

  const isOwner = job.employer_id === req.user.id;
  const isApplicant = application.worker_id === req.user.id;
  if (!isOwner && !isApplicant && req.user.role !== 'admin') {
    throw ApiError.forbidden('Not allowed');
  }
  db.prepare("UPDATE applications SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, appId);
  return ok(res, { message: 'Application updated' });
}
