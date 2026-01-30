# Guía para el Frontend: Actualizar Orden

## ✅ Endpoint Disponible

```
PUT /api/orders/:id
```

**Autenticación requerida:** Sí (token JWT)  
**Autorización requerida:** ADMINISTRADOR o SUPERVISOR

## 📋 Campos que se Pueden Actualizar

```typescript
interface UpdateOrderDTO {
  dispatchDate?: Date | string;  // Fecha de despacho (opcional)
  creditDays?: number;            // Días de crédito (opcional)
  amount?: number;                // Monto de la orden (opcional)
}
```

**Notas importantes:**
- Todos los campos son opcionales, pero **debes enviar al menos uno**
- `dispatchDate` debe ser una fecha válida (formato ISO 8601)
- `creditDays` debe ser un número entero mayor a 0
- `amount` debe ser un número mayor a 0
- El sistema **recalcula automáticamente** `dueDate = dispatchDate + creditDays`
- La fecha de vencimiento (`dueDate`) se actualiza tanto en la **orden** como en la **deuda asociada** automáticamente
- Si `amount` cambia, se actualiza automáticamente:
  - `debt.initialAmount` = nuevo `amount`
  - `debt.remainingAmount` = se ajusta según la diferencia
  - `debt.status` = se recalcula según el nuevo `remainingAmount`
  - `supplier.totalDebt` = suma de todas las deudas restantes
  - `supplier.status` = PENDING si `totalDebt > 0`, COMPLETED si `totalDebt === 0`
- Todo se hace en una **transacción** para evitar discrepancias

## 🔒 Validaciones del Backend

### Validaciones Automáticas:

1. **`dispatchDate`**: 
   - Debe ser una fecha válida
   - Formato aceptado: ISO 8601 (ej: "2024-12-31" o "2024-12-31T00:00:00.000Z")

2. **`creditDays`**: 
   - Debe ser un número entero
   - Debe ser mayor a 0

3. **`amount`**: 
   - Debe ser un número
   - Debe ser mayor a 0

4. **Al menos un campo**: Debes enviar `dispatchDate`, `creditDays` o `amount` (o cualquier combinación)

### Errores Posibles:

```typescript
// Errores que el backend puede devolver:
- "ID de orden inválido" (400)
- "Orden no encontrada" (404)
- "No se han realizado cambios en la orden" (400)
- "La fecha de despacho debe ser una fecha válida" (400)
- "Los días de crédito deben ser mayor a 0" (400)
- "El monto debe ser un número mayor a 0" (400)
- "Debe proporcionar al menos dispatchDate, creditDays o amount para actualizar" (400)
- "Usuario no autenticado" (401)
- "No tienes permisos para realizar esta acción" (403)
```

**Formato de respuesta de error:**
```json
{
  "success": false,
  "message": "Mensaje de error descriptivo"
}
```

## 📝 Ejemplos de Uso

### 1. Ejemplo con cURL

```bash
# Actualizar solo la fecha de despacho
curl -X PUT "http://localhost:3000/api/orders/123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dispatchDate": "2024-12-31"
  }'

# Actualizar solo los días de crédito
curl -X PUT "http://localhost:3000/api/orders/123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "creditDays": 45
  }'

# Actualizar ambos campos
curl -X PUT "http://localhost:3000/api/orders/123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dispatchDate": "2024-12-31",
    "creditDays": 45
  }'

# Actualizar solo el monto
curl -X PUT "http://localhost:3000/api/orders/123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 2000.00
  }'

# Actualizar todos los campos
curl -X PUT "http://localhost:3000/api/orders/123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dispatchDate": "2024-12-31",
    "creditDays": 45,
    "amount": 2000.00
  }'
```

### 2. Ejemplo con JavaScript/Fetch

```javascript
async function updateOrder(orderId, data) {
  const token = localStorage.getItem('token'); // O tu método de obtener el token
  
  try {
    const response = await fetch(`http://localhost:3000/api/orders/${orderId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al actualizar la orden');
    }

    const result = await response.json();
    return result.data; // Retorna la orden actualizada
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Uso:
// Actualizar solo fecha de despacho
await updateOrder(123, { dispatchDate: '2024-12-31' });

// Actualizar solo días de crédito
await updateOrder(123, { creditDays: 45 });

