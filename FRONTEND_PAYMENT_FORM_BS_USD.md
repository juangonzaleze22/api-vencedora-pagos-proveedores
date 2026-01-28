# Formulario de Registro de Pago con Switch BS/USD

Este documento muestra cómo implementar el formulario de registro de pago con la funcionalidad de switch BS/USD en el frontend.

## Funcionalidades

1. **Switch BS/USD**: Cuando está en `true` (BS):
   - Bloquea la opción de Zelle en el dropdown de método de pago
   - Si ya está seleccionado Zelle, limpia el select
   - Muestra 2 nuevos inputs: "Tasa del dólar" y "Monto en bolívares"
   - El campo "Monto" se deshabilita y su valor se calcula automáticamente: `Monto en bolívares / Tasa del dólar`

2. **Cuando está en `false` (USD)**:
   - Todo vuelve a la normalidad
   - El campo "Monto" se habilita
   - Se ocultan los campos de tasa y monto en bolívares

## Ejemplo de Implementación (React con TypeScript)

### Componente del Formulario

```tsx
import React, { useState, useEffect } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';

interface PaymentFormData {
  debtId: string;
  supplierId: string;
  amount: number;
  paymentMethod: 'ZELLE' | 'TRANSFER' | 'CASH' | '';
  senderName: string;
  senderEmail?: string;
  confirmationNumber?: string;
  paymentDate: string;
  receipt?: File;
  isBolivares: boolean; // Switch BS/USD
  exchangeRate?: number; // Tasa del dólar
  amountInBolivares?: number; // Monto en bolívares
}

const PaymentForm: React.FC = () => {
  const [isBolivares, setIsBolivares] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number | ''>('');
  const [amountInBolivares, setAmountInBolivares] = useState<number | ''>('');
  const [calculatedAmount, setCalculatedAmount] = useState<number>(0);

  // Calcular el monto en dólares cuando cambian la tasa o el monto en bolívares
  useEffect(() => {
    if (isBolivares && exchangeRate && amountInBolivares) {
      const rate = typeof exchangeRate === 'number' ? exchangeRate : parseFloat(exchangeRate);
      const amountBs = typeof amountInBolivares === 'number' ? amountInBolivares : parseFloat(amountInBolivares);
      
      if (!isNaN(rate) && !isNaN(amountBs) && rate > 0) {
        const calculated = amountBs / rate;
        setCalculatedAmount(parseFloat(calculated.toFixed(2)));
      } else {
        setCalculatedAmount(0);
      }
    } else {
      setCalculatedAmount(0);
    }
  }, [isBolivares, exchangeRate, amountInBolivares]);

  const validationSchema = Yup.object().shape({
    debtId: Yup.string().required('Debe seleccionar una deuda'),
    supplierId: Yup.string().required('Debe seleccionar un proveedor'),
    amount: Yup.number()
      .required('El monto es requerido')
      .min(0.01, 'El monto debe ser mayor a 0'),
    paymentMethod: Yup.string()
      .required('Debe seleccionar un método de pago')
      .test('no-zelle-if-bs', 'Zelle no está disponible para pagos en bolívares', function(value) {
        const isBs = this.parent.isBolivares;
        if (isBs && value === 'ZELLE') {
          return false;
        }
        return true;
      }),
    senderName: Yup.string().required('El nombre del emisor es requerido'),
    senderEmail: Yup.string().email('Email inválido').optional(),
    confirmationNumber: Yup.string().optional(),
    paymentDate: Yup.string().required('La fecha de pago es requerida'),
    exchangeRate: Yup.number()
      .when('isBolivares', {
        is: true,
        then: (schema) => schema
          .required('La tasa del dólar es requerida')
          .min(0.0001, 'La tasa debe ser mayor a 0'),
        otherwise: (schema) => schema.optional()
      }),
    amountInBolivares: Yup.number()
      .when('isBolivares', {
        is: true,
        then: (schema) => schema
          .required('El monto en bolívares es requerido')
          .min(0.01, 'El monto debe ser mayor a 0'),
        otherwise: (schema) => schema.optional()
      })
  });

  const handleSwitchChange = (setFieldValue: any, currentPaymentMethod: string) => {
    const newValue = !isBolivares;
    setIsBolivares(newValue);
    setFieldValue('isBolivares', newValue);

    // Si se activa BS y el método de pago es Zelle, limpiar el select
    if (newValue && currentPaymentMethod === 'ZELLE') {
      setFieldValue('paymentMethod', '');
    }

    // Si se desactiva BS, limpiar los campos relacionados
    if (!newValue) {
      setExchangeRate('');
      setAmountInBolivares('');
      setCalculatedAmount(0);
      setFieldValue('exchangeRate', undefined);
      setFieldValue('amountInBolivares', undefined);
    }
  };

  const handleSubmit = async (values: PaymentFormData) => {
    try {
      const formData = new FormData();
      
      formData.append('debtId', values.debtId);
      formData.append('supplierId', values.supplierId);
      formData.append('amount', values.amount.toString());
      formData.append('paymentMethod', values.paymentMethod);
      formData.append('senderName', values.senderName);
      
      if (values.senderEmail) {
        formData.append('senderEmail', values.senderEmail);
      }
      
      if (values.confirmationNumber) {
        formData.append('confirmationNumber', values.confirmationNumber);
      }
      
      formData.append('paymentDate', values.paymentDate);
      
      // Agregar los nuevos campos si está en bolívares
      if (values.isBolivares && values.exchangeRate) {
        formData.append('exchangeRate', values.exchangeRate.toString());
      }
      
      if (values.isBolivares && values.amountInBolivares) {
        formData.append('amountInBolivares', values.amountInBolivares.toString());
      }
      
      if (values.receipt) {
        formData.append('receipt', values.receipt);
      }

      // Enviar al backend
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al registrar el pago');
      }

      const result = await response.json();
      alert('Pago registrado exitosamente');
      // Redirigir o limpiar el formulario
      
    } catch (error: any) {
      console.error('Error:', error);
      alert(error.message || 'Error al registrar el pago');
    }
  };

  return (
    <div className="payment-form-container">
      <h2>Registrar Nuevo Pago</h2>
      
      <Formik
        initialValues={{
          debtId: '',
          supplierId: '',
          amount: 0,
          paymentMethod: '',
          senderName: '',
          senderEmail: '',
          confirmationNumber: '',
          paymentDate: new Date().toISOString().split('T')[0],
          receipt: undefined,
          isBolivares: false,
          exchangeRate: undefined,
          amountInBolivares: undefined
        }}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
      >
        {({ setFieldValue, values, errors, touched }) => (
          <Form>
            {/* Switch BS/USD */}
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={isBolivares}
                  onChange={() => handleSwitchChange(setFieldValue, values.paymentMethod)}
                />
                <span>Pago en Bolívares (BS)</span>
              </label>
              <small className="text-muted">
                {isBolivares ? 'Pago en Bolívares activado' : 'Pago en Dólares (USD)'}
              </small>
            </div>

            {/* Deuda */}
            <div className="form-group">
              <label>Deuda a Abonar *</label>
              <Field as="select" name="debtId">
                <option value="">Seleccione una deuda</option>
                {/* Opciones dinámicas de deudas */}
              </Field>
              <ErrorMessage name="debtId" component="div" className="error-message" />
            </div>

            {/* Proveedor */}
            <div className="form-group">
              <label>Proveedor *</label>
              <Field as="select" name="supplierId">
                <option value="">Seleccione un proveedor</option>
                {/* Opciones dinámicas de proveedores */}
              </Field>
              <ErrorMessage name="supplierId" component="div" className="error-message" />
            </div>

            {/* Monto - Se deshabilita si está en BS */}
            <div className="form-group">
              <label>Monto (USD) *</label>
              <Field
                type="number"
                name="amount"
                step="0.01"
                min="0.01"
                disabled={isBolivares}
                value={isBolivares ? calculatedAmount : values.amount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  if (!isBolivares) {
                    setFieldValue('amount', parseFloat(e.target.value) || 0);
                  }
                }}
              />
              {isBolivares && (
                <small className="text-info">
                  El monto se calcula automáticamente: Monto en BS / Tasa del dólar
                </small>
              )}
              <ErrorMessage name="amount" component="div" className="error-message" />
            </div>

            {/* Campos adicionales cuando está en BS */}
            {isBolivares && (
              <>
                {/* Tasa del dólar */}
                <div className="form-group">
                  <label>Tasa del dólar *</label>
                  <Field
                    type="number"
                    name="exchangeRate"
                    step="0.0001"
                    min="0.0001"
                    value={exchangeRate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const value = e.target.value === '' ? '' : parseFloat(e.target.value);
                      setExchangeRate(value);
                      setFieldValue('exchangeRate', value);
                    }}
                  />
                  <ErrorMessage name="exchangeRate" component="div" className="error-message" />
                </div>

                {/* Monto en bolívares */}
                <div className="form-group">
                  <label>Monto en bolívares *</label>
                  <Field
                    type="number"
                    name="amountInBolivares"
                    step="0.01"
                    min="0.01"
                    value={amountInBolivares}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const value = e.target.value === '' ? '' : parseFloat(e.target.value);
                      setAmountInBolivares(value);
                      setFieldValue('amountInBolivares', value);
                    }}
                  />
                  <ErrorMessage name="amountInBolivares" component="div" className="error-message" />
                </div>
              </>
            )}

            {/* Método de Pago */}
            <div className="form-group">
              <label>Método de Pago *</label>
              <Field as="select" name="paymentMethod">
                <option value="">Seleccione un método</option>
                <option value="ZELLE" disabled={isBolivares}>
                  Zelle {isBolivares ? '(No disponible para pagos en BS)' : ''}
                </option>
                <option value="TRANSFER">Transferencia</option>
                <option value="CASH">Efectivo</option>
              </Field>
              <ErrorMessage name="paymentMethod" component="div" className="error-message" />
            </div>

            {/* Nombre del Emisor */}
            <div className="form-group">
              <label>Nombre del Emisor *</label>
              <Field type="text" name="senderName" />
              <ErrorMessage name="senderName" component="div" className="error-message" />
            </div>

            {/* Email del Emisor (opcional) */}
            <div className="form-group">
              <label>Email del Emisor</label>
              <Field type="email" name="senderEmail" />
              <ErrorMessage name="senderEmail" component="div" className="error-message" />
            </div>

            {/* Número de Confirmación */}
            <div className="form-group">
              <label>N° de Confirmación (Últimos 5 dígitos)</label>
              <Field type="text" name="confirmationNumber" />
              <ErrorMessage name="confirmationNumber" component="div" className="error-message" />
            </div>

            {/* Fecha de Pago */}
            <div className="form-group">
              <label>Fecha de Pago *</label>
              <Field type="date" name="paymentDate" />
              <ErrorMessage name="paymentDate" component="div" className="error-message" />
            </div>

            {/* Archivo del Comprobante */}
            <div className="form-group">
              <label>Adjuntar Comprobante</label>
              <Field
                type="file"
                name="receipt"
                accept=".png,.jpg,.jpeg,.pdf"
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                  const file = event.currentTarget.files?.[0];
                  setFieldValue('receipt', file);
                }}
              />
              <small className="text-muted">PNG, JPG, PDF hasta 5MB</small>
            </div>

            {/* Botones */}
            <div className="form-actions">
              <button type="button" onClick={() => window.history.back()}>
                Cancelar
              </button>
              <button type="submit">
                Registrar Pago
              </button>
            </div>
          </Form>
        )}
      </Formik>
    </div>
  );
};

export default PaymentForm;
```

