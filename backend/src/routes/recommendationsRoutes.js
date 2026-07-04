import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import { aliasRouter } from '../utils/routeAlias.js';
import { requireAuth } from '../middleware/auth.js';
import * as recommendations from '../controllers/recommendationsController.js';

const router = Router();
const add = aliasRouter(router);

add('get', ['get', 'list', ''], requireAuth, asyncHandler(recommendations.get));
add('get', 'stats', requireAuth, asyncHandler(recommendations.stats));
add('post', 'generate', requireAuth, asyncHandler(recommendations.generate));

export default router;
