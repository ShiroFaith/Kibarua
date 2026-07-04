import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import { aliasRouter } from '../utils/routeAlias.js';
import { requireAuth } from '../middleware/auth.js';
import * as messages from '../controllers/messagesController.js';

const router = Router();
const add = aliasRouter(router);

add('get', 'conversations', requireAuth, asyncHandler(messages.conversations));
add('get', 'thread', requireAuth, asyncHandler(messages.thread));
add('post', 'send', requireAuth, asyncHandler(messages.send));

export default router;
