import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';

const userService = new UserService();

export class UserController {
  async getUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const role = typeof req.query.role === 'string' ? req.query.role : undefined;
      const users = await userService.getUsers(role);
      res.json({
        success: true,
        data: users
      });
    } catch (error: any) {
      next(error);
    }
  }
}
