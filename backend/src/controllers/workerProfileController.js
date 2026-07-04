import db from '../db/connection.js';
import { ok } from '../utils/response.js';
import { parseJson, toStringArray } from '../utils/helpers.js';
import { fileUrl } from '../middleware/upload.js';
import ApiError from '../utils/apiError.js';

const AVAILABILITY = ['available', 'partially_available', 'unavailable'];

/** Ensure a worker_profiles row exists for the user, then return it. */
function ensureProfileRow(userId) {
  db.prepare('INSERT OR IGNORE INTO worker_profiles (user_id) VALUES (?)').run(userId);
  return db.prepare('SELECT * FROM worker_profiles WHERE user_id = ?').get(userId);
}

/**
 * Weighted profile-completion score. Returns 0–100 based on how many of the
 * key profile fields the worker has filled in.
 */
function computeCompletion(profile) {
  const checks = [
    !!profile.headline,
    !!profile.bio,
    Number(profile.hourly_rate) > 0,
    Number(profile.experience_years) > 0,
    toStringArray(profile.skills).length > 0,
    toStringArray(profile.languages).length > 0,
    !!profile.location_city,
    !!profile.availability_status,
    !!profile.portfolio_url,
    !!profile.profile_photo_url,
  ];
  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
}

/** Flatten users + worker_profiles into the object the frontend expects. */
function serializeProfile(user, profile) {
  return {
    user_id: user.id,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone || '',
    avatar_url: user.avatar_url || '',
    professional_title: profile.professional_title || '',
    headline: profile.headline || '',
    bio: profile.bio || '',
    hourly_rate: profile.hourly_rate || 0,
    experience_years: profile.experience_years || 0,
    experience_level: profile.experience_level || 'entry',
    portfolio_url: profile.portfolio_url || '',
    availability_status: profile.availability_status || 'available',
    open_to_remote: !!profile.open_to_remote,
    location_city: profile.location_city || '',
    location_state: profile.location_state || '',
    location_country: profile.location_country || 'Kenya',
    skills: parseJson(profile.skills, []),
    languages: parseJson(profile.languages, []),
    certifications: parseJson(profile.certifications, []),
    profile_photo_url: profile.profile_photo_url || '',
    avg_rating: profile.avg_rating || 0,
    total_reviews: profile.total_reviews || 0,
    completion_percentage: profile.completion_percentage || 0,
  };
}

// GET /worker-profile/get  - the authenticated worker's own profile.
export async function get(req, res) {
  const user = req.user;
  const profile = ensureProfileRow(user.id);
  const data = serializeProfile(user, profile);
  return ok(res, { message: 'OK', data, extra: { profile: data } });
}

// POST /worker-profile/update  - multipart/form-data.
export async function update(req, res) {
  const user = req.user;
  ensureProfileRow(user.id);
  const b = req.body || {};

  const fields = {
    headline: b.headline !== undefined ? String(b.headline) : undefined,
    professional_title: b.professional_title !== undefined ? String(b.professional_title) : undefined,
    bio: b.bio !== undefined ? String(b.bio) : undefined,
    hourly_rate: b.hourly_rate !== undefined ? Number(b.hourly_rate) || 0 : undefined,
    experience_years: b.experience_years !== undefined ? parseInt(b.experience_years, 10) || 0 : undefined,
    portfolio_url: b.portfolio_url !== undefined ? String(b.portfolio_url) : undefined,
    availability_status: AVAILABILITY.includes(b.availability_status) ? b.availability_status : undefined,
    location_city: b.location_city !== undefined ? String(b.location_city) : undefined,
    location_state: b.location_state !== undefined ? String(b.location_state) : undefined,
    location_country: b.location_country !== undefined ? String(b.location_country) : undefined,
  };

  // Arrays arrive as JSON strings inside the multipart form.
  if (b.skills !== undefined) fields.skills = JSON.stringify(toStringArray(b.skills));
  if (b.languages !== undefined) fields.languages = JSON.stringify(toStringArray(b.languages));
  if (b.certifications !== undefined) {
    fields.certifications = JSON.stringify(toStringArray(b.certifications));
  }

  // Uploaded photo (multer put it on req.file).
  if (req.file) fields.profile_photo_url = fileUrl(req, req.file.filename);

  // Drop untouched fields.
  const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));

  if (Object.keys(clean).length) {
    const setClause = Object.keys(clean).map((k) => `${k} = @${k}`).join(', ');
    db.prepare(
      `UPDATE worker_profiles SET ${setClause}, updated_at = datetime('now') WHERE user_id = @user_id`,
    ).run({ ...clean, user_id: user.id });
  }

  // Recompute completion from the freshly-updated row.
  const updated = db.prepare('SELECT * FROM worker_profiles WHERE user_id = ?').get(user.id);
  const completion = computeCompletion(updated);
  db.prepare('UPDATE worker_profiles SET completion_percentage = ? WHERE user_id = ?').run(
    completion,
    user.id,
  );
  updated.completion_percentage = completion;

  const data = serializeProfile(user, updated);
  return ok(res, { message: 'Profile updated successfully', data, extra: { profile: data } });
}

// GET /worker-profile/view?id=  - public view of any worker's profile.
export async function view(req, res) {
  const id = Number(req.query.id || req.params.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user || user.role !== 'worker') throw ApiError.notFound('Worker not found');
  const profile = ensureProfileRow(id);
  const data = serializeProfile(user, profile);
  return ok(res, { message: 'OK', data, extra: { profile: data } });
}

export { serializeProfile };
