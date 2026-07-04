import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import asyncHandler from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import * as auth from '../controllers/authController.js';

const router = Router();

// Throttle credential endpoints to blunt brute-force attempts.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again later.' },
});

/**
 * Register a route under several path variants so it matches every frontend
 * client: plain (`/register`), `.php`-suffixed (`/register.php`), and any
 * extra aliases (e.g. request-reset vs forgot-password).
 */
function route(method, names, ...handlers) {
  for (const name of names) {
    router[method](`/${name}`, ...handlers);
    router[method](`/${name}.php`, ...handlers);
  }
}

route('post', ['register'], authLimiter, asyncHandler(auth.register));
route('post', ['login'], authLimiter, asyncHandler(auth.login));
route('post', ['logout'], asyncHandler(auth.logout));
route('get', ['me', 'profile'], requireAuth, asyncHandler(auth.me));
route('post', ['change-password'], requireAuth, asyncHandler(auth.changePassword));
route('post', ['verify-email'], asyncHandler(auth.verifyEmail));
route('post', ['forgot-password', 'request-reset'], authLimiter, asyncHandler(auth.requestReset));
route('post', ['verify-reset-token'], asyncHandler(auth.verifyResetToken));
route('post', ['reset-password'], authLimiter, asyncHandler(auth.resetPassword));

export default router;
