import { Router, Request, Response, NextFunction } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validation.middleware';
import { uploadSingle, handleMulterError } from '../config/multer';

const router = Router();
const paymentController = new PaymentController();

// Middleware de logging específico para payments (antes de authenticate)
router.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`🔵 PAYMENT ROUTE: ${req.method} ${req.path}`);
  console.log('Headers:', {
    authorization: req.headers.authorization ? 'Presente' : 'Ausente',
    contentType: req.headers['content-type'],
    origin: req.headers.origin
  });
  next();
});

// Endpoint PÚBLICO del comprobante (sin auth). Debe permanecer público para que
// el crawler de WhatsApp pueda GET la imagen y mostrar la vista previa (Content-Type: image/jpeg/png).
// La URL incluye ?v=... como token de versión; no usar auth en esta ruta.
router.get(
  '/:id/receipt',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({
          success: false,
          message: 'ID de pago inválido'
        });
      }
      // Llamar al controlador directamente sin validación de express-validator
      req.params.id = id.toString();
      return paymentController.getReceipt(req, res, next);
    } catch (error: any) {
      next(error);
    }
  }
);

router.use(authenticate);

router.post(
  '/',
  // Middleware para capturar errores de Multer
  (req: Request, res: Response, next: NextFunction) => {
    console.log('📤 Antes de Multer - Content-Type:', req.headers['content-type']);
    console.log('📤 Headers completos:', JSON.stringify(req.headers, null, 2));
    next();
  },
  uploadSingle('receipt'), // El campo del FormData debe llamarse 'receipt'
  handleMulterError,
  // Middleware después de Multer para ver qué se recibió
  (req: Request, res: Response, next: NextFunction) => {
    console.log('📥 Después de Multer');
    console.log('Body recibido:', req.body);
    console.log('File recibido:', req.file ? {
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size
    } : 'Ninguno');
    next();
  },
  // Validaciones personalizadas para FormData (los valores vienen como strings)
  (req: Request, res: Response, next: NextFunction) => {
    console.log('🔍 Antes de validaciones - Body:', req.body);
    next();
  },
  validate([
    body('debtId').custom((value) => {
      console.log('🔍 Validando debtId:', value);
      const num = parseInt(value);
      if (isNaN(num) || num <= 0) {
        throw new Error('ID de deuda inválido');
      }
      return true;
    }),
    body('supplierId').custom((value) => {
      console.log('🔍 Validando supplierId:', value);
      const num = parseInt(value);
      if (isNaN(num) || num <= 0) {
        throw new Error('ID de proveedor inválido');
      }
      return true;
    }),
    body('amount').custom((value) => {
      console.log('🔍 Validando amount:', value);
      const num = parseFloat(value);
      if (isNaN(num)) {
        throw new Error('El monto debe ser un número válido');
      }
      if (num <= 0) {
        throw new Error('El monto debe ser mayor a 0');
      }
      if (num > 999999.99) {
        throw new Error('El monto es demasiado grande (máximo $999,999.99)');
      }
      return true;
    }),
    body('paymentMethod').isIn(['ZELLE', 'TRANSFER', 'CASH']).withMessage('Método de pago inválido'),
    body('senderName').notEmpty().withMessage('Nombre del emisor es requerido'),
    body('senderEmail').optional().custom((value) => {
      // Permitir null, string vacío o email válido
      if (value === null || value === '' || value === undefined) {
        return true;
      }
      // Si tiene valor, debe ser un email válido
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        throw new Error('Email inválido');
      }
      return true;
    }),
    body('paymentDate').notEmpty().withMessage('Fecha de pago requerida'),
    body('confirmationNumber').optional().isString(),
    body('exchangeRate').optional().custom((value) => {
      if (value !== undefined && value !== null && value !== '') {
        const num = parseFloat(value);
        if (isNaN(num)) {
          throw new Error('La tasa del dólar debe ser un número válido');
        }
        if (num <= 0) {
          throw new Error('La tasa del dólar debe ser mayor a 0');
        }
      }
      return true;
    }),
    body('amountInBolivares').optional().custom((value) => {
      if (value !== undefined && value !== null && value !== '') {
        const num = parseFloat(value);
        if (isNaN(num)) {
          throw new Error('El monto en bolívares debe ser un número válido');
        }
        if (num <= 0) {
          throw new Error('El monto en bolívares debe ser mayor a 0');
        }
      }
      return true;
    })
  ]),
  authorize('ADMINISTRADOR', 'SUPERVISOR', 'CAJERO'),
  paymentController.create.bind(paymentController)
);

