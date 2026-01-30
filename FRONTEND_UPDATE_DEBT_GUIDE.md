# Guía para el Frontend: Actualizar Deuda

## ✅ Endpoint Disponible

```
PUT /api/debts/:id
```

**Autenticación requerida:** Sí (token JWT)  
**Autorización requerida:** ADMINISTRADOR o SUPERVISOR

## 📋 Campos que se Pueden Actualizar

```typescript
interface UpdateDebtDTO {
  initialAmount?: number;  // Monto inicial de la deuda (opcional)
  dueDate?: Date | string; // Fecha de vencimiento (opcional)
}
```

**Notas importantes:**
- Ambos campos son opcionales, pero debes enviar al menos uno
- `initialAmount` debe ser mayor a 0 y máximo $999,999.99
- `dueDate` debe ser una fecha válida
- Al actualizar `initialAmount`, el sistema recalcula automáticamente:
  - `remainingAmount` (ajustado según la diferencia)
  - `status` de la deuda (PAID si remainingAmount <= 0, PENDING si > 0)
  - `totalDebt` del proveedor (suma de todas las deudas restantes)
  - `status` del proveedor (PENDING si totalDebt > 0, COMPLETED si totalDebt === 0)

## 🔒 Validaciones del Backend

### Validaciones Automáticas:

1. **`initialAmount`**: 
   - Debe ser un número válido
   - Debe ser mayor a 0
   - Máximo $999,999.99

2. **`dueDate`**: 
   - Debe ser una fecha válida
   - Puede ser string (ISO 8601) o Date

### Errores Posibles:

```typescript
// Errores que el backend puede devolver:
- "ID de deuda inválido" (400)
- "Deuda no encontrada" (404)
- "No se han realizado cambios en la deuda" (400)
- "El monto inicial debe ser mayor a 0" (400)
- "El monto inicial es demasiado grande (máximo $999,999.99)" (400)
- "La fecha de vencimiento debe ser una fecha válida" (400)
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
# Actualizar solo el monto inicial
curl -X PUT "http://localhost:3000/api/debts/123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "initialAmount": 1500.00
  }'

# Actualizar solo la fecha de vencimiento
curl -X PUT "http://localhost:3000/api/debts/123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dueDate": "2024-12-31"
  }'

# Actualizar ambos campos
curl -X PUT "http://localhost:3000/api/debts/123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "initialAmount": 2000.00,
    "dueDate": "2024-12-31"
  }'
```

### 2. Ejemplo con JavaScript/Fetch

```javascript
async function updateDebt(debtId, data) {
  const token = localStorage.getItem('token'); // O tu método de obtener el token
  
  try {
    const response = await fetch(`http://localhost:3000/api/debts/${debtId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al actualizar la deuda');
    }

    const result = await response.json();
    return result.data; // Retorna la deuda actualizada
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Uso:
// Actualizar solo monto inicial
await updateDebt(123, { initialAmount: 1500.00 });

// Actualizar solo fecha
await updateDebt(123, { dueDate: '2024-12-31' });

// Actualizar ambos
await updateDebt(123, { 
  initialAmount: 2000.00, 
  dueDate: '2024-12-31' 
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

// Función para actualizar deuda
async function updateDebt(debtId, data) {
  try {
    const response = await api.put(`/debts/${debtId}`, data);
    return response.data.data; // Retorna la deuda actualizada
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.message || 'Error al actualizar la deuda');
    }
    throw error;
  }
}

// Uso:
await updateDebt(123, { initialAmount: 1500.00 });
```

### 4. Ejemplo con Angular

#### Servicio (debt.service.ts)

```typescript
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

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
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
  dueDate: Date;
  createdAt: Date;
  updatedAt: Date;
  debtNumber?: number;
  payments?: any[];
}

@Injectable({
  providedIn: 'root'
})
export class DebtService {
  private apiUrl = `${environment.apiUrl}/debts`;

  constructor(private http: HttpClient) {}

  /**
   * Obtener una deuda por ID
   */
  getDebtById(id: number): Observable<{ success: boolean; data: DebtResponse }> {
    return this.http.get<{ success: boolean; data: DebtResponse }>(
      `${this.apiUrl}/${id}`
    );
  }

