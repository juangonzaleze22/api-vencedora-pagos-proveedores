# Guía para el Frontend: Actualizar Proveedor

## ✅ Endpoints Disponibles

El backend tiene implementados los siguientes endpoints para proveedores:

### Obtener Proveedor por ID
```
GET /api/suppliers/:id
```
**Autenticación requerida:** Sí (token JWT)  
**Autorización requerida:** Cualquier usuario autenticado  
**Respuesta:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "companyName": "Empresa ABC C.A.",
    "taxId": "J-12345678-9",
    "phone": "+58 412-1234567",
    "status": "PENDING",
    "totalDebt": 1500.00,
    "lastPaymentDate": "2024-01-15T00:00:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-20T00:00:00.000Z"
  }
}
```

### Actualizar Proveedor
```
PUT /api/suppliers/:id
```
**Autenticación requerida:** Sí (token JWT)  
**Autorización requerida:** ADMINISTRADOR o SUPERVISOR  
**Respuesta:**
```json
{
  "success": true,
  "message": "Proveedor actualizado exitosamente",
  "data": {
    "id": 1,
    "companyName": "Empresa ABC C.A.",
    "taxId": "J-12345678-9",
    "phone": "+58 412-1234567",
    "status": "PENDING",
    "totalDebt": 1500.00,
    "lastPaymentDate": "2024-01-15T00:00:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-20T00:00:00.000Z"
  }
}
```

## 📋 Campos que se Pueden Actualizar

Según el `UpdateSupplierDTO`, puedes actualizar los siguientes campos (todos son opcionales):

```typescript
interface UpdateSupplierDTO {
  companyName?: string;  // Nombre de la empresa (mínimo 3 caracteres)
  taxId?: string;        // RIF/Identificación Fiscal (debe ser único, no puede estar vacío)
  phone?: string | null; // Teléfono (puede ser null para limpiar el campo)
  status?: 'PENDING' | 'COMPLETED';  // Estado del proveedor
}
```

**Nota importante:** 
- Todos los campos son opcionales, pero debes enviar al menos uno para que la actualización tenga efecto
- Si envías `phone: null` o `phone: ""`, se limpiará el teléfono del proveedor
- El backend validará que al menos un campo haya cambiado antes de actualizar

## 🔒 Validaciones del Backend

### Validaciones Automáticas:

1. **`companyName`**: Si se envía, debe tener al menos 3 caracteres
2. **`taxId`**: Si se envía y es diferente al actual, debe ser único (no puede existir otro proveedor con ese RIF)
3. **`phone`**: Opcional, debe ser string
4. **`status`**: Debe ser 'PENDING' o 'COMPLETED'

### Errores Posibles:

```typescript
// Errores que el backend puede devolver:
- "ID de proveedor inválido" (400) - Si el ID no es un número válido
- "Proveedor no encontrado" (404) - Si el proveedor no existe
- "No se han realizado cambios en el proveedor" (400) - Si todos los valores son iguales a los actuales
- "Ya existe un proveedor con este RIF/Identificación Fiscal" (400) - Si el RIF ya está en uso
- "El RIF/Identificación Fiscal no puede estar vacío" (400) - Si intentas actualizar el RIF con valor vacío
- "El nombre de la empresa debe tener al menos 3 caracteres" (400) - Si el nombre es muy corto
- "El estado debe ser PENDING o COMPLETED" (400) - Si el status no es válido
- "Usuario no autenticado" (401) - Si no hay token válido
- "No tienes permisos para realizar esta acción" (403) - Si el usuario no tiene rol ADMINISTRADOR o SUPERVISOR
```

**Formato de respuesta de error:**
```json
{
  "success": false,
  "message": "Mensaje de error descriptivo"
}
```

## 📝 Ejemplo de Implementación

### 1. Servicio de Proveedores (TypeScript/Angular)

```typescript
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

export interface UpdateSupplierDTO {
  companyName?: string;
  taxId?: string;
  phone?: string;
  status?: 'PENDING' | 'COMPLETED';
}

