import prisma from '../config/database';
import { DashboardStats, SupplierDetailedReport } from '../types';
import { SupplierService } from './supplier.service';
import { DebtService } from './debt.service';
import { PaymentService } from './payment.service';

const supplierService = new SupplierService();
const debtService = new DebtService();
const paymentService = new PaymentService();

export class ReportService {
  async getDashboardStats(): Promise<DashboardStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Pagos pendientes (deudas con estado PENDING o PARTIALLY_PAID)
    const pendingDebts = await prisma.debt.count({
      where: {
        status: {
          in: ['PENDING', 'PARTIALLY_PAID']
        }
      }
    });

    // Pagos procesados (total de pagos activos, excluyendo eliminados)
    const processedPayments = await prisma.payment.count({
      where: {
        deletedAt: null
      }
    });

    // Total proveedores
    const totalSuppliers = await prisma.supplier.count();

    // Total deuda (suma de remainingAmount de todas las deudas)
    const debts = await prisma.debt.findMany({
      select: {
        remainingAmount: true
      }
    });

    const totalDebt = debts.reduce((sum: number, debt: any) => {
      return sum + Number(debt.remainingAmount);
    }, 0);

    return {
      pendingPayments: pendingDebts,
      processedPayments,
      totalSuppliers,
      totalDebt
    };
  }

  async getSupplierDetailedReport(
    supplierId: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<SupplierDetailedReport> {
    try {
      console.log(`📊 Generando reporte detallado para proveedor ${supplierId}`, {
        startDate,
        endDate
      });

      // Obtener proveedor
      console.log('🔍 Obteniendo información del proveedor...');
      const supplier = await supplierService.getSupplierById(supplierId);
      if (!supplier) {
        console.error(`❌ Proveedor ${supplierId} no encontrado`);
        throw new Error('Proveedor no encontrado');
      }
      console.log('✅ Proveedor encontrado:', supplier.companyName);

      // Obtener todas las deudas del proveedor (incluyendo pagos eliminados para historial completo)
      console.log('🔍 Obteniendo deudas del proveedor...');
      const debtsResult = await debtService.getDebtsBySupplier(supplierId, { 
        limit: 1000,
        includeDeletedPayments: true // Incluir pagos eliminados en el reporte
      });
      const debts = debtsResult.data;
      console.log(`✅ Deudas obtenidas: ${debts.length}`);

      // Calcular estadísticas basadas en TODOS los pagos ACTIVOS del proveedor (con filtros de fecha si se proporcionan)
      // IMPORTANTE: Excluir pagos eliminados de las estadísticas
      // Esto es para mostrar estadísticas generales del periodo
      const allPaymentsResult = await paymentService.getPaymentsBySupplier(supplierId, { 
        limit: 10000,
        startDate: startDate,
        endDate: endDate,
        includeDeleted: false // Excluir eliminados de las estadísticas
      });
      let allPayments = allPaymentsResult.data;
    
      console.log(`📋 Pagos activos obtenidos para estadísticas: ${allPayments.length}${startDate || endDate ? ` (filtrados por rango de fechas)` : ''}`);

      // Calcular estadísticas basadas en todos los pagos activos filtrados
      const totalPaid = allPayments.reduce((sum, payment) => sum + payment.amount, 0);
      const paymentCount = allPayments.length;
      const averagePayment = paymentCount > 0 ? totalPaid / paymentCount : 0;

      console.log(`💰 Estadísticas calculadas:`, {
        totalPaid: totalPaid.toFixed(2),
        paymentCount,
        averagePayment: averagePayment.toFixed(2)
      });

      console.log('✅ Reporte detallado generado exitosamente');

      // NOTA: Los pagos ahora se obtienen mediante el endpoint específico /api/debts/:debtId/payments
      // Esto hace el reporte más ligero y permite al frontend cargar los pagos solo cuando se selecciona una deuda
      return {
        supplier,
        totalPaid,
        paymentCount,
        averagePayment,
        debts,
        payments: [], // Ya no incluimos pagos aquí, se obtienen por endpoint separado
        paymentsPagination: undefined
      };
    } catch (error: any) {
      console.error('❌ Error en getSupplierDetailedReport:', error);
      console.error('Stack:', error?.stack);
      throw error;
    }
  }
}

