import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import { aliasRouter } from '../utils/routeAlias.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import * as profile from '../controllers/employerProfileController.js';

const router = Router();
const add = aliasRouter(router);

add('get', 'get', requireAuth, asyncHandler(profile.get));
add('post', 'update', requireAuth, asyncHandler(profile.update));
add('get', 'view', optionalAuth, asyncHandler(profile.view));

export default router;
