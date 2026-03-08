import { Request, Response, NextFunction } from 'express';
import { CreditService } from '../services/credit.service';
import { AppError } from '../middleware/error.middleware';

const creditService = new CreditService();

export class CreditController {
  async listCredits(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const status = req.query.status as string | undefined;

      const result = await creditService.listCredits({ page, limit, status });

      res.json({
        success: true,
        data: result.data,
        summary: result.summary,
        pagination: result.pagination
      });
    } catch (error: any) {
      next(error);
    }
  }

  async getCreditById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        throw new AppError('ID de crédito inválido', 400);
      }

      const credit = await creditService.getCreditById(id);

      if (!credit) {
        throw new AppError('Crédito no encontrado', 404);
      }

      res.json({
        success: true,
        data: credit
      });
    } catch (error: any) {
      next(error);
    }
  }

  async applyCredit(req: Request, res: Response, next: NextFunction) {
    try {
      const creditId = parseInt(req.params.id);

      if (isNaN(creditId)) {
        throw new AppError('ID de crédito inválido', 400);
      }

      const { debtId, amount } = req.body;

      const result = await creditService.applyCredit(creditId, {
        debtId: parseInt(debtId),
        amount: parseFloat(amount)
      });

      res.json({
        success: true,
        message: `Crédito aplicado exitosamente: $${result.appliedAmount.toFixed(2)}`,
        data: result
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        next(error);
      } else {
        next(new AppError(error.message || 'Error al aplicar crédito', 500));
      }
    }
  }
}
