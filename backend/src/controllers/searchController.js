import db from '../db/connection.js';
import { ok, pageParams } from '../utils/response.js';
import { serializeJob } from './jobsController.js';
import { parseJson } from '../utils/helpers.js';
import { JOB_CATEGORIES, CATEGORY_LABELS } from '../utils/categories.js';

const DEFAULT_DURATIONS = [
  'less_than_week', '1_to_4_weeks', '1_to_3_months', '3_to_6_months', 'more_than_6_months',
];

/** Split a comma-joined param (e.g. "entry,expert") into a clean array. */
function splitCsv(value) {
  if (!value) return [];
  return String(value).split(',').map((s) => s.trim()).filter(Boolean);
}

/** Build a `col IN (@p0,@p1,...)` clause and merge its params. */
function inClause(col, values, params, prefix) {
  const keys = values.map((v, i) => {
    const key = `${prefix}${i}`;
    params[key] = v;
    return `@${key}`;
  });
  return `${col} IN (${keys.join(', ')})`;
}

// GET /search/filters
export async function filters(req, res) {
  const durationRows = db
    .prepare("SELECT DISTINCT duration FROM jobs WHERE duration IS NOT NULL AND duration != ''")
    .all()
    .map((r) => r.duration);
  const locationRows = db
    .prepare("SELECT DISTINCT location_city FROM jobs WHERE location_city IS NOT NULL AND location_city != ''")
    .all()
    .map((r) => r.location_city);

  const data = {
    categories: JOB_CATEGORIES,
    category_options: JOB_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] || c })),
    durations: durationRows.length ? durationRows : DEFAULT_DURATIONS,
    locations: ['Remote', ...locationRows.filter((l) => l.toLowerCase() !== 'remote')],
    experience_levels: ['entry', 'intermediate', 'expert'],
    budget_types: ['fixed', 'hourly'],
  };
  return ok(res, { message: 'OK', data, extra: { filters: data } });
}

// GET /search/suggestions?q=&limit=8
export async function suggestions(req, res) {
  const q = String(req.query.q || '').trim();
  const { limit } = pageParams({ limit: req.query.limit }, 8);
  if (q.length < 1) return ok(res, { message: 'OK', data: [] });

  const like = `%${q}%`;
  const out = [];
  const seen = new Set();
  const push = (suggestion, type, popularity) => {
    const key = `${type}:${suggestion.toLowerCase()}`;
    if (!suggestion || seen.has(key)) return;
    seen.add(key);
    out.push({ suggestion, type, popularity });
  };

  // Popular saved search terms first.
  db.prepare('SELECT term, kind, popularity FROM search_terms WHERE term LIKE ? ORDER BY popularity DESC LIMIT ?')
    .all(like, limit)
    .forEach((r) => push(r.term, r.kind || 'job', r.popularity));

  // Then live job titles.
  if (out.length < limit) {
    db.prepare(
      "SELECT title, proposals_count FROM jobs WHERE status = 'open' AND title LIKE ? ORDER BY proposals_count DESC LIMIT ?",
    )
      .all(like, limit)
      .forEach((r) => push(r.title, 'job', r.proposals_count || 0));
  }

  // Then worker professional titles.
  if (out.length < limit) {
    db.prepare(
      "SELECT DISTINCT professional_title FROM worker_profiles WHERE professional_title LIKE ? LIMIT ?",
    )
      .all(like, limit)
      .forEach((r) => push(r.professional_title, 'worker', 0));
  }

  const data = out.slice(0, limit);
  return ok(res, { message: 'OK', data, extra: { suggestions: data } });
}

/** Record/boost a search term so suggestions improve over time. */
function recordSearchTerm(term, kind) {
  const t = String(term || '').trim();
  if (t.length < 2) return;
  try {
    db.prepare(
      `INSERT INTO search_terms (term, kind, popularity) VALUES (?, ?, 1)
       ON CONFLICT (term) DO UPDATE SET popularity = popularity + 1`,
    ).run(t, kind);
  } catch {
    /* non-critical */
  }
}

