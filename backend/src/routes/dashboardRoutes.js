import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import { aliasRouter } from '../utils/routeAlias.js';
import { requireAuth } from '../middleware/auth.js';
import * as dashboard from '../controllers/dashboardController.js';

const router = Router();
const add = aliasRouter(router);

add('get', ['stats', ''], requireAuth, asyncHandler(dashboard.stats));
add('get', 'activity', requireAuth, asyncHandler(dashboard.activity));

export default router;
