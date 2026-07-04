import db from '../db/connection.js';
import { ok, created, pageParams, paginate } from '../utils/response.js';
import { toBit } from '../utils/helpers.js';
import ApiError from '../utils/apiError.js';
import { notify } from '../services/notificationService.js';

/** The list/stats `type` param uses worker|employer; reviews store for_*. */
function reviewTypeFromParam(type) {
  return type === 'employer' ? 'for_employer' : 'for_worker';
}

/** Recompute a reviewee's cached rating aggregate after a review changes. */
function refreshRatingAggregate(revieweeId, reviewType) {
  const agg = db
    .prepare(
      'SELECT COUNT(*) AS n, AVG(rating) AS avg FROM reviews WHERE reviewee_id = ? AND review_type = ?',
    )
    .get(revieweeId, reviewType);
  const total = agg.n || 0;
  const avg = agg.avg ? Math.round(agg.avg * 100) / 100 : 0;

  if (reviewType === 'for_worker') {
    db.prepare('INSERT OR IGNORE INTO worker_profiles (user_id) VALUES (?)').run(revieweeId);
    db.prepare('UPDATE worker_profiles SET avg_rating = ?, total_reviews = ? WHERE user_id = ?').run(
      avg, total, revieweeId,
    );
  } else {
    db.prepare('INSERT OR IGNORE INTO employer_profiles (user_id) VALUES (?)').run(revieweeId);
    db.prepare('UPDATE employer_profiles SET avg_rating = ?, total_reviews = ? WHERE user_id = ?').run(
      avg, total, revieweeId,
    );
  }
}

// GET /reviews/worker  - list reviews about a user (worker or employer).
export async function listForUser(req, res) {
  const userId = Number(req.query.user_id) || req.user?.id;
  if (!userId) throw ApiError.badRequest('user_id is required');
  const reviewType = reviewTypeFromParam(req.query.type);
  const { page, limit, offset } = pageParams(req.query, 10);

  const params = { userId, reviewType, limit, offset };
  const total = db
    .prepare('SELECT COUNT(*) AS n FROM reviews WHERE reviewee_id = @userId AND review_type = @reviewType')
    .get(params).n;

  const rows = db
    .prepare(
      `
      SELECT r.*,
             reviewer.full_name AS reviewer_name,
             reviewee.full_name AS reviewee_name,
             (SELECT COUNT(*) FROM review_votes v WHERE v.review_id = r.id AND v.is_helpful = 1) AS is_helpful,
             (SELECT COUNT(*) FROM review_votes v WHERE v.review_id = r.id AND v.is_helpful = 0) AS is_unhelpful
      FROM reviews r
      JOIN users reviewer ON reviewer.id = r.reviewer_id
      JOIN users reviewee ON reviewee.id = r.reviewee_id
      WHERE r.reviewee_id = @userId AND r.review_type = @reviewType
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT @limit OFFSET @offset
    `,
    )
    .all(params)
    .map((r) => ({
      ...r,
      has_response: !!(r.response_text && r.response_text.trim()),
      reviewer_name: r.reviewer_name || 'Anonymous',
    }));

  return ok(res, {
    message: 'OK',
    data: rows,
    extra: { pagination: paginate(total, page, limit), reviews: rows },
  });
}

// GET /reviews/stats
export async function stats(req, res) {
  const userId = Number(req.query.user_id) || req.user?.id;
  if (!userId) throw ApiError.badRequest('user_id is required');
  const reviewType = reviewTypeFromParam(req.query.type);

  const row = db
    .prepare(
      `
      SELECT COUNT(*)                 AS total_reviews,
             AVG(rating)              AS average_rating,
             AVG(quality_rating)      AS quality,
             AVG(communication_rating) AS communication,
             AVG(timeliness_rating)   AS timeliness,
             AVG(professionalism_rating) AS professionalism,
             SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS star5,
             SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS star4,
             SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS star3,
             SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS star2,
             SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS star1
      FROM reviews WHERE reviewee_id = ? AND review_type = ?
    `,
    )
    .get(userId, reviewType);

  const round1 = (v) => (v ? Math.round(v * 10) / 10 : 0);
  const data = {
    total_reviews: row.total_reviews || 0,
    average_rating: round1(row.average_rating),
    category_ratings: {
      quality: round1(row.quality),
      communication: round1(row.communication),
      timeliness: round1(row.timeliness),
      professionalism: round1(row.professionalism),
    },
    rating_breakdown: {
      5: row.star5 || 0,
      4: row.star4 || 0,
      3: row.star3 || 0,
      2: row.star2 || 0,
      1: row.star1 || 0,
    },
  };
  return ok(res, { message: 'OK', data, extra: { stats: data } });
}

