// Los enums se importan del cliente generado de Prisma
// Si hay error, ejecutar: npm run prisma:generate
export type SupplierStatus = 'PENDING' | 'COMPLETED';
export type DebtStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
export type PaymentMethod = 'ZELLE' | 'TRANSFER' | 'CASH';

// Auth Types
export interface LoginDTO {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: number;
    email: string;
    nombre: string;
    rol: {
      id: number;
      nombre: string;
    };
  };
}

// Supplier Types
export interface CreateSupplierDTO {
  companyName: string;
  taxId: string;
  email?: string;
  phone?: string;
  status?: SupplierStatus;
  initialDebtAmount?: number;
  debtDate?: Date;
  creditDays?: number;
}

export interface UpdateSupplierDTO {
  companyName?: string;
  taxId?: string;
  email?: string;
  phone?: string;
  status?: SupplierStatus;
}

export interface SupplierResponse {
  id: number;
  companyName: string;
  taxId: string;
  email: string | null;
  phone: string | null;
  status: SupplierStatus;
  totalDebt: number;
  lastPaymentDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Order Types
export interface CreateOrderDTO {
  supplierId: number;
  amount: number;
  dispatchDate: Date;
  creditDays: number;
}

export interface UpdateOrderDTO {
  dispatchDate?: Date | string;
  creditDays?: number;
  amount?: number;
}

export interface OrderResponse {
  id: number;
  supplierId: number;
  supplier: {
    id: number;
    companyName: string;
    taxId: string;
    phone: string | null;
  };
  amount: number;
  dispatchDate: Date;
  creditDays: number;
  dueDate: Date;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
  debt?: {
    id: number;
    status: DebtStatus;
    remainingAmount: number;
    initialAmount: number;
    dueDate: Date;
    createdAt: Date;
    updatedAt: Date;
    payments?: PaymentResponse[];
  };
}

// Debt Types
export interface UpdateDebtDTO {
  initialAmount?: number;
  dueDate?: Date | string;
}

export interface DebtResponse {
  id: number;
  orderId: number;
  supplierId: number;
  supplier: {
    id: number;
    companyName: string;
    taxId: string;
    phone: string | null;
  };
  initialAmount: number;
  remainingAmount: number;
  status: DebtStatus;
  dueDate: Date;
  createdAt: Date;
  updatedAt: Date;
  debtNumber?: number; // Número secuencial de deuda para este proveedor (1, 2, 3...)
  payments?: PaymentResponse[];
}

// Payment Types
export interface CreatePaymentDTO {
  debtId: number;
  supplierId: number;
  amount: number;
  paymentMethod: PaymentMethod;
  senderName: string;
  senderEmail?: string;
  confirmationNumber?: string;
  paymentDate: Date;
  exchangeRate?: number; // Tasa del dólar (opcional, solo para pagos en BS)
  amountInBolivares?: number; // Monto en bolívares (opcional, solo para pagos en BS)
}

export interface PaymentResponse {
  id: number;
  debtId: number;
  supplierId: number;
  supplier: {
    id: number;
    companyName: string;
    taxId: string;
    phone: string | null;
  };
  amount: number;
  paymentMethod: PaymentMethod;
  senderName: string;
  senderEmail: string | null;
  confirmationNumber: string | null;
  paymentDate: Date;
  receiptFile: string | null;
  verified: boolean;
  shared: boolean;
  sharedAt: Date | null;
  exchangeRate: number | null; // Tasa del dólar (opcional, solo para pagos en BS)
  amountInBolivares: number | null; // Monto en bolívares (opcional, solo para pagos en BS)
  createdBy: number;
  deletedAt?: Date | null;
  deletedBy?: number | null;
  deletedByUser?: {
    id: number;
    nombre: string;
    email: string;
  } | null;
  deletionReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
  debt?: {
    id: number;
    orderId: number;
    status: DebtStatus;
    initialAmount: number;
    remainingAmount: number;
    dueDate: Date;
    createdAt: Date;
    updatedAt: Date;
  };
}

export interface VerifyZelleDTO {
  confirmationNumber: string;
}

export interface DeletePaymentDTO {
  reason?: string;
}

// Report Types
export interface DashboardStats {
  pendingPayments: number;
  processedPayments: number;
  totalSuppliers: number;
  totalDebt: number;
}

export interface SupplierDetailedReport {
  supplier: SupplierResponse;
  totalPaid: number;
  paymentCount: number;
  averagePayment: number;
  debts: DebtResponse[];
  payments: PaymentResponse[];
  paymentsPagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Query Types
export interface PaginationParams {
  page?: number;
  limit?: number;
  includeDeleted?: boolean;
}

export interface SearchParams {
  search?: string;
  status?: SupplierStatus | DebtStatus;
  startDate?: Date;
  endDate?: Date;
  includeDeleted?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

