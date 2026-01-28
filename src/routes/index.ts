import { Router } from 'express';
import authRoutes from './auth.routes';
import supplierRoutes from './supplier.routes';
import orderRoutes from './order.routes';
import debtRoutes from './debt.routes';
import paymentRoutes from './payment.routes';
import reportRoutes from './report.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/orders', orderRoutes);
router.use('/debts', debtRoutes);
router.use('/payments', paymentRoutes);
router.use('/reports', reportRoutes);

export default router;

