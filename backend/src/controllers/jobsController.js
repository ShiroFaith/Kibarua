import db from '../db/connection.js';
import { ok, created, pageParams, paginate } from '../utils/response.js';
import { parseJson, toStringArray, toBit } from '../utils/helpers.js';
import ApiError from '../utils/apiError.js';
import { JOB_CATEGORIES } from '../utils/categories.js';

/** Turn a raw job row (+ optional joined employer fields) into an API object. */
export function serializeJob(row) {
  if (!row) return null;
  return {
    ...row,
    required_skills: parseJson(row.required_skills, []),
    location_required: !!row.location_required,
    remote_allowed: !!row.remote_allowed,
    employer_name: row.employer_name || null,
    company_name: row.company_name || null,
  };
}

const JOB_WITH_EMPLOYER = `
  SELECT j.*, u.full_name AS employer_name, ep.company_name AS company_name
  FROM jobs j
  JOIN users u ON u.id = j.employer_id
  LEFT JOIN employer_profiles ep ON ep.user_id = j.employer_id
`;

// POST /jobs/create  (employer)
export async function create(req, res) {
  if (req.user.role !== 'employer') {
    throw ApiError.forbidden('Only employers can post jobs');
  }
  const b = req.body || {};
  const title = String(b.title || '').trim();
  const description = String(b.description || '').trim();

  const errors = {};
  if (title.length < 3) errors.title = 'Title must be at least 3 characters';
  if (description.length < 10) errors.description = 'Description must be at least 10 characters';
  if (Object.keys(errors).length) throw ApiError.badRequest('Validation failed', errors);

  const category = JOB_CATEGORIES.includes(b.category) ? b.category : 'other';
  const budgetType = b.budget_type === 'hourly' ? 'hourly' : 'fixed';

  const info = db.prepare(`
    INSERT INTO jobs (
      employer_id, title, description, category, experience_level, budget_type,
      budget_amount, budget_min, budget_max, currency, duration, deadline,
      required_skills, visibility, location_required, location_city,
      location_country, remote_allowed
    ) VALUES (
      @employer_id, @title, @description, @category, @experience_level, @budget_type,
      @budget_amount, @budget_min, @budget_max, @currency, @duration, @deadline,
      @required_skills, @visibility, @location_required, @location_city,
      @location_country, @remote_allowed
    )
  `).run({
    employer_id: req.user.id,
    title,
    description,
    category,
    experience_level: ['entry', 'intermediate', 'expert'].includes(b.experience_level)
      ? b.experience_level : 'entry',
    budget_type: budgetType,
    budget_amount: Number(b.budget_amount) || 0,
    budget_min: Number(b.budget_min) || 0,
    budget_max: Number(b.budget_max) || 0,
    currency: b.currency || 'KES',
    duration: b.duration || '',
    deadline: b.deadline || null,
    required_skills: JSON.stringify(toStringArray(b.required_skills)),
    visibility: b.visibility === 'private' ? 'private' : 'public',
    location_required: toBit(b.location_required),
    location_city: b.location_city || '',
    location_country: b.location_country || 'Kenya',
    remote_allowed: b.remote_allowed === undefined ? 1 : toBit(b.remote_allowed),
  });

  const job = db.prepare(`${JOB_WITH_EMPLOYER} WHERE j.id = ?`).get(info.lastInsertRowid);
  return created(res, { message: 'Job posted successfully', data: { job: serializeJob(job) } });
}

// GET /jobs/my-jobs  (employer)
export async function myJobs(req, res) {
  const rows = db
    .prepare(`${JOB_WITH_EMPLOYER} WHERE j.employer_id = ? ORDER BY j.created_at DESC`)
    .all(req.user.id);
  return ok(res, { message: 'OK', data: { jobs: rows.map(serializeJob) } });
}

// GET /jobs  (public list with basic filters)
export async function list(req, res) {
  const { page, limit, offset } = pageParams(req.query, 12);
  const where = ["j.visibility = 'public'", "j.status = 'open'"];
  const params = {};
  if (req.query.category) { where.push('j.category = @category'); params.category = req.query.category; }
  if (req.query.q) {
    where.push('(j.title LIKE @q OR j.description LIKE @q)');
    params.q = `%${req.query.q}%`;
  }
  const whereSql = `WHERE ${where.join(' AND ')}`;

  const total = db.prepare(`SELECT COUNT(*) AS n FROM jobs j ${whereSql}`).get(params).n;
  const rows = db
    .prepare(`${JOB_WITH_EMPLOYER} ${whereSql} ORDER BY j.created_at DESC LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit, offset });

  return ok(res, {
    message: 'OK',
    data: { jobs: rows.map(serializeJob) },
    extra: { pagination: paginate(total, page, limit) },
  });
}

// GET /jobs/:id
export async function getOne(req, res) {
  const id = Number(req.params.id || req.query.id);
  const row = db.prepare(`${JOB_WITH_EMPLOYER} WHERE j.id = ?`).get(id);
  if (!row) throw ApiError.notFound('Job not found');
  db.prepare('UPDATE jobs SET views_count = views_count + 1 WHERE id = ?').run(id);
  return ok(res, { message: 'OK', data: { job: serializeJob(row) } });
}

// DELETE /jobs/delete?id=  (owner only)
export async function remove(req, res) {
  const id = Number(req.query.id || (req.body && req.body.id) || req.params.id);
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
  if (!job) throw ApiError.notFound('Job not found');
  if (job.employer_id !== req.user.id && req.user.role !== 'admin') {
    throw ApiError.forbidden('You can only delete your own jobs');
  }
  db.prepare('DELETE FROM jobs WHERE id = ?').run(id);
  return ok(res, { message: 'Job deleted successfully' });
}

// POST /jobs/save?id=  (worker bookmarks a job)
export async function save(req, res) {
  const id = Number(req.query.id || (req.body && req.body.id) || req.params.id);
  const job = db.prepare('SELECT id FROM jobs WHERE id = ?').get(id);
  if (!job) throw ApiError.notFound('Job not found');
  db.prepare('INSERT OR IGNORE INTO saved_jobs (user_id, job_id) VALUES (?, ?)').run(req.user.id, id);
  return ok(res, { message: 'Job saved' });
}

// GET /jobs/saved  (worker's bookmarks)
export async function saved(req, res) {
  const rows = db.prepare(`
    ${JOB_WITH_EMPLOYER}
    JOIN saved_jobs sj ON sj.job_id = j.id
    WHERE sj.user_id = ?
    ORDER BY sj.created_at DESC
  `).all(req.user.id);
  return ok(res, { message: 'OK', data: { jobs: rows.map(serializeJob) } });
}
