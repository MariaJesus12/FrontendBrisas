import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { toast } from 'react-toastify'
import { monedasService, type Moneda } from '@/services/monedas.service'
import { pedidosService } from '@/services/pedidos.service'
import { tipoCambioService, type TipoCambio } from '@/services/tipo-cambio.service'
import type { MetodoPago, PagoPedido, Pedido, PedidoAccount, PedidoAccountDetail, PedidoDetalle } from '@/types/pedido.types'
import { printBillingTicket } from '@/utils/billingTicketPrint'

interface FacturacionModalProps {
  open: boolean
  pedidoId: number | null
  pedidoFallback: Pedido | null
  detailsFallback: PedidoDetalle[]
  onClose: () => void
  onFacturado: () => Promise<void>
}

const FALLBACK_PAYMENT_METHODS: MetodoPago[] = [
  { id: 1, nombre: 'EFECTIVO' },
  { id: 2, nombre: 'TARJETA' },
  { id: 3, nombre: 'SINPE' },
]

const COLOR_GOLD = '#D4AF37'
const COLOR_TEXT = '#F3E9D2'
const COLOR_MUTED = 'rgba(243,233,210,0.72)'
const ORDER_SCOPE_KEY = 'UNASSIGNED'
const MONEY_EPSILON = 0.01
const PAID_ACCOUNT_STATUSES = new Set(['PAGADA', 'PAGADO', 'CERRADA', 'CERRADO'])

function isPaidAccountStatus(status: unknown): boolean {
  return PAID_ACCOUNT_STATUSES.has(String(status ?? '').trim().toUpperCase())
}

function toPositiveInt(value: unknown): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return null
  }

  const normalized = Math.trunc(parsed)
  return normalized > 0 ? normalized : null
}

function extractBackendMessage(payload: unknown): string {
  if (typeof payload === 'string') {
    return payload
  }

  if (typeof payload !== 'object' || payload === null) {
    return ''
  }

  const record = payload as { message?: unknown; error?: unknown; errors?: unknown }

  if (typeof record.message === 'string') {
    return record.message
  }

  if (Array.isArray(record.message)) {
    return record.message.map((item) => String(item)).join(' | ')
  }

  if (typeof record.error === 'string') {
    return record.error
  }

  if (Array.isArray(record.errors)) {
    return record.errors.map((item) => String(item)).join(' | ')
  }

  return ''
}


function formatCRC(value: number): string {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatUSD(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.round(value * 10000) / 10000
}

function parseMoneyValue(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : Number.NaN
  }

  if (typeof value !== 'string') {
    return Number.NaN
  }

  const cleaned = value.trim().replace(/[^\d,.-]/g, '')
  if (!cleaned) {
    return Number.NaN
  }

  const normalized =
    cleaned.includes(',') && !cleaned.includes('.')
      ? cleaned.replace(/,/g, '.')
      : cleaned.includes(',') && cleaned.includes('.')
        ? cleaned.replace(/,/g, '')
        : cleaned

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function normalizeCurrencyCode(value: unknown): string {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (!normalized) {
    return ''
  }

  if (normalized === 'USD' || normalized.includes('DOLAR') || normalized === '$') {
    return 'USD'
  }

  if (normalized === 'CRC' || normalized.includes('COLON') || normalized.includes('COLONES') || normalized === '₡') {
    return 'CRC'
  }

  return normalized
}

function normalizePedido(item: unknown): Pedido | null {
  if (typeof item !== 'object' || item === null) {
    return null
  }

  const record = item as Record<string, unknown>
  const id = Number(record.id ?? 0)
  if (!Number.isFinite(id) || id <= 0) {
    return null
  }

  return {
    id,
    codigo: typeof record.codigo === 'string' ? record.codigo : undefined,
    mesaId: toPositiveInt(record.mesaId ?? record.mesa_id),
    mesa:
      typeof record.mesa === 'object' && record.mesa !== null
        ? (record.mesa as Pedido['mesa'])
        : undefined,
    usuario:
      typeof record.usuario === 'object' && record.usuario !== null
        ? (record.usuario as Pedido['usuario'])
        : undefined,
    usuarioId: toPositiveInt(record.usuarioId ?? record.usuario_id),
    tipo: String(record.tipo ?? 'MESA'),
    estado: String(record.estado ?? ''),
    impuesto: Number(record.impuesto ?? 0),
    total: Number(record.total ?? 0),
    totalPagado: Number(record.totalPagado ?? record.total_pagado ?? 0),
    saldoPendiente: Number(record.saldoPendiente ?? record.saldo_pendiente ?? 0),
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : undefined,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
  }
}

function normalizePedidoDetail(item: unknown): PedidoDetalle | null {
  if (typeof item !== 'object' || item === null) {
    return null
  }

  const record = item as Record<string, unknown>
  const id = Number(record.id ?? record.detalleId ?? record.detalle_id ?? 0)
  const productoId = Number(record.productoId ?? record.product_id ?? record.producto_id ?? 0)
  const cantidad = Number(record.cantidad ?? record.qty ?? 0)
  const precioUnitario = Number(record.precioUnitario ?? record.precio_unitario ?? record.price ?? 0)
  const productoRecord =
    typeof record.producto === 'object' && record.producto !== null
      ? (record.producto as Record<string, unknown>)
      : null
  const productoNombre =
    typeof record.productoNombre === 'string'
      ? record.productoNombre
      : typeof record.nombreProducto === 'string'
        ? record.nombreProducto
        : typeof record.product_name === 'string'
          ? record.product_name
          : typeof record.productName === 'string'
            ? record.productName
            : typeof productoRecord?.nombre === 'string'
              ? productoRecord.nombre
              : undefined

  if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(productoId) || productoId <= 0) {
    return null
  }

  return {
    id,
    productoId,
    productoNombre,
    producto: productoRecord ? ({ ...(productoRecord as PedidoDetalle['producto']), nombre: productoNombre ?? String(productoRecord.nombre ?? '') } as PedidoDetalle['producto']) : productoNombre ? { nombre: productoNombre } : undefined,
    cantidad: Number.isFinite(cantidad) ? cantidad : 0,
    precioUnitario: Number.isFinite(precioUnitario) ? precioUnitario : 0,
    observacion: typeof record.observacion === 'string' ? record.observacion : undefined,
    subtotal:
      Number.isFinite(Number(record.subtotal)) && Number(record.subtotal) > 0
        ? Number(record.subtotal)
        : Number.isFinite(cantidad) && Number.isFinite(precioUnitario)
          ? cantidad * precioUnitario
          : 0,
  }
}

function normalizeMetodoPago(item: unknown): MetodoPago | null {
  if (typeof item !== 'object' || item === null) {
    return null
  }

  const record = item as Record<string, unknown>
  const id = Number(record.id ?? record.metodoPagoId ?? record.metodo_pago_id ?? 0)
  const nombre = String(record.nombre ?? record.name ?? '').trim()
  if (!Number.isFinite(id) || id <= 0 || !nombre) {
    return null
  }

  return { id, nombre }
}

function normalizePago(item: unknown): PagoPedido | null {
  if (typeof item !== 'object' || item === null) {
    return null
  }

  const record = item as Record<string, unknown>
  const monedaRecord =
    typeof record.moneda === 'object' && record.moneda !== null
      ? (record.moneda as Record<string, unknown>)
      : null
  const accountRecord =
    typeof record.account === 'object' && record.account !== null
      ? (record.account as Record<string, unknown>)
      : typeof record.cuenta === 'object' && record.cuenta !== null
        ? (record.cuenta as Record<string, unknown>)
        : typeof record.cuentaPedido === 'object' && record.cuentaPedido !== null
          ? (record.cuentaPedido as Record<string, unknown>)
          : typeof record.pedidoCuenta === 'object' && record.pedidoCuenta !== null
            ? (record.pedidoCuenta as Record<string, unknown>)
            : null
  const id = Number(record.id ?? 0)
  const metodoPagoRecord =
    typeof record.metodoPago === 'object' && record.metodoPago !== null
      ? (record.metodoPago as Record<string, unknown>)
      : typeof record.metodo_pago === 'object' && record.metodo_pago !== null
        ? (record.metodo_pago as Record<string, unknown>)
        : typeof record.paymentMethod === 'object' && record.paymentMethod !== null
          ? (record.paymentMethod as Record<string, unknown>)
          : typeof record.payment_method === 'object' && record.payment_method !== null
            ? (record.payment_method as Record<string, unknown>)
        : null
  const metodoPagoId = Number(
    record.metodoPagoId ??
      record.metodo_pago_id ??
      record.paymentMethodId ??
      record.payment_method_id ??
      metodoPagoRecord?.id ??
      0,
  )
  const monto = parseMoneyValue(record.monto)

  if (!Number.isFinite(id) || id <= 0) {
    return null
  }

  const normalizedMetodoPagoId = Number.isFinite(metodoPagoId) && metodoPagoId > 0 ? metodoPagoId : 0

  return {
    id,
    metodoPagoId: normalizedMetodoPagoId,
    metodoPago:
      typeof record.metodoPago === 'object' && record.metodoPago !== null
        ? (record.metodoPago as PagoPedido['metodoPago'])
        : undefined,
    monto: Number.isFinite(monto) ? monto : 0,
    montoMoneda:
      parseMoneyValue(record.montoMoneda ?? record.monto_moneda ?? record.montoDolares ?? record.monto_dolares) ||
      undefined,
    moneda:
      typeof record.moneda === 'string'
        ? record.moneda
        : typeof record.monedaCodigo === 'string'
          ? record.monedaCodigo
          : typeof record.moneda_codigo === 'string'
            ? record.moneda_codigo
            : typeof record.currency === 'string'
              ? record.currency
              : typeof monedaRecord?.codigo === 'string'
                ? monedaRecord.codigo
                : typeof monedaRecord?.nombre === 'string'
                  ? monedaRecord.nombre
                  : typeof monedaRecord?.simbolo === 'string'
                    ? monedaRecord.simbolo
                    : undefined,
    monedaId: toPositiveInt(record.monedaId ?? record.moneda_id) ?? undefined,
    accountId:
      toPositiveInt(
        record.accountId ??
          record.account_id ??
          record.cuentaId ??
          record.cuenta_id ??
          record.accountScopeId ??
          record.account_scope_id ??
          record.pedidoCuentaId ??
          record.pedido_cuenta_id ??
          record.cuentaPedidoId ??
          record.cuenta_pedido_id ??
          accountRecord?.id ??
          accountRecord?.accountId ??
          accountRecord?.account_id ??
          accountRecord?.cuentaId ??
          accountRecord?.cuenta_id ??
          accountRecord?.pedidoCuentaId ??
          accountRecord?.pedido_cuenta_id ??
          accountRecord?.cuentaPedidoId ??
          accountRecord?.cuenta_pedido_id,
      ) ?? undefined,
    montoColones:
      parseMoneyValue(record.montoColones ?? record.monto_colones ?? record.montoCRC ?? record.monto_crc) || undefined,
    montoRecibido:
      parseMoneyValue(record.montoRecibido ?? record.monto_recibido ?? record.montoRecibidoMoneda ?? record.monto_recibido_moneda) ||
      undefined,
    montoRecibidoColones:
      parseMoneyValue(record.montoRecibidoColones ?? record.monto_recibido_colones ?? record.montoRecibidoCRC ?? record.monto_recibido_crc) ||
      undefined,
    vuelto: parseMoneyValue(record.vuelto) || undefined,
    vueltoColones: parseMoneyValue(record.vueltoColones ?? record.vuelto_colones ?? record.vueltoCRC ?? record.vuelto_crc) || undefined,
    referencia: typeof record.referencia === 'string' ? record.referencia : undefined,
  }
}

