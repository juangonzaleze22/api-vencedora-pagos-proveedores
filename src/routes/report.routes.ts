import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { param } from 'express-validator';
import { validate } from '../middleware/validation.middleware';

const router = Router();
const reportController = new ReportController();

// Middleware de logging para reportes
router.use((req, res, next) => {
  console.log(`📊 REPORT ROUTE: ${req.method} ${req.path}`);
  next();
});

router.use(authenticate);

router.get(
  '/dashboard',
  authorize('ADMINISTRADOR', 'SUPERVISOR'),
  reportController.getDashboard.bind(reportController)
);

router.get(
  '/supplier/:supplierId/detailed',
  validate([
    param('supplierId').isInt().withMessage('ID de proveedor inválido')
  ]),
  reportController.getSupplierDetailed.bind(reportController)
);

router.get(
  '/export/:supplierId',
  validate([
    param('supplierId').isInt().withMessage('ID de proveedor inválido')
  ]),
  authorize('ADMINISTRADOR', 'SUPERVISOR'),
  reportController.exportReport.bind(reportController)
);

export default router;

