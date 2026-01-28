# Formulario Reutilizable para Crear y Editar Pagos

## Campos del Formulario

El formulario que usas para **crear** un pago tiene estos campos:
- `debtId` - ID de la deuda
- `supplierId` - ID del proveedor
- `amount` - Monto del pago
- `paymentMethod` - Método de pago (ZELLE, TRANSFER, CASH)
- `senderName` - Nombre del emisor
- `confirmationNumber` - Número de confirmación (opcional)
- `paymentDate` - Fecha del pago
- `receipt` - Archivo del comprobante (opcional)

## ⚠️ Importante: Campos que NO se pueden cambiar al editar

Al **editar** un pago, **NO debes permitir cambiar**:
- ❌ `debtId` - El pago ya está asociado a una deuda específica
- ❌ `supplierId` - El pago ya está asociado a un proveedor específico

Estos campos deben estar **deshabilitados** o **ocultos** en modo edición.

## ✅ Campos que SÍ se pueden editar

- ✅ `amount` - **Este es el importante**: al cambiarlo, se actualiza automáticamente:
  - El `remainingAmount` de la deuda
  - El `totalDebt` del proveedor
  - El `status` de la deuda
- ✅ `paymentMethod` - Método de pago
- ✅ `senderName` - Nombre del emisor
- ✅ `confirmationNumber` - Número de confirmación
- ✅ `paymentDate` - Fecha del pago
- ✅ `receipt` - Archivo del comprobante (puedes subir uno nuevo)

---

## Ejemplo: Componente Reutilizable (Angular)

```typescript
import { Component, OnInit, Input } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PaymentService } from './payment.service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-payment-form',
  templateUrl: './payment-form.component.html'
})
export class PaymentFormComponent implements OnInit {
  paymentForm: FormGroup;
  selectedFile: File | null = null;
  isEditMode = false;
  paymentId: number | null = null;
  loading = false;

  constructor(
    private fb: FormBuilder,
    private paymentService: PaymentService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.paymentForm = this.fb.group({
      debtId: ['', [Validators.required]],
      supplierId: ['', [Validators.required]],
      amount: ['', [Validators.required, Validators.min(0.01)]],
      paymentMethod: ['', [Validators.required]],
      senderName: ['', [Validators.required]],
      confirmationNumber: [''],
      paymentDate: ['', [Validators.required]],
      receipt: [null]
    });
  }

  ngOnInit(): void {
    // Verificar si estamos en modo edición
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.isEditMode = true;
        this.paymentId = +params['id'];
        this.loadPayment(this.paymentId);
      }
    });
  }

  loadPayment(id: number): void {
    this.loading = true;
    this.paymentService.getPaymentById(id).subscribe({
      next: (payment) => {
        // Cargar datos del pago en el formulario
        this.paymentForm.patchValue({
          debtId: payment.debtId,
          supplierId: payment.supplierId,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          senderName: payment.senderName,
          confirmationNumber: payment.confirmationNumber || '',
          paymentDate: this.formatDateForInput(payment.paymentDate)
        });

        // En modo edición, deshabilitar debtId y supplierId
        this.paymentForm.get('debtId')?.disable();
        this.paymentForm.get('supplierId')?.disable();

        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar pago:', error);
        alert('Error al cargar el pago');
        this.loading = false;
      }
    });
  }

  formatDateForInput(date: Date | string): string {
    const d = new Date(date);
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        alert('Tipo de archivo no permitido. Solo PNG, JPG, PDF');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        alert('El archivo es demasiado grande. Máximo 5MB');
        return;
      }

      this.selectedFile = file;
      this.paymentForm.patchValue({ receipt: file });
    }
  }

  onSubmit(): void {
    if (this.paymentForm.valid) {
      const formValue = this.paymentForm.value;

      if (this.isEditMode && this.paymentId) {
        // MODO EDICIÓN
        this.updatePayment(this.paymentId, formValue);
      } else {
        // MODO CREACIÓN
        this.createPayment(formValue);
      }
    } else {
      Object.keys(this.paymentForm.controls).forEach(key => {
        this.paymentForm.get(key)?.markAsTouched();
      });
    }
  }

  createPayment(formValue: any): void {
    const paymentData = {
      debtId: parseInt(formValue.debtId),
      supplierId: parseInt(formValue.supplierId),
      amount: parseFloat(formValue.amount),
      paymentMethod: formValue.paymentMethod,
      senderName: formValue.senderName,
      confirmationNumber: formValue.confirmationNumber || undefined,
      paymentDate: new Date(formValue.paymentDate),
      receipt: this.selectedFile || undefined
    };

    this.paymentService.create(paymentData).subscribe({
      next: (payment) => {
        console.log('✅ Pago creado exitosamente:', payment);
        alert('Pago registrado exitosamente');
        this.paymentForm.reset();
        this.selectedFile = null;
        this.router.navigate(['/payments']);
      },
      error: (error) => {
        console.error('❌ Error al crear pago:', error);
        alert(error.error?.message || 'Error al registrar el pago');
      }
    });
  }

  updatePayment(paymentId: number, formValue: any): void {
    // Preparar datos de actualización
    // NO incluimos debtId ni supplierId porque no se pueden cambiar
    const updateData: any = {
      amount: parseFloat(formValue.amount),
      paymentMethod: formValue.paymentMethod,
      senderName: formValue.senderName,
      confirmationNumber: formValue.confirmationNumber || undefined,
      paymentDate: new Date(formValue.paymentDate)
    };

    // Solo agregar archivo si se seleccionó uno nuevo
    if (this.selectedFile) {
      updateData.receipt = this.selectedFile;
    }

    this.paymentService.updatePayment(paymentId, updateData).subscribe({
      next: (payment) => {
        console.log('✅ Pago actualizado exitosamente:', payment);
        
        // Mostrar información sobre lo que se actualizó
        alert(
          'Pago actualizado exitosamente.\n\n' +
          'Se han actualizado automáticamente:\n' +
          '- Monto restante de la deuda\n' +
          '- Total de deuda del proveedor\n' +
          '- Estado de la deuda'
        );
        
        // Recargar o navegar
        this.router.navigate(['/payments', paymentId]);
      },
      error: (error) => {
        console.error('❌ Error al actualizar pago:', error);
        alert(error.error?.message || 'Error al actualizar el pago');
      }
    });
  }
}
```

