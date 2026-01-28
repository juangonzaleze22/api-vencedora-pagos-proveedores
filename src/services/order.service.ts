import prisma from '../config/database';
import { CreateOrderDTO, OrderResponse, PaginationParams, PaginatedResponse } from '../types';
import { SupplierService } from './supplier.service';

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
      debt: {
        id: debt.id,
        status: debt.status,
        remainingAmount: Number(debt.remainingAmount),
        initialAmount: Number(debt.initialAmount),
        dueDate: debt.dueDate,
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
      debt: order.debt ? {
        id: order.debt.id,
        status: order.debt.status,
        remainingAmount: Number(order.debt.remainingAmount),
        initialAmount: Number(order.debt.initialAmount),
        dueDate: order.debt.dueDate,
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
        debt: order.debt ? {
          id: order.debt.id,
          status: order.debt.status,
          remainingAmount: Number(order.debt.remainingAmount),
          initialAmount: Number(order.debt.initialAmount),
          dueDate: order.debt.dueDate,
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
        debt: order.debt ? {
          id: order.debt.id,
          status: order.debt.status,
          remainingAmount: Number(order.debt.remainingAmount),
          initialAmount: Number(order.debt.initialAmount),
          dueDate: order.debt.dueDate,
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
}

