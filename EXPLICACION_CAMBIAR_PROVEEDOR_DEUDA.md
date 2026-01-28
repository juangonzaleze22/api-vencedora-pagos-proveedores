# Explicación: Cambiar Proveedor y Deuda al Editar un Pago

## ⚠️ Estado Actual

**Actualmente NO se permite cambiar** `debtId` ni `supplierId` al editar un pago. Esto es **intencional y correcto** por las siguientes razones:

## ¿Por qué NO se debe permitir cambiar proveedor/deuda?

### 1. **Integridad de Datos**
Un pago está **históricamente vinculado** a una deuda y un proveedor específicos. Cambiar esto alteraría el historial financiero.

### 2. **Complejidad de Actualizaciones**
Si se permitiera cambiar, necesitarías actualizar múltiples entidades:

#### Si cambias el **PROVEEDOR**:
```
Proveedor Anterior:
- Restar el monto del totalDebt
- Actualizar lastPaymentDate (si era el último pago)

Proveedor Nuevo:
- Sumar el monto al totalDebt
- Actualizar lastPaymentDate
```

#### Si cambias la **DEUDA**:
```
Deuda Anterior:
- Recalcular remainingAmount (sumar el monto del pago de vuelta)
- Actualizar status (PENDING/PAID)

Deuda Nueva:
- Validar que el monto no exceda el remainingAmount disponible
- Recalcular remainingAmount (restar el monto del pago)
- Actualizar status (PENDING/PAID)
```

### 3. **Riesgo de Errores**
- Podría crear inconsistencias en los cálculos
- Podría generar deudas negativas
- Podría afectar reportes históricos

## ¿Qué hacer si el usuario seleccionó mal el proveedor/deuda?

### Opción 1: **Eliminar y Recrear** (Recomendado)
```typescript
// 1. Eliminar el pago incorrecto
DELETE /api/payments/:id

// 2. Crear nuevo pago con el proveedor/deuda correcto
POST /api/payments
{
  debtId: nuevoDebtId,
  supplierId: nuevoSupplierId,
  amount: monto,
  ...
}
```

### Opción 2: **Permitir Cambio** (Si realmente lo necesitas)
Si realmente necesitas permitir cambiar proveedor/deuda, necesitarías implementar lógica compleja.

## Implementación Compleja (Si se Permite)

Si decidieras permitir cambiar proveedor/deuda, necesitarías:

### 1. Actualizar el Controlador

```typescript
async update(req: Request, res: Response, next: NextFunction) {
  // ... código existente ...
  
  const updateData: any = {};
  
  // Permitir cambiar deuda y proveedor
  if (req.body.debtId !== undefined) {
    updateData.debtId = parseInt(req.body.debtId);
  }
  if (req.body.supplierId !== undefined) {
    updateData.supplierId = parseInt(req.body.supplierId);
  }
  
  // ... resto del código ...
}
```

### 2. Actualizar el Servicio con Lógica Compleja

```typescript
async updatePayment(paymentId: number, data: {
  debtId?: number;
  supplierId?: number;
  amount?: number;
  // ... otros campos
}) {
  // 1. Obtener pago original
  const oldPayment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { debt: true }
  });
  
  const oldDebtId = oldPayment.debtId;
  const oldSupplierId = oldPayment.supplierId;
  const oldAmount = Number(oldPayment.amount);
  
  const newDebtId = data.debtId || oldDebtId;
  const newSupplierId = data.supplierId || oldSupplierId;
  const newAmount = data.amount ? Number(data.amount) : oldAmount;
  
  // 2. Si cambió el proveedor
  if (newSupplierId !== oldSupplierId) {
    // Restar del proveedor anterior
    await supplierService.updateSupplierTotalDebt(oldSupplierId, oldAmount);
    
    // Sumar al nuevo proveedor
    await supplierService.updateSupplierTotalDebt(newSupplierId, -newAmount);
    
    // Actualizar lastPaymentDate del nuevo proveedor
    if (data.paymentDate) {
      await supplierService.updateSupplierLastPaymentDate(
        newSupplierId, 
        new Date(data.paymentDate)
      );
    }
  }
  
  // 3. Si cambió la deuda
  if (newDebtId !== oldDebtId) {
    // Recalcular deuda anterior (sumar el monto de vuelta)
    await debtService.updateDebtStatus(oldDebtId);
    
    // Validar nueva deuda
    const newDebt = await prisma.debt.findUnique({
      where: { id: newDebtId }
    });
    
    if (!newDebt) {
      throw new Error('Nueva deuda no encontrada');
    }
    
    // Validar que el monto no exceda el remainingAmount
    if (newAmount > Number(newDebt.remainingAmount)) {
      throw new Error('El monto excede el disponible en la nueva deuda');
    }
    
    // Recalcular nueva deuda (restar el monto)
    await debtService.updateDebtStatus(newDebtId);
  }
  
  // 4. Si solo cambió el monto (sin cambiar deuda/proveedor)
  if (newAmount !== oldAmount && newDebtId === oldDebtId) {
    // Lógica actual de actualización de monto
    const difference = newAmount - oldAmount;
    await supplierService.updateSupplierTotalDebt(newSupplierId, -difference);
    await debtService.updateDebtStatus(newDebtId);
  }
  
  // 5. Si cambió monto Y deuda/proveedor
  if (newAmount !== oldAmount && (newDebtId !== oldDebtId || newSupplierId !== oldSupplierId)) {
    // Lógica más compleja...
    // Restar monto anterior de deuda/proveedor anterior
    // Sumar monto nuevo a deuda/proveedor nuevo
  }
  
  // 6. Actualizar el pago
  const updatedPayment = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      debtId: newDebtId,
      supplierId: newSupplierId,
      amount: newAmount,
      // ... otros campos
    }
  });
  
  return updatedPayment;
}
```

## Recomendación

**NO permitas cambiar proveedor/deuda al editar un pago**. En su lugar:

1. **Validar bien al crear**: Asegúrate de que el usuario seleccione correctamente desde el inicio
2. **Permitir eliminar**: Si se equivocó, que elimine el pago y cree uno nuevo
3. **Mostrar información clara**: En el formulario de edición, muestra claramente el proveedor y deuda (deshabilitados) para que el usuario vea a qué está asociado

## Ejemplo de UI Recomendada

```html
<!-- En modo edición, mostrar pero deshabilitar -->
<div class="form-group">
  <label>Proveedor</label>
  <input 
    type="text" 
    [value]="payment.supplier.companyName" 
    disabled
    class="form-control">
  <small class="text-muted">
    El proveedor no puede ser cambiado. Si necesitas cambiarlo, elimina este pago y crea uno nuevo.
  </small>
</div>

<div class="form-group">
  <label>Deuda</label>
  <input 
    type="text" 
    [value]="'Deuda #' + payment.debt.debtNumber" 
    disabled
    class="form-control">
  <small class="text-muted">
    La deuda no puede ser cambiada. Si necesitas cambiarla, elimina este pago y crea uno nuevo.
  </small>
</div>
```

## Conclusión

**Mantén la restricción actual**: No permitas cambiar `debtId` ni `supplierId` al editar. Es más seguro, más simple y mantiene la integridad de los datos históricos.

