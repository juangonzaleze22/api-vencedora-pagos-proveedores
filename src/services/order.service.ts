import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { CreateOrderDTO, UpdateOrderDTO, OrderResponse, PaginationParams, PaginatedResponse } from '../types';
import { SupplierService } from './supplier.service';
import { AppError } from '../middleware/error.middleware';
import { getReceiptFileNames, buildReceiptUrls } from '../utils/receiptUrls';

const supplierService = new SupplierService();

export class OrderService {
  async createOrder(data: CreateOrderDTO, userId: number): Promise<OrderResponse> {
    const { supplierId, amount, dispatchDate, creditDays } = data;

    // Verificar que el proveedor existe
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId }
    });

    if (!supplier) {
      throw new Error('Proveedor no encontrado');
    }

    // Calcular fecha de vencimiento
    const dispatch = new Date(dispatchDate);
    const dueDate = new Date(dispatch);
    dueDate.setDate(dueDate.getDate() + creditDays);

    // Crear pedido
    const order = await prisma.order.create({
      data: {
        supplierId,
        amount,
        dispatchDate: dispatch,
        creditDays,
        dueDate,
        createdBy: userId
      },
      include: {
        supplier: {
          select: {
            id: true,
            companyName: true,
            taxId: true,
            phone: true
          }
        },
        createdByUser: {
          select: {
            id: true,
            nombre: true,
            email: true
          }
        }
      }
    });

    // Crear deuda automáticamente
    const debt = await prisma.debt.create({
      data: {
        orderId: order.id,
        supplierId,
        title: data.title ?? null,
        initialAmount: amount,
        remainingAmount: amount,
        dueDate,
        status: 'PENDING'
      }
    });

    // Actualizar total de deuda del proveedor
    await supplierService.updateSupplierTotalDebt(supplierId, Number(amount));

    return {
      id: order.id,
      supplierId: order.supplierId,
      supplier: order.supplier,
      amount: Number(order.amount),
      dispatchDate: order.dispatchDate,
      creditDays: order.creditDays,
      dueDate: order.dueDate,
      createdBy: order.createdBy,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      title: debt.title ?? null,
      debt: {
        id: debt.id,
        status: debt.status,
        remainingAmount: Number(debt.remainingAmount),
        initialAmount: Number(debt.initialAmount),
        dueDate: debt.dueDate,
        title: debt.title ?? undefined,
        createdAt: debt.createdAt,
        updatedAt: debt.updatedAt,
        payments: [] // Al crear la orden, aún no hay pagos
      }
    };
  }

  async getOrderById(id: number): Promise<OrderResponse | null> {
    const order = await prisma.order.findUnique({
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
        debt: {
          include: {
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
        }
      }
    });

    if (!order) {
      return null;
    }

    return {
      id: order.id,
      supplierId: order.supplierId,
      supplier: order.supplier,
      amount: Number(order.amount),
      dispatchDate: order.dispatchDate,
      creditDays: order.creditDays,
      dueDate: order.dueDate,
      createdBy: order.createdBy,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      title: order.debt?.title ?? null,
      debt: order.debt ? {
        id: order.debt.id,
        status: order.debt.status,
        remainingAmount: Number(order.debt.remainingAmount),
        initialAmount: Number(order.debt.initialAmount),
        dueDate: order.debt.dueDate,
        title: order.debt.title ?? undefined,
        createdAt: order.debt.createdAt,
        updatedAt: order.debt.updatedAt,
        payments: order.debt.payments.map((p: any) => ({
          id: p.id,
          debtId: p.debtId,
          supplierId: p.supplierId,
          supplier: order.supplier,
          amount: Number(p.amount),
          paymentMethod: p.paymentMethod,
          senderName: p.senderName,
          senderEmail: p.senderEmail,
          confirmationNumber: p.confirmationNumber,
          paymentDate: p.paymentDate,
          receiptFiles: buildReceiptUrls(p.id, getReceiptFileNames(p)),
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
      } : undefined
    };
  }

  async getOrdersBySupplier(
    supplierId: number,
    params?: PaginationParams
  ): Promise<PaginatedResponse<OrderResponse>> {
    const page = params?.page || 1;
    const limit = params?.limit || 10;
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { supplierId },
        include: {
          supplier: {
            select: {
              id: true,
              companyName: true,
              taxId: true,
              phone: true
            }
          },
          debt: {
            select: {
              id: true,
              status: true,
              remainingAmount: true,
              initialAmount: true,
              dueDate: true,
              title: true,
              createdAt: true,
              updatedAt: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.order.count({ where: { supplierId } })
    ]);

    return {
      data: orders.map((order: any) => ({
        id: order.id,
        supplierId: order.supplierId,
        supplier: order.supplier,
        amount: Number(order.amount),
        dispatchDate: order.dispatchDate,
        creditDays: order.creditDays,
        dueDate: order.dueDate,
        createdBy: order.createdBy,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        title: order.debt?.title ?? null,
        debt: order.debt ? {
          id: order.debt.id,
          status: order.debt.status,
          remainingAmount: Number(order.debt.remainingAmount),
          initialAmount: Number(order.debt.initialAmount),
          dueDate: order.debt.dueDate,
          title: order.debt.title ?? undefined,
          createdAt: order.debt.createdAt,
          updatedAt: order.debt.updatedAt
        } : undefined
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getAllOrders(params?: PaginationParams): Promise<PaginatedResponse<OrderResponse>> {
    const page = params?.page || 1;
    const limit = params?.limit || 10;
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        include: {
          supplier: {
            select: {
              id: true,
              companyName: true,
              taxId: true,
              phone: true
            }
          },
          debt: {
            select: {
              id: true,
              status: true,
              remainingAmount: true,
              initialAmount: true,
              dueDate: true,
              title: true,
              createdAt: true,
              updatedAt: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.order.count()
    ]);

    return {
      data: orders.map((order: any) => ({
        id: order.id,
        supplierId: order.supplierId,
        supplier: order.supplier,
        amount: Number(order.amount),
        dispatchDate: order.dispatchDate,
        creditDays: order.creditDays,
        dueDate: order.dueDate,
        createdBy: order.createdBy,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        title: order.debt?.title ?? null,
        debt: order.debt ? {
          id: order.debt.id,
          status: order.debt.status,
          remainingAmount: Number(order.debt.remainingAmount),
          initialAmount: Number(order.debt.initialAmount),
          dueDate: order.debt.dueDate,
          title: order.debt.title ?? undefined,
          createdAt: order.debt.createdAt,
          updatedAt: order.debt.updatedAt
        } : undefined
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Actualizar una orden
   * Permite actualizar dispatchDate, creditDays y/o amount
   * Recalcula automáticamente dueDate y sincroniza con la deuda asociada
   * Si amount cambia, actualiza la deuda y el proveedor
   */
  async updateOrder(
    orderId: number,
    data: UpdateOrderDTO
  ): Promise<OrderResponse> {
    try {
      console.log(`🔄 Actualizando orden ${orderId} con datos:`, data);

      // 1. Obtener la orden actual con su deuda asociada y pagos
      const currentOrder = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          supplier: {
            select: {
              id: true,
              companyName: true,
              taxId: true,
              phone: true,
              totalDebt: true,
              status: true
            }
          },
          debt: {
            include: {
              payments: {
                where: {
                  deletedAt: null
                }
              }
            }
          }
        }
      });

      if (!currentOrder) {
        throw new AppError('Orden no encontrada', 404);
      }

      // 2. Validar que al menos un campo se esté actualizando
      const oldAmount = Number(currentOrder.amount);
      const currentTitle = currentOrder.debt?.title ?? null;
      const newTitle = data.title !== undefined ? data.title : null;
      const hasChanges =
        (data.dispatchDate !== undefined && 
         new Date(data.dispatchDate).getTime() !== new Date(currentOrder.dispatchDate).getTime()) ||
        (data.creditDays !== undefined && data.creditDays !== currentOrder.creditDays) ||
        (data.amount !== undefined && data.amount !== oldAmount) ||
        (data.title !== undefined && newTitle !== currentTitle);

      if (!hasChanges) {
        throw new AppError('No se han realizado cambios en la orden', 400);
      }

      // 3. Validar amount si se proporciona
      if (data.amount !== undefined && data.amount <= 0) {
        throw new AppError('El monto debe ser mayor a 0', 400);
      }

      // 4. Calcular nuevos valores
      const newDispatchDate = data.dispatchDate 
        ? new Date(data.dispatchDate) 
        : new Date(currentOrder.dispatchDate);
      
      const newCreditDays = data.creditDays !== undefined 
        ? data.creditDays 
        : currentOrder.creditDays;

      const newAmount = data.amount !== undefined 
        ? data.amount 
        : oldAmount;

      // 5. Recalcular dueDate = dispatchDate + creditDays
      const newDueDate = new Date(newDispatchDate);
      newDueDate.setDate(newDueDate.getDate() + newCreditDays);

      console.log(`📅 Cálculo de fechas:`, {
        oldDispatchDate: currentOrder.dispatchDate,
        newDispatchDate: newDispatchDate,
        oldCreditDays: currentOrder.creditDays,
        newCreditDays: newCreditDays,
        oldDueDate: currentOrder.dueDate,
        newDueDate: newDueDate
      });

      // 6. Calcular cambios en deuda si amount cambió o si title se actualiza
      const amountChanged = data.amount !== undefined && data.amount !== oldAmount;
      let debtUpdateData: any = { dueDate: newDueDate };
      if (data.title !== undefined) {
        debtUpdateData.title = data.title;
      }
      let supplierUpdateData: any = {};

      if (amountChanged && currentOrder.debt) {
        const oldInitialAmount = Number(currentOrder.debt.initialAmount);
        const oldRemainingAmount = Number(currentOrder.debt.remainingAmount);
        
        // Calcular la diferencia en el monto inicial
        const difference = newAmount - oldAmount;
        
        // El remainingAmount debe ajustarse por la diferencia
        // Si aumentamos amount en $100, remainingAmount también aumenta en $100
        const newRemainingAmount = Math.max(0, oldRemainingAmount + difference);
        
        // Recalcular el status de la deuda
        const newDebtStatus: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' = 
          newRemainingAmount <= 0 ? 'PAID' : 'PENDING';

        debtUpdateData = {
          ...debtUpdateData,
          initialAmount: newAmount,
          remainingAmount: newRemainingAmount,
          status: newDebtStatus
        };

        console.log(`💰 Actualizando monto de orden:`, {
          oldAmount: oldAmount.toFixed(2),
          newAmount: newAmount.toFixed(2),
          difference: difference.toFixed(2),
          oldInitialAmount: oldInitialAmount.toFixed(2),
          newInitialAmount: newAmount.toFixed(2),
          oldRemainingAmount: oldRemainingAmount.toFixed(2),
          newRemainingAmount: newRemainingAmount.toFixed(2),
          newDebtStatus: newDebtStatus
        });
      }

      // 7. Actualizar en una transacción para mantener consistencia
      const updatedOrder = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Actualizar la orden
        const orderUpdateData: any = {
          dispatchDate: newDispatchDate,
          creditDays: newCreditDays,
          dueDate: newDueDate
        };
        
        if (amountChanged) {
          orderUpdateData.amount = newAmount;
        }

        const order = await tx.order.update({
          where: { id: orderId },
          data: orderUpdateData,
          include: {
            supplier: {
              select: {
                id: true,
                companyName: true,
                taxId: true,
                phone: true
              }
            }
          }
        });

        // Actualizar la deuda asociada (si existe)
        if (currentOrder.debt) {
          await tx.debt.update({
            where: { orderId: orderId },
            data: debtUpdateData
          });
          console.log(`✅ Deuda ${currentOrder.debt.id} actualizada`);
        }

        // Si amount cambió, recalcular totalDebt del proveedor
        if (amountChanged) {
          // Obtener todas las deudas del proveedor
          const allDebtsForSupplier = await tx.debt.findMany({
            where: {
              supplierId: currentOrder.supplierId
            },
            select: {
              remainingAmount: true
            }
          });

          const newTotalDebt = allDebtsForSupplier.reduce((sum: number, debt: any) => {
            return sum + Math.max(0, Number(debt.remainingAmount));
          }, 0);

          // El status del proveedor se calcula automáticamente: PENDING si totalDebt > 0, COMPLETED si totalDebt === 0
          const supplierStatus: 'PENDING' | 'COMPLETED' = newTotalDebt > 0 ? 'PENDING' : 'COMPLETED';

          await tx.supplier.update({
            where: { id: currentOrder.supplierId },
            data: {
              totalDebt: newTotalDebt,
              status: supplierStatus
            }
          });

          console.log(`💰 Proveedor ${currentOrder.supplierId} actualizado:`, {
            oldTotalDebt: Number(currentOrder.supplier.totalDebt).toFixed(2),
            newTotalDebt: newTotalDebt.toFixed(2),
            oldStatus: currentOrder.supplier.status,
            newStatus: supplierStatus
          });
        }

        return order;
      });

      console.log(`✅ Orden ${orderId} actualizada en BD`);

      // 6. Obtener la orden completa con su deuda para construir la respuesta
      const orderWithDebt = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          supplier: {
            select: {
              id: true,
              companyName: true,
              taxId: true,
              phone: true
            }
          },
          debt: {
            include: {
              payments: {
                where: {
                  deletedAt: null
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
          }
        }
      });

      if (!orderWithDebt) {
        throw new AppError('Error al obtener la orden actualizada', 500);
      }

      // 7. Construir respuesta en el formato OrderResponse
      return {
        id: orderWithDebt.id,
        supplierId: orderWithDebt.supplierId,
        supplier: orderWithDebt.supplier,
        amount: Number(orderWithDebt.amount),
        dispatchDate: orderWithDebt.dispatchDate,
        creditDays: orderWithDebt.creditDays,
        dueDate: orderWithDebt.dueDate,
        createdBy: orderWithDebt.createdBy,
        createdAt: orderWithDebt.createdAt,
        updatedAt: orderWithDebt.updatedAt,
        title: orderWithDebt.debt?.title ?? null,
        debt: orderWithDebt.debt ? {
          id: orderWithDebt.debt.id,
          status: orderWithDebt.debt.status,
          remainingAmount: Number(orderWithDebt.debt.remainingAmount),
          initialAmount: Number(orderWithDebt.debt.initialAmount),
          dueDate: orderWithDebt.debt.dueDate,
          title: orderWithDebt.debt.title ?? undefined,
          createdAt: orderWithDebt.debt.createdAt,
          updatedAt: orderWithDebt.debt.updatedAt,
          payments: orderWithDebt.debt.payments.map((p: any) => ({
            id: p.id,
            debtId: p.debtId,
            supplierId: p.supplierId,
            supplier: orderWithDebt.supplier,
            amount: Number(p.amount),
            paymentMethod: p.paymentMethod,
            senderName: p.senderName,
            senderEmail: p.senderEmail,
            confirmationNumber: p.confirmationNumber,
            paymentDate: p.paymentDate,
            receiptFiles: buildReceiptUrls(p.id, getReceiptFileNames(p)),
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
        } : undefined
      };
    } catch (error: any) {
      console.error(`❌ Error al actualizar orden ${orderId}:`, error);
      throw error;
    }
  }
}

