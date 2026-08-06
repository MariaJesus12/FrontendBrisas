import axios from 'axios'
import api from './api'
import type {
  AddPedidoAccountDetailDto,
  CreatePedidoAccountDto,
  PedidoAccountSplitItemDto,
  CreatePagoPedidoDto,
  CreatePedidoDetalleDto,
  CreatePedidoDto,
  MetodoPago,
  MovePedidoAccountDetailDto,
  Pedido,
  PedidoAccount,
  PedidoDetalle,
  PedidoListQuery,
  PagoPedido,
  UpdatePedidoDto,
} from '@/types/pedido.types'

function normalizeSplitItems(data: {
  items?: PedidoAccountSplitItemDto[]
  detailIds?: number[]
  detalleIds?: number[]
  detalles?: Array<{
    detailId?: number
    detalleId?: number
    productoId?: number
    producto_id?: number
    cantidad?: number
    quantity?: number
    qty?: number
  }>
  detailId?: number
  pedidoDetalleId?: number
  productoId?: number
  cantidad?: number
}): PedidoAccountSplitItemDto[] {
  const result: PedidoAccountSplitItemDto[] = []

  const fromItems = Array.isArray(data.items) ? data.items : []
  for (const item of fromItems) {
    const detailId = Number(item.detailId)
    const productoId = Number(item.productoId)
    const safeDetailId = Number.isFinite(detailId) && detailId > 0 ? detailId : undefined
    const safeProductoId = Number.isFinite(productoId) && productoId > 0 ? productoId : undefined
    if (!safeDetailId && !safeProductoId) {
      continue
    }

    const cantidad = Number(item.cantidad)
    result.push({
      detailId: safeDetailId,
      productoId: safeProductoId,
      cantidad: Number.isFinite(cantidad) && cantidad > 0 ? cantidad : undefined,
    })
  }

  const fromDetailIds = Array.isArray(data.detailIds) ? data.detailIds : []
  for (const id of fromDetailIds) {
    const detailId = Number(id)
    if (Number.isFinite(detailId) && detailId > 0) {
      result.push({ detailId })
    }
  }

  const fromDetalleIds = Array.isArray(data.detalleIds) ? data.detalleIds : []
  for (const id of fromDetalleIds) {
    const detailId = Number(id)
    if (Number.isFinite(detailId) && detailId > 0) {
      result.push({ detailId })
    }
  }

  const fromDetalles = Array.isArray(data.detalles) ? data.detalles : []
  for (const item of fromDetalles) {
    const detailId = Number(item.detailId ?? item.detalleId ?? 0)
    const productoId = Number(item.productoId ?? item.producto_id ?? 0)
    const safeDetailId = Number.isFinite(detailId) && detailId > 0 ? detailId : undefined
    const safeProductoId = Number.isFinite(productoId) && productoId > 0 ? productoId : undefined
    if (!safeDetailId && !safeProductoId) {
      continue
    }

    const cantidad = Number(item.cantidad ?? item.quantity ?? item.qty)
    result.push({
      detailId: safeDetailId,
      productoId: safeProductoId,
      cantidad: Number.isFinite(cantidad) && cantidad > 0 ? cantidad : undefined,
    })
  }

  const singleDetailId = Number(data.detailId ?? data.pedidoDetalleId ?? 0)
  const singleProductoId = Number(data.productoId ?? 0)
  const safeSingleDetailId = Number.isFinite(singleDetailId) && singleDetailId > 0 ? singleDetailId : undefined
  const safeSingleProductoId = Number.isFinite(singleProductoId) && singleProductoId > 0 ? singleProductoId : undefined
  if (safeSingleDetailId || safeSingleProductoId) {
    const cantidad = Number(data.cantidad)
    result.push({
      detailId: safeSingleDetailId,
      productoId: safeSingleProductoId,
      cantidad: Number.isFinite(cantidad) && cantidad > 0 ? cantidad : undefined,
    })
  }

  const deduped = new Map<string, PedidoAccountSplitItemDto>()
  for (const item of result) {
    const key = item.detailId ? `d:${item.detailId}` : item.productoId ? `p:${item.productoId}` : ''
    if (!key) {
      continue
    }

    const existing = deduped.get(key)
    if (!existing || (item.cantidad && !existing.cantidad)) {
      deduped.set(key, item)
    }
  }

  return Array.from(deduped.values())
}