## Template HTML Reutilizable

```html
<form [formGroup]="paymentForm" (ngSubmit)="onSubmit()">
  <h2>{{ isEditMode ? 'Editar Pago' : 'Registrar Nuevo Pago' }}</h2>

  <!-- Deuda (deshabilitado en modo edición) -->
  <div class="form-group">
    <label>Deuda a Abonar *</label>
    <select 
      formControlName="debtId" 
      class="form-control"
      [disabled]="isEditMode">
      <option value="">Seleccione una deuda</option>
      <!-- Opciones dinámicas -->
    </select>
    <small class="text-muted" *ngIf="isEditMode">
      La deuda no puede ser cambiada
    </small>
  </div>

  <!-- Proveedor (deshabilitado en modo edición) -->
  <div class="form-group">
    <label>Proveedor *</label>
    <select 
      formControlName="supplierId" 
      class="form-control"
      [disabled]="isEditMode">
      <option value="">Seleccione un proveedor</option>
      <!-- Opciones dinámicas -->
    </select>
    <small class="text-muted" *ngIf="isEditMode">
      El proveedor no puede ser cambiado
    </small>
  </div>

  <!-- Monto (EDITABLE - Este es el campo importante) -->
  <div class="form-group">
    <label>Monto *</label>
    <input 
      type="number" 
      formControlName="amount" 
      step="0.01" 
      min="0.01" 
      class="form-control">
    <small class="text-info" *ngIf="isEditMode">
      ⚠️ Al cambiar el monto, se actualizará automáticamente:
      <ul>
        <li>Monto restante de la deuda</li>
        <li>Total de deuda del proveedor</li>
        <li>Estado de la deuda</li>
      </ul>
    </small>
  </div>

  <!-- Método de Pago (EDITABLE) -->
  <div class="form-group">
    <label>Método de Pago *</label>
    <select formControlName="paymentMethod" class="form-control">
      <option value="">Seleccione un método</option>
      <option value="ZELLE">Zelle</option>
      <option value="TRANSFER">Transferencia</option>
      <option value="CASH">Efectivo</option>
    </select>
  </div>

  <!-- Nombre del Emisor (EDITABLE) -->
  <div class="form-group">
    <label>Emisor (Nombre y Apellido) *</label>
    <input type="text" formControlName="senderName" class="form-control">
  </div>

  <!-- Número de Confirmación (EDITABLE) -->
  <div class="form-group">
    <label>N° de Confirmación (Últimos 5 dígitos)</label>
    <input type="text" formControlName="confirmationNumber" class="form-control">
  </div>

  <!-- Fecha de Pago (EDITABLE) -->
  <div class="form-group">
    <label>Fecha de Pago *</label>
    <input type="date" formControlName="paymentDate" class="form-control">
  </div>

  <!-- Archivo (EDITABLE - opcional) -->
  <div class="form-group">
    <label>Adjuntar Comprobante</label>
    <input 
      type="file" 
      (change)="onFileSelected($event)"
      accept=".png,.jpg,.jpeg,.pdf"
      class="form-control">
    <small class="text-muted">
      PNG, JPG, PDF hasta 5MB
      <span *ngIf="isEditMode"> - Dejar vacío para mantener el actual</span>
    </small>
  </div>

  <!-- Botones -->
  <div class="form-actions">
    <button type="button" class="btn btn-secondary" (click)="router.navigate(['/payments'])">
      Cancelar
    </button>
    <button 
      type="submit" 
      class="btn btn-primary" 
      [disabled]="paymentForm.invalid || loading">
      {{ isEditMode ? 'Actualizar Pago' : 'Registrar Pago' }}
    </button>
  </div>
</form>
```

