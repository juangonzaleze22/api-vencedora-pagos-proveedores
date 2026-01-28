import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { DebtResponse, SearchParams, PaginationParams, PaginatedResponse } from '../types';

export class DebtService {
  async updateDebtStatus(debtId: number): Promise<void> {
    try {
      console.log(`🔄 Actualizando estado de deuda ${debtId}...`);
      
      // Forzar una consulta fresca sin caché para asegurar que incluya el último pago
      // IMPORTANTE: Excluir pagos eliminados del cálculo
      const debt = await prisma.debt.findUnique({
        where: { id: debtId },
        include: {
          payments: {
            where: {
              deletedAt: null // Excluir pagos eliminados
            },
            orderBy: {
              createdAt: 'desc' // Ordenar por fecha de creación para ver los más recientes primero
            }
          }
        }
      });

      if (!debt) {
        console.error(`❌ Deuda ${debtId} no encontrada`);
        throw new Error('Deuda no encontrada');
      }

      console.log(`📋 Pagos activos encontrados para deuda ${debtId}:`, debt.payments.length);
      
      if (debt.payments.length === 0) {
        console.warn(`⚠️ No se encontraron pagos activos para la deuda ${debtId}. Esto puede indicar un problema.`);
      }
      
      const totalPaid = debt.payments.reduce((sum: number, payment: any) => {
        const paymentAmount = Number(payment.amount);
        console.log(`  - Pago ID ${payment.id}: $${paymentAmount.toFixed(2)}`);
        return sum + paymentAmount;
      }, 0);

      const initialAmount = Number(debt.initialAmount);
      const remainingAmount = initialAmount - totalPaid;

      console.log(`💰 Cálculo de montos para deuda ${debtId}:`, {
        initialAmount: initialAmount.toFixed(2),
        totalPaid: totalPaid.toFixed(2),
        remainingAmount: remainingAmount.toFixed(2),
        numPayments: debt.payments.length
      });
      const today = new Date();
      const dueDate = new Date(debt.dueDate);

      let newStatus: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' = 'PENDING';

      // Si está completamente pagada
      if (remainingAmount <= 0) {
        newStatus = 'PAID';
      } else {
        // Si tiene monto pendiente, siempre queda en PENDING
        // (incluso si tiene abonos parciales o está vencida)
        // Las deudas permanecen en PENDING hasta que se paguen completamente
        newStatus = 'PENDING';
      }

      console.log(`📊 Estado calculado para deuda ${debtId}:`, {
        totalPaid,
        remainingAmount,
        newStatus,
        previousStatus: debt.status
      });

      // Asegurar que remainingAmount no sea negativo
      const finalRemainingAmount = Math.max(0, remainingAmount);
      
      await prisma.debt.update({
        where: { id: debtId },
        data: {
          remainingAmount: finalRemainingAmount,
          status: newStatus
        }
      });

      console.log(`💾 Deuda ${debtId} actualizada en BD:`, {
        remainingAmount: finalRemainingAmount.toFixed(2),
        status: newStatus
      });

      console.log(`✅ Estado de deuda ${debtId} actualizado a: ${newStatus}`);
    } catch (error: any) {
      console.error(`❌ Error al actualizar estado de deuda ${debtId}:`, error);
      throw error;
    }
  }