## Ejemplo de Implementación (Angular)

```typescript
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { PaymentService } from './payment.service';

@Component({
  selector: 'app-payment-form',
  templateUrl: './payment-form.component.html'
})
export class PaymentFormComponent implements OnInit {
  paymentForm: FormGroup;
  isBolivares = false;
  exchangeRate: number | null = null;
  amountInBolivares: number | null = null;
  calculatedAmount = 0;

  constructor(
    private fb: FormBuilder,
    private paymentService: PaymentService
  ) {
    this.paymentForm = this.fb.group({
      debtId: ['', Validators.required],
      supplierId: ['', Validators.required],
      amount: [{ value: 0, disabled: false }, [Validators.required, Validators.min(0.01)]],
      paymentMethod: ['', Validators.required],
      senderName: ['', Validators.required],
      senderEmail: [''],
      confirmationNumber: [''],
      paymentDate: [new Date().toISOString().split('T')[0], Validators.required],
      receipt: [null],
      exchangeRate: [null],
      amountInBolivares: [null]
    });
  }

  ngOnInit(): void {
    // Observar cambios en exchangeRate y amountInBolivares para calcular el monto
    this.paymentForm.get('exchangeRate')?.valueChanges.subscribe(() => this.calculateAmount());
    this.paymentForm.get('amountInBolivares')?.valueChanges.subscribe(() => this.calculateAmount());
  }

  onSwitchChange(): void {
    this.isBolivares = !this.isBolivares;
    
    if (this.isBolivares) {
      // Si se activa BS y el método de pago es Zelle, limpiar
      if (this.paymentForm.get('paymentMethod')?.value === 'ZELLE') {
        this.paymentForm.patchValue({ paymentMethod: '' });
      }
      
      // Habilitar validaciones para tasa y monto en BS
      this.paymentForm.get('exchangeRate')?.setValidators([Validators.required, Validators.min(0.0001)]);
      this.paymentForm.get('amountInBolivares')?.setValidators([Validators.required, Validators.min(0.01)]);
      
      // Deshabilitar el campo amount
      this.paymentForm.get('amount')?.disable();
    } else {
      // Limpiar campos de BS
      this.paymentForm.patchValue({
        exchangeRate: null,
        amountInBolivares: null
      });
      
      // Remover validaciones
      this.paymentForm.get('exchangeRate')?.clearValidators();
      this.paymentForm.get('amountInBolivares')?.clearValidators();
      
      // Habilitar el campo amount
      this.paymentForm.get('amount')?.enable();
    }
    
    this.paymentForm.get('exchangeRate')?.updateValueAndValidity();
    this.paymentForm.get('amountInBolivares')?.updateValueAndValidity();
  }

  calculateAmount(): void {
    if (this.isBolivares) {
      const rate = this.paymentForm.get('exchangeRate')?.value;
      const amountBs = this.paymentForm.get('amountInBolivares')?.value;
      
      if (rate && amountBs && rate > 0) {
        this.calculatedAmount = parseFloat((amountBs / rate).toFixed(2));
        this.paymentForm.patchValue({ amount: this.calculatedAmount }, { emitEvent: false });
      } else {
        this.calculatedAmount = 0;
        this.paymentForm.patchValue({ amount: 0 }, { emitEvent: false });
      }
    }
  }

  isZelleDisabled(): boolean {
    return this.isBolivares;
  }

  onSubmit(): void {
    if (this.paymentForm.valid) {
      const formValue = this.paymentForm.getRawValue();
      const formData = new FormData();
      
      formData.append('debtId', formValue.debtId);
      formData.append('supplierId', formValue.supplierId);
      formData.append('amount', formValue.amount.toString());
      formData.append('paymentMethod', formValue.paymentMethod);
      formData.append('senderName', formValue.senderName);
      
      if (formValue.senderEmail) {
        formData.append('senderEmail', formValue.senderEmail);
      }
      
      if (formValue.confirmationNumber) {
        formData.append('confirmationNumber', formValue.confirmationNumber);
      }
      
      formData.append('paymentDate', formValue.paymentDate);
      
      // Agregar los nuevos campos si está en bolívares
      if (this.isBolivares && formValue.exchangeRate) {
        formData.append('exchangeRate', formValue.exchangeRate.toString());
      }
      
      if (this.isBolivares && formValue.amountInBolivares) {
        formData.append('amountInBolivares', formValue.amountInBolivares.toString());
      }
      
      if (formValue.receipt) {
        formData.append('receipt', formValue.receipt);
      }

      this.paymentService.createPayment(formData).subscribe({
        next: (response) => {
          alert('Pago registrado exitosamente');
          // Redirigir o limpiar el formulario
        },
        error: (error) => {
          console.error('Error:', error);
          alert(error.error?.message || 'Error al registrar el pago');
        }
      });
    }
  }
}
```

