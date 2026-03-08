import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { CreditResponse, ApplyCreditDTO, PaginationParams } from '../types';
import { AppError } from '../middleware/error.middleware';
import { SupplierService } from './supplier.service';

const supplierService = new SupplierService();

export class CreditService {
  /**
   * Obtiene el saldo excedente total disponible (suma de remaining de créditos AVAILABLE/PARTIALLY_USED) del proveedor.
   */
  async getTotalAvailableCredit(supplierId: number): Promise<number> {
    const credits = await prisma.credit.findMany({
      where: {
        supplierId,
        status: { in: ['AVAILABLE', 'PARTIALLY_USED'] },
        remaining: { gt: 0 }
      },
      select: { remaining: true }
    });
    return credits.reduce((sum: number, c: { remaining: unknown }) => sum + Number(c.remaining), 0);
  }

  /**
   * Consume un monto del saldo excedente del proveedor (FIFO). Actualiza los créditos reduciendo remaining.
   * Usar dentro de una transacción pasando tx para mantener consistencia.
   */
  async consumeCreditFromSupplier(
    supplierId: number,
    amount: number,
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    if (amount <= 0) return;
    const client = tx ?? prisma;

    const credits = await client.credit.findMany({
      where: {
        supplierId,
        status: { in: ['AVAILABLE', 'PARTIALLY_USED'] },
        remaining: { gt: 0 }
      },
      orderBy: { id: 'asc' }
    });

    let remainingToConsume = amount;
    for (const credit of credits) {
      if (remainingToConsume <= 0) break;
      const creditRemaining = Number(credit.remaining);
      const consumeFromThis = Math.min(remainingToConsume, creditRemaining);
      const newRemaining = creditRemaining - consumeFromThis;
      remainingToConsume -= consumeFromThis;

      await client.credit.update({
        where: { id: credit.id },
        data: {
          remaining: newRemaining,
          status: newRemaining <= 0 ? 'USED' : 'PARTIALLY_USED'
        }
      });
    }
  }

