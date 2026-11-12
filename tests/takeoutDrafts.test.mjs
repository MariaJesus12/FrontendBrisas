import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getTakeoutDrafts } from '../src/utils/takeoutDrafts.ts'

test('solo muestra borradores para llevar, del más reciente al más antiguo', () => {
  const orders = [
    { id: 1, tipo: 'LLEVAR', estado: 'BORRADOR', createdAt: '2026-01-01T10:00:00Z' },
    { id: 2, tipo: 'LLEVAR', estado: 'FACTURADO', createdAt: '2026-01-04T10:00:00Z' },
    { id: 3, tipo: 'MESA', estado: 'BORRADOR', createdAt: '2026-01-05T10:00:00Z' },
    { id: 4, tipo: 'llevar', estado: 'borrador', createdAt: '2026-01-03T10:00:00Z' },
    { id: 5, tipo: 'LLEVAR', estado: 'BORRADOR', createdAt: '2026-01-03T10:00:00Z' },
    { id: 6, tipo: 'LLEVAR', estado: 'BORRADOR', createdAt: 'fecha inválida' },
    { id: 7, tipo: 'LLEVAR', estado: 'BORRADOR' },
  ]
  assert.deepEqual(getTakeoutDrafts(orders).map((pedido) => pedido.id), [5, 4, 1, 7, 6])
  assert.deepEqual(orders.map((pedido) => pedido.id), [1, 2, 3, 4, 5, 6, 7])
})

test('devuelve una lista vacía si no hay borradores para llevar', () => {
  assert.deepEqual(getTakeoutDrafts([{ id: 1, tipo: 'LLEVAR', estado: 'LISTO' }]), [])
})