function buildSplitPayloadVariants(items: PedidoAccountSplitItemDto[]) {
  if (items.length === 0) {
    return []
  }

  const detailIds = items.map((item) => item.detailId).filter((item): item is number => Number.isFinite(Number(item)) && Number(item) > 0)

  const itemsPayload = items.map((item) => ({
    detailId: item.detailId,
    productoId: item.productoId,
    cantidad: item.cantidad,
  }))

  const detallesPayload = items.map((item) => ({
    detailId: item.detailId,
    quantity: item.cantidad,
  }))

  const snakeItemsPayload = items.map((item) => ({
    detail_id: item.detailId,
    producto_id: item.productoId,
    cantidad: item.cantidad,
  }))

  const variants: Array<Record<string, unknown>> = [
    { items: itemsPayload },
    { detalles: detallesPayload },
    { items: snakeItemsPayload },
  ]

  if (detailIds.length > 0) {
    variants.push({ detailIds })
    variants.push({ detalleIds: detailIds })
  }

  return variants
}

function buildCreateAccountVariants(data: CreatePedidoAccountDto) {
  const items = normalizeSplitItems(data)
  const splitVariants = buildSplitPayloadVariants(items)
  const numeroCuenta = Number(data.numeroCuenta)
  const safeNumeroCuenta = Number.isFinite(numeroCuenta) && numeroCuenta > 0 ? numeroCuenta : undefined

  const variants = splitVariants.map((payload) => ({
    numeroCuenta: safeNumeroCuenta,
    numero_cuenta: safeNumeroCuenta,
    nombre: data.nombre,
    numero: data.numero,
    activo: data.activo,
    ...payload,
  }))

  if (variants.length === 0) {
    return [
      {
        numeroCuenta: safeNumeroCuenta,
        numero_cuenta: safeNumeroCuenta,
        nombre: data.nombre,
        numero: data.numero,
        activo: data.activo,
      },
    ]
  }

  return variants
}

function buildAddAccountDetailVariants(data: AddPedidoAccountDetailDto) {
  const items = normalizeSplitItems(data)
  const splitVariants = buildSplitPayloadVariants(items)
  const firstItem = items[0]

  const singularVariants: Array<Record<string, unknown>> = firstItem
    ? [
        {
          detailId: firstItem.detailId,
          pedidoDetalleId: firstItem.detailId,
          productoId: firstItem.productoId,
          cantidad: firstItem.cantidad,
        },
        {
          detail_id: firstItem.detailId,
          pedido_detalle_id: firstItem.detailId,
          producto_id: firstItem.productoId,
          cantidad: firstItem.cantidad,
        },
        {
          detalleId: firstItem.detailId,
          productoId: firstItem.productoId,
          quantity: firstItem.cantidad,
        },
      ]
    : []

  if (splitVariants.length > 0) {
    return [...splitVariants, ...singularVariants]
  }

  return [
    {
      detailId: data.detailId,
      pedidoDetalleId: data.pedidoDetalleId,
      productoId: data.productoId,
      cantidad: data.cantidad,
    },
    {
      detail_id: data.detailId,
      pedido_detalle_id: data.pedidoDetalleId,
      producto_id: data.productoId,
      cantidad: data.cantidad,
    },
  ]
}