  async listCredits(
    params?: PaginationParams & { status?: string; supplierId?: number }
  ): Promise<{ data: CreditResponse[]; summary: { totalAvailable: number }; pagination: any }> {
    const page = params?.page || 1;
    const limit = params?.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = params?.status
      ? { status: params.status }
      : { status: { in: ['AVAILABLE', 'PARTIALLY_USED'] } };

    if (params?.supplierId) {
      where.supplierId = params.supplierId;
    }

    const [credits, total] = await Promise.all([
      prisma.credit.findMany({
        where,
        include: {
          supplier: {
            select: { id: true, companyName: true }
          },
          payment: {
            select: {
              id: true,
              senderName: true,
              paymentDate: true,
              amount: true
            }
          },
          originDebt: {
            select: {
              id: true,
              title: true,
              supplier: {
                select: { id: true, companyName: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.credit.count({ where })
    ]);

    const totalAvailable = credits.reduce(
      (sum: number, c: any) => sum + Number(c.remaining),
      0
    );

    return {
      data: credits.map((c: any) => ({
        id: c.id,
        paymentId: c.paymentId,
        originDebtId: c.originDebtId,
        supplierId: c.supplierId,
        amount: Number(c.amount),
        remaining: Number(c.remaining),
        status: c.status,
        description: c.description,
        supplier: c.supplier,
        payment: {
          id: c.payment.id,
          senderName: c.payment.senderName,
          paymentDate: c.payment.paymentDate,
          amount: Number(c.payment.amount)
        },
        originDebt: {
          id: c.originDebt.id,
          title: c.originDebt.title,
          supplier: c.originDebt.supplier
        },
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      })),
      summary: { totalAvailable },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getCreditById(id: number): Promise<CreditResponse | null> {
    const credit = await prisma.credit.findUnique({
      where: { id },
      include: {
        supplier: {
          select: { id: true, companyName: true }
        },
        payment: {
          select: {
            id: true,
            senderName: true,
            paymentDate: true,
            amount: true
          }
        },
        originDebt: {
          select: {
            id: true,
            title: true,
            supplier: {
              select: { id: true, companyName: true }
            }
          }
        }
      }
    });

    if (!credit) return null;

    return {
      id: credit.id,
      paymentId: credit.paymentId,
      originDebtId: credit.originDebtId,
      supplierId: credit.supplierId,
      amount: Number(credit.amount),
      remaining: Number(credit.remaining),
      status: credit.status as any,
      description: credit.description,
      supplier: credit.supplier,
      payment: {
        id: credit.payment.id,
        senderName: credit.payment.senderName,
        paymentDate: credit.payment.paymentDate,
        amount: Number(credit.payment.amount)
      },
      originDebt: {
        id: credit.originDebt.id,
        title: credit.originDebt.title,
        supplier: credit.originDebt.supplier
      },
      createdAt: credit.createdAt,
      updatedAt: credit.updatedAt
    };
  }

  async applyCredit(
    creditId: number,
    data: ApplyCreditDTO
  ): Promise<{ credit: CreditResponse; debt: any; appliedAmount: number }> {
    const credit = await prisma.credit.findUnique({ where: { id: creditId } });

    if (!credit) {
      throw new AppError('Crédito no encontrado', 404);
    }

    if (credit.status === 'USED' || Number(credit.remaining) <= 0) {
      throw new AppError('Este crédito ya fue utilizado completamente', 400);
    }

    const debt = await prisma.debt.findUnique({
      where: { id: data.debtId },
      include: {
        supplier: {
          select: { id: true, companyName: true, taxId: true, phone: true }
        }
      }
    });

    if (!debt) {
      throw new AppError('Deuda no encontrada', 404);
    }

    if (debt.status === 'PAID' || Number(debt.remainingAmount) <= 0) {
      throw new AppError('La deuda ya está completamente pagada', 400);
    }

    const requestedAmount = Number(data.amount);
    if (requestedAmount <= 0) {
      throw new AppError('El monto a aplicar debe ser mayor a 0', 400);
    }

    const applyAmount = Math.min(
      requestedAmount,
      Number(credit.remaining),
      Number(debt.remainingAmount)
    );

    const newCreditRemaining = Number(credit.remaining) - applyAmount;
    const newDebtRemaining = Number(debt.remainingAmount) - applyAmount;

    const updatedCredit = await prisma.credit.update({
      where: { id: creditId },
      data: {
        remaining: Math.max(0, newCreditRemaining),
        status: newCreditRemaining <= 0 ? 'USED' : 'PARTIALLY_USED'
      },
      include: {
        supplier: {
          select: { id: true, companyName: true }
        },
        payment: {
          select: { id: true, senderName: true, paymentDate: true, amount: true }
        },
        originDebt: {
          select: {
            id: true,
            title: true,
            supplier: { select: { id: true, companyName: true } }
          }
        }
      }
    });

    const updatedDebt = await prisma.debt.update({
      where: { id: data.debtId },
      data: {
        remainingAmount: Math.max(0, newDebtRemaining),
        status: newDebtRemaining <= 0 ? 'PAID' : 'PENDING'
      },
      include: {
        supplier: {
          select: { id: true, companyName: true, taxId: true, phone: true }
        }
      }
    });

    await supplierService.updateSupplierTotalDebt(debt.supplierId, -applyAmount);

    console.log(`✅ Crédito #${creditId} aplicado a deuda #${data.debtId}: $${applyAmount.toFixed(2)}`);

    return {
      credit: {
        id: updatedCredit.id,
        paymentId: updatedCredit.paymentId,
        originDebtId: updatedCredit.originDebtId,
        supplierId: updatedCredit.supplierId,
        amount: Number(updatedCredit.amount),
        remaining: Number(updatedCredit.remaining),
        status: updatedCredit.status as any,
        description: updatedCredit.description,
        supplier: updatedCredit.supplier,
        payment: {
          id: updatedCredit.payment.id,
          senderName: updatedCredit.payment.senderName,
          paymentDate: updatedCredit.payment.paymentDate,
          amount: Number(updatedCredit.payment.amount)
        },
        originDebt: {
          id: updatedCredit.originDebt.id,
          title: updatedCredit.originDebt.title,
          supplier: updatedCredit.originDebt.supplier
        },
        createdAt: updatedCredit.createdAt,
        updatedAt: updatedCredit.updatedAt
      },
      debt: {
        id: updatedDebt.id,
        supplierId: updatedDebt.supplierId,
        supplier: updatedDebt.supplier,
        initialAmount: Number(updatedDebt.initialAmount),
        remainingAmount: Number(updatedDebt.remainingAmount),
        status: updatedDebt.status
      },
      appliedAmount: applyAmount
    };
  }
}
