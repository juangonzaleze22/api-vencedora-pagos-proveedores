import prisma from '../config/database';
import {
  CreateSupplierDTO,
  UpdateSupplierDTO,
  SupplierResponse,
  SearchParams,
  PaginationParams,
  PaginatedResponse
} from '../types';
import type { SupplierStatus } from '../types';
import { AppError } from '../middleware/error.middleware';

export class SupplierService {
  async createSupplier(data: CreateSupplierDTO, userId: number): Promise<SupplierResponse> {
    const { companyName, taxId, phone, status, initialDebtAmount, debtDate, creditDays } = data;

    // Validar que el taxId sea único
    const existingSupplier = await prisma.supplier.findUnique({
      where: { taxId }
    });

    if (existingSupplier) {
      throw new Error('Ya existe un proveedor con este RIF/Identificación Fiscal');
    }

    // Convertir initialDebtAmount a número si viene como string
    const debtAmount = typeof initialDebtAmount === 'string' 
      ? parseFloat(initialDebtAmount) 
      : (initialDebtAmount || 0);

    // Crear proveedor
    // El status se calculará dinámicamente basado en totalDebt
    // Si tiene deuda inicial, será PENDING, si no, COMPLETED
    const initialStatus: SupplierStatus = debtAmount > 0 ? 'PENDING' : 'COMPLETED';
    const supplier = await prisma.supplier.create({
      data: {
        companyName,
        taxId,
        phone,
        status: (status as SupplierStatus) || initialStatus,
        totalDebt: debtAmount
      }
    });

    // Si hay deuda inicial, crear pedido y deuda
    if (debtAmount > 0 && debtDate && creditDays) {
      const dispatchDate = new Date(debtDate);
      const dueDate = new Date(dispatchDate);
      dueDate.setDate(dueDate.getDate() + creditDays);

      const creditDaysNum = typeof creditDays === 'string' ? parseInt(creditDays) : creditDays;

      const order = await prisma.order.create({
        data: {
          supplierId: supplier.id,
          amount: debtAmount,
          dispatchDate,
          creditDays: creditDaysNum,
          dueDate,
          createdBy: userId
        }
      });

      await prisma.debt.create({
        data: {
          orderId: order.id,
          supplierId: supplier.id,
          initialAmount: debtAmount,
          remainingAmount: debtAmount,
          dueDate,
          status: 'PENDING'
        }
      });
    }

    return this.mapToResponse(supplier);
  }

  async getSupplierById(id: number): Promise<SupplierResponse | null> {
    const supplier = await prisma.supplier.findUnique({
      where: { id }
    });

    if (!supplier) {
      return null;
    }

    return this.mapToResponse(supplier);
  }