function normalizeAccountDetail(item: unknown): PedidoAccountDetail | null {
  if (typeof item !== 'object' || item === null) {
    return null
  }

  const record = item as Record<string, unknown>
  const nestedDetail =
    typeof record.pedidoDetalle === 'object' && record.pedidoDetalle !== null
      ? (record.pedidoDetalle as Record<string, unknown>)
      : typeof record.detail === 'object' && record.detail !== null
        ? (record.detail as Record<string, unknown>)
        : null

  const id = Number(record.id ?? record.accountDetailId ?? record.account_detail_id ?? 0)
  if (!Number.isFinite(id) || id <= 0) {
    return null
  }

  const subtotalValue =
    record.subtotal ??
    nestedDetail?.subtotal ??
    (Number(nestedDetail?.precioUnitario ?? nestedDetail?.precio_unitario ?? 0) *
      Number(nestedDetail?.cantidad ?? 0))

  return {
    id,
    detailId: toPositiveInt(record.detailId ?? record.detail_id ?? nestedDetail?.id ?? nestedDetail?.detalle_id) ?? undefined,
    pedidoDetalleId:
      toPositiveInt(record.pedidoDetalleId ?? record.pedido_detalle_id ?? nestedDetail?.id ?? nestedDetail?.detalle_id) ??
      undefined,
    productoId:
      toPositiveInt(record.productoId ?? record.producto_id ?? nestedDetail?.productoId ?? nestedDetail?.producto_id) ??
      undefined,
    productoNombre:
      typeof record.productoNombre === 'string'
        ? record.productoNombre
        : typeof nestedDetail?.productoNombre === 'string'
          ? nestedDetail.productoNombre
          : undefined,
    cantidad: Number(record.cantidad ?? nestedDetail?.cantidad ?? 0) || undefined,
    precioUnitario:
      Number(record.precioUnitario ?? record.precio_unitario ?? nestedDetail?.precioUnitario ?? nestedDetail?.precio_unitario ?? 0) ||
      undefined,
    subtotal: Number(subtotalValue ?? 0) || undefined,
  }
}

function normalizeAccount(item: unknown): PedidoAccount | null {
  if (typeof item !== 'object' || item === null) {
    return null
  }

  const record = item as Record<string, unknown>
  const id = Number(record.id ?? record.accountId ?? record.account_id ?? record.cuentaId ?? record.cuenta_id ?? 0)
  if (!Number.isFinite(id) || id <= 0) {
    return null
  }

  const rawDetalles =
    record.detalles ??
    record.details ??
    record.accountDetails ??
    record.account_details ??
    record.pedidoCuentaDetalles ??
    record.pedido_cuenta_detalles ??
    record.detallesCuenta ??
    record.items ??
    []
  const detalles = Array.isArray(rawDetalles)
    ? rawDetalles
        .map((detail) => normalizeAccountDetail(detail))
        .filter((detail): detail is PedidoAccountDetail => detail !== null)
    : []

  return {
    id,
    numeroCuenta: toPositiveInt(record.numeroCuenta ?? record.numero_cuenta ?? record.numero) ?? undefined,
    nombre: typeof record.nombre === 'string' ? record.nombre : undefined,
    numero:
      typeof record.numero === 'string'
        ? record.numero
        : typeof record.numeroCuenta === 'string'
          ? record.numeroCuenta
          : typeof record.numero_cuenta === 'string'
            ? record.numero_cuenta
            : undefined,
    activo: Boolean(record.activo ?? true),
    estado: typeof record.estado === 'string' ? record.estado : typeof record.status === 'string' ? record.status : undefined,
    detalles,
    subtotal: Number(record.subtotal ?? record.sub_total ?? 0) || undefined,
    servicio: Number(record.servicio ?? record.impuesto ?? record.service ?? 0) || undefined,
    total: Number(record.total ?? record.total_cuenta ?? 0) || undefined,
    totalPagado: Number(record.totalPagado ?? record.total_pagado ?? record.pagado ?? record.monto_pagado ?? 0) || undefined,
    saldoPendiente: Number(record.saldoPendiente ?? record.saldo_pendiente ?? record.pendiente ?? record.monto_pendiente ?? 0) || undefined,
  }
}

function normalizeMoneda(item: unknown): Moneda | null {
  if (typeof item !== 'object' || item === null) {
    return null
  }

  const record = item as Record<string, unknown>
  const id = Number(record.id ?? record.monedaId ?? record.moneda_id ?? 0)
  if (!Number.isFinite(id) || id <= 0) {
    return null
  }

  const rawActivo = record.activo ?? record.active ?? record.isActive
  const activo =
    typeof rawActivo === 'number'
      ? rawActivo === 1
      : typeof rawActivo === 'string'
        ? rawActivo === '1' || rawActivo.toLowerCase() === 'true'
        : Boolean(rawActivo)

  return {
    id,
    nombre: typeof record.nombre === 'string' ? record.nombre : undefined,
    codigo: typeof record.codigo === 'string' ? record.codigo : undefined,
    simbolo: typeof record.simbolo === 'string' ? record.simbolo : undefined,
    activo,
  }
}

function normalizeTipoCambio(item: unknown): TipoCambio | null {
  if (typeof item !== 'object' || item === null) {
    return null
  }

  const record = item as Record<string, unknown>
  const id = Number(record.id ?? 0)
  const compra = Number(record.compra ?? 0)
  const venta = Number(record.venta ?? 0)

  if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(venta) || venta <= 0) {
    return null
  }

  return {
    id,
    compra: Number.isFinite(compra) ? compra : 0,
    venta,
    activo: Boolean(record.activo ?? true),
    fecha: typeof record.fecha === 'string' ? record.fecha : undefined,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : undefined,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
  }
}

function unwrapArrayPayload<T>(payload: unknown, normalizer: (item: unknown) => T | null): T[] {
  if (Array.isArray(payload)) {
    return payload.map((item) => normalizer(item)).filter((item): item is T => item !== null)
  }

  if (typeof payload === 'object' && payload !== null) {
    const record = payload as Record<string, unknown>
    const keys = [
      'data',
      'items',
      'results',
      'accounts',
      'cuentas',
      'pedidoAccounts',
      'pedido_accounts',
      'payments',
      'pagos',
      'methods',
      'details',
      'detalles',
      'tipoCambio',
      'tiposCambio',
      'cambios',
      'exchangeRates',
      'monedas',
    ]

    for (const key of keys) {
      const value = record[key]
      if (Array.isArray(value)) {
        return value.map((item) => normalizer(item)).filter((item): item is T => item !== null)
      }

      if (typeof value === 'object' && value !== null) {
        const nested = unwrapArrayPayload(value, normalizer)
        if (nested.length > 0) {
          return nested
        }
      }
    }

    // Some backends return the record directly instead of wrapping in an array.
    const singleRoot = normalizer(record)
    if (singleRoot) {
      return [singleRoot]
    }
  }

  return []
}

function extractCreatedAccountId(payload: unknown): number | null {
  const visited = new WeakSet<object>()

  function visit(value: unknown, depth: number): number | null {
    if (depth > 5) {
      return null
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = visit(item, depth + 1)
        if (found) {
          return found
        }
      }
      return null
    }

    if (typeof value !== 'object' || value === null) {
      return null
    }

    if (visited.has(value)) {
      return null
    }
    visited.add(value)

    const record = value as Record<string, unknown>
    const directId = toPositiveInt(record.id ?? record.accountId ?? record.account_id)
    if (directId) {
      return directId
    }

    for (const nested of Object.values(record)) {
      const found = visit(nested, depth + 1)
      if (found) {
        return found
      }
    }

    return null
  }

  return visit(payload, 0)
}

