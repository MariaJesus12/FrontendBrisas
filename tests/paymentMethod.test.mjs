import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getPaymentMethodFromRecord, getPaymentMethodName } from '../src/utils/paymentMethod.ts'

test('muestra el nombre enviado directamente por el backend para cada método', () => {
  for (const [id, nombre] of [[1, 'EFECTIVO'], [2, 'TARJETA'], [3, 'SINPE']]) {
    const metodoPago = getPaymentMethodFromRecord({ metodoPagoNombre: nombre })
    assert.equal(getPaymentMethodName({ id: 1, metodoPagoId: id, metodoPago, monto: 100 }, []), nombre)
  }
})

test('acepta los nombres anidados y alternativos del backend', () => {
  assert.equal(getPaymentMethodFromRecord({ metodo_pago: { nombre: 'Tarjeta' } }).nombre, 'Tarjeta')
  assert.equal(getPaymentMethodFromRecord({ metodo_pago_nombre: 'SINPE' }).nombre, 'SINPE')
  assert.equal(getPaymentMethodFromRecord({ paymentMethod: { name: 'Efectivo' } }).nombre, 'Efectivo')
  assert.equal(getPaymentMethodFromRecord({ metodoPago: { nombre: '' }, metodoPagoNombre: 'SINPE' }).nombre, 'SINPE')
})

test('usa el catálogo cuando el pago no incluye nombre y muestra el id si no existe', () => {
  const payment = { id: 1, metodoPagoId: 3, monto: 100 }
  assert.equal(getPaymentMethodName(payment, [{ id: 3, nombre: 'SINPE' }]), 'SINPE')
  assert.equal(getPaymentMethodName(payment, []), 'Método #3')
})
