import { Request, Response, NextFunction } from 'express';
import { ReportService } from '../services/report.service';
import { AppError } from '../middleware/error.middleware';

const reportService = new ReportService();

export class ReportController {
  async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await reportService.getDashboardStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      next(error);
    }
  }

  async getSupplierDetailed(req: Request, res: Response, next: NextFunction) {
    try {
      console.log('🎯 ReportController.getSupplierDetailed - Iniciando...');
      console.log('Params:', req.params);
      console.log('Query:', req.query);
      
      const supplierId = parseInt(req.params.supplierId);
      
      if (isNaN(supplierId)) {
        throw new AppError('ID de proveedor inválido', 400);
      }
      
      // Obtener parámetros de fecha del query string
      const startDate = req.query.startDate 
        ? new Date(req.query.startDate as string) 
        : undefined;
      const endDate = req.query.endDate 
        ? new Date(req.query.endDate as string) 
        : undefined;

      console.log(`🔍 Solicitud de reporte detallado:`, {
        supplierId,
        startDate,
        endDate
      });

      // El reporte ahora solo devuelve deudas y estadísticas
      // Los pagos se obtienen mediante el endpoint separado: GET /api/debts/:debtId/payments
      const report = await reportService.getSupplierDetailedReport(
        supplierId,
        startDate,
        endDate
      );

      console.log('✅ Reporte generado exitosamente, enviando respuesta...');

      if (!res.headersSent) {
        res.json({
          success: true,
          data: report
        });
      }
    } catch (error: any) {
      console.error('❌ Error en ReportController.getSupplierDetailed:', error);
      console.error('Stack:', error?.stack);
      next(error);
    }
  }

  async exportReport(req: Request, res: Response, next: NextFunction) {
    try {
      const supplierId = parseInt(req.params.supplierId);
      
      // Obtener parámetros de fecha del query string
      const startDate = req.query.startDate 
        ? new Date(req.query.startDate as string) 
        : undefined;
      const endDate = req.query.endDate 
        ? new Date(req.query.endDate as string) 
        : undefined;

      const report = await reportService.getSupplierDetailedReport(
        supplierId,
        startDate,
        endDate
      );

      // Por ahora retornamos JSON, en el futuro se puede implementar PDF/Excel
      res.json({
        success: true,
        message: 'Reporte generado exitosamente',
        data: report
      });
    } catch (error: any) {
      next(error);
    }
  }
}