  async getDebtById(id: number): Promise<DebtResponse | null> {
    const debt = await prisma.debt.findUnique({
      where: { id },
      include: {
        supplier: {
          select: {
            id: true,
            companyName: true,
            taxId: true,
            phone: true
          }
        },
        payments: {
          where: {
            deletedAt: null // Excluir pagos eliminados por defecto
          },
          include: {
            createdByUser: {
              select: {
                id: true,
                nombre: true,
                email: true
              }
            },
            deletedByUser: {
              select: {
                id: true,
                nombre: true,
                email: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!debt) {
      return null;
    }

    // Obtener el número secuencial de esta deuda para el proveedor
    const allDebtsForSupplier = await prisma.debt.findMany({
      where: { supplierId: debt.supplierId },
      orderBy: { createdAt: 'asc' },
      select: { id: true }
    });
    const debtNumber = allDebtsForSupplier.findIndex((d: any) => d.id === debt.id) + 1;

    return {
      id: debt.id,
      orderId: debt.orderId,
      supplierId: debt.supplierId,
      supplier: debt.supplier,
      initialAmount: Number(debt.initialAmount),
      remainingAmount: Number(debt.remainingAmount),
      status: debt.status,
      dueDate: debt.dueDate,
      createdAt: debt.createdAt,
      updatedAt: debt.updatedAt,
      debtNumber,
      payments: debt.payments.map((p: any) => ({
        id: p.id,
        debtId: p.debtId,
        supplierId: p.supplierId,
        supplier: debt.supplier,
        amount: Number(p.amount),
        paymentMethod: p.paymentMethod,
        senderName: p.senderName,
        senderEmail: p.senderEmail,
        confirmationNumber: p.confirmationNumber,
        paymentDate: p.paymentDate,
        receiptFile: p.receiptFile,
        verified: p.verified,
        createdBy: p.createdBy,
        deletedAt: p.deletedAt || null,
        deletedBy: p.deletedBy || null,
        deletedByUser: p.deletedByUser ? {
          id: p.deletedByUser.id,
          nombre: p.deletedByUser.nombre,
          email: p.deletedByUser.email
        } : null,
        deletionReason: p.deletionReason || null,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      }))
    };
  }

  async getDebtsBySupplier(
    supplierId: number,
    params?: SearchParams & PaginationParams & { includeDeletedPayments?: boolean }
  ): Promise<PaginatedResponse<DebtResponse>> {
    const page = params?.page || 1;
    const limit = params?.limit || 10;
    const skip = (page - 1) * limit;

    console.log(`🔍 Buscando deudas para proveedor ${supplierId} con filtros:`, {
      status: params?.status,
      startDate: params?.startDate,
      endDate: params?.endDate,
      page,
      limit
    });

    const where: any = {
      supplierId
    };

    if (params?.status) {
      where.status = params.status;
      console.log(`📋 Filtrando por estado: ${params.status}`);
    }

    if (params?.startDate || params?.endDate) {
      where.dueDate = {};
      if (params.startDate) {
        where.dueDate.gte = new Date(params.startDate);
      }
      if (params.endDate) {
        where.dueDate.lte = new Date(params.endDate);
      }
    }

    const [debts, total] = await Promise.all([
      prisma.debt.findMany({
        where,
        include: {
          supplier: {
            select: {
              id: true,
              companyName: true,
              taxId: true,
              phone: true
            }
          },
          payments: {
            where: params?.includeDeletedPayments ? {} : {
              deletedAt: null // Excluir pagos eliminados por defecto
            },
            include: {
              deletedByUser: {
                select: {
                  id: true,
                  nombre: true,
                  email: true
                }
              }
            },
            orderBy: {
              createdAt: 'desc'
            }
          }
        },
        orderBy: {
          dueDate: 'asc'
        },
        skip,
        take: limit
      }),
      prisma.debt.count({ where })
    ]);

    console.log(`📊 Deudas encontradas para proveedor ${supplierId}:`, {
      total: debts.length,
      totalCount: total,
      estados: debts.map((d: any) => ({ 
        id: d.id, 
        status: d.status, 
        remainingAmount: Number(d.remainingAmount).toFixed(2),
        numPayments: d.payments.length
      }))
    });

    // Calcular el número de deuda para cada una
    // Solo hacer esta consulta si realmente necesitamos el debtNumber
    // Para reportes grandes, podemos optimizar esto
    let allDebtsForSupplier: any[] = [];
    try {
      allDebtsForSupplier = await prisma.debt.findMany({
        where: { supplierId },
        orderBy: { createdAt: 'asc' },
        select: { id: true }
      });
      console.log(`📋 Total de deudas del proveedor para calcular números: ${allDebtsForSupplier.length}`);
    } catch (error: any) {
      console.error('⚠️ Error al obtener todas las deudas para calcular números:', error);
      // Continuar sin el debtNumber si hay error
    }

    return {
      data: debts.map((debt: any) => {
        const debtNumber = allDebtsForSupplier.findIndex((d: any) => d.id === debt.id) + 1;
        return {
          id: debt.id,
          orderId: debt.orderId,
          supplierId: debt.supplierId,
          supplier: debt.supplier,
          initialAmount: Number(debt.initialAmount),
          remainingAmount: Number(debt.remainingAmount),
          status: debt.status,
          dueDate: debt.dueDate,
          createdAt: debt.createdAt,
          updatedAt: debt.updatedAt,
          debtNumber,
          payments: debt.payments.map((p: any) => ({
            id: p.id,
            debtId: p.debtId,
            supplierId: p.supplierId,
            supplier: debt.supplier,
            amount: Number(p.amount),
            paymentMethod: p.paymentMethod,
            senderName: p.senderName,
            senderEmail: p.senderEmail,
            confirmationNumber: p.confirmationNumber,
            paymentDate: p.paymentDate,
            receiptFile: p.receiptFile,
            verified: p.verified,
            createdBy: p.createdBy,
            deletedAt: p.deletedAt || null,
            deletedBy: p.deletedBy || null,
            deletedByUser: p.deletedByUser ? {
              id: p.deletedByUser.id,
              nombre: p.deletedByUser.nombre,
              email: p.deletedByUser.email
            } : null,
            deletionReason: p.deletionReason || null,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt
          }))
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getAllDebts(
    params?: SearchParams & PaginationParams
  ): Promise<PaginatedResponse<DebtResponse>> {
    const page = params?.page || 1;
    const limit = params?.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params?.status) {
      where.status = params.status;
    }

    if (params?.startDate || params?.endDate) {
      where.dueDate = {};
      if (params.startDate) {
        where.dueDate.gte = new Date(params.startDate);
      }
      if (params.endDate) {
        where.dueDate.lte = new Date(params.endDate);
      }
    }

    const [debts, total] = await Promise.all([
      prisma.debt.findMany({
        where,
        include: {
          supplier: {
            select: {
              id: true,
              companyName: true,
              taxId: true,
              phone: true
            }
          },
          payments: {
            where: {
              deletedAt: null // Excluir pagos eliminados por defecto
            },
            include: {
              deletedByUser: {
                select: {
                  id: true,
                  nombre: true,
                  email: true
                }
              }
            },
            orderBy: {
              createdAt: 'desc'
            }
          }
        },
        orderBy: {
          dueDate: 'asc'
        },
        skip,
        take: limit
      }),
      prisma.debt.count({ where })
    ]);

    // Para cada deuda, calcular su número secuencial dentro de su proveedor
    const debtNumberMap = new Map<number, Map<number, number>>();
    
    // Agrupar deudas por proveedor y calcular números secuenciales
    const supplierIds = [...new Set(debts.map((d: any) => d.supplierId))];
    for (const supplierId of supplierIds) {
      const supplierDebts = await prisma.debt.findMany({
        where: { supplierId },
        orderBy: { createdAt: 'asc' },
        select: { id: true }
      });
      const supplierMap = new Map<number, number>();
      supplierDebts.forEach((debt: any, index: number) => {
        supplierMap.set(debt.id, index + 1);
      });
      debtNumberMap.set(supplierId as number, supplierMap);
    }

    return {
      data: debts.map((debt: any) => ({
        id: debt.id,
        orderId: debt.orderId,
        supplierId: debt.supplierId,
        supplier: debt.supplier,
        initialAmount: Number(debt.initialAmount),
        remainingAmount: Number(debt.remainingAmount),
        status: debt.status,
        dueDate: debt.dueDate,
        createdAt: debt.createdAt,
        updatedAt: debt.updatedAt,
        debtNumber: debtNumberMap.get(debt.supplierId)?.get(debt.id) || 1,
        payments: debt.payments.map((p: any) => ({
          id: p.id,
          debtId: p.debtId,
          supplierId: p.supplierId,
          supplier: debt.supplier,
          amount: Number(p.amount),
          paymentMethod: p.paymentMethod,
          senderName: p.senderName,
          confirmationNumber: p.confirmationNumber,
          paymentDate: p.paymentDate,
          receiptFile: p.receiptFile,
          verified: p.verified,
          createdBy: p.createdBy,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt
        }))
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}