router.get(
  '/',
  paymentController.getAll.bind(paymentController)
);

router.get(
  '/search-by-confirmation',
  paymentController.searchByConfirmationNumber.bind(paymentController)
);

router.get(
  '/:id',
  validate([
    param('id').isInt().withMessage('ID inválido')
  ]),
  paymentController.getById.bind(paymentController)
);

router.put(
  '/:id',
  uploadSingle('receipt'), // Opcional: para actualizar el comprobante
  handleMulterError,
  validate([
    param('id').isInt().withMessage('ID inválido'),
    body('amount').optional().custom((value) => {
      if (value !== undefined && value !== null && value !== '') {
        const num = parseFloat(value);
        if (isNaN(num)) {
          throw new Error('El monto debe ser un número válido');
        }
        if (num <= 0) {
          throw new Error('El monto debe ser mayor a 0');
        }
        if (num > 999999.99) {
          throw new Error('El monto es demasiado grande (máximo $999,999.99)');
        }
      }
      return true;
    }),
    body('debtId').optional().custom((value) => {
      if (value !== undefined && value !== null && value !== '') {
        const num = parseInt(value);
        if (isNaN(num) || num <= 0) {
          throw new Error('ID de deuda inválido');
        }
      }
      return true;
    }),
    body('supplierId').optional().custom((value) => {
      if (value !== undefined && value !== null && value !== '') {
        const num = parseInt(value);
        if (isNaN(num) || num <= 0) {
          throw new Error('ID de proveedor inválido');
        }
      }
      return true;
    }),
    body('paymentMethod').optional().isIn(['ZELLE', 'TRANSFER', 'CASH']).withMessage('Método de pago inválido'),
    body('senderName').optional().notEmpty().withMessage('Nombre del emisor es requerido'),
    body('senderEmail').optional().custom((value) => {
      // Permitir null, string vacío o email válido
      if (value === null || value === '' || value === undefined) {
        return true;
      }
      // Si tiene valor, debe ser un email válido
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        throw new Error('Email inválido');
      }
      return true;
    }),
    body('paymentDate').optional().notEmpty().withMessage('Fecha de pago requerida'),
    body('confirmationNumber').optional().isString(),
    body('removeReceipt').optional().isBoolean().withMessage('removeReceipt debe ser un booleano'),
    body('receiptFile').optional().isString().withMessage('receiptFile debe ser un string'),
    body('exchangeRate').optional().custom((value) => {
      if (value !== undefined && value !== null && value !== '') {
        const num = parseFloat(value);
        if (isNaN(num)) {
          throw new Error('La tasa del dólar debe ser un número válido');
        }
        if (num <= 0) {
          throw new Error('La tasa del dólar debe ser mayor a 0');
        }
      }
      return true;
    }),
    body('amountInBolivares').optional().custom((value) => {
      if (value !== undefined && value !== null && value !== '') {
        const num = parseFloat(value);
        if (isNaN(num)) {
          throw new Error('El monto en bolívares debe ser un número válido');
        }
        if (num <= 0) {
          throw new Error('El monto en bolívares debe ser mayor a 0');
        }
      }
      return true;
    })
  ]),
  authorize('ADMINISTRADOR', 'SUPERVISOR'),
  paymentController.update.bind(paymentController)
);

router.delete(
  '/:id',
  validate([
    param('id').isInt().withMessage('ID inválido'),
    body('reason').optional().isString().withMessage('El motivo debe ser un string')
  ]),
  authorize('ADMINISTRADOR', 'SUPERVISOR'),
  paymentController.delete.bind(paymentController)
);

router.get(
  '/supplier/:supplierId',
  validate([
    param('supplierId').isInt().withMessage('ID de proveedor inválido')
  ]),
  paymentController.getBySupplier.bind(paymentController)
);

router.post(
  '/verify-zelle',
  validate([
    body('confirmationNumber').notEmpty().withMessage('Número de confirmación requerido')
  ]),
  authorize('ADMINISTRADOR', 'SUPERVISOR'),
  paymentController.verifyZelle.bind(paymentController)
);

router.post(
  '/:id/share',
  validate([
    param('id').isInt().withMessage('ID de pago inválido')
  ]),
  authorize('ADMINISTRADOR', 'SUPERVISOR', 'CAJERO'),
  paymentController.share.bind(paymentController)
);

export default router;

