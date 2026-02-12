import { Request, Response, NextFunction } from 'express';
import { ReportService } from '../services/report.service';
import { AppError } from '../middleware/error.middleware';
import { generateSupplierPaymentsPdf } from '../utils/pdfGenerator';

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
      if (isNaN(supplierId)) {
        throw new AppError('ID de proveedor inválido', 400);
      }

      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : undefined;
      const endDate = req.query.endDate
        ? new Date(req.query.endDate as string)
        : undefined;

      const data = await reportService.getSupplierPaymentReportData(
        supplierId,
        startDate,
        endDate
      );

      const safeName = data.supplier.companyName.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-') || 'proveedor';
      const filename = `reporte-pagos-${safeName}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      generateSupplierPaymentsPdf(data, res);
    } catch (error: any) {
      next(error);
    }
  }
}