function buildPaymentPayloadVariants(data: CreatePagoPedidoDto) {
  const accountScopeId = data.cuentaPedidoId ?? data.cuentaId ?? data.accountId

  return [
    {
      metodoPagoId: data.metodoPagoId,
      monto: data.monto,
      montoMoneda: data.montoMoneda,
      moneda: data.moneda,
      monedaId: data.monedaId,
      montoColones: data.montoColones,
      montoRecibido: data.montoRecibido,
      montoRecibidoMoneda: data.montoRecibidoMoneda,
      montoRecibidoColones: data.montoRecibidoColones,
      vuelto: data.vuelto,
      vueltoColones: data.vueltoColones,
      tipoCambioId: data.tipoCambioId,
      cuentaPedidoId: accountScopeId,
      cuentaId: accountScopeId,
      accountId: accountScopeId,
      aplicarServicio: data.aplicarServicio,
      exonerarServicio: data.exonerarServicio,
      referencia: data.referencia,
    },
    {
      metodo_pago_id: data.metodoPagoId,
      monto: data.monto,
      monto_moneda: data.montoMoneda,
      moneda: data.moneda,
      moneda_id: data.monedaId,
      monto_colones: data.montoColones,
      monto_recibido: data.montoRecibido,
      monto_recibido_moneda: data.montoRecibidoMoneda,
      monto_recibido_colones: data.montoRecibidoColones,
      vuelto: data.vuelto,
      vuelto_colones: data.vueltoColones,
      tipo_cambio_id: data.tipoCambioId,
      cuenta_pedido_id: accountScopeId,
      cuenta_id: accountScopeId,
      account_id: accountScopeId,
      aplicar_servicio: data.aplicarServicio,
      exonerar_servicio: data.exonerarServicio,
      referencia: data.referencia,
    },
  ]
}

async function createPaymentWithFallback(id: number, data: CreatePagoPedidoDto) {
  const variants = buildPaymentPayloadVariants(data)
  let lastError: unknown

  for (const payload of variants) {
    try {
      return await api.post<PagoPedido>(`/pedidos/${id}/payments`, payload)
    } catch (error) {
      lastError = error
      if (!axios.isAxiosError(error) || !error.response || ![400, 422].includes(error.response.status)) {
        throw error
      }
    }
  }

  throw lastError
}

async function updatePaymentWithFallback(id: number, paymentId: number, data: Partial<CreatePagoPedidoDto>) {
  const variants = buildPaymentPayloadVariants(data as CreatePagoPedidoDto)
  let lastError: unknown

  for (const payload of variants) {
    try {
      return await api.put<PagoPedido>(`/pedidos/${id}/payments/${paymentId}`, payload)
    } catch (error) {
      lastError = error
      if (!axios.isAxiosError(error) || !error.response || ![400, 422].includes(error.response.status)) {
        throw error
      }
    }
  }

  throw lastError
}

async function addAccountDetailWithFallback(pedidoId: number, accountId: number, data: AddPedidoAccountDetailDto) {
  const variants = buildAddAccountDetailVariants(data)
  let lastError: unknown

  for (const payload of variants) {
    try {
      return await api.post<PedidoAccount>(`/pedidos/${pedidoId}/accounts/${accountId}/details`, payload)
    } catch (error) {
      lastError = error
      if (!axios.isAxiosError(error) || !error.response || ![400, 422].includes(error.response.status)) {
        throw error
      }
    }
  }

  throw lastError
}

async function createAccountWithFallback(pedidoId: number, data: CreatePedidoAccountDto) {
  const variants = buildCreateAccountVariants(data)
  let lastError: unknown

  for (const payload of variants) {
    try {
      return await api.post<PedidoAccount>(`/pedidos/${pedidoId}/accounts`, payload)
    } catch (error) {
      lastError = error
      if (!axios.isAxiosError(error) || !error.response || ![400, 422].includes(error.response.status)) {
        throw error
      }
    }
  }

  throw lastError
}

function buildDetailMovePayloadVariants(data?: MovePedidoAccountDetailDto) {
  if (!data) {
    return [{}, { cantidad: undefined }, { quantity: undefined }, { qty: undefined }]
  }

  const quantityValue =
    data.cantidad ??
    data.quantity ??
    data.qty

  const targetAccountId =
    data.cuentaDestinoId ??
    data.cuenta_destino_id ??
    data.targetAccountId ??
    data.target_account_id

  return [
    {
      cantidad: quantityValue,
      cuentaDestinoId: targetAccountId,
    },
    {
      quantity: quantityValue,
      targetAccountId,
    },
    {
      qty: quantityValue,
      target_account_id: targetAccountId,
    },
    {
      cantidad: quantityValue,
      cuenta_destino_id: targetAccountId,
    },
  ]
}

