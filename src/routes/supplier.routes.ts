import { Router } from 'express';
import { SupplierController } from '../controllers/supplier.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validation.middleware';

const router = Router();
const supplierController = new SupplierController();

// Todas las rutas requieren autenticación
router.use(authenticate);

router.post(
  '/',
  validate([
    body('companyName').trim().isLength({ min: 3 }).withMessage('El nombre de la empresa debe tener al menos 3 caracteres'),
    body('taxId').notEmpty().withMessage('RIF/Identificación Fiscal es requerido'),
    body('phone').optional().trim().isString().withMessage('El teléfono debe ser una cadena de texto')
  ]),
  authorize('ADMINISTRADOR', 'SUPERVISOR'),
  supplierController.create.bind(supplierController)
);

router.get(
  '/',
  supplierController.getAll.bind(supplierController)
);

router.get(
  '/:id',
  validate([param('id').isInt().withMessage('ID inválido')]),
  supplierController.getById.bind(supplierController)
);

router.put(
  '/:id',
  validate([
    param('id').isInt().withMessage('ID inválido'),
    body('companyName').optional().trim().isLength({ min: 3 }).withMessage('El nombre de la empresa debe tener al menos 3 caracteres'),
    body('phone').optional().trim().isString().withMessage('El teléfono debe ser una cadena de texto')
  ]),
  authorize('ADMINISTRADOR', 'SUPERVISOR'),
  supplierController.update.bind(supplierController)
);

router.get(
  '/:id/debts',
  validate([param('id').isInt().withMessage('ID inválido')]),
  supplierController.getDebts.bind(supplierController)
);

router.get(
  '/:id/payments',
  validate([param('id').isInt().withMessage('ID inválido')]),
  supplierController.getPayments.bind(supplierController)
);

export default router;

