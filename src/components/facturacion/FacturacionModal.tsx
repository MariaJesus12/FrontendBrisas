import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import {
  Alert,
  Box,
  Button,
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

  if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(productoId) || productoId <= 0) {
    return null
  }

  return {
    id,
    productoId,
    producto:
      typeof record.producto === 'object' && record.producto !== null
        ? (record.producto as PedidoDetalle['producto'])
        : undefined,
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
  const id = Number(record.id ?? 0)
  const metodoPagoId = Number(record.metodoPagoId ?? record.metodo_pago_id ?? 0)
  const monto = Number(record.monto ?? 0)

  if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(metodoPagoId) || metodoPagoId <= 0) {
    return null
  }

  return {
    id,
    metodoPagoId,
    metodoPago:
      typeof record.metodoPago === 'object' && record.metodoPago !== null
        ? (record.metodoPago as PagoPedido['metodoPago'])
        : undefined,
    monto: Number.isFinite(monto) ? monto : 0,
    moneda: typeof record.moneda === 'string' ? record.moneda : undefined,
    monedaId: toPositiveInt(record.monedaId ?? record.moneda_id) ?? undefined,
    accountId: toPositiveInt(record.accountId ?? record.account_id ?? record.cuentaId ?? record.cuenta_id) ?? undefined,
    montoColones: Number(record.montoColones ?? record.monto_colones ?? 0) || undefined,
    montoRecibido: Number(record.montoRecibido ?? record.monto_recibido ?? 0) || undefined,
    montoRecibidoColones: Number(record.montoRecibidoColones ?? record.monto_recibido_colones ?? 0) || undefined,
    vuelto: Number(record.vuelto ?? 0) || undefined,
    vueltoColones: Number(record.vueltoColones ?? record.vuelto_colones ?? 0) || undefined,
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
  const id = Number(record.id ?? record.accountId ?? record.account_id ?? 0)
  if (!Number.isFinite(id) || id <= 0) {
    return null
  }

  const rawDetalles = record.detalles ?? record.details ?? record.accountDetails ?? record.account_details ?? []
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
    detalles,
    subtotal: Number(record.subtotal ?? 0) || undefined,
    servicio: Number(record.servicio ?? 0) || undefined,
    total: Number(record.total ?? 0) || undefined,
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
      'payments',
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
        const single = normalizer(value)
        if (single) {
          return [single]
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

  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountNumber, setNewAccountNumber] = useState('')
  const [selectedDetailToSplit, setSelectedDetailToSplit] = useState('')
  const [splitQuantity, setSplitQuantity] = useState('')
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

    const [accountsRes, paymentsRes] = await Promise.allSettled([
      pedidosService.getAccounts(pedidoId),
      pedidosService.getPayments(pedidoId),
    ])

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

  const unassignedDetails = useMemo(() => {
    return details
      .map((detail) => {
        const assignedQty = assignedQuantityByDetailId.get(detail.id) ?? 0
        const detailQty = Number(detail.cantidad ?? 0)
        const unitPrice = Number(detail.precioUnitario ?? 0)
        const fallbackSubtotal = Number(detail.subtotal ?? detailQty * unitPrice)
        const remainingQty = Number.isFinite(detailQty) ? Math.max(detailQty - assignedQty, 0) : 0
        const subtotal = remainingQty > 0 ? remainingQty * unitPrice : 0

        if (remainingQty <= 0) {
          return null
        }

        return {
          detailId: detail.id,
          label: detail.producto?.nombre ?? `Producto #${detail.productoId}`,
          cantidad: roundMoney(remainingQty),
          subtotal: subtotal > 0 ? roundMoney(subtotal) : roundMoney(fallbackSubtotal),
        }
      })
      .filter((item): item is { detailId: number; label: string; cantidad: number; subtotal: number } => item !== null)
  }, [assignedQuantityByDetailId, details])

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
    return toPositiveInt(payment.accountId ?? null)
  }

  function getScopeAmounts(accountId: number | null) {
    const scopeKey = getScopeKey(accountId)
    const subtotal = accountId ? Number(accountSubtotalById.get(accountId) ?? 0) : unassignedSubtotal
    const serviceAmount = isServiceApplied(scopeKey) ? subtotal * serviceRate : 0
    const totalCRC = roundMoney(subtotal + serviceAmount)

    const paidCRC = roundMoney(
      payments.reduce((sum, payment) => {
        const paymentAccountId = getPaymentAccountId(payment)
        const isSameScope = accountId ? paymentAccountId === accountId : paymentAccountId === null
        if (!isSameScope) {
          return sum
        }

        const montoColones = Number(payment.montoColones ?? 0)
        if (Number.isFinite(montoColones) && montoColones > 0) {
          return sum + montoColones
        }

        const paymentCurrency = String(payment.moneda ?? 'CRC').toUpperCase()
        const amount = Number(payment.monto ?? 0)
        if (!Number.isFinite(amount) || amount <= 0) {
          return sum
        }

        if (paymentCurrency === 'USD' && exchangeRate) {
          return sum + amount * exchangeRate
        }

        return sum + amount
      }, 0),
    )

    const pendingCRC = roundMoney(Math.max(totalCRC - paidCRC, 0))
    const chargeCRC = roundMoney(Math.min(pendingCRC, backendPendingCRC > 0 ? backendPendingCRC : pendingCRC))
    const totalUSD = exchangeRate ? roundMoney(totalCRC / exchangeRate) : null
    const chargeUSD = exchangeRate ? roundMoney(chargeCRC / exchangeRate) : null

    return {
      subtotal: roundMoney(subtotal),
      serviceAmount: roundMoney(serviceAmount),
      totalCRC,
      totalUSD,
      paidCRC,
      pendingCRC,
      chargeCRC,
      chargeUSD,
    }
  }

  const billingScopes = useMemo(() => {
    const base = [
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
    const detailId = toPositiveInt(selectedDetailToSplit)
    if (!detailId) {
      return []
    }

    const detail = detailsById.get(detailId)
    if (!detail) {
      return []
    }

    const parsedQuantity = Number(splitQuantity)
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      return [{ detailId }]
    }

    const maxCantidad = Number(detail.cantidad)
    if (Number.isFinite(maxCantidad) && maxCantidad > 0 && parsedQuantity > maxCantidad) {
      toast.error(`La cantidad a mover no puede exceder ${maxCantidad}.`)
      return null
    }

    return [{ detailId, cantidad: parsedQuantity }]
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

    const parsedAccountNumber = Number(newAccountNumber)
    const accountNumber =
      Number.isFinite(parsedAccountNumber) && parsedAccountNumber > 0
        ? Math.trunc(parsedAccountNumber)
        : accounts.length + 1

    const items = buildSplitItemsFromSelection()
    if (items === null) {
      return
    }

    const name = newAccountName.trim()
    if (!name && items.length === 0) {
      toast.error('Ingresa un nombre de cuenta o selecciona productos para dividir.')
      return
    }

    setSaving(true)
    try {
      const existingIds = new Set(accounts.map((account) => account.id))
      const createResponse = await pedidosService.createAccount(pedidoId, {
        numeroCuenta: accountNumber,
        nombre: name || undefined,
        activo: true,
      })

      let createdAccountId = extractCreatedAccountId(createResponse.data)
      if (!createdAccountId) {
        const refreshedAccountsResponse = await pedidosService.getAccounts(pedidoId)
        const refreshedAccounts = unwrapArrayPayload(refreshedAccountsResponse.data, normalizeAccount)
        setAccounts(refreshedAccounts)

        const byNewId = refreshedAccounts.find((account) => !existingIds.has(account.id))
        const byNumber = refreshedAccounts.find(
          (account) => Number(account.numeroCuenta ?? Number(account.numero ?? 0)) === accountNumber,
        )
        const byName = name
          ? refreshedAccounts.find((account) => String(account.nombre ?? '').trim().toLowerCase() === name.toLowerCase())
          : undefined

        createdAccountId = byNewId?.id ?? byNumber?.id ?? byName?.id ?? null
      }

      if (items.length > 0 && createdAccountId) {
        await pedidosService.addAccountDetail(pedidoId, createdAccountId, { items })
      }

      if (items.length > 0 && !createdAccountId) {
        toast.error('Cuenta creada, pero no se pudo identificar su ID para asignar productos automáticamente.')
      }

      setNewAccountName('')
      setNewAccountNumber('')
      setSelectedDetailToSplit('')
      setSplitQuantity('')
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
      setSelectedDetailToSplit('')
      setSplitQuantity('')
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
      await pedidosService.removeAccountDetail(pedidoId, accountId, accountDetailId, {
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
    const metodoPagoId = toPositiveInt(getScopeMethodId(scopeKey))
    if (!metodoPagoId) {
      toast.error('Selecciona un método de pago.')
      return
    }

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

    if (!Number.isFinite(received) || received <= 0) {
      toast.error('Ingresa un monto recibido válido.')
      return
    }

    if (selectedCurrency === 'USD' && !exchangeRate) {
      toast.error('No hay tipo de cambio activo para cobrar en dólares.')
      return
    }

    const receivedInCRC = selectedCurrency === 'CRC' ? received : Number(exchangeRate ? received * exchangeRate : 0)
    const changeCRC = Math.max(0, receivedInCRC - amounts.chargeCRC)
    const changeSelected = selectedCurrency === 'CRC' ? changeCRC : Number(exchangeRate ? changeCRC / exchangeRate : 0)

    if (received < payableAmount) {
      toast.error('El monto recibido es menor al total.')
      return
    }

    const monedaId = resolveMonedaId(selectedCurrency)
    if (!monedaId) {
      toast.error('No se pudo resolver la moneda seleccionada. Verifica el catálogo de monedas.')
      return
    }

    setSaving(true)
    try {
      await pedidosService.createPayment(pedidoId, {
        metodoPagoId,
        monto: payableAmount,
        moneda: selectedCurrency,
        monedaId,
        montoColones: amounts.chargeCRC,
        montoRecibido: received,
        montoRecibidoColones: receivedInCRC,
        vuelto: changeSelected,
        vueltoColones: changeCRC,
        tipoCambioId: selectedCurrency === 'USD' ? activeTipoCambio?.id : undefined,
        accountId: accountId ?? undefined,
        aplicarServicio: isMesaOrder ? isServiceApplied(scopeKey) : false,
        exonerarServicio: isMesaOrder ? !isServiceApplied(scopeKey) : true,
        referencia: (referenceByScope[scopeKey] ?? '').trim() || undefined,
      })

      toast.success('Pago registrado.')
      setReceivedByScope((current) => ({ ...current, [scopeKey]: '' }))
      setReferenceByScope((current) => ({ ...current, [scopeKey]: '' }))
      await reloadAccountsAndPayments()
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      toast.error(backendMessage || 'No fue posible registrar el pago.')
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

                  <TextField
                    label="Número cuenta"
                    type="number"
                    value={newAccountNumber}
                    onChange={(event) => setNewAccountNumber(event.target.value)}
                    fullWidth
                    sx={{
                      '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                      '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                    }}
                  />

                  <TextField
                    label="Nueva cuenta"
                    value={newAccountName}
                    onChange={(event) => setNewAccountName(event.target.value)}
                    fullWidth
                    sx={{
                      '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                      '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                    }}
                  />

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
                  <TextField
                    label="Producto"
                    select
                    value={selectedDetailToSplit}
                    onChange={(event) => setSelectedDetailToSplit(event.target.value)}
                    fullWidth
                    helperText="Si eliges producto y luego creas cuenta, se divide automáticamente en esa nueva cuenta."
                    sx={{
                      '& .MuiFormHelperText-root': { color: COLOR_MUTED },
                      '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                      '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                    }}
                  >
                    <MenuItem value="">Seleccionar producto</MenuItem>
                    {details.map((detail) => {
                      const detailSubtotal = detail.subtotal ?? detail.precioUnitario * detail.cantidad
                      return (
                        <MenuItem key={detail.id} value={String(detail.id)}>
                          {detail.producto?.nombre ?? `Producto #${detail.productoId}`} • {detail.cantidad} • {formatCRC(detailSubtotal)}
                        </MenuItem>
                      )
                    })}
                  </TextField>

                  <TextField
                    label="Cantidad a mover"
                    type="number"
                    value={splitQuantity}
                    onChange={(event) => setSplitQuantity(event.target.value)}
                    helperText="Vacío = mover todo el detalle"
                    sx={{
                      minWidth: { md: 190 },
                      '& .MuiFormHelperText-root': { color: COLOR_MUTED },
                      '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                      '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                    }}
                  />

                  <Button
                    variant="outlined"
                    onClick={() => void handleAssignDetailToAccount()}
                    disabled={saving || !selectedAccountId}
                    sx={{ color: COLOR_TEXT, borderColor: 'rgba(243,233,210,0.35)' }}
                  >
                    Asignar
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
                          const label = source?.producto?.nombre ?? detail.productoNombre ?? `Detalle #${detail.id}`
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

                {billingScopes.map((scope) => {
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
                    <Paper key={scope.key} sx={{ p: 1.5, backgroundColor: 'rgba(0,0,0,0.25)', border: '1px solid rgba(212,175,55,0.2)' }}>
                      <Stack spacing={1.25}>
                        <Typography sx={{ color: COLOR_GOLD, fontWeight: 700 }}>{scope.title}</Typography>

                        {hasProducts ? (
                          <Stack spacing={0.5}>
                            {scope.accountId
                              ? accountDetails.map((detail) => {
                                  const detailId = detail.detailId ?? detail.pedidoDetalleId
                                  const source = detailId ? detailsById.get(detailId) : null
                                  const label = source?.producto?.nombre ?? detail.productoNombre ?? `Detalle #${detail.id}`
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
                        </Stack>

                        <FormControl>
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

                        <FormControl>
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
                          <FormControl>
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
                          disabled={saving || !pedido || scopeAmounts.pendingCRC <= 0}
                          sx={{ backgroundColor: '#8F1D2E', '&:hover': { backgroundColor: '#a42d3e' } }}
                        >
                          Registrar pago de esta cuenta
                        </Button>
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