async function removeAccountDetailWithFallback(
  pedidoId: number,
  accountId: number,
  detailId: number,
  data?: MovePedidoAccountDetailDto,
) {
  const variants = buildDetailMovePayloadVariants(data)
  let lastError: unknown

  for (const payload of variants) {
    try {
      return await api.delete(`/pedidos/${pedidoId}/accounts/${accountId}/details/${detailId}`, {
        data: payload,
      })
    } catch (error) {
      lastError = error
      if (!axios.isAxiosError(error) || !error.response || ![400, 422].includes(error.response.status)) {
        throw error
      }
    }
  }

  throw lastError
}

async function moveAccountDetailWithFallback(
  pedidoId: number,
  accountId: number,
  detailId: number,
  data?: MovePedidoAccountDetailDto,
) {
  const variants = buildDetailMovePayloadVariants(data)
  let lastError: unknown

  for (const payload of variants) {
    try {
      return await api.post<PedidoAccount>(
        `/pedidos/${pedidoId}/accounts/${accountId}/details/${detailId}/move`,
        payload,
      )
    } catch (error) {
      lastError = error
      if (!axios.isAxiosError(error) || !error.response || ![400, 422].includes(error.response.status)) {
        throw error
      }
    }
  }

  throw lastError
}

export const pedidosService = {
  getAll: (params?: PedidoListQuery) => api.get<Pedido[]>('/pedidos', { params }),
  getById: (id: number) => api.get<Pedido>(`/pedidos/${id}`),
  create: (data: CreatePedidoDto) => api.post<Pedido>('/pedidos', data),
  update: (id: number, data: UpdatePedidoDto) => api.put<Pedido>(`/pedidos/${id}`, data),
  sendToKitchen: (id: number) => api.post<Pedido>(`/pedidos/${id}/enviar-cocina`),
  bill: (id: number) => api.post<Pedido>(`/pedidos/${id}/facturar`),
  delete: (id: number) => api.delete(`/pedidos/${id}`),
  getDetails: async (id: number) => {
    try {
      return await api.get<PedidoDetalle[]>(`/pedidos/${id}/details`)
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return api.get<PedidoDetalle[]>(`/pedidos/${id}/detalles`)
      }

      throw error
    }
  },
  createDetail: async (id: number, data: CreatePedidoDetalleDto) => {
    try {
      return await api.post<PedidoDetalle>(`/pedidos/${id}/details`, data)
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return api.post<PedidoDetalle>(`/pedidos/${id}/detalles`, data)
      }

      throw error
    }
  },
  updateDetail: async (id: number, detailId: number, data: Partial<CreatePedidoDetalleDto>) => {
    try {
      return await api.put<PedidoDetalle>(`/pedidos/${id}/details/${detailId}`, data)
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return api.put<PedidoDetalle>(`/pedidos/${id}/detalles/${detailId}`, data)
      }

      throw error
    }
  },
  deleteDetail: async (id: number, detailId: number) => {
    try {
      return await api.delete(`/pedidos/${id}/details/${detailId}`)
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return api.delete(`/pedidos/${id}/detalles/${detailId}`)
      }

      throw error
    }
  },
  getAccounts: (id: number) => api.get<PedidoAccount[]>(`/pedidos/${id}/accounts`),
  createAccount: (id: number, data: CreatePedidoAccountDto) => createAccountWithFallback(id, data),
  addAccountDetail: (id: number, accountId: number, data: AddPedidoAccountDetailDto) =>
    addAccountDetailWithFallback(id, accountId, data),
  removeAccountDetail: (id: number, accountId: number, detailId: number, data?: MovePedidoAccountDetailDto) =>
    removeAccountDetailWithFallback(id, accountId, detailId, data),
  moveAccountDetail: (id: number, accountId: number, detailId: number, data?: MovePedidoAccountDetailDto) =>
    moveAccountDetailWithFallback(id, accountId, detailId, data),
  getPayments: (id: number) => api.get<PagoPedido[]>(`/pedidos/${id}/payments`),
  createPayment: (id: number, data: CreatePagoPedidoDto) => createPaymentWithFallback(id, data),
  updatePayment: (id: number, paymentId: number, data: Partial<CreatePagoPedidoDto>) =>
    updatePaymentWithFallback(id, paymentId, data),
  deletePayment: (id: number, paymentId: number) =>
    api.delete(`/pedidos/${id}/payments/${paymentId}`),
  getPaymentMethods: () => api.get<MetodoPago[]>('/pedidos/payment-methods'),
}
