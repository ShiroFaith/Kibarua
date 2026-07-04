import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import { aliasRouter } from '../utils/routeAlias.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import * as reviews from '../controllers/reviewsController.js';

const router = Router();
const add = aliasRouter(router);

// Reads work with or without auth (a token is still passed to derive user_id).
add('get', ['worker', 'employer', 'list'], optionalAuth, asyncHandler(reviews.listForUser));
add('get', 'stats', optionalAuth, asyncHandler(reviews.stats));

// Writes require auth.
add('post', 'submit', requireAuth, asyncHandler(reviews.submit));
add('post', 'respond', requireAuth, asyncHandler(reviews.respond));
add('post', 'helpful', requireAuth, asyncHandler(reviews.helpful));
add('post', 'dispute', requireAuth, asyncHandler(reviews.dispute));

export default router;
