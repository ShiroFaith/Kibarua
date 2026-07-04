import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import { aliasRouter } from '../utils/routeAlias.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import * as profile from '../controllers/workerProfileController.js';

const router = Router();
const add = aliasRouter(router);

add('get', 'get', requireAuth, asyncHandler(profile.get));
// update is multipart/form-data with an optional `profile_photo` file.
add('post', 'update', requireAuth, upload.single('profile_photo'), asyncHandler(profile.update));
add('get', 'view', optionalAuth, asyncHandler(profile.view));

export default router;