### Template HTML (Angular)

```html
<form [formGroup]="paymentForm" (ngSubmit)="onSubmit()">
  <h2>Registrar Nuevo Pago</h2>

  <!-- Switch BS/USD -->
  <div class="form-group">
    <label>
      <input type="checkbox" [checked]="isBolivares" (change)="onSwitchChange()">
      <span>Pago en Bolívares (BS)</span>
    </label>
    <small class="text-muted">
      {{ isBolivares ? 'Pago en Bolívares activado' : 'Pago en Dólares (USD)' }}
    </small>
  </div>

  <!-- Deuda -->
  <div class="form-group">
    <label>Deuda a Abonar *</label>
    <select formControlName="debtId">
      <option value="">Seleccione una deuda</option>
      <!-- Opciones dinámicas -->
    </select>
    <div *ngIf="paymentForm.get('debtId')?.invalid && paymentForm.get('debtId')?.touched" class="error-message">
      Debe seleccionar una deuda
    </div>
  </div>

  <!-- Proveedor -->
  <div class="form-group">
    <label>Proveedor *</label>
    <select formControlName="supplierId">
      <option value="">Seleccione un proveedor</option>
      <!-- Opciones dinámicas -->
    </select>
    <div *ngIf="paymentForm.get('supplierId')?.invalid && paymentForm.get('supplierId')?.touched" class="error-message">
      Debe seleccionar un proveedor
    </div>
  </div>

  <!-- Monto -->
  <div class="form-group">
    <label>Monto (USD) *</label>
    <input 
      type="number" 
      formControlName="amount" 
      step="0.01" 
      min="0.01"
      [disabled]="isBolivares">
    <small *ngIf="isBolivares" class="text-info">
      El monto se calcula automáticamente: Monto en BS / Tasa del dólar
    </small>
    <div *ngIf="paymentForm.get('amount')?.invalid && paymentForm.get('amount')?.touched" class="error-message">
      El monto es requerido y debe ser mayor a 0
    </div>
  </div>

  <!-- Campos adicionales cuando está en BS -->
  <ng-container *ngIf="isBolivares">
    <!-- Tasa del dólar -->
    <div class="form-group">
      <label>Tasa del dólar *</label>
      <input 
        type="number" 
        formControlName="exchangeRate" 
        step="0.0001" 
        min="0.0001">
      <div *ngIf="paymentForm.get('exchangeRate')?.invalid && paymentForm.get('exchangeRate')?.touched" class="error-message">
        La tasa del dólar es requerida
      </div>
    </div>

    <!-- Monto en bolívares -->
    <div class="form-group">
      <label>Monto en bolívares *</label>
      <input 
        type="number" 
        formControlName="amountInBolivares" 
        step="0.01" 
        min="0.01">
      <div *ngIf="paymentForm.get('amountInBolivares')?.invalid && paymentForm.get('amountInBolivares')?.touched" class="error-message">
        El monto en bolívares es requerido
      </div>
    </div>
  </ng-container>

  <!-- Método de Pago -->
  <div class="form-group">
    <label>Método de Pago *</label>
    <select formControlName="paymentMethod">
      <option value="">Seleccione un método</option>
      <option [value]="'ZELLE'" [disabled]="isZelleDisabled()">
        Zelle {{ isBolivares ? '(No disponible para pagos en BS)' : '' }}
      </option>
      <option [value]="'TRANSFER'">Transferencia</option>
      <option [value]="'CASH'">Efectivo</option>
    </select>
    <div *ngIf="paymentForm.get('paymentMethod')?.invalid && paymentForm.get('paymentMethod')?.touched" class="error-message">
      Debe seleccionar un método de pago
    </div>
  </div>

  <!-- Nombre del Emisor -->
  <div class="form-group">
    <label>Nombre del Emisor *</label>
    <input type="text" formControlName="senderName">
    <div *ngIf="paymentForm.get('senderName')?.invalid && paymentForm.get('senderName')?.touched" class="error-message">
      El nombre del emisor es requerido
    </div>
  </div>

  <!-- Email del Emisor -->
  <div class="form-group">
    <label>Email del Emisor</label>
    <input type="email" formControlName="senderEmail">
  </div>

  <!-- Número de Confirmación -->
  <div class="form-group">
    <label>N° de Confirmación (Últimos 5 dígitos)</label>
    <input type="text" formControlName="confirmationNumber">
  </div>

  <!-- Fecha de Pago -->
  <div class="form-group">
    <label>Fecha de Pago *</label>
    <input type="date" formControlName="paymentDate">
    <div *ngIf="paymentForm.get('paymentDate')?.invalid && paymentForm.get('paymentDate')?.touched" class="error-message">
      La fecha de pago es requerida
    </div>
  </div>

  <!-- Archivo del Comprobante -->
  <div class="form-group">
    <label>Adjuntar Comprobante</label>
    <input 
      type="file" 
      (change)="onFileSelected($event)"
      accept=".png,.jpg,.jpeg,.pdf">
    <small class="text-muted">PNG, JPG, PDF hasta 5MB</small>
  </div>

  <!-- Botones -->
  <div class="form-actions">
    <button type="button" (click)="goBack()">Cancelar</button>
    <button type="submit" [disabled]="paymentForm.invalid">Registrar Pago</button>
  </div>
</form>
```

## Notas Importantes

1. **Validación del método de pago**: Cuando el switch está en `true` (BS), Zelle debe estar deshabilitado y no debe poder seleccionarse.

2. **Cálculo automático**: El monto en dólares se calcula automáticamente cuando se ingresan la tasa y el monto en bolívares.

3. **Limpieza de campos**: Al desactivar el switch, se deben limpiar los campos de tasa y monto en bolívares.

4. **Envío al backend**: Los campos `exchangeRate` y `amountInBolivares` solo se envían cuando el switch está activado (BS).

5. **FormData**: Como el formulario incluye un archivo (comprobante), se debe usar `FormData` para enviar los datos al backend.
