import { Router } from 'express';
import authRoutes from './authRoutes.js';
import dbRoutes from './dbRoutes.js';
import mobileRoutes from './mobileRoutes.js';
import phoneRoutes from './phoneRoutes.js';

const router = Router();

router.use('/phones', phoneRoutes);
router.use('/', mobileRoutes);
router.use('/auth', authRoutes);
router.use('/db', dbRoutes);

export default router;
