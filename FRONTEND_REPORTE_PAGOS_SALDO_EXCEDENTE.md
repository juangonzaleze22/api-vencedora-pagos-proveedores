# Saldo excedente en vista "Reporte de Pagos Detallados"

La API ya devuelve en cada deuda el campo **`surplusAmountAtCreation`**: monto de saldo excedente (créditos) aplicado al registrar esa deuda. Si no se aplicó nada, viene `null`.

## Dónde sale el dato

- **GET** ` /api/reports/supplier/:supplierId/detailed`  
  En la respuesta, cada elemento de `debts[]` tiene:
  - `initialAmount`, `remainingAmount`, `status`, `dueDate`, `debtNumber`, `title`, etc.
  - **`surplusAmountAtCreation`**: `number | null` — excedente asignado al crear la deuda.

## Qué mostrar en la vista

En la misma vista **Reporte de Pagos Detallados**, en cada tarjeta de deuda (donde ya muestras Inicial, Restante, Vencimiento, Pagos Activos), agrega una línea o bloque:

- **Etiqueta:** "Excedente asignado" o "Saldo excedente"
- **Valor:** solo cuando `debt.surplusAmountAtCreation != null && debt.surplusAmountAtCreation > 0`  
  - Mostrar el monto formateado (ej. `$ 100.00`).  
  - Si es `null` o `0`, no mostrar la fila o mostrar "—" / "N/A".

Mismo criterio que en el reporte por proveedor: solo mostrar el campo cuando la deuda se registró con excedente aplicado.

## Ejemplo de estructura en la tarjeta (React)

```tsx
{/* Inicial, Restante, Vencimiento, Pagos Activos... */}

{debt.surplusAmountAtCreation != null && debt.surplusAmountAtCreation > 0 && (
  <div className="flex items-center gap-2">
    <span className="text-muted">Excedente asignado</span>
    <span className="font-medium">$ {Number(debt.surplusAmountAtCreation).toFixed(2)}</span>
  </div>
)}
```

## Ejemplo con ícono (similar a Inicial/Restante)

Puedes reutilizar el mismo estilo que "Inicial" y "Restante" (por ejemplo un ícono de moneda o de crédito) y una línea como:

- **Excedente asignado:** `$ X.XX` (solo si `surplusAmountAtCreation > 0`).

## Tipo TypeScript (si usas TS en el front)

```ts
interface DebtForReport {
  id: number;
  orderId: number;
  supplierId: number;
  initialAmount: number;
  remainingAmount: number;
  surplusAmountAtCreation?: number | null;  // añadir esto
  status: string;
  dueDate: string;
  debtNumber?: number;
  title?: string | null;
  payments?: Payment[];
  // ...
}
```

## Resumen

1. La vista **Reporte de Pagos Detallados** usa los datos de `GET /api/reports/supplier/:id/detailed` (o el endpoint que alimente esa pantalla).
2. En cada tarjeta de deuda, lee `debt.surplusAmountAtCreation`.
3. Si es un número mayor a 0, muestra una fila/campo **"Excedente asignado"** con el monto formateado.
4. Si es `null` o `0`, no muestres esa fila (o muestra "—"/"N/A") para mantener la misma lógica que en el reporte por proveedor y en el PDF.

Con esto la vista de Reporte de Pagos Detallados queda alineada con el reporte detallado por proveedor y con el PDF de exportación.
