import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';

export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log('🔍 Iniciando validaciones...');
      console.log('Body a validar:', req.body);
      
      // Ejecutar todas las validaciones
      await Promise.all(validations.map(validation => validation.run(req)));

      const errors = validationResult(req);
      
      if (!errors.isEmpty()) {
        console.log('❌ Errores de validación encontrados:', errors.array());
        return res.status(400).json({
          success: false,
          message: 'Errores de validación',
          errors: errors.array()
        });
      }

      console.log('✅ Validaciones pasadas correctamente');
      return next();
    } catch (error: any) {
      console.error('❌ Error en middleware de validación:', error);
      return res.status(500).json({
        success: false,
        message: 'Error al validar los datos',
        error: error.message
      });
    }
  };
};

