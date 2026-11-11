import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getPendingKitchenDetails, sameKitchenDetails } from '../src/utils/kitchenPending.ts'

const cafe = { id: 1, productoId: 7, cantidad: 3, cantidadEnviadaCocina: 2, precioUnitario: 1500 }
const pan = { id: 2, productoId: 8, cantidad: 2, cantidadEnviadaCocina: 0, precioUnitario: 800, observacion: 'Sin sal' }

test('una comanda adicional solo incluye unidades pendientes, con sus observaciones', () => {
  const previous = { ...cafe, cantidad: 2 }
  assert.deepEqual(getPendingKitchenDetails([previous]), [])
  const pending = getPendingKitchenDetails([cafe, pan])
  assert.deepEqual(pending.map(({ productoId, cantidad }) => ({ productoId, cantidad })), [
    { productoId: 7, cantidad: 1 },
    { productoId: 8, cantidad: 2 },
  ])
  assert.equal(pending[1].observacion, 'Sin sal')
  assert.deepEqual(getPendingKitchenDetails(pending.map((item) => ({
    ...item, cantidadEnviadaCocina: item.cantidad,
  }))), [])
})

test('no prepara una comanda cuando no se puede determinar la cantidad enviada', () => {
  for (const sent of [undefined, null, NaN, -1, 4, 1.5]) {
    assert.throws(() => getPendingKitchenDetails([{ ...cafe, cantidadEnviadaCocina: sent }]), /pendientes de cocina/)
  }
})

test('detecta cambios o envíos mientras la comanda está abierta', () => {
  assert.equal(sameKitchenDetails([cafe, pan], [pan, cafe]), true)
  assert.equal(sameKitchenDetails([cafe, pan], [{ ...cafe, cantidadEnviadaCocina: 3 }, pan]), false)
  assert.equal(sameKitchenDetails([cafe, pan], [cafe, { ...pan, cantidad: 3 }]), false)
  assert.equal(sameKitchenDetails([cafe, pan], [cafe, { ...pan, observacion: 'Con sal' }]), false)
  assert.equal(sameKitchenDetails([cafe], [cafe, pan]), false)
})