// Actualizar ambos
await updateOrder(123, { 
  dispatchDate: '2024-12-31', 
  creditDays: 45 
});

// Actualizar solo el monto
await updateOrder(123, { amount: 2000.00 });

// Actualizar todos los campos
await updateOrder(123, { 
  dispatchDate: '2024-12-31', 
  creditDays: 45,
  amount: 2000.00
});
```

### 3. Ejemplo con Axios

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor para agregar el token automáticamente
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Función para actualizar orden
async function updateOrder(orderId, data) {
  try {
    const response = await api.put(`/orders/${orderId}`, data);
    return response.data.data; // Retorna la orden actualizada
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.message || 'Error al actualizar la orden');
    }
    throw error;
  }
}

// Uso:
await updateOrder(123, { dispatchDate: '2024-12-31', creditDays: 45 });
```

### 4. Ejemplo con Angular

#### Servicio (order.service.ts)

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

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
    status: string;
    remainingAmount: number;
    initialAmount: number;
    dueDate: Date;
    createdAt: Date;
    updatedAt: Date;
    payments?: any[];
  };
}

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private apiUrl = `${environment.apiUrl}/orders`;

  constructor(private http: HttpClient) {}

  /**
   * Obtener una orden por ID
   */
  getOrderById(id: number): Observable<{ success: boolean; data: OrderResponse }> {
    return this.http.get<{ success: boolean; data: OrderResponse }>(
      `${this.apiUrl}/${id}`
    );
  }

  /**
   * Actualizar una orden
   */
  updateOrder(
    id: number,
    data: UpdateOrderDTO
  ): Observable<{ success: boolean; message: string; data: OrderResponse }> {
    return this.http.put<{ success: boolean; message: string; data: OrderResponse }>(
      `${this.apiUrl}/${id}`,
      data
    );
  }
}
```

#### Componente (update-order.component.ts)

```typescript
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { OrderService, OrderResponse } from '../services/order.service';

