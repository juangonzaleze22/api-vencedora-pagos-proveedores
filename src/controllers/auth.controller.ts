import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { LoginDTO } from '../types';
import { AppError } from '../middleware/error.middleware';

const authService = new AuthService();

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const data: LoginDTO = req.body;

      if (!data.email || !data.password) {
        throw new AppError('Email y contraseña son requeridos', 400);
      }

      const result = await authService.login(data);

      res.json({
        success: true,
        message: 'Inicio de sesión exitoso',
        data: result
      });
    } catch (error: any) {
      next(error);
    }
  }

  async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const user = await authService.getCurrentUser(req.user.userId);

      res.json({
        success: true,
        data: user
      });
    } catch (error: any) {
      next(error);
    }
  }
}

