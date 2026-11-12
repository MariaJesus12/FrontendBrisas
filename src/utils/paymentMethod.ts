import type { MetodoPago, PagoPedido } from '@/types/pedido.types'

export function getPaymentMethodFromRecord(record: Record<string, unknown>): PagoPedido['metodoPago'] {
  const rawMethod = record.metodoPago ?? record.metodo_pago ?? record.paymentMethod ?? record.payment_method
  const method = typeof rawMethod === 'object' && rawMethod !== null
    ? rawMethod as Record<string, unknown>
    : null
  const nombre = [method?.nombre, method?.name, record.metodoPagoNombre, record.metodo_pago_nombre]
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0)?.trim()
  const id = Number(method?.id)
  if (!nombre && (!Number.isFinite(id) || id <= 0)) return undefined

  return {
    id: Number.isFinite(id) && id > 0 ? id : undefined,
    nombre,
  }
}

export function getPaymentMethodName(payment: PagoPedido, methods: MetodoPago[]): string {
  const name = payment.metodoPago?.nombre?.trim()
  if (name) return name

  const catalogName = methods.find((method) => Number(method.id) === payment.metodoPagoId)?.nombre?.trim()
  return catalogName || `Método #${payment.metodoPagoId}`
}
