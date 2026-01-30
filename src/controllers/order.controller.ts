import { Request, Response, NextFunction } from 'express';
import { OrderService } from '../services/order.service';
import { AppError } from '../middleware/error.middleware';

const orderService = new OrderService();

export class OrderController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const order = await orderService.createOrder(req.body, req.user.userId);

      res.status(201).json({
        success: true,
        message: 'Pedido creado exitosamente',
        data: order
      });
    } catch (error: any) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

      const result = await orderService.getAllOrders({ page, limit });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (error: any) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const order = await orderService.getOrderById(id);

      if (!order) {
        throw new AppError('Pedido no encontrado', 404);
      }

      res.json({
        success: true,
        data: order
      });
    } catch (error: any) {
      next(error);
    }
  }

  async getBySupplier(req: Request, res: Response, next: NextFunction) {
    try {
      const supplierId = parseInt(req.params.supplierId);
      const page = req.query.page ? parseInt(req.query.page as string) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

      const result = await orderService.getOrdersBySupplier(supplierId, { page, limit });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (error: any) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        throw new AppError('ID de orden inválido', 400);
      }

      // Preparar datos para actualizar
      const updateData: any = {};
      
      if (req.body.dispatchDate !== undefined) {
        updateData.dispatchDate = new Date(req.body.dispatchDate);
      }
      
      if (req.body.creditDays !== undefined) {
        updateData.creditDays = parseInt(req.body.creditDays);
      }
      
      if (req.body.amount !== undefined) {
        updateData.amount = parseFloat(req.body.amount);
      }

      console.log(`Actualizando orden ${id} con datos:`, updateData);
      const updatedOrder = await orderService.updateOrder(id, updateData);
      console.log(`Orden ${id} actualizada exitosamente`);

      res.json({
        success: true,
        message: 'Orden actualizada exitosamente',
        data: updatedOrder
      });
    } catch (error: any) {
      console.error('Error al actualizar orden:', error);
      next(error);
    }
  }
}

