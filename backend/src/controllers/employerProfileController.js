import db from '../db/connection.js';
import { ok } from '../utils/response.js';
import ApiError from '../utils/apiError.js';

/** Ensure an employer_profiles row exists for the user, then return it. */
function ensureProfileRow(userId) {
  db.prepare('INSERT OR IGNORE INTO employer_profiles (user_id) VALUES (?)').run(userId);
  return db.prepare('SELECT * FROM employer_profiles WHERE user_id = ?').get(userId);
}

/** Flatten users + employer_profiles into the object the frontend expects. */
function serializeProfile(user, profile) {
  return {
    user_id: user.id,
    full_name: user.full_name,
    email: user.email,
    phone: profile.phone || user.phone || '',
    company_name: profile.company_name || '',
    description: profile.description || '',
    business_type: profile.business_type || '',
    logo_url: profile.logo_url || '',
    jobs_completed: profile.jobs_completed || 0,
    avg_rating: profile.avg_rating || 0,
    total_reviews: profile.total_reviews || 0,
  };
}

// GET /employer-profile/get  - the authenticated employer's own profile.
export async function get(req, res) {
  const profile = ensureProfileRow(req.user.id);
  const data = serializeProfile(req.user, profile);
  return ok(res, { message: 'OK', data, extra: { profile: data } });
}

// POST /employer-profile/update
export async function update(req, res) {
  ensureProfileRow(req.user.id);
  const b = req.body || {};

  const fields = {
    company_name: b.company_name !== undefined ? String(b.company_name) : undefined,
    description: b.description !== undefined ? String(b.description) : undefined,
    business_type: b.business_type !== undefined ? String(b.business_type) : undefined,
    phone: b.phone !== undefined ? String(b.phone) : undefined,
    logo_url: b.logo_url !== undefined ? String(b.logo_url) : undefined,
  };
  const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));

  if (Object.keys(clean).length) {
    const setClause = Object.keys(clean).map((k) => `${k} = @${k}`).join(', ');
    db.prepare(
      `UPDATE employer_profiles SET ${setClause}, updated_at = datetime('now') WHERE user_id = @user_id`,
    ).run({ ...clean, user_id: req.user.id });
  }

  const updated = db.prepare('SELECT * FROM employer_profiles WHERE user_id = ?').get(req.user.id);
  const data = serializeProfile(req.user, updated);
  return ok(res, { message: 'Profile updated successfully', data, extra: { profile: data } });
}

// GET /employer-profile/view?id=  - public view of any employer.
export async function view(req, res) {
  const id = Number(req.query.id || req.params.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user || user.role !== 'employer') throw ApiError.notFound('Employer not found');
  const profile = ensureProfileRow(id);
  const data = serializeProfile(user, profile);
  return ok(res, { message: 'OK', data, extra: { profile: data } });
}
