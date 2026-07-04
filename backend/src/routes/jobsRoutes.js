import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import { aliasRouter } from '../utils/routeAlias.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import * as jobs from '../controllers/jobsController.js';

const router = Router();
const add = aliasRouter(router);

// Employer-owned actions.
add('post', 'create', requireAuth, asyncHandler(jobs.create));
add('get', 'my-jobs', requireAuth, asyncHandler(jobs.myJobs));
add('delete', 'delete', requireAuth, asyncHandler(jobs.remove));
add('post', 'delete', requireAuth, asyncHandler(jobs.remove)); // some clients POST

// Worker bookmarks.
add('post', 'save', requireAuth, asyncHandler(jobs.save));
add('get', 'saved', requireAuth, asyncHandler(jobs.saved));

// Public listing / detail (optionalAuth so we can personalise later).
add('get', ['list', ''], optionalAuth, asyncHandler(jobs.list));
add('get', 'get', optionalAuth, asyncHandler(jobs.getOne));
router.get('/:id', optionalAuth, asyncHandler(jobs.getOne));

export default router;
