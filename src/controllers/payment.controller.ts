import { Request, Response, NextFunction } from 'express';
import { PaymentService } from '../services/payment.service';
import { AppError } from '../middleware/error.middleware';
import path from 'path';
import fs from 'fs';
import prisma from '../config/database';

const paymentService = new PaymentService();

export class PaymentController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      console.log('🎯 PaymentController.create - Iniciando...');
      console.log('User:', req.user ? req.user.email : 'No autenticado');
      
      if (!req.user) {
        console.log('❌ Usuario no autenticado');
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      console.log('Body recibido (FormData):', req.body);
      console.log('🔍 Campos BS/USD recibidos:', {
        exchangeRate: req.body.exchangeRate,
        amountInBolivares: req.body.amountInBolivares,
        exchangeRateType: typeof req.body.exchangeRate,
        amountInBolivaresType: typeof req.body.amountInBolivares
      });
      console.log('Archivo recibido:', req.file ? {
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size
      } : 'Ninguno');

      // Validar que los campos requeridos estén presentes
      if (!req.body.debtId || !req.body.supplierId || !req.body.amount) {
        return res.status(400).json({
          success: false,
          message: 'Faltan campos requeridos: debtId, supplierId, amount'
        });
      }

      // Convertir los valores de FormData a los tipos correctos
      const exchangeRateValue = req.body.exchangeRate && req.body.exchangeRate !== '' 
        ? parseFloat(req.body.exchangeRate) 
        : undefined;
      const amountInBolivaresValue = req.body.amountInBolivares && req.body.amountInBolivares !== '' 
        ? parseFloat(req.body.amountInBolivares) 
        : undefined;

      console.log('💰 Valores procesados de BS/USD:', {
        exchangeRate: exchangeRateValue,
        amountInBolivares: amountInBolivaresValue,
        exchangeRateIsValid: exchangeRateValue !== undefined && !isNaN(exchangeRateValue),
        amountInBolivaresIsValid: amountInBolivaresValue !== undefined && !isNaN(amountInBolivaresValue)
      });

      const paymentData = {
        debtId: parseInt(req.body.debtId),
        supplierId: parseInt(req.body.supplierId),
        amount: parseFloat(req.body.amount),
        paymentMethod: req.body.paymentMethod,
        senderName: req.body.senderName,
        senderEmail: req.body.senderEmail || undefined,
        confirmationNumber: req.body.confirmationNumber || undefined,
        paymentDate: req.body.paymentDate,
        exchangeRate: exchangeRateValue,
        amountInBolivares: amountInBolivaresValue
      };

      // Guardar solo el nombre del archivo (se construirá la URL después de crear el pago)
      const receiptFileName = req.file ? req.file.filename : undefined;
      const receiptFilePath = req.file ? req.file.path : undefined;

      console.log('📝 Datos del pago a procesar:', paymentData);
      console.log('📎 Archivo recibido:', req.file ? {
        filename: req.file.filename,
        originalname: req.file.originalname,
        path: req.file.path
      } : 'Ninguno');

      const payment = await paymentService.createPayment(
        paymentData,
        req.user.userId,
        receiptFileName,
        receiptFilePath
      );

      console.log('✅ Pago creado exitosamente:', payment.id);

      // Asegurar que no se haya enviado respuesta antes
      if (!res.headersSent) {
        res.status(201).json({
          success: true,
          message: 'Pago registrado exitosamente',
          data: payment
        });
      }
    } catch (error: any) {
      console.error('❌ Error en PaymentController.create:', error);
      console.error('Stack:', error?.stack);
      console.error('Error completo:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      
      // Si hay un archivo subido y hay error, eliminarlo
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
          console.log('🗑️ Archivo eliminado debido a error');
        } catch (unlinkError) {
          console.error('Error al eliminar archivo:', unlinkError);
        }
      }
      
      // Convertir errores genéricos a AppError si no lo son
      if (!res.headersSent) {
        if (error instanceof AppError) {
          next(error);
        } else {
          // Mapear mensajes de error comunes a códigos de estado apropiados
          let statusCode = 500;
          const errorMessage = error.message || 'Error al registrar el pago';
          
          // Errores de validación de negocio (400)
          if (
            errorMessage.includes('no encontrada') ||
            errorMessage.includes('no pertenece') ||
            errorMessage.includes('excede') ||
            errorMessage.includes('completamente pagada') ||
            errorMessage.includes('debe ser mayor') ||
            errorMessage.includes('requerido')
          ) {
            statusCode = 400;
          }
          
          // Convertir error genérico a AppError
          const appError = new AppError(errorMessage, statusCode);
          next(appError);
        }
      } else {
        console.error('⚠️ No se puede enviar respuesta, headers ya enviados');
      }
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      console.log('GET /api/payments - Iniciando...');
      const page = req.query.page ? parseInt(req.query.page as string) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const includeDeleted = req.query.includeDeleted === 'true';

      console.log('Obteniendo pagos con page:', page, 'limit:', limit, 'includeDeleted:', includeDeleted);
      const result = await paymentService.getAllPayments({ page, limit, includeDeleted });
      console.log('Pagos obtenidos:', result.data.length);

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (error: any) {
      console.error('Error en getAll payments:', error);
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      console.log('🎯 PaymentController.getById - Iniciando...');
      console.log('Params:', req.params);
      console.log('Query:', req.query);
      
      const id = parseInt(req.params.id);
      // Para el detalle de un pago, por defecto permitimos ver también pagos eliminados
      // (historial/auditoría). Si se quiere forzar solo activos: ?includeDeleted=false
      const rawIncludeDeleted = req.query.includeDeleted as unknown;
      const includeDeleted =
        rawIncludeDeleted === undefined
          ? true
          : rawIncludeDeleted === 'true' || rawIncludeDeleted === true;
      
      if (isNaN(id)) {
        console.error('❌ ID inválido:', req.params.id);
        throw new AppError('ID de pago inválido', 400);
      }

      console.log(`🔍 Buscando pago con ID: ${id}, includeDeleted: ${includeDeleted}`);
      const payment = await paymentService.getPaymentById(id, includeDeleted);

      if (!payment) {
        console.error(`❌ Pago ${id} no encontrado`);
        throw new AppError('Pago no encontrado', 404);
      }

      console.log(`✅ Pago ${id} encontrado exitosamente`);
      
      if (!res.headersSent) {
        res.json({
          success: true,
          data: payment
        });
      }
    } catch (error: any) {
      console.error('❌ Error en PaymentController.getById:', error);
      next(error);
    }
  }

  async getBySupplier(req: Request, res: Response, next: NextFunction) {
    try {
      const supplierId = parseInt(req.params.supplierId);
      const page = req.query.page ? parseInt(req.query.page as string) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const includeDeleted = req.query.includeDeleted === 'true';

      const result = await paymentService.getPaymentsBySupplier(supplierId, { page, limit, includeDeleted });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (error: any) {
      next(error);
    }
  }

  async verifyZelle(req: Request, res: Response, next: NextFunction) {
    try {
      const { confirmationNumber } = req.body;

      if (!confirmationNumber) {
        throw new AppError('Número de confirmación requerido', 400);
      }

      const payment = await paymentService.verifyZelleByConfirmationNumber({ confirmationNumber });

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'No se encontraron registros para la confirmación proporcionada'
        });
      }

      res.json({
        success: true,
        message: 'Pago verificado',
        data: payment
      });
    } catch (error: any) {
      next(error);
    }
  }

  async searchByConfirmationNumber(req: Request, res: Response, next: NextFunction) {
    try {
      const query = req.query.q as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      if (!query) {
        return res.json({
          success: true,
          data: []
        });
      }

      // Validar que el query tenga al menos 3 caracteres
      if (query.length < 3) {
        return res.json({
          success: true,
          data: []
        });
      }

      // Validar límite máximo
      const maxLimit = Math.min(limit, 20); // Máximo 20 resultados

      const payments = await paymentService.searchPaymentsByConfirmationNumber(query, maxLimit);

      res.json({
        success: true,
        data: payments
      });
    } catch (error: any) {
      next(error);
    }
  }

  async getByDebt(req: Request, res: Response, next: NextFunction) {
    try {
      const debtId = parseInt(req.params.debtId);
      const page = req.query.page ? parseInt(req.query.page as string) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const includeDeleted = req.query.includeDeleted === 'true';
      const startDate = req.query.startDate 
        ? new Date(req.query.startDate as string) 
        : undefined;
      const endDate = req.query.endDate 
        ? new Date(req.query.endDate as string) 
        : undefined;

      if (isNaN(debtId)) {
        throw new AppError('ID de deuda inválido', 400);
      }

      const result = await paymentService.getPaymentsByDebt(debtId, {
        page,
        limit,
        startDate,
        endDate,
        includeDeleted
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (error: any) {
      next(error);
    }
  }

  async getReceipt(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      
      // Obtener el pago directamente de la BD para obtener el nombre del archivo
      const payment = await prisma.payment.findUnique({
        where: { id },
        select: { receiptFile: true }
      });

      if (!payment) {
        throw new AppError('Pago no encontrado', 404);
      }

      if (!payment.receiptFile) {
        throw new AppError('No hay comprobante disponible para este pago', 404);
      }

      // El receiptFile en la BD contiene el nombre del archivo (ej: receipt-1234567890.pdf)
      // Construir la ruta completa del archivo (está en la subcarpeta receipt/)
      const { env } = await import('../config/env');
      const filePath = path.resolve(env.UPLOAD_PATH, 'receipt', payment.receiptFile);

      console.log('🔍 Buscando archivo en:', filePath);
      
      if (!fs.existsSync(filePath)) {
        console.error(`❌ Archivo no encontrado en: ${filePath}`);
        throw new AppError('Archivo de comprobante no encontrado', 404);
      }

      // Determinar el tipo MIME del archivo según la extensión
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes: { [key: string]: string } = {
        '.pdf': 'application/pdf',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif'
      };

      const contentType = mimeTypes[ext] || 'application/octet-stream';
      
      console.log('✅ Enviando archivo:', {
        filePath,
        contentType,
        fileName: payment.receiptFile
      });
      
      // Configurar headers para la visualización de imágenes
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${payment.receiptFile}"`);
      
      // Headers CORS adicionales para permitir carga de imágenes desde el frontend
      const origin = req.headers.origin;
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
      }
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate'); // Cache por 1 hora con revalidación
      res.setHeader('ETag', `"${payment.receiptFile}"`);
      
      // Usar sendFile con ruta absoluta
      res.sendFile(path.resolve(filePath));
    } catch (error: any) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        console.log('❌ Usuario no autenticado');
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        throw new AppError('ID de pago inválido', 400);
      }

      // Obtener datos del body (puede ser JSON o FormData)
      const updateData: any = {};
      
      // Permitir cambiar deuda y proveedor
      if (req.body.debtId !== undefined) {
        updateData.debtId = parseInt(req.body.debtId);
      }
      if (req.body.supplierId !== undefined) {
        updateData.supplierId = parseInt(req.body.supplierId);
      }
      
      if (req.body.amount !== undefined) {
        updateData.amount = parseFloat(req.body.amount);
      }
      if (req.body.paymentMethod) {
        updateData.paymentMethod = req.body.paymentMethod;
      }
      if (req.body.senderName) {
        updateData.senderName = req.body.senderName;
      }
      if (req.body.senderEmail !== undefined) {
        updateData.senderEmail = req.body.senderEmail || null;
      }
      if (req.body.confirmationNumber !== undefined) {
        updateData.confirmationNumber = req.body.confirmationNumber || null;
      }
      if (req.body.paymentDate) {
        updateData.paymentDate = req.body.paymentDate;
      }
      if (req.body.exchangeRate !== undefined) {
        updateData.exchangeRate = req.body.exchangeRate ? parseFloat(req.body.exchangeRate) : null;
      }
      if (req.body.amountInBolivares !== undefined) {
        updateData.amountInBolivares = req.body.amountInBolivares ? parseFloat(req.body.amountInBolivares) : null;
      }

      // Manejar el comprobante (archivo nuevo o remover existente)
      if (req.file) {
        // Si hay archivo nuevo, actualizar con el nuevo archivo
        updateData.receiptFileName = req.file.filename;
        updateData.receiptFilePath = req.file.path;
      } else if (req.body.removeReceipt === 'true' || req.body.removeReceipt === true) {
        // Si el usuario quiere remover la imagen, setear a null
        console.log('🗑️ Usuario quiere remover el comprobante');
        updateData.receiptFileName = null;
        updateData.removeReceipt = true; // Flag para eliminar el archivo físico
      } else if (req.body.receiptFile === '' || req.body.receiptFile === null) {
        // También permitir remover enviando string vacío o null
        console.log('🗑️ Usuario quiere remover el comprobante (campo vacío)');
        updateData.receiptFileName = null;
        updateData.removeReceipt = true;
      }

      const updatedPayment = await paymentService.updatePayment(id, updateData);

      console.log('✅ Pago actualizado exitosamente:', updatedPayment.id);

      if (!res.headersSent) {
        res.json({
          success: true,
          message: 'Pago actualizado exitosamente',
          data: updatedPayment
        });
      }
    } catch (error: any) {
      console.error('❌ Error en PaymentController.update:', error);
      console.error('Stack:', error?.stack);
      
      // Si hay un archivo subido y hay error, eliminarlo
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
          console.log('🗑️ Archivo eliminado debido a error');
        } catch (unlinkError) {
          console.error('Error al eliminar archivo:', unlinkError);
        }
      }
      
      if (error instanceof AppError) {
        next(error);
      } else {
        let statusCode = 500;
        const errorMessage = error.message || 'Error al actualizar el pago';
        
        if (
          errorMessage.includes('no encontrado') ||
          errorMessage.includes('excede') ||
          errorMessage.includes('debe ser mayor') ||
          errorMessage.includes('requerido')
        ) {
          statusCode = 400;
        }
        
        const appError = new AppError(errorMessage, statusCode);
        next(appError);
      }
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      console.log('🗑️ PaymentController.delete - Iniciando...');
      console.log('User:', req.user ? req.user.email : 'No autenticado');
      console.log('Params:', req.params);
      console.log('Body:', req.body);
      
      if (!req.user) {
        console.log('❌ Usuario no autenticado');
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        throw new AppError('ID de pago inválido', 400);
      }

      const reason = req.body.reason || undefined;

      console.log(`🗑️ Eliminando pago ${id}...`);
      const deletedPayment = await paymentService.deletePayment(id, req.user.userId, reason);

      console.log('✅ Pago eliminado exitosamente:', deletedPayment.id);

      if (!res.headersSent) {
        res.json({
          success: true,
          message: 'Pago eliminado exitosamente',
          data: deletedPayment
        });
      }
    } catch (error: any) {
      console.error('❌ Error en PaymentController.delete:', error);
      console.error('Stack:', error?.stack);
      
      if (error instanceof AppError) {
        next(error);
      } else {
        let statusCode = 500;
        const errorMessage = error.message || 'Error al eliminar el pago';
        
        if (
          errorMessage.includes('no encontrado') ||
          errorMessage.includes('ya ha sido eliminado')
        ) {
          statusCode = 400;
        }
        
        const appError = new AppError(errorMessage, statusCode);
        next(appError);
      }
    }
  }

  async share(req: Request, res: Response, next: NextFunction) {
    try {
      console.log('📤 PaymentController.share - Iniciando...');
      
      if (!req.user) {
        console.log('❌ Usuario no autenticado');
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado'
        });
      }

      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        throw new AppError('ID de pago inválido', 400);
      }

      console.log(`📤 Compartiendo pago ${id}...`);
      const result = await paymentService.sharePayment(id);

      console.log('✅ Pago compartido exitosamente:', result.payment.id);

      if (!res.headersSent) {
        res.json({
          success: true,
          message: 'Pago compartido exitosamente',
          data: {
            payment: result.payment,
            whatsappUrl: result.whatsappUrl
          }
        });
      }
    } catch (error: any) {
      console.error('❌ Error en PaymentController.share:', error);
      console.error('Stack:', error?.stack);
      
      if (error instanceof AppError) {
        next(error);
      } else {
        let statusCode = 500;
        const errorMessage = error.message || 'Error al compartir el pago';
        
        if (
          errorMessage.includes('no encontrado') ||
          errorMessage.includes('no tiene un número de teléfono')
        ) {
          statusCode = 400;
        }
        
        const appError = new AppError(errorMessage, statusCode);
        next(appError);
      }
    }
  }
}