---

## Servicio de Pagos (con método update)

```typescript
@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  constructor(private apiService: ApiService) {}

  // Método para crear (ya lo tienes)
  create(data: CreatePaymentData): Observable<Payment> {
    // ... código existente
  }

  // Método para obtener por ID
  getPaymentById(id: number): Observable<Payment> {
    return this.apiService.get<PaymentResponse>(`/payments/${id}`).pipe(
      map(response => {
        if (response.success && response.data) {
          return response.data;
        }
        throw new Error('Pago no encontrado');
      })
    );
  }

  // Método para actualizar
  updatePayment(id: number, data: {
    amount?: number;
    paymentMethod?: 'ZELLE' | 'TRANSFER' | 'CASH';
    senderName?: string;
    confirmationNumber?: string;
    paymentDate?: Date;
    receipt?: File;
  }): Observable<Payment> {
    const formData = new FormData();
    
    if (data.amount !== undefined) {
      formData.append('amount', data.amount.toString());
    }
    if (data.paymentMethod) {
      formData.append('paymentMethod', data.paymentMethod);
    }
    if (data.senderName) {
      formData.append('senderName', data.senderName);
    }
    if (data.confirmationNumber !== undefined) {
      formData.append('confirmationNumber', data.confirmationNumber || '');
    }
    if (data.paymentDate) {
      formData.append('paymentDate', data.paymentDate.toISOString().split('T')[0]);
    }
    if (data.receipt) {
      formData.append('receipt', data.receipt);
    }

    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.put<PaymentResponse>(
      `${this.baseUrl}/payments/${id}`,
      formData,
      { headers }
    ).pipe(
      map(response => {
        if (response.success && response.data) {
          return response.data;
        }
        throw new Error(response.message || 'Error al actualizar pago');
      })
    );
  }
}
```

---

## ¿Qué se Actualiza Automáticamente?

### Al cambiar el MONTO (`amount`):

1. ✅ **El pago** se actualiza con el nuevo monto
2. ✅ **El `remainingAmount` de la deuda** se recalcula:
   - Fórmula: `remainingAmount = initialAmount - suma(todos los pagos)`
3. ✅ **El `status` de la deuda** se actualiza:
   - Si `remainingAmount = 0` → `PAID`
   - Si `remainingAmount > 0` → `PENDING`
4. ✅ **El `totalDebt` del proveedor** se ajusta:
   - Si aumentaste el monto: resta más del total
   - Si disminuiste el monto: suma al total

### Al cambiar otros campos (paymentMethod, senderName, etc.):

- ✅ Solo se actualiza el pago
- ❌ NO afecta los cálculos de deuda ni proveedor

---

## Ejemplo Práctico

**Escenario: Editar el monto de un pago**

```
Estado inicial:
- Deuda: $1000 (initialAmount)
- Pago 1: $300
- Pago 2: $200 ← Vamos a editar este
- Pago 3: $100
- Remaining: $400

Editas Pago 2 de $200 a $250:

Resultado automático:
- Pago 2: $250 (actualizado)
- Total pagado: $650 (300 + 250 + 100)
- Remaining: $350 (1000 - 650) ← ACTUALIZADO AUTOMÁTICAMENTE
- totalDebt del proveedor: se resta $50 adicionales ← ACTUALIZADO AUTOMÁTICAMENTE
```

---

## Resumen

✅ **Sí, puedes usar el mismo formulario** para crear y editar

✅ **Sí, al actualizar el monto**, se actualizan automáticamente:
- Deuda (`remainingAmount`, `status`)
- Proveedor (`totalDebt`)

⚠️ **Importante**: No permitas cambiar `debtId` ni `supplierId` en modo edición

✅ **Otros campos** (paymentMethod, senderName, etc.) solo actualizan el pago, no afectan cálculos

