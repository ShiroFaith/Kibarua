import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import { aliasRouter } from '../utils/routeAlias.js';
import { requireAuth } from '../middleware/auth.js';
import * as payments from '../controllers/paymentsController.js';

const router = Router();
const add = aliasRouter(router);

add('get', 'wallet', requireAuth, asyncHandler(payments.wallet));
add('get', 'methods', requireAuth, asyncHandler(payments.methods));
add('post', 'method/add', requireAuth, asyncHandler(payments.addMethod));
add('get', 'transactions', requireAuth, asyncHandler(payments.transactions));
add('get', 'invoices', requireAuth, asyncHandler(payments.invoices));
add('post', 'withdraw/request', requireAuth, asyncHandler(payments.requestWithdrawal));

export default router;