function searchJobs(req) {
  const q = String(req.query.q || '').trim();
  const { page, limit, offset } = pageParams(req.query, 20);
  const where = ["j.visibility = 'public'", "j.status = 'open'"];
  const params = { limit, offset };

  if (q) {
    where.push('(j.title LIKE @q OR j.description LIKE @q OR j.required_skills LIKE @q)');
    params.q = `%${q}%`;
  }
  if (req.query.category) { where.push('j.category = @category'); params.category = req.query.category; }
  if (req.query.duration) { where.push('j.duration = @duration'); params.duration = req.query.duration; }
  if (req.query.location) {
    where.push('j.location_city LIKE @location');
    params.location = `%${req.query.location}%`;
  }
  if (req.query.remote_only === 'true' || req.query.remote_only === '1') {
    where.push('j.remote_allowed = 1');
  }

  const expLevels = splitCsv(req.query.experience_level);
  if (expLevels.length) where.push(inClause('j.experience_level', expLevels, params, 'exp'));

  const budgetTypes = splitCsv(req.query.budget_type);
  if (budgetTypes.length) where.push(inClause('j.budget_type', budgetTypes, params, 'bt'));

  // Effective budget: fixed → budget_amount, hourly → budget_min.
  const effBudget = "(CASE WHEN j.budget_type = 'fixed' THEN j.budget_amount ELSE j.budget_min END)";
  if (req.query.budget_min) { where.push(`${effBudget} >= @budget_min`); params.budget_min = Number(req.query.budget_min); }
  if (req.query.budget_max) { where.push(`${effBudget} <= @budget_max`); params.budget_max = Number(req.query.budget_max); }
  if (req.query.min_rating) { where.push('COALESCE(ep.avg_rating, 0) >= @min_rating'); params.min_rating = Number(req.query.min_rating); }

  const orderMap = {
    highest_budget: `${effBudget} DESC`,
    lowest_budget: `${effBudget} ASC`,
    most_proposals: 'j.proposals_count DESC',
    best_rating: 'COALESCE(ep.avg_rating, 0) DESC',
  };
  const orderBy = orderMap[req.query.sort_by] || 'j.created_at DESC';

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const base = `
    FROM jobs j
    JOIN users u ON u.id = j.employer_id
    LEFT JOIN employer_profiles ep ON ep.user_id = j.employer_id
    ${whereSql}
  `;
  const total = db.prepare(`SELECT COUNT(*) AS n ${base}`).get(params).n;
  const rows = db
    .prepare(
      `SELECT j.*, u.full_name AS employer_name, ep.company_name AS company_name, ep.avg_rating AS employer_rating
       ${base} ORDER BY ${orderBy} LIMIT @limit OFFSET @offset`,
    )
    .all(params)
    .map(serializeJob);

  if (q) recordSearchTerm(q, 'job');
  return { total, total_pages: Math.max(1, Math.ceil(total / limit)), page, jobs: rows };
}

function searchWorkers(req) {
  const q = String(req.query.q || '').trim();
  const { page, limit, offset } = pageParams(req.query, 20);
  const where = ["u.role = 'worker'", 'u.is_active = 1'];
  const params = { limit, offset };

  if (q) {
    where.push('(u.full_name LIKE @q OR wp.professional_title LIKE @q OR wp.headline LIKE @q OR wp.bio LIKE @q OR wp.skills LIKE @q)');
    params.q = `%${q}%`;
  }
  if (req.query.location) {
    where.push('wp.location_city LIKE @location');
    params.location = `%${req.query.location}%`;
  }
  if (req.query.remote_only === 'true' || req.query.remote_only === '1') {
    where.push('wp.open_to_remote = 1');
  }
  const expLevels = splitCsv(req.query.experience_level);
  if (expLevels.length) where.push(inClause('wp.experience_level', expLevels, params, 'exp'));
  if (req.query.min_rating) { where.push('COALESCE(wp.avg_rating, 0) >= @min_rating'); params.min_rating = Number(req.query.min_rating); }
  if (req.query.budget_min) { where.push('COALESCE(wp.hourly_rate, 0) >= @budget_min'); params.budget_min = Number(req.query.budget_min); }
  if (req.query.budget_max) { where.push('COALESCE(wp.hourly_rate, 0) <= @budget_max'); params.budget_max = Number(req.query.budget_max); }

  const orderBy = req.query.sort_by === 'best_rating'
    ? 'COALESCE(wp.avg_rating, 0) DESC'
    : 'u.created_at DESC';

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const base = `
    FROM users u
    JOIN worker_profiles wp ON wp.user_id = u.id
    ${whereSql}
  `;
  const total = db.prepare(`SELECT COUNT(*) AS n ${base}`).get(params).n;
  const rows = db
    .prepare(`SELECT u.id, u.full_name AS name, u.avatar_url, wp.* ${base} ORDER BY ${orderBy} LIMIT @limit OFFSET @offset`)
    .all(params)
    .map((w) => ({
      id: w.user_id,
      name: w.name,
      professional_title: w.professional_title || '',
      headline: w.headline || '',
      bio: w.bio || '',
      experience_level: w.experience_level || 'entry',
      avg_rating: w.avg_rating || 0,
      total_reviews: w.total_reviews || 0,
      open_to_remote: !!w.open_to_remote,
      hourly_rate: w.hourly_rate || 0,
      location_city: w.location_city || '',
      skills: parseJson(w.skills, []),
      avatar_url: w.avatar_url || '',
    }));

  if (q) recordSearchTerm(q, 'worker');
  return { total, total_pages: Math.max(1, Math.ceil(total / limit)), page, workers: rows };
}

// GET /search/jobs
export async function jobs(req, res) {
  const result = searchJobs(req);
  return ok(res, { message: 'OK', data: result, extra: result });
}

// GET /search/workers
export async function workers(req, res) {
  const result = searchWorkers(req);
  return ok(res, { message: 'OK', data: result, extra: result });
}

// GET /search/global
export async function global(req, res) {
  const j = searchJobs(req);
  const w = searchWorkers(req);
  const data = {
    jobs_total: j.total,
    workers_total: w.total,
    jobs: j.jobs,
    workers: w.workers,
  };
  return ok(res, { message: 'OK', data, extra: data });
}