  async searchSuppliers(
    search?: string,
    params?: SearchParams & PaginationParams
  ): Promise<PaginatedResponse<SupplierResponse>> {
    const page = params?.page || 1;
    const limit = params?.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: 'insensitive' } },
        { taxId: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Filtro por status - temporalmente deshabilitado hasta regenerar cliente de Prisma
    // TODO: Habilitar después de ejecutar: npx prisma generate
    // if (params?.status) {
    //   where.status = params.status;
    // }
    
    // Filtro temporal: usar totalDebt en lugar de status hasta regenerar Prisma
    // Verificar que el status sea de tipo SupplierStatus (PENDING o COMPLETED)
    if (params?.status) {
      const supplierStatus = params.status as SupplierStatus;
      if (supplierStatus === 'PENDING') {
        where.totalDebt = { gt: 0 };
      } else if (supplierStatus === 'COMPLETED') {
        where.totalDebt = { equals: 0 };
      }
    }

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        orderBy: {
          companyName: 'asc'
        },
        skip,
        take: limit
      }),
      prisma.supplier.count({ where })
    ]);

    return {
      data: suppliers.map((s: any) => this.mapToResponse(s)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async updateSupplier(id: number, data: UpdateSupplierDTO): Promise<SupplierResponse> {
    const supplier = await prisma.supplier.findUnique({
      where: { id }
    });

    if (!supplier) {
      throw new AppError('Proveedor no encontrado', 404);
    }

    // Validar que al menos un campo se esté actualizando
    const hasChanges = 
      (data.companyName !== undefined && data.companyName !== supplier.companyName) ||
      (data.taxId !== undefined && data.taxId !== supplier.taxId) ||
      (data.phone !== undefined && data.phone !== supplier.phone) ||
      (data.status !== undefined && data.status !== supplier.status);

    if (!hasChanges) {
      throw new AppError('No se han realizado cambios en el proveedor', 400);
    }

    // Si se actualiza el taxId, verificar que sea único
    if (data.taxId !== undefined && data.taxId !== supplier.taxId) {
      // Validar que el taxId no esté vacío
      if (!data.taxId || data.taxId.trim() === '') {
        throw new AppError('El RIF/Identificación Fiscal no puede estar vacío', 400);
      }

      const existingSupplier = await prisma.supplier.findUnique({
        where: { taxId: data.taxId.trim() }
      });

      if (existingSupplier) {
        throw new AppError('Ya existe un proveedor con este RIF/Identificación Fiscal', 400);
      }
    }

    // Preparar datos para actualizar
    const updateData: any = {};

    if (data.companyName !== undefined) {
      if (!data.companyName || data.companyName.trim().length < 3) {
        throw new AppError('El nombre de la empresa debe tener al menos 3 caracteres', 400);
      }
      updateData.companyName = data.companyName.trim();
    }

    if (data.taxId !== undefined) {
      updateData.taxId = data.taxId.trim();
    }

    if (data.phone !== undefined) {
      // Permitir null o string vacío para limpiar el teléfono
      updateData.phone = data.phone === null || data.phone === '' ? null : data.phone.trim();
    }

    if (data.status !== undefined) {
      // Validar que el status sea válido
      if (data.status !== 'PENDING' && data.status !== 'COMPLETED') {
        throw new AppError('El estado debe ser PENDING o COMPLETED', 400);
      }
      updateData.status = data.status;
    }

    const updated = await prisma.supplier.update({
      where: { id },
      data: updateData
    });

    return this.mapToResponse(updated);
  }

  async deleteSupplier(id: number): Promise<void> {
    const supplier = await prisma.supplier.findUnique({
      where: { id }
    });

    if (!supplier) {
      throw new AppError('Proveedor no encontrado', 404);
    }

    await prisma.supplier.delete({
      where: { id }
    });
  }

  async updateSupplierTotalDebt(supplierId: number, amount: number): Promise<void> {
    try {
      console.log(`🔄 Actualizando total de deuda del proveedor ${supplierId} con incremento: ${amount}`);
      
      // Primero obtener el proveedor para calcular el nuevo totalDebt
      const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
        select: { totalDebt: true }
      });

      if (!supplier) {
        throw new Error('Proveedor no encontrado');
      }

      const newTotalDebt = Number(supplier.totalDebt) + amount;
      
      // Calcular el nuevo status basado en el totalDebt actualizado
      const newStatus: SupplierStatus = newTotalDebt > 0 ? 'PENDING' : 'COMPLETED';
      
      await prisma.supplier.update({
        where: { id: supplierId },
        data: {
          totalDebt: {
            increment: amount
          },
          status: newStatus // Actualizar status automáticamente
        }
      });
      console.log(`✅ Total de deuda actualizado para proveedor ${supplierId}. Nuevo status: ${newStatus}`);
    } catch (error: any) {
      console.error(`❌ Error al actualizar total de deuda del proveedor ${supplierId}:`, error);
      throw error;
    }
  }

  async updateSupplierLastPaymentDate(supplierId: number, date: Date): Promise<void> {
    try {
      console.log(`🔄 Actualizando última fecha de pago del proveedor ${supplierId} a: ${date}`);
      await prisma.supplier.update({
        where: { id: supplierId },
        data: {
          lastPaymentDate: date
        }
      });
      console.log(`✅ Última fecha de pago actualizada para proveedor ${supplierId}`);
    } catch (error: any) {
      console.error(`❌ Error al actualizar última fecha de pago del proveedor ${supplierId}:`, error);
      throw error;
    }
  }

  private mapToResponse(supplier: any): SupplierResponse {
    return {
      id: supplier.id,
      companyName: supplier.companyName,
      taxId: supplier.taxId,
      phone: supplier.phone,
      status: supplier.status,
      totalDebt: Number(supplier.totalDebt),
      lastPaymentDate: supplier.lastPaymentDate,
      createdAt: supplier.createdAt,
      updatedAt: supplier.updatedAt
    };
  }
}

