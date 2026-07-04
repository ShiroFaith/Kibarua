import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import { aliasRouter } from '../utils/routeAlias.js';
import { requireAuth } from '../middleware/auth.js';
import * as notifications from '../controllers/notificationsController.js';

const router = Router();
const add = aliasRouter(router);

add('get', ['list', ''], requireAuth, asyncHandler(notifications.list));
add('get', 'stats', requireAuth, asyncHandler(notifications.stats));
add('post', 'read', requireAuth, asyncHandler(notifications.markRead));
add('post', 'read-all', requireAuth, asyncHandler(notifications.markAllRead));

// The frontend uses DELETE; accept POST too for clients that avoid it.
add('delete', 'delete', requireAuth, asyncHandler(notifications.remove));
add('post', 'delete', requireAuth, asyncHandler(notifications.remove));
add('delete', 'clear', requireAuth, asyncHandler(notifications.clear));
add('post', 'clear', requireAuth, asyncHandler(notifications.clear));

export default router;
