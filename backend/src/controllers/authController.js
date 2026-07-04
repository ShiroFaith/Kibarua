import crypto from 'node:crypto';
import * as Users from '../models/userModel.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signToken } from '../utils/token.js';
import { isEmail } from '../utils/helpers.js';
import { ok, created } from '../utils/response.js';
import ApiError from '../utils/apiError.js';
import { provisionUser } from '../services/provisioning.js';
import config from '../config/index.js';

/** Normalise the role sent by the frontend (which uses `employee` in places). */
function normaliseRole(role) {
  const r = String(role || 'worker').toLowerCase();
  if (r === 'employee') return 'worker';
  if (['worker', 'employer'].includes(r)) return r;
  return 'worker'; // never allow self-registering as admin
}

/** Derive a unique username from a preferred value or the email local part. */
function uniqueUsername(preferred, email) {
  let base = (preferred || (email ? email.split('@')[0] : 'user'))
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '')
    .slice(0, 40) || 'user';
  let candidate = base;
  let n = 1;
  while (Users.findByUsername(candidate)) {
    candidate = `${base}${n++}`;
  }
  return candidate;
}

/** Shape the auth payload so every frontend client finds token/user where it looks. */
function authPayload(user) {
  const token = signToken(user);
  const publicUser = Users.toPublic(user);
  return { token, user: publicUser };
}

// POST /auth/register
export async function register(req, res) {
  const body = req.body || {};
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const confirm = body.confirm_password;
  // Accept both `full_name` and `name`.
  const fullName = String(body.full_name || body.name || '').trim();
  const role = normaliseRole(body.role);
  const phone = body.phone ? String(body.phone).trim() : null;

  const errors = {};
  if (!fullName) errors.full_name = 'Full name is required';
  if (!isEmail(email)) errors.email = 'A valid email is required';
  if (password.length < 6) errors.password = 'Password must be at least 6 characters';
  if (confirm !== undefined && confirm !== null && confirm !== '' && confirm !== password) {
    errors.confirm_password = 'Passwords do not match';
  }
  if (Object.keys(errors).length) throw ApiError.badRequest('Validation failed', errors);

  if (Users.findByEmail(email)) {
    throw ApiError.conflict('Email already registered', { email: 'Email already registered' });
  }

  const username = uniqueUsername(body.username, email);
  const user = Users.create({
    username,
    email,
    password_hash: await hashPassword(password),
    full_name: fullName,
    role,
    phone,
    email_verify_token: crypto.randomBytes(24).toString('hex'),
  });
  provisionUser(user);

  const { token, user: publicUser } = authPayload(user);
  return created(res, {
    message: 'Registration successful. Please verify your email to activate your account.',
    data: { user: publicUser, token },
    extra: { token, user: publicUser },
  });
}

// POST /auth/login
export async function login(req, res) {
  const body = req.body || {};
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!email || !password) {
    throw ApiError.badRequest('Email and password are required');
  }

  const user = Users.findByEmail(email);
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (!user.is_active) throw ApiError.forbidden('Account is disabled');

  const { token, user: publicUser } = authPayload(user);
  return ok(res, {
    message: 'Login successful',
    data: { token, user: publicUser },
    extra: { token, user: publicUser },
  });
}

// POST /auth/logout - JWTs are stateless, so this just acknowledges.
export async function logout(req, res) {
  return ok(res, { message: 'Logged out successfully' });
}

// GET /auth/me  &  GET /auth/profile
export async function me(req, res) {
  const publicUser = Users.toPublic(req.user);
  return ok(res, { message: 'OK', data: { user: publicUser }, extra: { user: publicUser } });
}

// POST /auth/change-password  (authenticated - verifies the current password)
export async function changePassword(req, res) {
  const body = req.body || {};
  const current = String(body.current_password || body.old_password || '');
  const next = String(body.new_password || body.password || '');
  const confirm = body.confirm_password;

  if (!current) throw ApiError.badRequest('Current password is required');
  if (next.length < 6) throw ApiError.badRequest('New password must be at least 6 characters');
  if (confirm !== undefined && confirm !== null && confirm !== '' && confirm !== next) {
    throw ApiError.badRequest('Passwords do not match');
  }

  if (!(await verifyPassword(current, req.user.password_hash))) {
    throw ApiError.badRequest('Current password is incorrect');
  }

  Users.update(req.user.id, { password_hash: await hashPassword(next) });
  return ok(res, { message: 'Password changed successfully' });
}

// POST /auth/verify-email
export async function verifyEmail(req, res) {
  const token = String((req.body && req.body.token) || req.query.token || '');
  if (!token) throw ApiError.badRequest('Verification token is required');

  const user = Users.findByVerifyToken(token);
  if (!user) throw ApiError.badRequest('Invalid or expired verification token');

  Users.update(user.id, { is_verified: 1, email_verify_token: null });
  return ok(res, { message: 'Email verified successfully. You can now log in.' });
}

// POST /auth/forgot-password  &  POST /auth/request-reset
export async function requestReset(req, res) {
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  if (!isEmail(email)) throw ApiError.badRequest('A valid email is required');

  const user = Users.findByEmail(email);
  // Always respond success to avoid leaking which emails exist.
  const responseMsg = 'If an account exists for that email, a reset link has been sent.';

  if (user) {
    const token = crypto.randomBytes(24).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');
    Users.update(user.id, { reset_token: token, reset_token_expires: expires });

    // No mail service is configured; in development we surface the token so the
    // reset flow is testable end-to-end.
    if (config.env !== 'production') {
      return ok(res, {
        message: responseMsg,
        data: { reset_token: token, expires_at: expires },
      });
    }
  }
  return ok(res, { message: responseMsg });
}

// POST /auth/verify-reset-token
export async function verifyResetToken(req, res) {
  const token = String((req.body && req.body.token) || req.query.token || '');
  const user = token ? Users.findByResetToken(token) : null;
  const valid = !!user && new Date(user.reset_token_expires) > new Date();
  if (!valid) throw ApiError.badRequest('Invalid or expired reset token');
  return ok(res, { message: 'Token is valid', data: { valid: true } });
}

// POST /auth/reset-password
export async function resetPassword(req, res) {
  const body = req.body || {};
  const token = String(body.token || '');
  const password = String(body.password || '');
  const confirm = body.confirm_password;

  if (!token) throw ApiError.badRequest('Reset token is required');
  if (password.length < 6) throw ApiError.badRequest('Password must be at least 6 characters');
  if (confirm !== undefined && confirm !== null && confirm !== password) {
    throw ApiError.badRequest('Passwords do not match');
  }

  const user = Users.findByResetToken(token);
  if (!user || new Date(user.reset_token_expires) <= new Date()) {
    throw ApiError.badRequest('Invalid or expired reset token');
  }

  Users.update(user.id, {
    password_hash: await hashPassword(password),
    reset_token: null,
    reset_token_expires: null,
  });
  return ok(res, { message: 'Password reset successfully. You can now log in.' });
}
