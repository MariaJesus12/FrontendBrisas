import type { PedidoDetalle } from '@/types/pedido.types'

export function getPendingKitchenDetails(details: PedidoDetalle[]): PedidoDetalle[] {
  return details.flatMap((detail) => {
    const cantidad = Number(detail.cantidad)
    const enviada = detail.cantidadEnviadaCocina == null ? NaN : Number(detail.cantidadEnviadaCocina)
    if (!Number.isInteger(cantidad) || cantidad < 0 || !Number.isInteger(enviada) || enviada < 0 || enviada > cantidad) {
      throw new Error('No se pudo determinar qué productos están pendientes de cocina. Actualiza el pedido e inténtalo de nuevo.')
    }

    return cantidad > enviada ? [{ ...detail, cantidad: cantidad - enviada }] : []
  })
}

export function sameKitchenDetails(left: PedidoDetalle[], right: PedidoDetalle[]): boolean {
  const snapshot = (details: PedidoDetalle[]) =>
    JSON.stringify(details.map((detail) => [
      detail.id,
      detail.productoId,
      detail.cantidad,
      detail.cantidadEnviadaCocina,
      detail.observacion ?? '',
    ]).sort((a, b) => Number(a[0]) - Number(b[0])))

  return snapshot(left) === snapshot(right)
}