  /**
   * Actualizar una deuda
   */
  updateDebt(
    id: number,
    data: UpdateDebtDTO
  ): Observable<{ success: boolean; message: string; data: DebtResponse }> {
    return this.http.put<{ success: boolean; message: string; data: DebtResponse }>(
      `${this.apiUrl}/${id}`,
      data
    );
  }

  /**
   * Obtener token del localStorage o del servicio de autenticación
   */
  private getToken(): string {
    return localStorage.getItem('token') || '';
  }
}
```

#### Componente (update-debt.component.ts)

```typescript
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DebtService, DebtResponse } from '../services/debt.service';

@Component({
  selector: 'app-update-debt',
  templateUrl: './update-debt.component.html',
  styleUrls: ['./update-debt.component.css']
})
export class UpdateDebtComponent implements OnInit {
  debtForm: FormGroup;
  debtId: number;
  debt: DebtResponse | null = null;
  loading = false;
  error: string | null = null;
  success = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private debtService: DebtService
  ) {
    this.debtForm = this.fb.group({
      initialAmount: ['', [Validators.required, Validators.min(0.01), Validators.max(999999.99)]],
      dueDate: ['']
    });
  }

  ngOnInit(): void {
    this.debtId = +this.route.snapshot.params['id'];
    this.loadDebt();
  }

  loadDebt(): void {
    this.loading = true;
    this.debtService.getDebtById(this.debtId).subscribe({
      next: (response) => {
        this.debt = response.data;
        // Prellenar el formulario con los datos actuales
        this.debtForm.patchValue({
          initialAmount: this.debt.initialAmount,
          dueDate: this.formatDateForInput(this.debt.dueDate)
        });
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Error al cargar la deuda: ' + (err.error?.message || err.message);
        this.loading = false;
      }
    });
  }

  onSubmit(): void {
    if (this.debtForm.invalid) {
      this.markFormGroupTouched(this.debtForm);
      return;
    }

    this.loading = true;
    this.error = null;
    this.success = false;

    const formValue = this.debtForm.value;
    const updateData: any = {};

    // Solo incluir campos que han cambiado
    if (formValue.initialAmount !== this.debt?.initialAmount) {
      updateData.initialAmount = parseFloat(formValue.initialAmount);
    }
    if (formValue.dueDate !== this.formatDateForInput(this.debt?.dueDate)) {
      updateData.dueDate = formValue.dueDate;
    }

    // Si no hay cambios, no enviar la petición
    if (Object.keys(updateData).length === 0) {
      this.error = 'No se han realizado cambios';
      this.loading = false;
      return;
    }

    this.debtService.updateDebt(this.debtId, updateData).subscribe({
      next: (response) => {
        this.success = true;
        this.loading = false;
        
        // Mostrar mensaje de éxito y redirigir después de 2 segundos
        setTimeout(() => {
          this.router.navigate(['/debts', this.debtId]);
        }, 2000);
      },
      error: (err) => {
        this.error = err.error?.message || 'Error al actualizar la deuda';
        this.loading = false;
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/debts', this.debtId]);
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

  get initialAmount() { return this.debtForm.get('initialAmount'); }
  get dueDate() { return this.debtForm.get('dueDate'); }
}
```

#### Template HTML (update-debt.component.html)

```html
<div class="container mt-4">
  <div class="row justify-content-center">
    <div class="col-md-8">
      <div class="card">
        <div class="card-header">
          <h3 class="mb-0">Actualizar Deuda</h3>
        </div>
        <div class="card-body">
          <!-- Mensaje de éxito -->
          <div *ngIf="success" class="alert alert-success alert-dismissible fade show" role="alert">
            <strong>¡Éxito!</strong> La deuda ha sido actualizada correctamente.
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
          </div>

          <!-- Mensaje de error -->
          <div *ngIf="error" class="alert alert-danger alert-dismissible fade show" role="alert">
            <strong>Error:</strong> {{ error }}
            <button type="button" class="btn-close" data-bs-dismiss="alert" (click)="error = null"></button>
          </div>

          <!-- Loading -->
          <div *ngIf="loading && !debt" class="text-center">
            <div class="spinner-border" role="status">
              <span class="visually-hidden">Cargando...</span>
            </div>
          </div>

          <!-- Formulario -->
          <form *ngIf="debt" [formGroup]="debtForm" (ngSubmit)="onSubmit()">
            <!-- Monto Inicial -->
            <div class="mb-3">
              <label for="initialAmount" class="form-label">
                Monto Inicial <span class="text-danger">*</span>
              </label>
              <div class="input-group">
                <span class="input-group-text">$</span>
                <input
                  type="number"
                  class="form-control"
                  id="initialAmount"
                  formControlName="initialAmount"
                  [class.is-invalid]="initialAmount?.invalid && initialAmount?.touched"
                  step="0.01"
                  min="0.01"
                  max="999999.99"
                  placeholder="0.00"
                />
              </div>
              <div *ngIf="initialAmount?.invalid && initialAmount?.touched" class="invalid-feedback">
                <div *ngIf="initialAmount?.errors?.['required']">
                  El monto inicial es requerido
                </div>
                <div *ngIf="initialAmount?.errors?.['min']">
                  El monto debe ser mayor a 0
                </div>
                <div *ngIf="initialAmount?.errors?.['max']">
                  El monto es demasiado grande (máximo $999,999.99)
                </div>
              </div>
              <small class="form-text text-muted">
                Al cambiar el monto inicial, el sistema recalculará automáticamente el monto restante y el estado del proveedor.
              </small>
            </div>

            <!-- Fecha de Vencimiento -->
            <div class="mb-3">
              <label for="dueDate" class="form-label">Fecha de Vencimiento</label>
              <input
                type="date"
                class="form-control"
                id="dueDate"
                formControlName="dueDate"
                [class.is-invalid]="dueDate?.invalid && dueDate?.touched"
              />
              <div *ngIf="dueDate?.invalid && dueDate?.touched" class="invalid-feedback">
                La fecha de vencimiento es inválida
              </div>
            </div>

            <!-- Información de solo lectura -->
            <div class="mb-3">
              <div class="card bg-light">
                <div class="card-body">
                  <h6 class="card-title">Información de la Deuda</h6>
                  <p class="mb-1"><strong>Monto Restante:</strong> ${{ debt.remainingAmount | number:'1.2-2' }}</p>
                  <p class="mb-1"><strong>Estado:</strong> 
                    <span [class]="'badge bg-' + (debt.status === 'PAID' ? 'success' : 'warning')">
                      {{ debt.status }}
                    </span>
                  </p>
                  <p class="mb-1"><strong>Proveedor:</strong> {{ debt.supplier.companyName }}</p>
                  <p class="mb-1"><strong>RIF:</strong> {{ debt.supplier.taxId }}</p>
                  <p class="mb-0"><strong>Total Deuda del Proveedor:</strong> 
                    <span class="text-danger">${{ debt.supplier.totalDebt | number:'1.2-2' }}</span>
                  </p>
                </div>
              </div>
            </div>

            <!-- Botones -->
            <div class="d-flex justify-content-between">
              <button type="button" class="btn btn-secondary" (click)="cancel()">
                Cancelar
              </button>
              <button type="submit" class="btn btn-primary" [disabled]="loading || debtForm.invalid">
                <span *ngIf="loading" class="spinner-border spinner-border-sm me-2"></span>
                {{ loading ? 'Actualizando...' : 'Actualizar Deuda' }}
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

interface Debt {
  id: number;
  initialAmount: number;
  remainingAmount: number;
  status: string;
  dueDate: Date;
  supplier: {
    id: number;
    companyName: string;
    taxId: string;
  };
}

const UpdateDebt: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [debt, setDebt] = useState<Debt | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    initialAmount: '',
    dueDate: ''
  });

  useEffect(() => {
    loadDebt();
  }, [id]);

  const loadDebt = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/debts/${id}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      const debtData = response.data.data;
      setDebt(debtData);
      setFormData({
        initialAmount: debtData.initialAmount.toString(),
        dueDate: new Date(debtData.dueDate).toISOString().split('T')[0]
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al cargar la deuda');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!debt) return;

    const updateData: any = {};
    if (parseFloat(formData.initialAmount) !== debt.initialAmount) {
      updateData.initialAmount = parseFloat(formData.initialAmount);
    }
    if (formData.dueDate !== new Date(debt.dueDate).toISOString().split('T')[0]) {
      updateData.dueDate = formData.dueDate;
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
        `${process.env.REACT_APP_API_URL}/debts/${id}`,
        updateData,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      setSuccess(true);
      setTimeout(() => {
        navigate(`/debts/${id}`);
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al actualizar la deuda');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !debt) {
    return <div>Cargando...</div>;
  }

  if (!debt) {
    return <div>Deuda no encontrada</div>;
  }

  return (
    <div className="container mt-4">
      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="card">
            <div className="card-header">
              <h3>Actualizar Deuda</h3>
            </div>
            <div className="card-body">
              {success && (
                <div className="alert alert-success">
                  ¡Éxito! La deuda ha sido actualizada correctamente.
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
                    Monto Inicial <span className="text-danger">*</span>
                  </label>
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.initialAmount}
                      onChange={(e) => setFormData({ ...formData, initialAmount: e.target.value })}
                      required
                      step="0.01"
                      min="0.01"
                      max="999999.99"
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label">Fecha de Vencimiento</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  />
                </div>

                <div className="mb-3">
                  <div className="card bg-light">
                    <div className="card-body">
                      <h6>Información de la Deuda</h6>
                      <p className="mb-1">
                        <strong>Monto Restante:</strong> ${debt.remainingAmount.toFixed(2)}
                      </p>
                      <p className="mb-1">
                        <strong>Estado:</strong> {debt.status}
                      </p>
                      <p className="mb-0">
                        <strong>Proveedor:</strong> {debt.supplier.companyName}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="d-flex justify-content-between">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => navigate(`/debts/${id}`)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? 'Actualizando...' : 'Actualizar Deuda'}
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

export default UpdateDebt;
```

## 📊 Respuesta del Endpoint

### Respuesta Exitosa (200 OK)

```json
{
  "success": true,
  "message": "Deuda actualizada exitosamente",
  "data": {
    "id": 123,
    "orderId": 456,
    "supplierId": 789,
    "supplier": {
      "id": 789,
      "companyName": "Empresa ABC C.A.",
      "taxId": "J-12345678-9",
      "phone": "+58 412-1234567"
    },
    "initialAmount": 1500.00,
    "remainingAmount": 1200.00,
    "status": "PENDING",
    "dueDate": "2024-12-31T00:00:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-20T00:00:00.000Z",
    "debtNumber": 1,
    "payments": []
  }
}
```

## ⚠️ Consideraciones Importantes

1. **Impacto en el Proveedor**: Al actualizar `initialAmount`, el sistema:
   - Recalcula el `remainingAmount` de la deuda
   - Recalcula el `totalDebt` del proveedor (suma de todas las deudas restantes)
   - Actualiza el `status` del proveedor automáticamente:
     - Si `totalDebt > 0` → `PENDING`
     - Si `totalDebt === 0` → `COMPLETED`

2. **Validación de Cambios**: El backend valida que al menos un campo haya cambiado antes de actualizar.

3. **Cálculo Automático**: No necesitas calcular `remainingAmount` manualmente, el sistema lo hace automáticamente basado en los pagos existentes.

4. **Formato de Fecha**: Puedes enviar la fecha como:
   - String ISO 8601: `"2024-12-31"`
   - String con hora: `"2024-12-31T00:00:00.000Z"`
   - Date object (se serializa automáticamente)

## 🔄 Flujo de Navegación Recomendado

1. **Desde la lista de deudas:**
   - Botón "Editar" → Navega a `/debts/:id/edit`

2. **Desde el detalle de la deuda:**
   - Botón "Actualizar" → Navega a `/debts/:id/edit`

3. **Después de actualizar:**
   - Redirigir a `/debts/:id` (vista de detalle)
   - O mostrar mensaje de éxito y permitir seguir editando
