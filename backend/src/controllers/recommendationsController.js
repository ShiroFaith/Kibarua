import db from '../db/connection.js';
import { ok, pageParams } from '../utils/response.js';
import { parseJson } from '../utils/helpers.js';

/**
 * Score how well an open job matches a worker. Combines skill overlap (the
 * dominant signal), experience-level fit, and a small freshness/demand nudge.
 * Returns { score, reason } with score clamped to 0–100.
 */
function scoreJob(job, worker) {
  const jobSkills = parseJson(job.required_skills, []).map((s) => String(s).toLowerCase());
  const workerSkills = new Set(worker.skills.map((s) => String(s).toLowerCase()));

  let score = 40; // baseline for any open job
  const matched = jobSkills.filter((s) => workerSkills.has(s));

  if (jobSkills.length) {
    score = Math.round((matched.length / jobSkills.length) * 60);
    score += matched.length ? 20 : 0; // bonus for any overlap at all
  }

  if (job.experience_level && worker.experience_level === job.experience_level) score += 12;
  if (job.remote_allowed && worker.open_to_remote) score += 8;
  score = Math.max(5, Math.min(100, score));

  let reason;
  if (matched.length) {
    reason = `Matches your skills: ${matched.slice(0, 4).join(', ')}`;
  } else if (job.experience_level === worker.experience_level) {
    reason = `Suits your ${worker.experience_level} experience level`;
  } else {
    reason = 'Recently posted in a category you may like';
  }
  return { score, reason };
}

// POST /recommendations/generate  - (re)build recommendations for the worker.
export async function generate(req, res) {
  const me = req.user.id;
  const profile =
    db.prepare('SELECT * FROM worker_profiles WHERE user_id = ?').get(me) || {};
  const worker = {
    skills: parseJson(profile.skills, []),
    experience_level: profile.experience_level || 'entry',
    open_to_remote: !!profile.open_to_remote,
  };

  const openJobs = db
    .prepare("SELECT * FROM jobs WHERE status = 'open' AND visibility = 'public' ORDER BY created_at DESC LIMIT 200")
    .all();

  const scored = openJobs
    .map((job) => ({ job, ...scoreJob(job, worker) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);

  const upsert = db.prepare(
    `INSERT INTO recommendations (user_id, job_id, match_score, reason, is_viewed)
     VALUES (@user_id, @job_id, @match_score, @reason, 0)
     ON CONFLICT (user_id, job_id)
     DO UPDATE SET match_score = excluded.match_score, reason = excluded.reason`,
  );
  const tx = db.transaction((items) => {
    for (const it of items) {
      upsert.run({ user_id: me, job_id: it.job.id, match_score: it.score, reason: it.reason });
    }
  });
  tx(scored);

  return ok(res, {
    message: 'Recommendations refreshed',
    data: { generated: scored.length },
    extra: { count: scored.length },
  });
}

// GET /recommendations/get?limit=50
export async function get(req, res) {
  const me = req.user.id;
  const { limit } = pageParams({ limit: req.query.limit }, 50);

  const rows = db
    .prepare(
      `
      SELECT r.match_score, r.reason, r.is_viewed,
             j.id AS job_id, j.title, j.category, j.description, j.duration,
             j.budget_type, j.budget_amount, j.budget_min, j.budget_max,
             j.required_skills, j.proposals_count, j.experience_level, j.remote_allowed,
             u.full_name AS employer_name, ep.company_name AS company_name
      FROM recommendations r
      JOIN jobs j ON j.id = r.job_id
      JOIN users u ON u.id = j.employer_id
      LEFT JOIN employer_profiles ep ON ep.user_id = j.employer_id
      WHERE r.user_id = ? AND j.status = 'open'
      ORDER BY r.match_score DESC, j.created_at DESC
      LIMIT ?
    `,
    )
    .all(me, limit)
    .map((r) => ({
      job_id: r.job_id,
      title: r.title,
      category: r.category,
      description: r.description,
      duration: r.duration,
      budget_type: r.budget_type,
      budget_amount: r.budget_amount,
      budget_min: r.budget_min,
      budget_max: r.budget_max,
      required_skills: parseJson(r.required_skills, []),
      proposals_count: r.proposals_count || 0,
      experience_level: r.experience_level,
      remote_allowed: !!r.remote_allowed,
      employer_name: r.employer_name,
      company_name: r.company_name || r.employer_name,
      match_score: r.match_score,
      reason: r.reason || '',
    }));

  // Mark the surfaced recommendations as viewed.
  db.prepare('UPDATE recommendations SET is_viewed = 1 WHERE user_id = ?').run(me);

  return ok(res, {
    message: 'OK',
    data: { recommendations: rows },
    extra: { recommendations: rows },
  });
}

// GET /recommendations/stats
export async function stats(req, res) {
  const me = req.user.id;
  const row = db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN is_viewed = 1 THEN 1 ELSE 0 END) AS viewed,
              AVG(match_score) AS avg_score,
              MAX(match_score) AS best_score
       FROM recommendations WHERE user_id = ?`,
    )
    .get(me);

  const total = row.total || 0;
  const data = {
    total_recommendations: total,
    viewed_percentage: total ? Math.round(((row.viewed || 0) / total) * 100) : 0,
    average_match_score: row.avg_score ? Math.round(row.avg_score * 10) / 10 : 0,
    best_match_score: row.best_score || 0,
  };
  return ok(res, { message: 'OK', data, extra: { stats: data } });
}