@Component({
  selector: 'app-update-order',
  templateUrl: './update-order.component.html',
  styleUrls: ['./update-order.component.css']
})
export class UpdateOrderComponent implements OnInit {
  orderForm: FormGroup;
  orderId: number;
  order: OrderResponse | null = null;
  loading = false;
  error: string | null = null;
  success = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private orderService: OrderService
  ) {
    this.orderForm = this.fb.group({
      dispatchDate: ['', Validators.required],
      creditDays: ['', [Validators.required, Validators.min(1)]],
      amount: ['', [Validators.required, Validators.min(0.01)]]
    });
  }

  ngOnInit(): void {
    this.orderId = +this.route.snapshot.params['id'];
    this.loadOrder();
  }

  loadOrder(): void {
    this.loading = true;
    this.orderService.getOrderById(this.orderId).subscribe({
      next: (response) => {
        this.order = response.data;
        // Prellenar el formulario con los datos actuales
        this.orderForm.patchValue({
          dispatchDate: this.formatDateForInput(this.order.dispatchDate),
          creditDays: this.order.creditDays,
          amount: this.order.amount
        });
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Error al cargar la orden: ' + (err.error?.message || err.message);
        this.loading = false;
      }
    });
  }

  onSubmit(): void {
    if (this.orderForm.invalid) {
      this.markFormGroupTouched(this.orderForm);
      return;
    }

    this.loading = true;
    this.error = null;
    this.success = false;

    const formValue = this.orderForm.value;
    const updateData: any = {};

    // Solo incluir campos que han cambiado
    if (formValue.dispatchDate !== this.formatDateForInput(this.order?.dispatchDate)) {
      updateData.dispatchDate = formValue.dispatchDate;
    }
    if (formValue.creditDays !== this.order?.creditDays) {
      updateData.creditDays = parseInt(formValue.creditDays);
    }
    if (formValue.amount !== this.order?.amount) {
      updateData.amount = parseFloat(formValue.amount);
    }

    // Si no hay cambios, no enviar la petición
    if (Object.keys(updateData).length === 0) {
      this.error = 'No se han realizado cambios';
      this.loading = false;
      return;
    }

    this.orderService.updateOrder(this.orderId, updateData).subscribe({
      next: (response) => {
        this.success = true;
        this.loading = false;
        
        // Mostrar mensaje de éxito y redirigir después de 2 segundos
        setTimeout(() => {
          this.router.navigate(['/orders', this.orderId]);
        }, 2000);
      },
      error: (err) => {
        this.error = err.error?.message || 'Error al actualizar la orden';
        this.loading = false;
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/orders', this.orderId]);
  }

  private formatDateForInput(date: Date | string | null | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  get dispatchDate() { return this.orderForm.get('dispatchDate'); }
  get creditDays() { return this.orderForm.get('creditDays'); }
  get amount() { return this.orderForm.get('amount'); }
}
```

#### Template HTML (update-order.component.html)

```html
<div class="container mt-4">
  <div class="row justify-content-center">
    <div class="col-md-8">
      <div class="card">
        <div class="card-header">
          <h3 class="mb-0">Actualizar Orden</h3>
        </div>
        <div class="card-body">
          <!-- Mensaje de éxito -->
          <div *ngIf="success" class="alert alert-success alert-dismissible fade show" role="alert">
            <strong>¡Éxito!</strong> La orden ha sido actualizada correctamente.
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
          </div>

          <!-- Mensaje de error -->
          <div *ngIf="error" class="alert alert-danger alert-dismissible fade show" role="alert">
            <strong>Error:</strong> {{ error }}
            <button type="button" class="btn-close" data-bs-dismiss="alert" (click)="error = null"></button>
          </div>

          <!-- Loading -->
          <div *ngIf="loading && !order" class="text-center">
            <div class="spinner-border" role="status">
              <span class="visually-hidden">Cargando...</span>
            </div>
          </div>

          <!-- Formulario -->
          <form *ngIf="order" [formGroup]="orderForm" (ngSubmit)="onSubmit()">
            <!-- Fecha de Despacho -->
            <div class="mb-3">
              <label for="dispatchDate" class="form-label">
                Fecha de Despacho <span class="text-danger">*</span>
              </label>
              <input
                type="date"
                class="form-control"
                id="dispatchDate"
                formControlName="dispatchDate"
                [class.is-invalid]="dispatchDate?.invalid && dispatchDate?.touched"
              />
              <div *ngIf="dispatchDate?.invalid && dispatchDate?.touched" class="invalid-feedback">
                La fecha de despacho es requerida
              </div>
            </div>

            <!-- Días de Crédito -->
            <div class="mb-3">
              <label for="creditDays" class="form-label">
                Días de Crédito <span class="text-danger">*</span>
              </label>
              <input
                type="number"
                class="form-control"
                id="creditDays"
                formControlName="creditDays"
                [class.is-invalid]="creditDays?.invalid && creditDays?.touched"
                min="1"
                placeholder="Ej: 30"
              />
              <div *ngIf="creditDays?.invalid && creditDays?.touched" class="invalid-feedback">
                <div *ngIf="creditDays?.errors?.['required']">
                  Los días de crédito son requeridos
                </div>
                <div *ngIf="creditDays?.errors?.['min']">
                  Los días de crédito deben ser mayor a 0
                </div>
              </div>
              <small class="form-text text-muted">
                La fecha de vencimiento se calculará automáticamente: Fecha de Despacho + Días de Crédito
              </small>
            </div>

            <!-- Monto -->
            <div class="mb-3">
              <label for="amount" class="form-label">
                Monto <span class="text-danger">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                class="form-control"
                id="amount"
                formControlName="amount"
                [class.is-invalid]="amount?.invalid && amount?.touched"
                min="0.01"
                placeholder="Ej: 1500.00"
              />
              <div *ngIf="amount?.invalid && amount?.touched" class="invalid-feedback">
                <div *ngIf="amount?.errors?.['required']">
                  El monto es requerido
                </div>
                <div *ngIf="amount?.errors?.['min']">
                  El monto debe ser mayor a 0
                </div>
              </div>
              <small class="form-text text-muted">
                Si cambias el monto, se actualizará automáticamente la deuda asociada y el total de deuda del proveedor
              </small>
            </div>

            <!-- Información de solo lectura -->
            <div class="mb-3">
              <div class="card bg-light">
                <div class="card-body">
                  <h6 class="card-title">Información de la Orden</h6>
                  <p class="mb-1"><strong>Monto:</strong> ${{ order.amount | number:'1.2-2' }}</p>
                  <p class="mb-1"><strong>Fecha de Vencimiento Calculada:</strong> 
                    <span class="text-primary">{{ order.dueDate | date:'dd/MM/yyyy' }}</span>
                  </p>
                  <p class="mb-1"><strong>Proveedor:</strong> {{ order.supplier.companyName }}</p>
                  <p class="mb-0"><strong>RIF:</strong> {{ order.supplier.taxId }}</p>
                </div>
              </div>
            </div>

            <!-- Botones -->
            <div class="d-flex justify-content-between">
              <button type="button" class="btn btn-secondary" (click)="cancel()">
                Cancelar
              </button>
              <button type="submit" class="btn btn-primary" [disabled]="loading || orderForm.invalid">
                <span *ngIf="loading" class="spinner-border spinner-border-sm me-2"></span>
                {{ loading ? 'Actualizando...' : 'Actualizar Orden' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</div>
```

### 5. Ejemplo con React

```typescript
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

interface Order {
  id: number;
  dispatchDate: Date;
  creditDays: number;
  dueDate: Date;
  amount: number;
  supplier: {
    id: number;
    companyName: string;
    taxId: string;
  };
}

const UpdateOrder: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    dispatchDate: '',
    creditDays: '',
    amount: ''
  });

  useEffect(() => {
    loadOrder();
  }, [id]);

  const loadOrder = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/orders/${id}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      const orderData = response.data.data;
      setOrder(orderData);
      setFormData({
        dispatchDate: new Date(orderData.dispatchDate).toISOString().split('T')[0],
        creditDays: orderData.creditDays.toString(),
        amount: orderData.amount.toString()
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al cargar la orden');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!order) return;

    const updateData: any = {};
    if (formData.dispatchDate !== new Date(order.dispatchDate).toISOString().split('T')[0]) {
      updateData.dispatchDate = formData.dispatchDate;
    }
    if (parseInt(formData.creditDays) !== order.creditDays) {
      updateData.creditDays = parseInt(formData.creditDays);
    }
    if (parseFloat(formData.amount) !== order.amount) {
      updateData.amount = parseFloat(formData.amount);
    }

    if (Object.keys(updateData).length === 0) {
      setError('No se han realizado cambios');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      
      await axios.put(
        `${process.env.REACT_APP_API_URL}/orders/${id}`,
        updateData,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      setSuccess(true);
      setTimeout(() => {
        navigate(`/orders/${id}`);
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al actualizar la orden');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !order) {
    return <div>Cargando...</div>;
  }

  if (!order) {
    return <div>Orden no encontrada</div>;
  }

  return (
    <div className="container mt-4">
      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="card">
            <div className="card-header">
              <h3>Actualizar Orden</h3>
            </div>
            <div className="card-body">
              {success && (
                <div className="alert alert-success">
                  ¡Éxito! La orden ha sido actualizada correctamente.
                </div>
              )}
              
              {error && (
                <div className="alert alert-danger">
                  <strong>Error:</strong> {error}
                  <button className="btn-close" onClick={() => setError(null)}></button>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label">
                    Fecha de Despacho <span className="text-danger">*</span>
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    value={formData.dispatchDate}
                    onChange={(e) => setFormData({ ...formData, dispatchDate: e.target.value })}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">
                    Días de Crédito <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.creditDays}
                    onChange={(e) => setFormData({ ...formData, creditDays: e.target.value })}
                    required
                    min="1"
                  />
                  <small className="form-text text-muted">
                    La fecha de vencimiento se calculará automáticamente
                  </small>
                </div>

                <div className="mb-3">
                  <label className="form-label">
                    Monto <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                    min="0.01"
                  />
                  <small className="form-text text-muted">
                    Si cambias el monto, se actualizará automáticamente la deuda asociada y el total de deuda del proveedor
                  </small>
                </div>

                <div className="mb-3">
                  <div className="card bg-light">
                    <div className="card-body">
                      <h6>Información de la Orden</h6>
                      <p className="mb-1">
                        <strong>Monto:</strong> ${order.amount.toFixed(2)}
                      </p>
                      <p className="mb-1">
                        <strong>Fecha de Vencimiento:</strong>{' '}
                        {new Date(order.dueDate).toLocaleDateString()}
                      </p>
                      <p className="mb-0">
                        <strong>Proveedor:</strong> {order.supplier.companyName}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="d-flex justify-content-between">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => navigate(`/orders/${id}`)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? 'Actualizando...' : 'Actualizar Orden'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpdateOrder;
```

## 📊 Respuesta del Endpoint

### Respuesta Exitosa (200 OK)

```json
{
  "success": true,
  "message": "Orden actualizada exitosamente",
  "data": {
    "id": 123,
    "supplierId": 789,
    "supplier": {
      "id": 789,
      "companyName": "Empresa ABC C.A.",
      "taxId": "J-12345678-9",
      "phone": "+58 412-1234567"
    },
    "amount": 1500.00,
    "dispatchDate": "2024-12-31T00:00:00.000Z",
    "creditDays": 45,
    "dueDate": "2025-02-14T00:00:00.000Z",
    "createdBy": 1,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-20T00:00:00.000Z",
    "debt": {
      "id": 456,
      "status": "PENDING",
      "remainingAmount": 1500.00,
      "initialAmount": 1500.00,
      "dueDate": "2025-02-14T00:00:00.000Z",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-20T00:00:00.000Z",
      "payments": []
    }
  }
}
```

## ⚠️ Consideraciones Importantes

1. **Cálculo Automático de Fecha de Vencimiento**: 
   - Al cambiar `dispatchDate` o `creditDays`, el sistema recalcula automáticamente `dueDate = dispatchDate + creditDays`
   - Esta fecha se actualiza tanto en la **orden** como en la **deuda asociada**

2. **Actualización de Monto y Deuda**: 
   - Si cambias `amount`, el sistema actualiza automáticamente:
     - `debt.initialAmount` = nuevo `amount`
     - `debt.remainingAmount` = se ajusta según la diferencia (manteniendo los pagos existentes)
     - `debt.status` = se recalcula según el nuevo `remainingAmount` (PAID si es 0, PENDING si es > 0)
     - `supplier.totalDebt` = suma de todas las deudas restantes del proveedor
     - `supplier.status` = PENDING si `totalDebt > 0`, COMPLETED si `totalDebt === 0`
   - Esto asegura que si un proveedor estaba COMPLETED y aumentas el monto de una orden, vuelva a PENDING

3. **Transacción Atómica**: 
   - La actualización se hace en una transacción de base de datos
   - Si falla alguna parte, todo se revierte (no hay discrepancias)

4. **Sincronización con Deuda**: 
   - La deuda asociada a la orden se actualiza automáticamente con la nueva `dueDate` y `amount`
   - No necesitas hacer llamadas adicionales para actualizar la deuda

5. **Validación de Cambios**: 
   - El backend valida que al menos un campo haya cambiado antes de actualizar

6. **Formato de Fecha**: 
   - Puedes enviar la fecha como:
     - String ISO 8601: `"2024-12-31"`
     - String con hora: `"2024-12-31T00:00:00.000Z"`
     - Date object (se serializa automáticamente)

## 🔄 Flujo de Navegación Recomendado

1. **Desde la lista de órdenes:**
   - Botón "Editar" → Navega a `/orders/:id/edit`

2. **Desde el detalle de la orden:**
   - Botón "Actualizar" → Navega a `/orders/:id/edit`

3. **Después de actualizar:**
   - Redirigir a `/orders/:id` (vista de detalle)
   - O mostrar mensaje de éxito y permitir seguir editando

## 📌 Relación con Deudas

- Cada orden tiene una deuda asociada (relación 1:1)
- Al actualizar `dispatchDate` o `creditDays` de una orden:
  - Se recalcula `order.dueDate`
  - Se actualiza automáticamente `debt.dueDate` para mantener consistencia
  - Los pagos existentes no se modifican (solo cambia la fecha de vencimiento)
- Al actualizar `amount` de una orden:
  - Se actualiza `order.amount`
  - Se actualiza `debt.initialAmount` = nuevo `amount`
  - Se ajusta `debt.remainingAmount` = `oldRemainingAmount + (newAmount - oldAmount)`
  - Se recalcula `debt.status` según el nuevo `remainingAmount`
  - Se recalcula `supplier.totalDebt` sumando todas las deudas restantes
  - Se actualiza `supplier.status` según el nuevo `totalDebt`
  - Los pagos existentes no se modifican (solo se ajusta el `remainingAmount`)