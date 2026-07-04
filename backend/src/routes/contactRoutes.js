import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import asyncHandler from '../utils/asyncHandler.js';
import { aliasRouter } from '../utils/routeAlias.js';
import * as contact from '../controllers/contactController.js';

const router = Router();
const add = aliasRouter(router);

// Throttle so the public form can't be used to spam the inbox.
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many messages. Please try again later.' },
});

add('post', ['submit', ''], contactLimiter, asyncHandler(contact.submit));

export default router;
