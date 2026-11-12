import type { Pedido } from '@/types/pedido.types'

export function getTakeoutDrafts(pedidos: Pedido[]): Pedido[] {
  return pedidos
    .filter((pedido) =>
      String(pedido.tipo).trim().toUpperCase() === 'LLEVAR' &&
      String(pedido.estado).trim().toUpperCase() === 'BORRADOR',
    )
    .sort((left, right) => {
      const leftDate = left.createdAt ? Date.parse(left.createdAt) : NaN
      const rightDate = right.createdAt ? Date.parse(right.createdAt) : NaN
      const leftTime = Number.isFinite(leftDate) ? leftDate : Number.NEGATIVE_INFINITY
      const rightTime = Number.isFinite(rightDate) ? rightDate : Number.NEGATIVE_INFINITY
      return rightTime - leftTime || Number(right.id) - Number(left.id)
    })
}
