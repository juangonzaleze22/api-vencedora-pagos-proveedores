import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwt';

// Extender el tipo Request para incluir el usuario
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      console.log('❌ No hay header de autorización en:', req.method, req.path);
      return res.status(401).json({
        success: false,
        message: 'Token de autenticación requerido'
      });
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (!token) {
      console.log('❌ Token vacío en:', req.method, req.path);
      return res.status(401).json({
        success: false,
        message: 'Token de autenticación requerido'
      });
    }

    const decoded = verifyToken(token);
    req.user = decoded;
    console.log('✅ Usuario autenticado:', decoded.email, 'Rol:', decoded.rolNombre);
    next();
  } catch (error: any) {
    console.log('❌ Error de autenticación:', error.message);
    return res.status(401).json({
      success: false,
      message: error.message || 'Token inválido o expirado'
    });
  }
};

// Middleware para verificar roles específicos
export const authorize = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    console.log('🔐 Verificando autorización...');
    console.log('Usuario:', req.user ? req.user.email : 'No autenticado');
    console.log('Roles permitidos:', allowedRoles);
    
    if (!req.user) {
      console.log('❌ Usuario no autenticado en authorize');
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
    }

    const userRole = req.user.rolNombre;
    console.log('Rol del usuario:', userRole);

    if (!allowedRoles.includes(userRole)) {
      console.log('❌ Usuario no tiene permisos. Rol:', userRole, 'Permitidos:', allowedRoles);
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para realizar esta acción'
      });
    }

    console.log('✅ Usuario autorizado');
    next();
  };
};