export interface SupplierResponse {
  id: number;
  companyName: string;
  taxId: string;
  phone: string | null;
  status: 'PENDING' | 'COMPLETED';
  totalDebt: number;
  lastPaymentDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class SupplierService {
  private apiUrl = `${environment.apiUrl}/suppliers`;

  constructor(private http: HttpClient) {}

  /**
   * Obtener un proveedor por ID
   */
  getSupplierById(id: number): Observable<{ success: boolean; data: SupplierResponse }> {
    return this.http.get<{ success: boolean; data: SupplierResponse }>(
      `${this.apiUrl}/${id}`,
      {
        headers: {
          'Authorization': `Bearer ${this.getToken()}`
        }
      }
    );
  }

  /**
   * Obtener token del localStorage o del servicio de autenticación
   */
  private getToken(): string {
    // Ajusta esto según tu implementación de autenticación
    return localStorage.getItem('token') || '';
  }

  /**
   * Actualizar un proveedor
   */
  updateSupplier(
    id: number, 
    data: UpdateSupplierDTO
  ): Observable<{ success: boolean; message: string; data: SupplierResponse }> {
    return this.http.put<{ success: boolean; message: string; data: SupplierResponse }>(
      `${this.apiUrl}/${id}`,
      data,
      {
        headers: {
          'Authorization': `Bearer ${this.getToken()}`,
          'Content-Type': 'application/json'
        }
      }
    );
  }
}
```

### 2. Componente de Actualización (Angular)

```typescript
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SupplierService, SupplierResponse } from '../services/supplier.service';

