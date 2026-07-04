import { Router } from 'express';
import authRoutes from './authRoutes.js';
import jobsRoutes from './jobsRoutes.js';
import applicationsRoutes from './applicationsRoutes.js';
import workerProfileRoutes from './workerProfileRoutes.js';
import employerProfileRoutes from './employerProfileRoutes.js';
import messagesRoutes from './messagesRoutes.js';
import notificationsRoutes from './notificationsRoutes.js';
import paymentsRoutes from './paymentsRoutes.js';
import reviewsRoutes from './reviewsRoutes.js';
import searchRoutes from './searchRoutes.js';
import recommendationsRoutes from './recommendationsRoutes.js';
import contactRoutes from './contactRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/jobs', jobsRoutes);
router.use('/applications', applicationsRoutes);
router.use('/worker-profile', workerProfileRoutes);
router.use('/employer-profile', employerProfileRoutes);
router.use('/messages', messagesRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/payments', paymentsRoutes);
router.use('/reviews', reviewsRoutes);
router.use('/search', searchRoutes);
router.use('/recommendations', recommendationsRoutes);
router.use('/contact', contactRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
