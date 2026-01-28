# Explicación: Actualización de Deuda al Editar un Pago

## Escenario del Usuario

- **Deuda inicial**: $600
- **Pago original**: $200
- **Pago editado**: $100
- **Pregunta**: ¿La deuda debería quedar en $700?

## Cómo Funciona Actualmente

### Paso 1: Estado Inicial
```
Deuda inicial (initialAmount): $600
Pago realizado: $200
Deuda restante (remainingAmount): $600 - $200 = $400
Total deuda del proveedor (totalDebt): $400 (asumiendo que es la única deuda)
```

### Paso 2: Editas el Pago de $200 a $100

El sistema calcula la **diferencia**:
```typescript
difference = newAmount - oldAmount
difference = $100 - $200 = -$100
```

### Paso 3: Actualización del Total de Deuda del Proveedor

```typescript
updateSupplierTotalDebt(supplierId, -difference)
updateSupplierTotalDebt(supplierId, -(-$100))
updateSupplierTotalDebt(supplierId, +$100)
```

Esto **SUMA** $100 al `totalDebt` del proveedor:
```
totalDebt anterior: $400
totalDebt nuevo: $400 + $100 = $500
```

### Paso 4: Recalcular RemainingAmount de la Deuda

El sistema recalcula sumando **TODOS** los pagos:
```typescript
totalPaid = suma de todos los pagos = $100 (porque solo hay un pago ahora)
remainingAmount = initialAmount - totalPaid
remainingAmount = $600 - $100 = $500
```

## Resultado Final

✅ **Deuda restante (remainingAmount)**: $500
✅ **Total deuda del proveedor (totalDebt)**: $500

## ¿Por qué NO queda en $700?

El `totalDebt` del proveedor **NO** es simplemente la deuda inicial más la diferencia del pago.

El `totalDebt` es la **suma de todas las deudas restantes** del proveedor. Cuando editas un pago:

1. El `remainingAmount` de la deuda se recalcula correctamente: $500
2. El `totalDebt` del proveedor se ajusta para reflejar el cambio

## Ejemplo con Múltiples Deudas

Si el proveedor tiene **múltiples deudas**:

```
Deuda 1: $600 (initialAmount)
  - Pago: $200 → remainingAmount: $400

Deuda 2: $300 (initialAmount)
  - Pago: $100 → remainingAmount: $200

Total deuda del proveedor (totalDebt): $400 + $200 = $600
```

Si editas el pago de la Deuda 1 de $200 a $100:

```
Deuda 1: $600
  - Pago editado: $100 → remainingAmount: $500

Deuda 2: $300
  - Pago: $100 → remainingAmount: $200

Total deuda del proveedor (totalDebt): $500 + $200 = $700 ✅
```

## Conclusión

**Sí, tienes razón** en que la deuda debería aumentar cuando reduces el monto del pago.

El código actual **SÍ hace esto correctamente**:
- Si reduces el pago de $200 a $100, el `totalDebt` aumenta en $100
- Si aumentas el pago de $200 a $300, el `totalDebt` disminuye en $100

La lógica es:
- `difference = nuevoMonto - montoAnterior`
- Si `difference` es negativo (redujiste el pago), entonces `-difference` es positivo (aumenta la deuda)
- Si `difference` es positivo (aumentaste el pago), entonces `-difference` es negativo (disminuye la deuda)

## Verificación del Código

```typescript
// Línea 731-738 de payment.service.ts
const difference = newAmount - oldAmount;
// Si oldAmount = $200, newAmount = $100
// difference = $100 - $200 = -$100

await supplierService.updateSupplierTotalDebt(supplierId, -difference);
// -difference = -(-$100) = +$100
// Esto SUMA $100 al totalDebt ✅
```

**El código está correcto y funciona como esperas.**