export default function FacturacionModal({
  open,
  pedidoId,
  pedidoFallback,
  detailsFallback,
  onClose,
  onFacturado,
}: FacturacionModalProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [pedido, setPedido] = useState<Pedido | null>(pedidoFallback)
  const [details, setDetails] = useState<PedidoDetalle[]>(detailsFallback)
  const [accounts, setAccounts] = useState<PedidoAccount[]>([])
  const [payments, setPayments] = useState<PagoPedido[]>([])
  const [methods, setMethods] = useState<MetodoPago[]>(FALLBACK_PAYMENT_METHODS)
  const [monedas, setMonedas] = useState<Moneda[]>([])
  const [activeTipoCambio, setActiveTipoCambio] = useState<TipoCambio | null>(null)
  const [paymentScopeById, setPaymentScopeById] = useState<Record<number, number | null>>({})

  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [splitSelectionByDetail, setSplitSelectionByDetail] = useState<Record<number, { checked: boolean; cantidad: string }>>({})
  const [detailMoveQty, setDetailMoveQty] = useState<Record<string, string>>({})
  const [detailMoveTarget, setDetailMoveTarget] = useState<Record<string, string>>({})

  const [methodByScope, setMethodByScope] = useState<Record<string, string>>({})
  const [currencyByScope, setCurrencyByScope] = useState<Record<string, 'CRC' | 'USD'>>({})
  const [receivedByScope, setReceivedByScope] = useState<Record<string, string>>({})
  const [referenceByScope, setReferenceByScope] = useState<Record<string, string>>({})
  const [serviceByScope, setServiceByScope] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!open || !pedidoId) {
      return
    }

    setPaymentScopeById({})
    void loadData(pedidoId)
  }, [open, pedidoId])

  useEffect(() => {
    setPedido(pedidoFallback)
  }, [pedidoFallback])

  useEffect(() => {
    setDetails(detailsFallback)
  }, [detailsFallback])

  async function loadData(id: number) {
    setLoading(true)
    setError(null)

    try {
      const [pedidoRes, detailsRes, methodsRes, accountsRes, paymentsRes, tipoCambioRes, monedasRes] =
        await Promise.allSettled([
        pedidosService.getById(id),
        pedidosService.getDetails(id),
        pedidosService.getPaymentMethods(),
        pedidosService.getAccounts(id),
        pedidosService.getPayments(id),
        tipoCambioService.getAll(),
        monedasService.getAll(),
      ])

      if (pedidoRes.status === 'fulfilled') {
        const normalizedPedido = normalizePedido(pedidoRes.value.data)
        if (normalizedPedido) {
          setPedido(normalizedPedido)
        }
      }

      if (detailsRes.status === 'fulfilled') {
        const fetchedDetails = unwrapArrayPayload(detailsRes.value.data, normalizePedidoDetail)
        if (fetchedDetails.length > 0) {
          setDetails(fetchedDetails)
        }
      }

      if (methodsRes.status === 'fulfilled') {
        const list = unwrapArrayPayload(methodsRes.value.data, normalizeMetodoPago)
        const nextMethods = list.length > 0 ? list : FALLBACK_PAYMENT_METHODS
        setMethods(nextMethods)
      }

      if (accountsRes.status === 'fulfilled') {
        setAccounts(unwrapArrayPayload(accountsRes.value.data, normalizeAccount))
      }

      if (paymentsRes.status === 'fulfilled') {
        setPayments(unwrapArrayPayload(paymentsRes.value.data, normalizePago))
      }

      if (tipoCambioRes.status === 'fulfilled') {
        const list = unwrapArrayPayload(tipoCambioRes.value.data, normalizeTipoCambio)
        const latest = list
          .filter((item) => item.activo !== false && Number(item.venta) > 0)
          .sort((a, b) => {
            const bDate = b.fecha ?? b.updatedAt ?? b.createdAt ?? ''
            const aDate = a.fecha ?? a.updatedAt ?? a.createdAt ?? ''
            return new Date(bDate).getTime() - new Date(aDate).getTime()
          })[0] ?? null
        setActiveTipoCambio(latest)
      }

      if (monedasRes.status === 'fulfilled') {
        setMonedas(unwrapArrayPayload(monedasRes.value.data, normalizeMoneda))
      }

      if (pedidoRes.status === 'rejected' && !pedidoFallback) {
        throw pedidoRes.reason
      }
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      setError(backendMessage || 'No se pudo cargar la facturación del pedido.')
    } finally {
      setLoading(false)
    }
  }

  async function reloadAccountsAndPayments() {
    if (!pedidoId) {
      return
    }

    const [pedidoRes, accountsRes, paymentsRes] = await Promise.allSettled([
      pedidosService.getById(pedidoId),
      pedidosService.getAccounts(pedidoId),
      pedidosService.getPayments(pedidoId),
    ])

    if (pedidoRes.status === 'fulfilled') {
      const nextPedido = normalizePedido(pedidoRes.value.data)
      if (nextPedido) {
        setPedido(nextPedido)
      }
    }

    if (accountsRes.status === 'fulfilled') {
      setAccounts(unwrapArrayPayload(accountsRes.value.data, normalizeAccount))
    }

    if (paymentsRes.status === 'fulfilled') {
      setPayments(unwrapArrayPayload(paymentsRes.value.data, normalizePago))
    }
  }

  const detailsById = useMemo(() => {
    return new Map(details.map((item) => [item.id, item]))
  }, [details])

  const orderSubtotal = useMemo(() => {
    return details.reduce((sum, detail) => {
      const lineSubtotal = Number(detail.subtotal ?? detail.precioUnitario * detail.cantidad)
      return sum + (Number.isFinite(lineSubtotal) ? lineSubtotal : 0)
    }, 0)
  }, [details])

  function getAccountSubtotal(account: PedidoAccount): number {
    if (Number.isFinite(Number(account.subtotal)) && Number(account.subtotal) > 0) {
      return Number(account.subtotal)
    }

    let sum = 0

    for (const detail of account.detalles ?? []) {
      const directSubtotal = Number(detail.subtotal)
      if (Number.isFinite(directSubtotal) && directSubtotal > 0) {
        sum += directSubtotal
        continue
      }

      const detailId = detail.detailId ?? detail.pedidoDetalleId
      const source = detailId ? detailsById.get(detailId) : null
      if (source) {
        const sourceSubtotal = Number(source.subtotal ?? source.precioUnitario * source.cantidad)
        if (Number.isFinite(sourceSubtotal) && sourceSubtotal > 0) {
          sum += sourceSubtotal
          continue
        }
      }

      const fallbackSubtotal = Number(detail.precioUnitario ?? 0) * Number(detail.cantidad ?? 0)
      if (Number.isFinite(fallbackSubtotal) && fallbackSubtotal > 0) {
        sum += fallbackSubtotal
      }
    }

    return roundMoney(sum)
  }

  const accountSubtotalById = useMemo(() => {
    const map = new Map<number, number>()
    for (const account of accounts) {
      map.set(account.id, getAccountSubtotal(account))
    }
    return map
  }, [accounts, detailsById])

  const assignedSubtotal = useMemo(() => {
    return accounts.reduce((sum, account) => sum + (accountSubtotalById.get(account.id) ?? 0), 0)
  }, [accountSubtotalById, accounts])

  const unassignedSubtotal = useMemo(() => {
    return Math.max(roundMoney(orderSubtotal - assignedSubtotal), 0)
  }, [assignedSubtotal, orderSubtotal])

  const isMesaOrder = useMemo(() => String(pedido?.tipo ?? '').toUpperCase() === 'MESA', [pedido?.tipo])

  const serviceRate = useMemo(() => {
    if (!isMesaOrder) {
      return 0
    }

    const impuesto = Number(pedido?.impuesto ?? 0)
    if (Number.isFinite(impuesto) && impuesto > 0 && orderSubtotal > 0) {
      return impuesto / orderSubtotal
    }

    return 0.1
  }, [isMesaOrder, orderSubtotal, pedido?.impuesto])

  const orderServiceAmount = useMemo(() => {
    return isMesaOrder ? orderSubtotal * serviceRate : 0
  }, [isMesaOrder, orderSubtotal, serviceRate])

  const orderTotalCRC = useMemo(() => orderSubtotal + orderServiceAmount, [orderServiceAmount, orderSubtotal])
  const exchangeRate = useMemo(() => {
    const value = Number(activeTipoCambio?.venta ?? 0)
    return Number.isFinite(value) && value > 0 ? value : null
  }, [activeTipoCambio?.venta])
  const orderTotalUSD = useMemo(() => (exchangeRate ? orderTotalCRC / exchangeRate : null), [exchangeRate, orderTotalCRC])

  const backendPendingCRC = useMemo(() => {
    const saldoPendiente = Number(pedido?.saldoPendiente ?? 0)
    if (Number.isFinite(saldoPendiente) && saldoPendiente > 0) {
      return roundMoney(saldoPendiente)
    }

    const total = Number(pedido?.total ?? 0)
    const totalPagado = Number(pedido?.totalPagado ?? 0)
    if (Number.isFinite(total) && total > 0) {
      const pending = Math.max(total - (Number.isFinite(totalPagado) ? totalPagado : 0), 0)
      return roundMoney(pending)
    }

    return roundMoney(orderTotalCRC)
  }, [orderTotalCRC, pedido?.saldoPendiente, pedido?.total, pedido?.totalPagado])

  const assignedQuantityByDetailId = useMemo(() => {
    const result = new Map<number, number>()

    for (const account of accounts) {
      for (const detail of account.detalles ?? []) {
        const detailId = toPositiveInt(detail.detailId ?? detail.pedidoDetalleId)
        if (!detailId) {
          continue
        }

        const cantidad = Number(detail.cantidad ?? 0)
        if (!Number.isFinite(cantidad) || cantidad <= 0) {
          continue
        }

        result.set(detailId, (result.get(detailId) ?? 0) + cantidad)
      }
    }

    return result
  }, [accounts])

  const assignedDetailIds = useMemo(() => {
    const ids = new Set<number>()

    for (const account of accounts) {
      for (const detail of account.detalles ?? []) {
        const detailId = toPositiveInt(detail.detailId ?? detail.pedidoDetalleId)
        if (detailId) {
          ids.add(detailId)
        }
      }
    }

    return ids
  }, [accounts])

  const unassignedDetails = useMemo(() => {
    return details
      .map((detail) => {
        const assignedQty = assignedQuantityByDetailId.get(detail.id) ?? 0
        const detailQty = Number(detail.cantidad ?? 0)
        const unitPrice = Number(detail.precioUnitario ?? 0)
        const fallbackSubtotal = Number(detail.subtotal ?? detailQty * unitPrice)
        const hasQuantityAssignment = assignedQty > 0
        const assignedByReference = assignedDetailIds.has(detail.id)
        const remainingQty = Number.isFinite(detailQty)
          ? hasQuantityAssignment
            ? Math.max(detailQty - assignedQty, 0)
            : assignedByReference
              ? 0
              : detailQty
          : 0
        const subtotal = remainingQty > 0 ? remainingQty * unitPrice : 0

        if (remainingQty <= 0) {
          return null
        }

        return {
          detailId: detail.id,
          label: detail.producto?.nombre ?? detail.productoNombre ?? 'Producto',
          cantidad: roundMoney(remainingQty),
          subtotal: subtotal > 0 ? roundMoney(subtotal) : roundMoney(fallbackSubtotal),
        }
      })
      .filter((item): item is { detailId: number; label: string; cantidad: number; subtotal: number } => item !== null)
  }, [assignedDetailIds, assignedQuantityByDetailId, details])

  function getScopeKey(accountId: number | null): string {
    return accountId ? `ACCOUNT:${accountId}` : ORDER_SCOPE_KEY
  }

  function getScopeCurrency(scopeKey: string): 'CRC' | 'USD' {
    return currencyByScope[scopeKey] ?? 'CRC'
  }

  function getScopeMethodId(scopeKey: string): string {
    return methodByScope[scopeKey] ?? String(methods[0]?.id ?? '')
  }

  function isServiceApplied(scopeKey: string): boolean {
    if (!isMesaOrder) {
      return false
    }

    return serviceByScope[scopeKey] ?? true
  }

  function getPaymentAccountId(payment: PagoPedido): number | null {
    const direct = toPositiveInt(payment.accountId ?? null)
    if (direct) {
      return direct
    }

    const mapped = paymentScopeById[payment.id]
    return mapped === null ? null : toPositiveInt(mapped ?? null)
  }

  function resolvePaymentCurrency(payment: PagoPedido): 'CRC' | 'USD' {
    const byLabel = normalizeCurrencyCode(payment.moneda)
    if (byLabel === 'USD' || byLabel === 'CRC') {
      return byLabel
    }

    const currencyId = toPositiveInt(payment.monedaId ?? null)
    if (currencyId) {
      const byId = monedas.find((item) => item.id === currencyId)
      const byCode = normalizeCurrencyCode(byId?.codigo)
      if (byCode === 'USD' || byCode === 'CRC') {
        return byCode
      }

      const byName = normalizeCurrencyCode(byId?.nombre)
      if (byName === 'USD' || byName === 'CRC') {
        return byName
      }

      const bySymbol = normalizeCurrencyCode(byId?.simbolo)
      if (bySymbol === 'USD' || bySymbol === 'CRC') {
        return bySymbol
      }
    }

    return 'CRC'
  }

  function resolvePaymentAmountCRC(payment: PagoPedido): number {
    const montoColones = Number(payment.montoColones ?? 0)
    if (Number.isFinite(montoColones) && montoColones > 0) {
      return montoColones
    }

    const paymentCurrency = resolvePaymentCurrency(payment)
    const amount = Number(payment.montoMoneda ?? payment.monto ?? 0)
    if (!Number.isFinite(amount) || amount <= 0) {
      return 0
    }

    if (paymentCurrency === 'USD') {
      if (!exchangeRate || exchangeRate <= 0) {
        return 0
      }
      return amount * exchangeRate
    }

    return amount
  }

  function resolvePaymentAmountInCurrency(payment: PagoPedido, currency: 'CRC' | 'USD'): number {
    const paymentCurrency = resolvePaymentCurrency(payment)

    if (currency === 'USD') {
      if (paymentCurrency === 'USD') {
        const amountUSD = Number(payment.montoMoneda ?? payment.monto ?? 0)
        return Number.isFinite(amountUSD) && amountUSD > 0 ? amountUSD : 0
      }

      const amountCRC = resolvePaymentAmountCRC(payment)
      if (!Number.isFinite(amountCRC) || amountCRC <= 0 || !exchangeRate || exchangeRate <= 0) {
        return 0
      }

      return amountCRC / exchangeRate
    }

    if (paymentCurrency === 'CRC') {
      return resolvePaymentAmountCRC(payment)
    }

    const amountUSD = Number(payment.montoMoneda ?? payment.monto ?? 0)
    if (!Number.isFinite(amountUSD) || amountUSD <= 0 || !exchangeRate || exchangeRate <= 0) {
      return 0
    }

    return amountUSD * exchangeRate
  }

  function resolvePaymentChangeInCurrency(payment: PagoPedido, currency: 'CRC' | 'USD'): number {
    if (currency === 'USD') {
      const changeUSD = Number(payment.vuelto ?? 0)
      if (Number.isFinite(changeUSD) && changeUSD > 0 && resolvePaymentCurrency(payment) === 'USD') {
        return changeUSD
      }

      const changeCRC = Number(payment.vueltoColones ?? 0)
      if (!Number.isFinite(changeCRC) || changeCRC <= 0 || !exchangeRate || exchangeRate <= 0) {
        return 0
      }

      return changeCRC / exchangeRate
    }

    const changeCRC = Number(payment.vueltoColones ?? payment.vuelto ?? 0)
    return Number.isFinite(changeCRC) && changeCRC > 0 ? changeCRC : 0
  }

  function resolvePaymentChangeCRC(payment: PagoPedido): number {
    const paymentCurrency = resolvePaymentCurrency(payment)
    const changeCRC = Number(payment.vueltoColones ?? 0)
    if (Number.isFinite(changeCRC) && changeCRC > 0) {
      return changeCRC
    }

    const changeRaw = Number(payment.vuelto ?? 0)
    if (!Number.isFinite(changeRaw) || changeRaw <= 0) {
      return 0
    }

    if (paymentCurrency === 'USD') {
      if (!exchangeRate || exchangeRate <= 0) {
        return 0
      }

      return changeRaw * exchangeRate
    }

    return changeRaw
  }

  function isValidRegisteredPayment(payment: PagoPedido): boolean {
    const methodId = toPositiveInt(payment.metodoPagoId)
    const methodName = String(payment.metodoPago?.nombre ?? '').trim()
    const hasMethod = methodId !== null || methodName.length > 0
    if (!hasMethod) {
      return false
    }

    return resolvePaymentAmountCRC(payment) > MONEY_EPSILON
  }

  function getScopeAmounts(accountId: number | null) {
    const scopeKey = getScopeKey(accountId)
    const account = accountId ? accounts.find((item) => item.id === accountId) ?? null : null
    const isOrderScope = !accountId

    const computedSubtotal = accountId ? Number(accountSubtotalById.get(accountId) ?? 0) : unassignedSubtotal
    const backendSubtotal = Number(account?.subtotal ?? 0)
    const subtotal =
      accountId && Number.isFinite(backendSubtotal) && backendSubtotal > 0 ? roundMoney(backendSubtotal) : roundMoney(computedSubtotal)

    const computedServiceAmount = isServiceApplied(scopeKey) ? subtotal * serviceRate : 0
    const backendServiceAmount = Number(account?.servicio ?? 0)
    const serviceAmount =
      accountId && Number.isFinite(backendServiceAmount) && backendServiceAmount >= 0
        ? roundMoney(backendServiceAmount)
        : roundMoney(computedServiceAmount)

    const backendTotal = Number(account?.total ?? 0)
    const computedTotal = roundMoney(subtotal + serviceAmount)
    const totalCRC =
      accountId && Number.isFinite(backendTotal) && backendTotal > 0 ? roundMoney(backendTotal) : roundMoney(computedTotal)

    const matchesScope = (payment: PagoPedido): boolean => {
      const paymentAccountId = getPaymentAccountId(payment)

      if (accountId) {
        if (paymentAccountId === accountId) {
          return true
        }

        // Some backends persist split-account payments but return them without accountId.
        // If there is only one account, treat unscoped payments as belonging to it.
        if (paymentAccountId === null && accounts.length === 1 && accounts[0]?.id === accountId) {
          return true
        }

        return false
      }

      // If the order is not split, any payment belongs to the same billing scope.
      if (accounts.length === 0) {
        return true
      }

      return paymentAccountId === null
    }

    const paidCRC = roundMoney(
      payments.reduce((sum, payment) => {
        if (!matchesScope(payment)) {
          return sum
        }

        if (!isValidRegisteredPayment(payment)) {
          return sum
        }

        return sum + resolvePaymentAmountCRC(payment)
      }, 0),
    )

    const scopeMarkedPaidByStatus = !isOrderScope && isPaidAccountStatus(account?.estado)
    const effectivePaidFromPayments = roundMoney(paidCRC)

    const calculatedPending = roundMoney(Math.max(totalCRC - effectivePaidFromPayments, 0))
    const pendingCRC = scopeMarkedPaidByStatus ? 0 : calculatedPending
    const effectivePaidCRC = roundMoney(Math.max(totalCRC - pendingCRC, 0))
    const chargeCRC = pendingCRC
    const totalUSD = exchangeRate ? roundMoney(totalCRC / exchangeRate) : null
    const chargeUSD = exchangeRate ? roundMoney(chargeCRC / exchangeRate) : null
    const isClosed = accountId ? isPaidAccountStatus(account?.estado) || pendingCRC <= MONEY_EPSILON : pendingCRC <= MONEY_EPSILON

    return {
      subtotal: roundMoney(subtotal),
      serviceAmount: roundMoney(serviceAmount),
      totalCRC,
      totalUSD,
      paidCRC: effectivePaidCRC,
      pendingCRC,
      chargeCRC,
      chargeUSD,
      isClosed,
    }
  }

  const billingScopes = useMemo(() => {
    const base = accounts.length
      ? []
      : [
          {
            key: ORDER_SCOPE_KEY,
            accountId: null as number | null,
            title: 'Cuenta principal (no asignado)',
          },
        ]

    const accountScopes = accounts.map((account) => ({
      key: getScopeKey(account.id),
      accountId: account.id,
      title: account.nombre ?? `Cuenta #${account.id}`,
    }))

    return [...base, ...accountScopes]
  }, [accounts])

  const openBillingScopes = billingScopes.filter((scope) => !getScopeAmounts(scope.accountId).isClosed)
  const closedBillingScopes = billingScopes.filter((scope) => getScopeAmounts(scope.accountId).isClosed)
  const pendingAcrossAccountsCRC = roundMoney(
    openBillingScopes.reduce((sum, scope) => sum + getScopeAmounts(scope.accountId).pendingCRC, 0),
  )

  function resolveMonedaId(currency: 'CRC' | 'USD'): number | null {
    const normalizedCode = currency.toUpperCase()
    const byCode = monedas.find((item) => String(item.codigo ?? '').trim().toUpperCase() === normalizedCode)
    if (byCode) {
      return byCode.id
    }

    const aliases =
      normalizedCode === 'CRC'
        ? ['COLON', 'COLONES', 'COLONES', 'CRC']
        : ['DOLAR', 'DOLARES', 'DOLARES', 'USD', '$']

    const byName = monedas.find((item) => {
      const name = String(item.nombre ?? '').trim().toUpperCase()
      const symbol = String(item.simbolo ?? '').trim().toUpperCase()
      return aliases.some((alias) => name.includes(alias) || symbol.includes(alias))
    })

    if (byName?.id) {
      return byName.id
    }

    // Common defaults used by many catalogs: 1=CRC, 2=USD.
    return currency === 'CRC' ? 1 : 2
  }

  function buildSplitItemsFromSelection() {
    const selectedDetailIds = Object.entries(splitSelectionByDetail)
      .filter(([, value]) => value.checked)
      .map(([detailId]) => Number(detailId))
      .filter((detailId) => Number.isFinite(detailId) && detailId > 0)

    if (selectedDetailIds.length === 0) {
      return []
    }

    const items: Array<{ detailId?: number; productoId?: number; cantidad?: number }> = []

    for (const detailId of selectedDetailIds) {
      const detail = detailsById.get(detailId)
      if (!detail) {
        continue
      }

      const selectedRow = splitSelectionByDetail[detailId]
      const parsedQuantity = Number(selectedRow?.cantidad ?? '')
      const maxCantidad = Number(detail.cantidad)
      if (Number.isFinite(parsedQuantity) && parsedQuantity > 0 && Number.isFinite(maxCantidad) && maxCantidad > 0 && parsedQuantity > maxCantidad) {
        toast.error(`La cantidad para ${detail.producto?.nombre ?? detail.productoNombre ?? 'producto'} no puede exceder ${maxCantidad}.`)
        return null
      }

      items.push({
        detailId,
        productoId: detail.productoId,
        cantidad: Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : undefined,
      })
    }

    return items
  }

  function clearSplitSelection() {
    setSplitSelectionByDetail({})
  }

  function getDetailMoveKey(accountId: number, accountDetailId: number): string {
    return `${accountId}:${accountDetailId}`
  }

  function getOptionalPositiveNumber(rawValue: string): number | undefined {
    const parsed = Number(rawValue)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
  }

  async function handleCreateAccount() {
    if (!pedidoId) {
      return
    }

    const items = buildSplitItemsFromSelection()
    if (items === null) {
      return
    }

    if (items.length === 0) {
      toast.error('Selecciona al menos un producto para dividir la cuenta.')
      return
    }

    setSaving(true)
    try {
      const existingIds = new Set(accounts.map((account) => account.id))
      const createResponse = await pedidosService.createAccount(pedidoId, {
        activo: true,
      })

      let createdAccountId = extractCreatedAccountId(createResponse.data)
      if (!createdAccountId) {
        const refreshedAccountsResponse = await pedidosService.getAccounts(pedidoId)
        const refreshedAccounts = unwrapArrayPayload(refreshedAccountsResponse.data, normalizeAccount)
        setAccounts(refreshedAccounts)

        const byNewId = refreshedAccounts.find((account) => !existingIds.has(account.id))
        createdAccountId = byNewId?.id ?? null
      }

      if (items.length > 0 && createdAccountId) {
        await pedidosService.addAccountDetail(pedidoId, createdAccountId, { items })
      }

      if (items.length > 0 && !createdAccountId) {
        toast.error('Cuenta creada, pero no se pudo identificar su ID para asignar productos automáticamente.')
      }

      clearSplitSelection()
      toast.success(items.length > 0 ? 'Cuenta creada y productos divididos.' : 'Cuenta creada.')
      await reloadAccountsAndPayments()
      if (createdAccountId) {
        setSelectedAccountId(String(createdAccountId))
      }
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      toast.error(backendMessage || 'No fue posible crear la cuenta.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAssignDetailToAccount() {
    if (!pedidoId) {
      return
    }

    const accountId = toPositiveInt(selectedAccountId)
    if (!accountId) {
      toast.error('Selecciona cuenta y producto para dividir.')
      return
    }

    const items = buildSplitItemsFromSelection()
    if (items === null || items.length === 0) {
      toast.error('Selecciona un producto para dividir.')
      return
    }

    setSaving(true)
    try {
      await pedidosService.addAccountDetail(pedidoId, accountId, { items })
      clearSplitSelection()
      toast.success('Producto agregado a la cuenta.')
      await reloadAccountsAndPayments()
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      toast.error(backendMessage || 'No fue posible dividir el producto.')
    } finally {
      setSaving(false)
    }
  }

  async function handleMoveAccountDetail(accountId: number, accountDetailId: number) {
    if (!pedidoId) {
      return
    }

    const key = getDetailMoveKey(accountId, accountDetailId)
    const targetRaw = detailMoveTarget[key] ?? ''
    const targetAccountId = toPositiveInt(targetRaw)
    if (!targetAccountId) {
      toast.error('Selecciona la cuenta destino para mover este producto.')
      return
    }

    if (targetAccountId === accountId) {
      toast.error('La cuenta destino debe ser diferente a la cuenta origen.')
      return
    }

    const cantidad = getOptionalPositiveNumber(detailMoveQty[key] ?? '')

    setSaving(true)
    try {
      await pedidosService.moveAccountDetail(pedidoId, accountId, accountDetailId, {
        cantidad,
        cuentaDestinoId: targetAccountId,
      })
      toast.success('Producto movido a la cuenta destino.')
      await reloadAccountsAndPayments()
      setDetailMoveQty((current) => ({ ...current, [key]: '' }))
      setDetailMoveTarget((current) => ({ ...current, [key]: '' }))
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      toast.error(backendMessage || 'No fue posible mover el producto a otra cuenta.')
    } finally {
      setSaving(false)
    }
  }

  async function handleReturnAccountDetail(accountId: number, accountDetailId: number) {
    if (!pedidoId) {
      return
    }

    const key = getDetailMoveKey(accountId, accountDetailId)
    const cantidad = getOptionalPositiveNumber(detailMoveQty[key] ?? '')

    setSaving(true)
    try {
      await pedidosService.moveAccountDetail(pedidoId, accountId, accountDetailId, {
        cantidad,
      })
      toast.success('Producto devuelto a no asignado.')
      await reloadAccountsAndPayments()
      setDetailMoveQty((current) => ({ ...current, [key]: '' }))
      setDetailMoveTarget((current) => ({ ...current, [key]: '' }))
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      toast.error(backendMessage || 'No fue posible devolver el producto.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSavePaymentForScope(accountId: number | null) {
    if (!pedidoId || !pedido) {
      return
    }

    const scopeKey = getScopeKey(accountId)

    if (accounts.length > 0 && !accountId) {
      toast.error('Debes indicar cuentaPedidoId para evitar cobrar una cuenta equivocada.')
      return
    }

    const metodoPagoId = toPositiveInt(getScopeMethodId(scopeKey))
    if (!metodoPagoId) {
      toast.error('Selecciona un método de pago.')
      return
    }

    const methodName = String(methods.find((method) => method.id === metodoPagoId)?.nombre ?? '').trim().toUpperCase()
    const isCashMethod = methodName.includes('EFECTIVO') || methodName.includes('CASH') || methodName.includes('CONTADO')

    const selectedCurrency = getScopeCurrency(scopeKey)
    const amounts = getScopeAmounts(accountId)
    const payableAmount = selectedCurrency === 'CRC' ? amounts.chargeCRC : Number(amounts.chargeUSD ?? 0)

    if (!Number.isFinite(payableAmount) || payableAmount <= 0) {
      toast.info('Esta cuenta no tiene saldo pendiente por cobrar.')
      return
    }

    const receivedRaw = receivedByScope[scopeKey] ?? ''
    const receivedNumber = Number(receivedRaw)
    const received = Number.isFinite(receivedNumber) ? receivedNumber : 0

    if (selectedCurrency === 'USD' && !exchangeRate) {
      toast.error('No hay tipo de cambio activo para cobrar en dólares.')
      return
    }

    if (isCashMethod) {
      if (!Number.isFinite(received) || received <= 0) {
        toast.error('Ingresa un monto recibido válido para efectivo.')
        return
      }

      if (received < payableAmount) {
        toast.error('El monto recibido es menor al total.')
        return
      }
    }

    const effectiveReceived = isCashMethod ? received : payableAmount
    const receivedInCRC = selectedCurrency === 'CRC' ? effectiveReceived : Number(exchangeRate ? effectiveReceived * exchangeRate : 0)
    const changeCRC = isCashMethod ? Math.max(0, receivedInCRC - amounts.chargeCRC) : 0
    const changeSelected = selectedCurrency === 'CRC' ? changeCRC : Number(exchangeRate ? changeCRC / exchangeRate : 0)

    const monedaId = resolveMonedaId(selectedCurrency)
    if (!monedaId) {
      toast.error('No se pudo resolver la moneda seleccionada. Verifica el catálogo de monedas.')
      return
    }

    setSaving(true)
    try {
      const cuentaPedidoId = accountId ?? undefined

      const paymentResponse = await pedidosService.createPayment(pedidoId, {
        metodoPagoId,
        monto: payableAmount,
        montoMoneda: payableAmount,
        moneda: selectedCurrency,
        monedaId,
        montoColones: amounts.chargeCRC,
        ...(isCashMethod
          ? {
              montoRecibido: effectiveReceived,
              montoRecibidoMoneda: effectiveReceived,
              montoRecibidoColones: receivedInCRC,
            }
          : {}),
        vuelto: changeSelected,
        vueltoColones: changeCRC,
        tipoCambioId: selectedCurrency === 'USD' ? activeTipoCambio?.id : undefined,
        cuentaPedidoId,
        cuentaId: cuentaPedidoId,
        accountId: cuentaPedidoId,
        aplicarServicio: isMesaOrder ? isServiceApplied(scopeKey) : false,
        exonerarServicio: isMesaOrder ? !isServiceApplied(scopeKey) : true,
        referencia: (referenceByScope[scopeKey] ?? '').trim() || undefined,
      })

      const createdPayment =
        normalizePago(paymentResponse.data) ??
        unwrapArrayPayload(paymentResponse.data, normalizePago)[0] ??
        null

      if (createdPayment?.id) {
        setPaymentScopeById((current) => ({
          ...current,
          [createdPayment.id]: accountId,
        }))
      }

      toast.success('Pago registrado.')
      setReceivedByScope((current) => ({ ...current, [scopeKey]: '' }))
      setReferenceByScope((current) => ({ ...current, [scopeKey]: '' }))
      await reloadAccountsAndPayments()
    } catch (requestError) {
      const isBusinessConflict = axios.isAxiosError(requestError) && requestError.response?.status === 409
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      toast.error(backendMessage || (isBusinessConflict ? 'Conflicto de negocio al registrar el pago.' : 'No fue posible registrar el pago.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleFacturar() {
    if (!pedidoId) {
      return
    }

    setSaving(true)
    try {
      await pedidosService.bill(pedidoId)
      toast.success('Pedido facturado correctamente.')
      await onFacturado()
      onClose()
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      toast.error(backendMessage || 'No fue posible facturar el pedido.')
    } finally {
      setSaving(false)
    }
  }

  function handlePrintScope(accountId: number | null, title: string) {
    const scopeAmounts = getScopeAmounts(accountId)

    const account = accountId ? accounts.find((item) => item.id === accountId) : null
    const accountDetails = account?.detalles ?? []

    const items = accountId
      ? accountDetails.map((detail) => {
          const detailId = detail.detailId ?? detail.pedidoDetalleId
          const source = detailId ? detailsById.get(detailId) : null
          const descripcion = source?.producto?.nombre ?? source?.productoNombre ?? detail.productoNombre ?? 'Producto'
          const cantidad = Number(detail.cantidad ?? source?.cantidad ?? 0)
          const amount = Number(detail.subtotal ?? source?.subtotal ?? cantidad * Number(detail.precioUnitario ?? source?.precioUnitario ?? 0))

          return {
            descripcion,
            cantidad,
            precio: Number.isFinite(amount) ? amount : 0,
            observacion: source?.observacion?.trim() || undefined,
          }
        })
      : unassignedDetails.map((detail) => ({
          descripcion: detail.label,
          cantidad: Number(detail.cantidad ?? 0),
          precio: Number(detail.subtotal ?? 0),
          observacion: undefined,
        }))

    const scopePayments = payments.filter((payment) => {
      const paymentAccountId = getPaymentAccountId(payment)

      if (accountId) {
        if (paymentAccountId === accountId) {
          return true
        }
        return paymentAccountId === null && accounts.length === 1 && accounts[0]?.id === accountId
      }

      if (accounts.length === 0) {
        return true
      }

      return paymentAccountId === null
    })

    const formattedPayments = scopePayments.map((payment) => {
      const methodName =
        payment.metodoPago?.nombre ??
        methods.find((method) => method.id === payment.metodoPagoId)?.nombre ??
        `Método #${payment.metodoPagoId}`
      const amount = Number(payment.montoColones ?? payment.monto ?? 0)
      return {
        metodo: methodName,
        monto: Number.isFinite(amount) ? amount : 0,
      }
    })

    const totalPagado = scopePayments.reduce((sum, payment) => {
      const amount = Number(payment.montoColones ?? payment.monto ?? 0)
      return sum + (Number.isFinite(amount) ? amount : 0)
    }, 0)

    const totalVuelto = scopePayments.reduce((sum, payment) => sum + resolvePaymentChangeCRC(payment), 0)

    const hasUsdPayments = scopePayments.some((payment) => resolvePaymentCurrency(payment) === 'USD')
    const totalPagadoUSD = scopePayments.reduce((sum, payment) => sum + resolvePaymentAmountInCurrency(payment, 'USD'), 0)
    const totalVueltoUSD = scopePayments.reduce((sum, payment) => sum + resolvePaymentChangeInCurrency(payment, 'USD'), 0)

    const popup = window.open('', '_blank', 'width=420,height=700')
    if (!popup) {
      toast.error('No se pudo abrir la ventana de impresión. Revisa el bloqueador de popups.')
      return
    }

    printBillingTicket(popup, {
      title,
      pedidoId: pedido?.id ?? pedidoId ?? undefined,
      codigoFactura: pedido?.codigo ?? undefined,
      cedula: '1-5580010047',
      direccion: 'San Luis, Tilarán, Guanacaste',
      telefono: '26953363',
      items,
      subtotal: scopeAmounts.subtotal,
      servicioMonto: scopeAmounts.serviceAmount,
      descuentoMonto: 0,
      total: scopeAmounts.totalCRC,
      pagos: formattedPayments,
      totalPagado,
      vuelto: totalVuelto,
      hasUsdPayments,
      totalPagadoUSD,
      vueltoUSD: totalVueltoUSD,
    })
  }

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} fullScreen>
      <DialogTitle sx={{ backgroundColor: '#120c0a', color: COLOR_GOLD, fontWeight: 800 }}>
        Facturación del pedido #{pedido?.id ?? pedidoId ?? ''}
      </DialogTitle>

      <DialogContent sx={{ backgroundColor: '#120c0a', p: { xs: 2, md: 3 } }}>
        {loading ? (
          <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress sx={{ color: COLOR_GOLD }} />
          </Box>
        ) : (
          <Stack spacing={2.5}>
            {error ? <Alert severity="error">{error}</Alert> : null}

            {!pedido ? <Alert severity="warning">No se pudo cargar el pedido para facturar.</Alert> : null}

            <Paper sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(212,175,55,0.2)' }}>
              <Stack spacing={1.25}>
                <Typography sx={{ color: COLOR_GOLD, fontWeight: 800 }}>Resumen</Typography>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                  <Chip label={`Subtotal pedido: ${formatCRC(orderSubtotal)}`} sx={{ color: COLOR_TEXT }} />
                  <Chip label={`Servicio pedido: ${formatCRC(orderServiceAmount)}`} sx={{ color: COLOR_TEXT }} />
                  <Chip label={`Total pedido CRC: ${formatCRC(orderTotalCRC)}`} sx={{ color: COLOR_TEXT }} />
                  <Chip label={`Total pedido USD: ${formatUSD(Number(orderTotalUSD ?? 0))}`} sx={{ color: COLOR_TEXT }} />
                  <Chip label={`Asignado a cuentas: ${formatCRC(assignedSubtotal)}`} sx={{ color: COLOR_TEXT }} />
                  <Chip label={`No asignado: ${formatCRC(unassignedSubtotal)}`} sx={{ color: COLOR_TEXT }} />
                </Stack>
                <Typography sx={{ color: COLOR_MUTED, fontSize: '0.84rem' }}>
                  Tipo de cambio (venta): {activeTipoCambio ? activeTipoCambio.venta.toFixed(4) : 'No disponible'}
                </Typography>
                <Typography sx={{ color: COLOR_MUTED, fontSize: '0.82rem' }}>
                  Saldo pendiente backend: {formatCRC(backendPendingCRC)}
                </Typography>
                {!exchangeRate ? (
                  <Alert severity="warning">No hay tipo de cambio activo. El cobro en USD queda deshabilitado.</Alert>
                ) : null}
              </Stack>
            </Paper>

            <Paper sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(212,175,55,0.2)' }}>
              <Stack spacing={1.5}>
                <Typography sx={{ color: COLOR_GOLD, fontWeight: 800 }}>Dividir cuenta por productos</Typography>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25}>
                  <TextField
                    label="Cuenta"
                    select
                    value={selectedAccountId}
                    onChange={(event) => setSelectedAccountId(event.target.value)}
                    fullWidth
                    sx={{
                      '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                      '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                    }}
                  >
                    <MenuItem value="">Cuenta completa</MenuItem>
                    {accounts.map((account) => (
                      <MenuItem key={account.id} value={String(account.id)}>
                        {account.nombre ?? `Cuenta #${account.id}`}
                      </MenuItem>
                    ))}
                  </TextField>


                  <Button
                    variant="outlined"
                    onClick={() => void handleCreateAccount()}
                    disabled={saving}
                    sx={{ color: COLOR_GOLD, borderColor: 'rgba(212,175,55,0.35)' }}
                  >
                    Crear cuenta
                  </Button>
                </Stack>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25}>
                  <Paper sx={{ p: 1.25, width: '100%', backgroundColor: 'rgba(0,0,0,0.2)' }}>
                    <Stack spacing={1}>
                      <Typography sx={{ color: COLOR_TEXT, fontWeight: 700 }}>Selecciona productos para dividir</Typography>
                      {details.map((detail) => {
                        const detailSubtotal = detail.subtotal ?? detail.precioUnitario * detail.cantidad
                        const selected = splitSelectionByDetail[detail.id] ?? { checked: false, cantidad: '' }
                        return (
                          <Stack key={detail.id} direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ alignItems: { md: 'center' } }}>
                            <FormControlLabel
                              sx={{ flex: 1, m: 0 }}
                              control={
                                <Checkbox
                                  checked={selected.checked}
                                  onChange={(event) =>
                                    setSplitSelectionByDetail((current) => ({
                                      ...current,
                                      [detail.id]: {
                                        checked: event.target.checked,
                                        cantidad: current[detail.id]?.cantidad ?? '',
                                      },
                                    }))
                                  }
                                  sx={{ color: COLOR_GOLD, '&.Mui-checked': { color: COLOR_GOLD } }}
                                />
                              }
                              label={
                                <Typography sx={{ color: COLOR_TEXT }}>
                                  {detail.producto?.nombre ?? detail.productoNombre ?? 'Producto'} • {detail.cantidad} • {formatCRC(detailSubtotal)}
                                </Typography>
                              }
                            />

                            <TextField
                              label="Cantidad"
                              type="number"
                              value={selected.cantidad}
                              onChange={(event) =>
                                setSplitSelectionByDetail((current) => ({
                                  ...current,
                                  [detail.id]: {
                                    checked: current[detail.id]?.checked ?? false,
                                    cantidad: event.target.value,
                                  },
                                }))
                              }
                              helperText="Vacío = todo"
                              sx={{
                                width: { xs: '100%', md: 140 },
                                '& .MuiFormHelperText-root': { color: COLOR_MUTED },
                                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                                '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                              }}
                            />
                          </Stack>
                        )
                      })}
                    </Stack>
                  </Paper>
                </Stack>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25}>
                  <Button
                    variant="outlined"
                    onClick={() => void handleAssignDetailToAccount()}
                    disabled={
                      saving ||
                      !selectedAccountId ||
                      Object.values(splitSelectionByDetail).every((entry) => !entry.checked)
                    }
                    sx={{ color: COLOR_TEXT, borderColor: 'rgba(243,233,210,0.35)' }}
                  >
                    Mover seleccion a cuenta
                  </Button>
                  <Button
                    variant="text"
                    onClick={() => clearSplitSelection()}
                    disabled={saving}
                    sx={{ color: COLOR_MUTED }}
                  >
                    Limpiar seleccion
                  </Button>
                </Stack>

                {accounts.map((account) => (
                  <Paper key={account.id} sx={{ p: 1.25, backgroundColor: 'rgba(0,0,0,0.25)' }}>
                    <Typography sx={{ color: COLOR_GOLD, fontWeight: 700, mb: 0.75 }}>
                      {account.nombre ?? `Cuenta #${account.id}`}
                    </Typography>
                    {(account.detalles ?? []).length === 0 ? (
                      <Typography sx={{ color: COLOR_MUTED, fontSize: '0.85rem' }}>Sin productos en esta cuenta.</Typography>
                    ) : (
                      <Stack spacing={0.6}>
                        {(account.detalles ?? []).map((detail) => {
                          const detailId = detail.detailId ?? detail.pedidoDetalleId
                          const source = detailId ? detailsById.get(detailId) : null
                          const label = source?.producto?.nombre ?? source?.productoNombre ?? detail.productoNombre ?? 'Producto'
                          const amount = detail.subtotal ?? source?.subtotal ?? 0
                          const rowKey = getDetailMoveKey(account.id, detail.id)

                          return (
                            <Stack
                              key={detail.id}
                              spacing={1}
                              sx={{ p: 1, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.03)' }}
                            >
                              <Typography sx={{ color: COLOR_TEXT }}>
                                {label} • {formatCRC(Number(amount) || 0)}
                              </Typography>

                              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                                <TextField
                                  label="Cantidad"
                                  type="number"
                                  value={detailMoveQty[rowKey] ?? ''}
                                  onChange={(event) =>
                                    setDetailMoveQty((current) => ({ ...current, [rowKey]: event.target.value }))
                                  }
                                  helperText="Vacío = todo"
                                  sx={{
                                    width: { xs: '100%', md: 130 },
                                    '& .MuiFormHelperText-root': { color: COLOR_MUTED },
                                    '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                                    '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                                  }}
                                />

                                <TextField
                                  label="Cuenta destino"
                                  select
                                  value={detailMoveTarget[rowKey] ?? ''}
                                  onChange={(event) =>
                                    setDetailMoveTarget((current) => ({ ...current, [rowKey]: event.target.value }))
                                  }
                                  sx={{
                                    minWidth: { xs: '100%', md: 220 },
                                    '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                                    '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                                  }}
                                >
                                  <MenuItem value="">Seleccionar</MenuItem>
                                  {accounts
                                    .filter((targetAccount) => targetAccount.id !== account.id)
                                    .map((targetAccount) => (
                                      <MenuItem key={targetAccount.id} value={String(targetAccount.id)}>
                                        {targetAccount.nombre ?? `Cuenta #${targetAccount.id}`}
                                      </MenuItem>
                                    ))}
                                </TextField>

                                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => void handleMoveAccountDetail(account.id, detail.id)}
                                    sx={{ color: COLOR_GOLD, borderColor: 'rgba(212,175,55,0.35)' }}
                                  >
                                    Mover
                                  </Button>
                                  <Button
                                    size="small"
                                    sx={{ color: '#f4a8b2' }}
                                    onClick={() => void handleReturnAccountDetail(account.id, detail.id)}
                                  >
                                    Devolver
                                  </Button>
                                </Stack>
                              </Stack>
                            </Stack>
                          )
                        })}
                      </Stack>
                    )}
                  </Paper>
                ))}
              </Stack>
            </Paper>

            <Paper sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(212,175,55,0.2)' }}>
              <Stack spacing={1.5}>
                <Typography sx={{ color: COLOR_GOLD, fontWeight: 800 }}>Facturación por cuenta</Typography>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                  <Chip label={`Cuentas pendientes: ${openBillingScopes.length}`} sx={{ color: COLOR_TEXT }} />
                  <Chip label={`Cuentas pagadas: ${closedBillingScopes.length}`} sx={{ color: COLOR_TEXT }} />
                  <Chip label={`Saldo pendiente total: ${formatCRC(pendingAcrossAccountsCRC)}`} sx={{ color: COLOR_TEXT }} />
                </Stack>

                {[...openBillingScopes, ...closedBillingScopes].map((scope) => {
                  const scopeAmounts = getScopeAmounts(scope.accountId)
                  const selectedCurrency = getScopeCurrency(scope.key)
                  const receivedRaw = receivedByScope[scope.key] ?? ''
                  const receivedNumber = Number(receivedRaw)
                  const received = Number.isFinite(receivedNumber) ? receivedNumber : 0
                  const receivedInCRC = selectedCurrency === 'CRC' ? received : Number(exchangeRate ? received * exchangeRate : 0)
                  const changeCRC = Math.max(0, receivedInCRC - scopeAmounts.chargeCRC)
                  const changeSelected = selectedCurrency === 'CRC' ? changeCRC : Number(exchangeRate ? changeCRC / exchangeRate : 0)
                  const payableAmount = selectedCurrency === 'CRC' ? scopeAmounts.chargeCRC : Number(scopeAmounts.chargeUSD ?? 0)

                  const account = scope.accountId ? accounts.find((item) => item.id === scope.accountId) : null
                  const accountDetails = account?.detalles ?? []
                  const hasProducts = scope.accountId ? accountDetails.length > 0 : unassignedDetails.length > 0

                  return (
                    <Paper
                      key={scope.key}
                      sx={{
                        p: 1.5,
                        backgroundColor: scopeAmounts.isClosed ? 'rgba(29,66,41,0.22)' : 'rgba(0,0,0,0.25)',
                        border: scopeAmounts.isClosed
                          ? '1px solid rgba(130,220,167,0.45)'
                          : '1px solid rgba(212,175,55,0.2)',
                      }}
                    >
                      <Stack spacing={1.25}>
                        <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                            <Typography sx={{ color: COLOR_GOLD, fontWeight: 700 }}>{scope.title}</Typography>
                            <Chip
                              size="small"
                              label={scopeAmounts.isClosed ? 'PAGADA' : 'PENDIENTE'}
                              sx={{
                                color: scopeAmounts.isClosed ? '#c7f5d9' : '#fff1c1',
                                border: scopeAmounts.isClosed
                                  ? '1px solid rgba(130,220,167,0.45)'
                                  : '1px solid rgba(212,175,55,0.35)',
                              }}
                            />
                          </Stack>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handlePrintScope(scope.accountId, scope.title)}
                            sx={{ color: COLOR_GOLD, borderColor: 'rgba(212,175,55,0.35)' }}
                          >
                            Imprimir cuenta
                          </Button>
                        </Stack>

                        {hasProducts ? (
                          <Stack spacing={0.5}>
                            {scope.accountId
                              ? accountDetails.map((detail) => {
                                  const detailId = detail.detailId ?? detail.pedidoDetalleId
                                  const source = detailId ? detailsById.get(detailId) : null
                                  const label = source?.producto?.nombre ?? source?.productoNombre ?? detail.productoNombre ?? 'Producto'
                                  const quantity = Number(detail.cantidad ?? source?.cantidad ?? 0)
                                  const amount = Number(detail.subtotal ?? source?.subtotal ?? quantity * Number(detail.precioUnitario ?? source?.precioUnitario ?? 0))
                                  return (
                                    <Typography key={detail.id} sx={{ color: COLOR_TEXT, fontSize: '0.88rem' }}>
                                      {label} • {quantity > 0 ? `${quantity} uds` : 'Cantidad no definida'} • {formatCRC(Number.isFinite(amount) ? amount : 0)}
                                    </Typography>
                                  )
                                })
                              : unassignedDetails.map((detail) => (
                                  <Typography key={detail.detailId} sx={{ color: COLOR_TEXT, fontSize: '0.88rem' }}>
                                    {detail.label} • {detail.cantidad} uds • {formatCRC(detail.subtotal)}
                                  </Typography>
                                ))}
                          </Stack>
                        ) : (
                          <Typography sx={{ color: COLOR_MUTED, fontSize: '0.86rem' }}>
                            Sin productos en esta cuenta.
                          </Typography>
                        )}

                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                          <Chip label={`Subtotal: ${formatCRC(scopeAmounts.subtotal)}`} sx={{ color: COLOR_TEXT }} />
                          <Chip label={`Servicio: ${formatCRC(scopeAmounts.serviceAmount)}`} sx={{ color: COLOR_TEXT }} />
                          <Chip label={`Total CRC: ${formatCRC(scopeAmounts.totalCRC)}`} sx={{ color: COLOR_TEXT }} />
                          <Chip label={`Pagado CRC: ${formatCRC(scopeAmounts.paidCRC)}`} sx={{ color: COLOR_TEXT }} />
                          <Chip label={`Pendiente CRC: ${formatCRC(scopeAmounts.pendingCRC)}`} sx={{ color: COLOR_TEXT }} />
                          {scopeAmounts.isClosed ? (
                            <Chip label="Cuenta pagada" sx={{ color: '#c7f5d9', border: '1px solid rgba(130,220,167,0.45)' }} />
                          ) : null}
                        </Stack>

                        <FormControl disabled={scopeAmounts.isClosed}>
                          <FormLabel sx={{ color: COLOR_TEXT }}>Método de pago</FormLabel>
                          <RadioGroup
                            row
                            value={getScopeMethodId(scope.key)}
                            onChange={(event) =>
                              setMethodByScope((current) => ({ ...current, [scope.key]: event.target.value }))
                            }
                          >
                            {methods.map((method) => (
                              <FormControlLabel key={method.id} value={String(method.id)} control={<Radio />} label={method.nombre} />
                            ))}
                          </RadioGroup>
                        </FormControl>

                        <FormControl disabled={scopeAmounts.isClosed}>
                          <FormLabel sx={{ color: COLOR_TEXT }}>Moneda</FormLabel>
                          <RadioGroup
                            row
                            value={selectedCurrency}
                            onChange={(event) => {
                              const nextCurrency = event.target.value === 'USD' ? 'USD' : 'CRC'
                              if (nextCurrency === 'USD' && !exchangeRate) {
                                toast.error('No hay tipo de cambio activo para usar dólares.')
                                return
                              }

                              setCurrencyByScope((current) => ({ ...current, [scope.key]: nextCurrency }))
                            }}
                          >
                            <FormControlLabel value="CRC" control={<Radio />} label="Colones" />
                            <FormControlLabel value="USD" control={<Radio />} label="Dólares" disabled={!exchangeRate} />
                          </RadioGroup>
                        </FormControl>

                        {isMesaOrder ? (
                          <FormControl disabled={scopeAmounts.isClosed}>
                            <FormLabel sx={{ color: COLOR_TEXT }}>Servicio</FormLabel>
                            <RadioGroup
                              row
                              value={isServiceApplied(scope.key) ? 'SI' : 'NO'}
                              onChange={(event) =>
                                setServiceByScope((current) => ({ ...current, [scope.key]: event.target.value === 'SI' }))
                              }
                            >
                              <FormControlLabel value="SI" control={<Radio />} label="Aplicar" />
                              <FormControlLabel value="NO" control={<Radio />} label="Quitar" />
                            </RadioGroup>
                          </FormControl>
                        ) : null}

                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25}>
                          <TextField
                            label={`Monto recibido (${selectedCurrency})`}
                            type="number"
                            value={receivedByScope[scope.key] ?? ''}
                            disabled={scopeAmounts.isClosed}
                            onChange={(event) =>
                              setReceivedByScope((current) => ({ ...current, [scope.key]: event.target.value }))
                            }
                            fullWidth
                            sx={{
                              '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                              '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                            }}
                          />
                          <TextField
                            label="Referencia"
                            value={referenceByScope[scope.key] ?? ''}
                            disabled={scopeAmounts.isClosed}
                            onChange={(event) =>
                              setReferenceByScope((current) => ({ ...current, [scope.key]: event.target.value }))
                            }
                            fullWidth
                            sx={{
                              '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                              '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                            }}
                          />
                        </Stack>

                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                          <Chip
                            label={selectedCurrency === 'CRC' ? `Cobro: ${formatCRC(payableAmount)}` : `Cobro: ${formatUSD(Number(scopeAmounts.chargeUSD ?? 0))}`}
                            sx={{ color: COLOR_TEXT }}
                          />
                          <Chip
                            label={selectedCurrency === 'CRC' ? `Vuelto: ${formatCRC(changeSelected)}` : `Vuelto: ${formatUSD(changeSelected)}`}
                            sx={{ color: COLOR_TEXT }}
                          />
                          <Chip label={`Vuelto en CRC: ${formatCRC(changeCRC)}`} sx={{ color: COLOR_TEXT }} />
                        </Stack>

                        <Button
                          variant="contained"
                          onClick={() => void handleSavePaymentForScope(scope.accountId)}
                          disabled={
                            saving ||
                            !pedido ||
                            scopeAmounts.isClosed ||
                            scopeAmounts.pendingCRC <= 0 ||
                            (accounts.length > 0 && !scope.accountId)
                          }
                          sx={{ backgroundColor: '#8F1D2E', '&:hover': { backgroundColor: '#a42d3e' } }}
                        >
                          Registrar pago de esta cuenta
                        </Button>
                        {accounts.length > 0 && !scope.accountId ? (
                          <Typography sx={{ color: COLOR_MUTED, fontSize: '0.8rem' }}>
                            Cuando hay cuentas divididas, debes cobrar indicando cuentaPedidoId (cuenta específica).
                          </Typography>
                        ) : null}
                      </Stack>
                    </Paper>
                  )
                })}
              </Stack>
            </Paper>

            <Paper sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(212,175,55,0.2)' }}>
              <Typography sx={{ color: COLOR_GOLD, fontWeight: 800, mb: 1 }}>Pagos registrados</Typography>
              {payments.length === 0 ? (
                <Typography sx={{ color: COLOR_MUTED }}>No hay pagos registrados.</Typography>
              ) : (
                <Stack spacing={0.75}>
                  {payments.map((payment) => {
                    const method = methods.find((item) => item.id === payment.metodoPagoId)?.nombre ?? `Método #${payment.metodoPagoId}`
                    const currency = String(payment.moneda ?? 'CRC').toUpperCase() === 'USD' ? 'USD' : 'CRC'
                    const amount = currency === 'USD' ? formatUSD(payment.monto) : formatCRC(payment.monto)
                    const accountLabel = payment.accountId
                      ? accounts.find((item) => item.id === payment.accountId)?.nombre ?? `Cuenta #${payment.accountId}`
                      : 'Cuenta principal'
                    return (
                      <Typography key={payment.id} sx={{ color: COLOR_TEXT }}>
                        {accountLabel} • {method} • {currency} • {amount}
                      </Typography>
                    )
                  })}
                </Stack>
              )}
            </Paper>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ backgroundColor: '#120c0a', p: 2 }}>
        <Button onClick={onClose} disabled={saving} sx={{ color: COLOR_TEXT }}>
          Cerrar
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleFacturar()}
          disabled={saving || !pedido || details.length === 0}
          sx={{
            background: 'linear-gradient(135deg, #D4AF37 0%, #f2d36f 100%)',
            color: '#1a1208',
            fontWeight: 800,
          }}
        >
          {saving ? 'Facturando...' : 'Confirmar y facturar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