// POST /reviews/submit
export async function submit(req, res) {
  const b = req.body || {};
  const revieweeId = Number(b.reviewee_id);
  const rating = parseInt(b.rating, 10);
  const reviewType = b.review_type === 'for_employer' ? 'for_employer' : 'for_worker';

  if (!revieweeId) throw ApiError.badRequest('reviewee_id is required');
  if (!(rating >= 1 && rating <= 5)) throw ApiError.badRequest('Rating must be between 1 and 5');
  if (revieweeId === req.user.id) throw ApiError.badRequest('You cannot review yourself');

  const reviewee = db.prepare('SELECT id FROM users WHERE id = ?').get(revieweeId);
  if (!reviewee) throw ApiError.notFound('The person you are reviewing does not exist');

  const subRating = (v) => {
    const n = parseInt(v, 10);
    return n >= 1 && n <= 5 ? n : null;
  };

  const info = db
    .prepare(
      `
      INSERT INTO reviews (
        hiring_id, job_id, reviewer_id, reviewee_id, review_type, rating, title, description,
        quality_rating, communication_rating, timeliness_rating, professionalism_rating
      ) VALUES (
        @hiring_id, @job_id, @reviewer_id, @reviewee_id, @review_type, @rating, @title, @description,
        @quality_rating, @communication_rating, @timeliness_rating, @professionalism_rating
      )
    `,
    )
    .run({
      hiring_id: Number(b.hiring_id) || null,
      job_id: Number(b.job_id) || null,
      reviewer_id: req.user.id,
      reviewee_id: revieweeId,
      review_type: reviewType,
      rating,
      title: String(b.title || ''),
      description: String(b.description || ''),
      quality_rating: subRating(b.quality_rating),
      communication_rating: subRating(b.communication_rating),
      timeliness_rating: subRating(b.timeliness_rating),
      professionalism_rating: subRating(b.professionalism_rating),
    });

  refreshRatingAggregate(revieweeId, reviewType);
  notify(revieweeId, 'review', 'New review received',
    `${req.user.full_name} left you a ${rating}-star review`, 'dashboard/reviews.html');

  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(info.lastInsertRowid);
  return created(res, { message: 'Review submitted successfully', data: { review } });
}

// POST /reviews/respond  - the reviewee replies to a review about them.
export async function respond(req, res) {
  const b = req.body || {};
  const reviewId = Number(b.review_id);
  const text = String(b.response || b.response_text || '').trim();
  if (!reviewId) throw ApiError.badRequest('review_id is required');
  if (!text) throw ApiError.badRequest('Response text is required');

  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(reviewId);
  if (!review) throw ApiError.notFound('Review not found');
  if (review.reviewee_id !== req.user.id && req.user.role !== 'admin') {
    throw ApiError.forbidden('You can only respond to reviews about you');
  }

  db.prepare("UPDATE reviews SET response_text = ?, response_at = datetime('now') WHERE id = ?").run(
    text, reviewId,
  );
  return ok(res, { message: 'Response posted' });
}

// POST /reviews/helpful  - vote a review helpful / unhelpful.
export async function helpful(req, res) {
  const b = req.body || {};
  const reviewId = Number(b.review_id);
  const isHelpful = toBit(b.is_helpful);
  if (!reviewId) throw ApiError.badRequest('review_id is required');

  const review = db.prepare('SELECT id FROM reviews WHERE id = ?').get(reviewId);
  if (!review) throw ApiError.notFound('Review not found');

  // One vote per user; a repeat vote updates the stance.
  db.prepare(
    `INSERT INTO review_votes (review_id, user_id, is_helpful) VALUES (?, ?, ?)
     ON CONFLICT (review_id, user_id) DO UPDATE SET is_helpful = excluded.is_helpful`,
  ).run(reviewId, req.user.id, isHelpful);

  const counts = db
    .prepare(
      `SELECT
         SUM(CASE WHEN is_helpful = 1 THEN 1 ELSE 0 END) AS is_helpful,
         SUM(CASE WHEN is_helpful = 0 THEN 1 ELSE 0 END) AS is_unhelpful
       FROM review_votes WHERE review_id = ?`,
    )
    .get(reviewId);

  return ok(res, {
    message: 'Thanks for your feedback',
    data: { is_helpful: counts.is_helpful || 0, is_unhelpful: counts.is_unhelpful || 0 },
  });
}

// POST /reviews/dispute  - flag a review for moderation.
export async function dispute(req, res) {
  const b = req.body || {};
  const reviewId = Number(b.review_id);
  if (!reviewId) throw ApiError.badRequest('review_id is required');

  const review = db.prepare('SELECT id FROM reviews WHERE id = ?').get(reviewId);
  if (!review) throw ApiError.notFound('Review not found');

  db.prepare(
    `INSERT INTO review_disputes (review_id, raised_by, reason, description)
     VALUES (?, ?, ?, ?)`,
  ).run(reviewId, req.user.id, String(b.reason || 'other'), String(b.description || ''));

  return created(res, { message: 'Review reported. Our team will review it shortly.' });
}
