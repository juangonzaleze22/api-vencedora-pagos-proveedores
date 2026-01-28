import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Asegurar que no se intente enviar respuesta si ya se envió
  if (res.headersSent) {
    return next(err);
  }

  console.error('❌ Error capturado en errorHandler:', {
    message: err.message,
    code: err.code,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  // Si es un error de Prisma
  if (err.code === 'P2002') {
    return res.status(400).json({
      success: false,
      message: 'Ya existe un registro con estos datos'
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      message: 'Registro no encontrado'
    });
  }

  const statusCode = err.statusCode || (err instanceof AppError ? err.statusCode : 500);
  const message = err.message || 'Error interno del servidor';

  // Log del error
  logger.error(`Error ${statusCode}: ${message}`, {
    path: req.path,
    method: req.method,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  // Respuesta al cliente
  try {
    res.status(statusCode).json({
      success: false,
      message: message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  } catch (responseError) {
    console.error('❌ Error al enviar respuesta de error:', responseError);
    // Si no se puede enviar respuesta, al menos loguear el error
    logger.error('Error al enviar respuesta de error', responseError);
  }
};

export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new AppError(`Ruta no encontrada: ${req.originalUrl}`, 404);
  next(error);
};

