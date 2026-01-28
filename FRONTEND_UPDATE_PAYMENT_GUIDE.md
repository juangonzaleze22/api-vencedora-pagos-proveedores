# Guía para el Frontend: Actualizar Pago con Cambio de Proveedor/Deuda

## ✅ Cambios Implementados en el Backend

El backend ahora **permite cambiar** `debtId` y `supplierId` al editar un pago. La lógica automáticamente:

1. **Si cambia el proveedor:**
   - Resta el monto del `totalDebt` del proveedor anterior
   - Suma el monto al `totalDebt` del nuevo proveedor
   - Actualiza `lastPaymentDate` del nuevo proveedor

2. **Si cambia la deuda:**
   - Valida que la nueva deuda pertenezca al proveedor seleccionado
   - Valida que el monto no exceda el `remainingAmount` disponible
   - Recalcula `remainingAmount` de la deuda anterior (suma el monto)
   - Recalcula `remainingAmount` de la nueva deuda (resta el monto)

3. **Si cambia el monto:**
   - Ajusta los totales según corresponda

## 📋 Qué Debe Hacer el Frontend

### 1. Enviar `debtId` y `supplierId` en el FormData/JSON

Cuando el usuario edita un pago y cambia el proveedor o la deuda, debes enviar estos campos:

```typescript
// Ejemplo con FormData
const formData = new FormData();
formData.append('debtId', newDebtId.toString());
formData.append('supplierId', newSupplierId.toString());
formData.append('amount', newAmount.toString());
// ... otros campos
```

### 2. Validación en el Frontend (Recomendado)

Antes de enviar, valida que:
- La deuda seleccionada pertenezca al proveedor seleccionado
- El monto no exceda el `remainingAmount` de la deuda seleccionada

```typescript
// Ejemplo de validación
async validatePaymentUpdate(debtId: number, supplierId: number, amount: number) {
  // 1. Obtener la deuda para validar
  const debt = await this.debtService.getDebtById(debtId).toPromise();
  
  if (!debt) {
    throw new Error('Deuda no encontrada');
  }
  
  // 2. Validar que la deuda pertenezca al proveedor
  if (debt.supplierId !== supplierId) {
    throw new Error('La deuda seleccionada no pertenece al proveedor seleccionado');
  }
  
  // 3. Validar que el monto no exceda el remainingAmount
  if (amount > debt.remainingAmount) {
    throw new Error(
      `El monto ($${amount}) excede el monto disponible ($${debt.remainingAmount})`
    );
  }
  
  return true;
}
```

### 3. Manejo de Errores

El backend puede devolver estos errores:

```typescript
// Errores posibles:
- "Nueva deuda no encontrada"
- "La deuda seleccionada no pertenece al proveedor seleccionado"
- "El monto excede el monto máximo permitido en la nueva deuda"
- "El nuevo monto excede el monto máximo permitido"
```

Muestra estos errores al usuario de forma clara.

### 4. Actualizar la UI Después de la Actualización

Después de actualizar exitosamente, recarga:
- El reporte del proveedor (si estás en una vista de reporte)
- La lista de pagos
- La información de la deuda

## 📝 Ejemplo Completo de Implementación

### Servicio de Pagos (TypeScript/Angular)

```typescript
@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  constructor(private http: HttpClient) {}

  updatePayment(paymentId: number, data: {
    debtId?: number;
    supplierId?: number;
    amount?: number;
    paymentMethod?: 'ZELLE' | 'TRANSFER' | 'CASH';
    senderName?: string;
    email?: string;
    confirmationNumber?: string;
    paymentDate?: Date;
    receipt?: File;
    removeReceipt?: boolean;
  }): Observable<Payment> {
    const formData = new FormData();
    
    // Campos opcionales - solo enviar si están definidos
    if (data.debtId !== undefined) {
      formData.append('debtId', data.debtId.toString());
    }
    if (data.supplierId !== undefined) {
      formData.append('supplierId', data.supplierId.toString());
    }
    if (data.amount !== undefined) {
      formData.append('amount', data.amount.toString());
    }
    if (data.paymentMethod) {
      formData.append('paymentMethod', data.paymentMethod);
    }
    if (data.senderName) {
      formData.append('senderName', data.senderName);
    }
    if (data.email !== undefined) {
      formData.append('email', data.email || '');
    }
    if (data.confirmationNumber !== undefined) {
      formData.append('confirmationNumber', data.confirmationNumber || '');
    }
    if (data.paymentDate) {
      formData.append('paymentDate', data.paymentDate.toISOString().split('T')[0]);
    }
    if (data.removeReceipt) {
      formData.append('removeReceipt', 'true');
    }
    if (data.receipt) {
      formData.append('receipt', data.receipt);
    }

    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.put<PaymentResponse>(
      `${this.baseUrl}/payments/${paymentId}`,
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

### Componente (TypeScript/Angular)

```typescript
export class EditPaymentComponent {
  paymentForm: FormGroup;
  payment: Payment | null = null;

