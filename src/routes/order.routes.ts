import { Router } from 'express';
import { OrderController } from '../controllers/order.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validation.middleware';

const router = Router();
const orderController = new OrderController();

router.use(authenticate);

router.post(
  '/',
  validate([
    body('supplierId').isInt().withMessage('ID de proveedor inválido'),
    body('amount').isFloat({ min: 0.01 }).withMessage('El monto debe ser mayor a 0'),
    body('dispatchDate').isISO8601().withMessage('Fecha de despacho inválida'),
    body('creditDays').isInt({ min: 1 }).withMessage('Los días de crédito deben ser mayor a 0')
  ]),
  authorize('ADMINISTRADOR', 'SUPERVISOR', 'CAJERO'),
  orderController.create.bind(orderController)
);

router.get(
  '/',
  orderController.getAll.bind(orderController)
);

router.get(
  '/:id',
  validate([
    param('id').isInt().withMessage('ID inválido')
  ]),
  orderController.getById.bind(orderController)
);

router.get(
  '/supplier/:supplierId',
  validate([
    param('supplierId').isInt().withMessage('ID de proveedor inválido')
  ]),
  orderController.getBySupplier.bind(orderController)
);

export default router;

