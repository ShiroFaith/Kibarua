import { verifyToken } from '../utils/token.js';
import ApiError from '../utils/apiError.js';
import * as Users from '../models/userModel.js';

/**
 * Pull a JWT from the Authorization header (`Bearer <token>`) or, as a
 * fallback, from a `?token=` query param - several frontend pages pass it that
 * way to avoid a CORS preflight.
 */
function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  if (req.query && req.query.token) return String(req.query.token);
  if (req.body && req.body.token && typeof req.body.token === 'string') return req.body.token;
  return null;
}

/** Require a valid token; attaches req.user (full row) and req.auth (claims). */
export function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) throw ApiError.unauthorized('Authentication required');

    const claims = verifyToken(token);
    const user = Users.findById(claims.user_id || claims.id);
    if (!user) throw ApiError.unauthorized('User no longer exists');
    if (!user.is_active) throw ApiError.forbidden('Account is disabled');

    req.auth = claims;
    req.user = user;
    next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    return next(ApiError.unauthorized('Invalid or expired token'));
  }
}

/** Attach req.user if a valid token is present, but don't fail if it isn't. */
export function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const claims = verifyToken(token);
    const user = Users.findById(claims.user_id || claims.id);
    if (user && user.is_active) {
      req.auth = claims;
      req.user = user;
    }
  } catch {
    /* ignore - treat as anonymous */
  }
  next();
}

/** Restrict a route to specific roles. Use after requireAuth. */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized('Authentication required'));
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('You do not have permission to perform this action'));
    }
    next();
  };
}
