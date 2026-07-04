import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import { aliasRouter } from '../utils/routeAlias.js';
import { optionalAuth } from '../middleware/auth.js';
import * as search from '../controllers/searchController.js';

const router = Router();
const add = aliasRouter(router);

// Filters/suggestions/search all work anonymously; a token just personalises.
add('get', 'filters', optionalAuth, asyncHandler(search.filters));
add('get', 'suggestions', optionalAuth, asyncHandler(search.suggestions));
add('get', 'jobs', optionalAuth, asyncHandler(search.jobs));
add('get', 'workers', optionalAuth, asyncHandler(search.workers));
add('get', 'global', optionalAuth, asyncHandler(search.global));

export default router;