  constructor(
    private fb: FormBuilder,
    private paymentService: PaymentService,
    private debtService: DebtService,
    private route: ActivatedRoute
  ) {
    this.paymentForm = this.fb.group({
      debtId: ['', [Validators.required]],
      supplierId: ['', [Validators.required]],
      amount: ['', [Validators.required, Validators.min(0.01)]],
      paymentMethod: ['', [Validators.required]],
      senderName: ['', [Validators.required]],
      email: [''],
      confirmationNumber: [''],
      paymentDate: ['', [Validators.required]]
    });
  }

  async onSubmit() {
    if (this.paymentForm.valid) {
      const formValue = this.paymentForm.value;
      
      try {
        // Validar antes de enviar (opcional pero recomendado)
        await this.validateBeforeSubmit(
          formValue.debtId,
          formValue.supplierId,
          formValue.amount
        );

        // Enviar actualización
        await this.paymentService.updatePayment(this.payment!.id, {
          debtId: parseInt(formValue.debtId),
          supplierId: parseInt(formValue.supplierId),
          amount: parseFloat(formValue.amount),
          paymentMethod: formValue.paymentMethod,
          senderName: formValue.senderName,
          email: formValue.email || undefined,
          confirmationNumber: formValue.confirmationNumber || undefined,
          paymentDate: new Date(formValue.paymentDate)
        }).toPromise();

        alert('Pago actualizado exitosamente');
        // Recargar datos o navegar
      } catch (error: any) {
        console.error('Error:', error);
        alert(error.error?.message || error.message || 'Error al actualizar el pago');
      }
    }
  }

  async validateBeforeSubmit(debtId: number, supplierId: number, amount: number) {
    const debt = await this.debtService.getDebtById(debtId).toPromise();
    
    if (!debt) {
      throw new Error('Deuda no encontrada');
    }
    
    if (debt.supplierId !== supplierId) {
      throw new Error('La deuda seleccionada no pertenece al proveedor seleccionado');
    }
    
    if (amount > debt.remainingAmount) {
      throw new Error(
        `El monto ($${amount.toFixed(2)}) excede el monto disponible ` +
        `($${debt.remainingAmount.toFixed(2)})`
      );
    }
  }
}
```

## 🔄 Flujo Recomendado

1. **Usuario carga el formulario de edición**
   - Cargar datos del pago actual
   - Cargar lista de proveedores
   - Cargar lista de deudas del proveedor actual

2. **Usuario cambia el proveedor**
   - Filtrar/cargar deudas del nuevo proveedor
   - Actualizar el dropdown de deudas
   - Validar que la deuda actual pertenezca al nuevo proveedor

3. **Usuario cambia la deuda**
   - Actualizar el monto máximo permitido
   - Validar que el monto actual no exceda el nuevo máximo

4. **Usuario envía el formulario**
   - Validar en frontend (opcional)
   - Enviar al backend
   - Manejar errores
   - Recargar datos

## ⚠️ Consideraciones Importantes

1. **Sincronización de Proveedor y Deuda:**
   - Cuando el usuario cambia el proveedor, asegúrate de que la deuda seleccionada pertenezca a ese proveedor
   - Si no, muestra un error o resetea la selección de deuda

2. **Monto Máximo:**
   - Actualiza el monto máximo permitido cuando cambie la deuda
   - Muestra claramente: "Monto (Máx: $XXX.XX)"

3. **Feedback al Usuario:**
   - Muestra mensajes claros cuando cambie proveedor/deuda
   - Ejemplo: "Al cambiar el proveedor, se actualizarán automáticamente los totales de deuda"

4. **Confirmación (Opcional):**
   - Si cambia proveedor o deuda, podrías mostrar un diálogo de confirmación:
   - "¿Estás seguro de cambiar el proveedor? Esto actualizará los totales de deuda automáticamente."

## 📊 Estructura de Respuesta del Backend

```json
{
  "success": true,
  "message": "Pago actualizado exitosamente",
  "data": {
    "id": 10,
    "debtId": 5,
    "supplierId": 3,
    "amount": 150.00,
    "paymentMethod": "ZELLE",
    "senderName": "Juan González",
    "email": "juan@example.com",
    "confirmationNumber": "12345",
    "paymentDate": "2026-01-15T00:00:00.000Z",
    "receiptFile": null,
    "verified": false,
    "createdBy": 1,
    "createdAt": "2026-01-13T00:00:00.000Z",
    "updatedAt": "2026-01-15T00:00:00.000Z",
    "supplier": {
      "id": 3,
      "companyName": "Nuevo Proveedor",
      "taxId": "J-12345678-9"
    }
  }
}
```

## ✅ Checklist para el Frontend

- [ ] Enviar `debtId` y `supplierId` cuando el usuario los cambie
- [ ] Validar que la deuda pertenezca al proveedor (opcional pero recomendado)
- [ ] Validar que el monto no exceda el `remainingAmount` (opcional pero recomendado)
- [ ] Manejar errores del backend y mostrarlos al usuario
- [ ] Actualizar la UI después de una actualización exitosa
- [ ] Sincronizar el dropdown de deudas cuando cambie el proveedor
- [ ] Actualizar el monto máximo cuando cambie la deuda
- [ ] Mostrar feedback claro al usuario sobre los cambios

