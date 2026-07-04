import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import { aliasRouter } from '../utils/routeAlias.js';
import { requireAuth } from '../middleware/auth.js';
import * as apps from '../controllers/applicationsController.js';

const router = Router();
const add = aliasRouter(router);

add('post', 'apply', requireAuth, asyncHandler(apps.apply));
add('get', 'mine', requireAuth, asyncHandler(apps.mine));
add('get', 'job', requireAuth, asyncHandler(apps.forJob));
add('get', 'hirings', requireAuth, asyncHandler(apps.hirings));
add('post', 'hire', requireAuth, asyncHandler(apps.hire));
add('post', 'complete', requireAuth, asyncHandler(apps.complete));
add('post', 'status', requireAuth, asyncHandler(apps.setStatus));

export default router;