@Component({
  selector: 'app-update-supplier',
  templateUrl: './update-supplier.component.html',
  styleUrls: ['./update-supplier.component.css']
})
export class UpdateSupplierComponent implements OnInit {
  supplierForm: FormGroup;
  supplierId: number;
  supplier: SupplierResponse | null = null;
  loading = false;
  error: string | null = null;
  success = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private supplierService: SupplierService
  ) {
    this.supplierForm = this.fb.group({
      companyName: ['', [Validators.required, Validators.minLength(3)]],
      taxId: ['', [Validators.required]],
      phone: [''],
      status: ['PENDING', [Validators.required]]
    });
  }

  ngOnInit(): void {
    // Obtener el ID del proveedor de la ruta
    this.supplierId = +this.route.snapshot.params['id'];
    
    // Cargar datos del proveedor
    this.loadSupplier();
  }

  loadSupplier(): void {
    this.loading = true;
    this.supplierService.getSupplierById(this.supplierId).subscribe({
      next: (response) => {
        this.supplier = response.data;
        // Prellenar el formulario con los datos actuales
        this.supplierForm.patchValue({
          companyName: this.supplier.companyName,
          taxId: this.supplier.taxId,
          phone: this.supplier.phone || '',
          status: this.supplier.status
        });
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Error al cargar el proveedor: ' + (err.error?.message || err.message);
        this.loading = false;
      }
    });
  }

  onSubmit(): void {
    if (this.supplierForm.invalid) {
      this.markFormGroupTouched(this.supplierForm);
      return;
    }

    this.loading = true;
    this.error = null;
    this.success = false;

    // Preparar datos para enviar (solo campos que han cambiado)
    const formValue = this.supplierForm.value;
    const updateData: any = {};

    // Solo incluir campos que han cambiado
    if (formValue.companyName !== this.supplier?.companyName) {
      updateData.companyName = formValue.companyName;
    }
    if (formValue.taxId !== this.supplier?.taxId) {
      updateData.taxId = formValue.taxId;
    }
    if (formValue.phone !== (this.supplier?.phone || '')) {
      updateData.phone = formValue.phone || null;
    }
    if (formValue.status !== this.supplier?.status) {
      updateData.status = formValue.status;
    }

    // Si no hay cambios, no enviar la petición
    if (Object.keys(updateData).length === 0) {
      this.error = 'No se han realizado cambios';
      this.loading = false;
      return;
    }

    this.supplierService.updateSupplier(this.supplierId, updateData).subscribe({
      next: (response) => {
        this.success = true;
        this.loading = false;
        
        // Mostrar mensaje de éxito y redirigir después de 2 segundos
        setTimeout(() => {
          this.router.navigate(['/suppliers', this.supplierId]);
        }, 2000);
      },
      error: (err) => {
        this.error = err.error?.message || 'Error al actualizar el proveedor';
        this.loading = false;
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/suppliers', this.supplierId]);
  }

  // Helper para marcar todos los campos como touched
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  // Getters para facilitar el acceso en el template
  get companyName() { return this.supplierForm.get('companyName'); }
  get taxId() { return this.supplierForm.get('taxId'); }
  get phone() { return this.supplierForm.get('phone'); }
  get status() { return this.supplierForm.get('status'); }
}
```

### 3. Template HTML (Angular)

```html
<div class="container mt-4">
  <div class="row justify-content-center">
    <div class="col-md-8">
      <div class="card">
        <div class="card-header">
          <h3 class="mb-0">Actualizar Proveedor</h3>
        </div>
        <div class="card-body">
          <!-- Mensaje de éxito -->
          <div *ngIf="success" class="alert alert-success alert-dismissible fade show" role="alert">
            <strong>¡Éxito!</strong> El proveedor ha sido actualizado correctamente.
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
          </div>

          <!-- Mensaje de error -->
          <div *ngIf="error" class="alert alert-danger alert-dismissible fade show" role="alert">
            <strong>Error:</strong> {{ error }}
            <button type="button" class="btn-close" data-bs-dismiss="alert" (click)="error = null"></button>
          </div>

          <!-- Loading -->
          <div *ngIf="loading && !supplier" class="text-center">
            <div class="spinner-border" role="status">
              <span class="visually-hidden">Cargando...</span>
            </div>
          </div>

          <!-- Formulario -->
          <form *ngIf="supplier" [formGroup]="supplierForm" (ngSubmit)="onSubmit()">
            <!-- Nombre de la Empresa -->
            <div class="mb-3">
              <label for="companyName" class="form-label">
                Nombre de la Empresa <span class="text-danger">*</span>
              </label>
              <input
                type="text"
                class="form-control"
                id="companyName"
                formControlName="companyName"
                [class.is-invalid]="companyName?.invalid && companyName?.touched"
                placeholder="Ej: Empresa ABC C.A."
              />
              <div *ngIf="companyName?.invalid && companyName?.touched" class="invalid-feedback">
                <div *ngIf="companyName?.errors?.['required']">
                  El nombre de la empresa es requerido
                </div>
                <div *ngIf="companyName?.errors?.['minlength']">
                  El nombre debe tener al menos 3 caracteres
                </div>
              </div>
            </div>

            <!-- RIF/Identificación Fiscal -->
            <div class="mb-3">
              <label for="taxId" class="form-label">
                RIF/Identificación Fiscal <span class="text-danger">*</span>
              </label>
              <input
                type="text"
                class="form-control"
                id="taxId"
                formControlName="taxId"
                [class.is-invalid]="taxId?.invalid && taxId?.touched"
                placeholder="Ej: J-12345678-9"
              />
              <div *ngIf="taxId?.invalid && taxId?.touched" class="invalid-feedback">
                <div *ngIf="taxId?.errors?.['required']">
                  El RIF/Identificación Fiscal es requerido
                </div>
              </div>
              <small class="form-text text-muted">
                Si cambias el RIF, asegúrate de que no exista otro proveedor con el mismo RIF
              </small>
            </div>

            <!-- Teléfono -->
            <div class="mb-3">
              <label for="phone" class="form-label">Teléfono</label>
              <input
                type="text"
                class="form-control"
                id="phone"
                formControlName="phone"
                placeholder="Ej: +58 412-1234567"
              />
            </div>

            <!-- Estado -->
            <div class="mb-3">
              <label for="status" class="form-label">
                Estado <span class="text-danger">*</span>
              </label>
              <select
                class="form-select"
                id="status"
                formControlName="status"
                [class.is-invalid]="status?.invalid && status?.touched"
              >
                <option value="PENDING">Pendiente</option>
                <option value="COMPLETED">Completado</option>
              </select>
              <div *ngIf="status?.invalid && status?.touched" class="invalid-feedback">
                El estado es requerido
              </div>
              <small class="form-text text-muted">
                <strong>Pendiente:</strong> El proveedor tiene deudas activas<br>
                <strong>Completado:</strong> El proveedor no tiene deudas pendientes
              </small>
            </div>

            <!-- Información de solo lectura -->
            <div class="mb-3">
              <div class="card bg-light">
                <div class="card-body">
                  <h6 class="card-title">Información del Proveedor</h6>
                  <p class="mb-1"><strong>Total de Deuda:</strong> ${{ supplier.totalDebt | number:'1.2-2' }}</p>
                  <p class="mb-1" *ngIf="supplier.lastPaymentDate">
                    <strong>Último Pago:</strong> {{ supplier.lastPaymentDate | date:'dd/MM/yyyy' }}
                  </p>
                  <p class="mb-0">
                    <strong>Fecha de Creación:</strong> {{ supplier.createdAt | date:'dd/MM/yyyy' }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Botones -->
            <div class="d-flex justify-content-between">
              <button type="button" class="btn btn-secondary" (click)="cancel()">
                Cancelar
              </button>
              <button type="submit" class="btn btn-primary" [disabled]="loading || supplierForm.invalid">
                <span *ngIf="loading" class="spinner-border spinner-border-sm me-2"></span>
                {{ loading ? 'Actualizando...' : 'Actualizar Proveedor' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</div>
```

### 4. Ejemplo con React

```typescript
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

interface Supplier {
  id: number;
  companyName: string;
  taxId: string;
  phone: string | null;
  status: 'PENDING' | 'COMPLETED';
  totalDebt: number;
  lastPaymentDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const UpdateSupplier: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    companyName: '',
    taxId: '',
    phone: '',
    status: 'PENDING' as 'PENDING' | 'COMPLETED'
  });

  useEffect(() => {
    loadSupplier();
  }, [id]);

  const loadSupplier = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/suppliers/${id}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      const supplierData = response.data.data;
      setSupplier(supplierData);
      setFormData({
        companyName: supplierData.companyName,
        taxId: supplierData.taxId,
        phone: supplierData.phone || '',
        status: supplierData.status
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al cargar el proveedor');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!supplier) return;

    // Preparar datos solo con campos que han cambiado
    const updateData: any = {};
    if (formData.companyName !== supplier.companyName) {
      updateData.companyName = formData.companyName;
    }
    if (formData.taxId !== supplier.taxId) {
      updateData.taxId = formData.taxId;
    }
    if (formData.phone !== (supplier.phone || '')) {
      updateData.phone = formData.phone || null;
    }
    if (formData.status !== supplier.status) {
      updateData.status = formData.status;
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
        `${process.env.REACT_APP_API_URL}/suppliers/${id}`,
        updateData,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      setSuccess(true);
      setTimeout(() => {
        navigate(`/suppliers/${id}`);
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al actualizar el proveedor');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !supplier) {
    return <div>Cargando...</div>;
  }

  if (!supplier) {
    return <div>Proveedor no encontrado</div>;
  }

  return (
    <div className="container mt-4">
      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="card">
            <div className="card-header">
              <h3>Actualizar Proveedor</h3>
            </div>
            <div className="card-body">
              {success && (
                <div className="alert alert-success">
                  ¡Éxito! El proveedor ha sido actualizado correctamente.
                </div>
              )}
              
              {error && (
                <div className="alert alert-danger">
                  <strong>Error:</strong> {error}
                  <button 
                    className="btn-close" 
                    onClick={() => setError(null)}
                  ></button>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label">
                    Nombre de la Empresa <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    required
                    minLength={3}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">
                    RIF/Identificación Fiscal <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.taxId}
                    onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Teléfono</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">
                    Estado <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'PENDING' | 'COMPLETED' })}
                    required
                  >
                    <option value="PENDING">Pendiente</option>
                    <option value="COMPLETED">Completado</option>
                  </select>
                </div>

                <div className="mb-3">
                  <div className="card bg-light">
                    <div className="card-body">
                      <h6>Información del Proveedor</h6>
                      <p className="mb-1">
                        <strong>Total de Deuda:</strong> ${supplier.totalDebt.toFixed(2)}
                      </p>
                      {supplier.lastPaymentDate && (
                        <p className="mb-1">
                          <strong>Último Pago:</strong>{' '}
                          {new Date(supplier.lastPaymentDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="d-flex justify-content-between">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => navigate(`/suppliers/${id}`)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? 'Actualizando...' : 'Actualizar Proveedor'}
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

export default UpdateSupplier;
```

## 🔄 Flujo de Navegación Recomendado

1. **Desde la lista de proveedores:**
   - Botón "Editar" → Navega a `/suppliers/:id/edit`

2. **Desde el detalle del proveedor:**
   - Botón "Actualizar" → Navega a `/suppliers/:id/edit`

3. **Después de actualizar:**
   - Redirigir a `/suppliers/:id` (vista de detalle)
   - O mostrar mensaje de éxito y permitir seguir editando

## 📌 Notas Importantes

1. **Las deudas NO se actualizan aquí**: Como mencionaste, las deudas se gestionan en otro formulario separado.

2. **Validación del RIF**: Si el usuario cambia el `taxId`, el backend validará que sea único. Si ya existe, mostrará un error.

3. **Estado del Proveedor**: El estado (`status`) puede ser actualizado manualmente, pero normalmente se calcula automáticamente basado en `totalDebt`:
   - `PENDING`: Si `totalDebt > 0`
   - `COMPLETED`: Si `totalDebt === 0`

4. **Solo enviar campos modificados**: Es una buena práctica enviar solo los campos que han cambiado para optimizar la petición.

5. **Autenticación**: Recuerda incluir el token JWT en el header `Authorization: Bearer <token>`.

## 🎨 Mejoras Opcionales

- Mostrar un indicador visual de qué campos han sido modificados
- Confirmación antes de cambiar el RIF (ya que es un campo crítico)
- Historial de cambios del proveedor
- Validación en tiempo real del RIF antes de enviar
