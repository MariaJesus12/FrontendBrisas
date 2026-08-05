import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
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
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { pedidosService } from '@/services/pedidos.service'
import { tipoCambioService, type TipoCambio } from '@/services/tipo-cambio.service'
import type { MetodoPago, PagoPedido, Pedido, PedidoAccount, PedidoAccountDetail, PedidoDetalle } from '@/types/pedido.types'

const COLOR_GOLD = '#D4AF37'
const COLOR_TEXT = '#F3E9D2'
const COLOR_MUTED = 'rgba(243,233,210,0.72)'

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

function normalizeAccountDetail(item: unknown): PedidoAccountDetail | null {
  if (typeof item !== 'object' || item === null) {
    return null
  }

  const record = item as Record<string, unknown>
  const id = Number(record.id ?? record.accountDetailId ?? record.account_detail_id ?? 0)
  if (!Number.isFinite(id) || id <= 0) {
    return null
  }

  const detailId = toPositiveInt(record.detailId ?? record.detail_id)
  const pedidoDetalleId = toPositiveInt(record.pedidoDetalleId ?? record.pedido_detalle_id)
  const productoId = toPositiveInt(record.productoId ?? record.producto_id)
  const cantidad = Number(record.cantidad ?? record.qty ?? 0)
  const precioUnitario = Number(record.precioUnitario ?? record.precio_unitario ?? 0)
  const subtotal = Number(record.subtotal ?? (cantidad * precioUnitario))

  return {
    id,
    detailId: detailId ?? undefined,
    pedidoDetalleId: pedidoDetalleId ?? undefined,
    productoId: productoId ?? undefined,
    productoNombre: typeof record.productoNombre === 'string' ? record.productoNombre : undefined,
    cantidad: Number.isFinite(cantidad) ? cantidad : undefined,
    precioUnitario: Number.isFinite(precioUnitario) ? precioUnitario : undefined,
    subtotal: Number.isFinite(subtotal) ? subtotal : undefined,
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

  const rawDetalles = record.detalles ?? record.details ?? []
  const detalles = Array.isArray(rawDetalles)
    ? rawDetalles.map((detail) => normalizeAccountDetail(detail)).filter((detail): detail is PedidoAccountDetail => detail !== null)
    : []

  const subtotal = Number(record.subtotal)
  const servicio = Number(record.servicio ?? record.service)
  const total = Number(record.total)

  return {
    id,
    nombre: typeof record.nombre === 'string' ? record.nombre : undefined,
    numero: typeof record.numero === 'string' ? record.numero : undefined,
    activo: Boolean(record.activo ?? true),
    detalles,
    subtotal: Number.isFinite(subtotal) ? subtotal : undefined,
    servicio: Number.isFinite(servicio) ? servicio : undefined,
    total: Number.isFinite(total) ? total : undefined,
  }
}

function normalizeTipoCambio(item: unknown): TipoCambio | null {
  if (typeof item !== 'object' || item === null) {
    return null
  }

  const record = item as Record<string, unknown>
  const id = Number(record.id ?? 0)
  if (!Number.isFinite(id) || id <= 0) {
    return null
  }

  const compra = Number(record.compra ?? 0)
  const venta = Number(record.venta ?? 0)
  if (!Number.isFinite(venta) || venta <= 0) {
    return null
  }

  return {
    id,
    fecha: typeof record.fecha === 'string' ? record.fecha : undefined,
    compra: Number.isFinite(compra) ? compra : 0,
    venta,
    activo: Boolean(record.activo ?? true),
    usuarioId: toPositiveInt(record.usuarioId ?? record.usuario_id) ?? undefined,
    createdAt: typeof record.created_at === 'string' ? record.created_at : undefined,
    updatedAt: typeof record.updated_at === 'string' ? record.updated_at : undefined,
  }
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

function normalizeMetodoPago(item: unknown): MetodoPago | null {
  if (typeof item !== 'object' || item === null) {
    return null
  }

  const record = item as Record<string, unknown>
  const id = Number(record.id ?? record.metodoPagoId ?? record.metodo_pago_id ?? 0)
  const nombre = String(record.nombre ?? record.name ?? '')
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
    montoColones: Number(record.montoColones ?? record.monto_colones ?? 0) || undefined,
    montoRecibido: Number(record.montoRecibido ?? record.monto_recibido ?? 0) || undefined,
    montoRecibidoColones: Number(record.montoRecibidoColones ?? record.monto_recibido_colones ?? 0) || undefined,
    vuelto: Number(record.vuelto ?? 0) || undefined,
    vueltoColones: Number(record.vueltoColones ?? record.vuelto_colones ?? 0) || undefined,
    tipoCambioId: toPositiveInt(record.tipoCambioId ?? record.tipo_cambio_id) ?? undefined,
    accountId: toPositiveInt(record.accountId ?? record.account_id) ?? undefined,
    referencia: typeof record.referencia === 'string' ? record.referencia : undefined,
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
    const keys = ['data', 'items', 'results', 'accounts', 'payments', 'methods', 'details']

    for (const key of keys) {
      const value = record[key]
      if (Array.isArray(value)) {
        return value.map((item) => normalizer(item)).filter((item): item is T => item !== null)
      }
    }
  }

  return []
}

export default function FacturacionPage() {
  const navigate = useNavigate()
  const { pedidoId } = useParams<{ pedidoId: string }>()
  const parsedPedidoId = toPositiveInt(pedidoId)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [details, setDetails] = useState<PedidoDetalle[]>([])
  const [accounts, setAccounts] = useState<PedidoAccount[]>([])
  const [payments, setPayments] = useState<PagoPedido[]>([])
  const [methods, setMethods] = useState<MetodoPago[]>([])

  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [newAccountName, setNewAccountName] = useState('')
  const [selectedDetailToSplit, setSelectedDetailToSplit] = useState('')

  const [selectedMethodId, setSelectedMethodId] = useState('')
  const [selectedCurrency, setSelectedCurrency] = useState<'CRC' | 'USD'>('CRC')
  const [receivedAmount, setReceivedAmount] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [editingPaymentId, setEditingPaymentId] = useState<number | null>(null)

  const [applyService, setApplyService] = useState(true)
  const [activeTipoCambio, setActiveTipoCambio] = useState<TipoCambio | null>(null)

  const selectedAccount = useMemo(() => {
    const id = toPositiveInt(selectedAccountId)
    if (!id) {
      return null
    }

    return accounts.find((account) => account.id === id) ?? null
  }, [accounts, selectedAccountId])

  const detailsById = useMemo(() => {
    return new Map(details.map((item) => [item.id, item]))
  }, [details])

  const splitAssignedMap = useMemo(() => {
    const map = new Map<number, number[]>()

    for (const account of accounts) {
      for (const accountDetail of account.detalles ?? []) {
        const detailId = accountDetail.detailId ?? accountDetail.pedidoDetalleId
        if (!detailId) {
          continue
        }

        const current = map.get(detailId) ?? []
        current.push(account.id)
        map.set(detailId, current)
      }
    }

    return map
  }, [accounts])

  useEffect(() => {
    if (!parsedPedidoId) {
      setError('El id de pedido no es válido.')
      setLoading(false)
      return
    }

    void loadInitialData(parsedPedidoId)
  }, [parsedPedidoId])

  useEffect(() => {
    const tipo = String(pedido?.tipo ?? '').toUpperCase()
    if (tipo === 'MESA') {
      setApplyService(true)
      return
    }

    if (tipo === 'LLEVAR') {
      setApplyService(false)
    }
  }, [pedido?.tipo])

  async function loadInitialData(id: number) {
    setLoading(true)
    setError(null)

    try {
      const [pedidoRes, detailsRes, methodsRes, accountsRes, paymentsRes, tipoCambioRes] = await Promise.allSettled([
        pedidosService.getById(id),
        pedidosService.getDetails(id),
        pedidosService.getPaymentMethods(),
        pedidosService.getAccounts(id),
        pedidosService.getPayments(id),
        tipoCambioService.getAll(),
      ])

      if (pedidoRes.status === 'rejected') {
        throw pedidoRes.reason
      }

      const normalizedPedido = normalizePedido(pedidoRes.value.data)
      if (!normalizedPedido) {
        throw new Error('No se pudo leer el pedido.')
      }

      setPedido(normalizedPedido)

      if (detailsRes.status === 'fulfilled') {
        setDetails(unwrapArrayPayload(detailsRes.value.data, normalizePedidoDetail))
      } else {
        setDetails([])
      }

      if (methodsRes.status === 'fulfilled') {
        const methodList = unwrapArrayPayload(methodsRes.value.data, normalizeMetodoPago)
        setMethods(methodList)
        if (methodList.length > 0) {
          setSelectedMethodId(String(methodList[0].id))
        }
      } else {
        setMethods([])
      }

      if (accountsRes.status === 'fulfilled') {
        setAccounts(unwrapArrayPayload(accountsRes.value.data, normalizeAccount))
      } else {
        setAccounts([])
      }

      if (paymentsRes.status === 'fulfilled') {
        setPayments(unwrapArrayPayload(paymentsRes.value.data, normalizePago))
      } else {
        setPayments([])
      }

      if (tipoCambioRes.status === 'fulfilled') {
        const cambios = unwrapArrayPayload(tipoCambioRes.value.data, normalizeTipoCambio)
        const active = cambios
          .filter((item) => item.activo !== false && Number.isFinite(item.venta) && item.venta > 0)
          .sort((a, b) => {
            const bDate = b.fecha ?? b.updatedAt ?? b.createdAt ?? ''
            const aDate = a.fecha ?? a.updatedAt ?? a.createdAt ?? ''
            return new Date(bDate).getTime() - new Date(aDate).getTime()
          })[0] ?? null

        setActiveTipoCambio(active)
      } else {
        setActiveTipoCambio(null)
      }
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : requestError instanceof Error
            ? requestError.message
            : ''
      setError(backendMessage || 'No se pudo cargar la información de facturación.')
    } finally {
      setLoading(false)
    }
  }

  async function reloadAccountsAndPayments() {
    if (!parsedPedidoId) {
      return
    }

    const [accountsRes, paymentsRes] = await Promise.allSettled([
      pedidosService.getAccounts(parsedPedidoId),
      pedidosService.getPayments(parsedPedidoId),
    ])

    if (accountsRes.status === 'fulfilled') {
      setAccounts(unwrapArrayPayload(accountsRes.value.data, normalizeAccount))
    }

    if (paymentsRes.status === 'fulfilled') {
      setPayments(unwrapArrayPayload(paymentsRes.value.data, normalizePago))
    }
  }

  const selectedDetails = useMemo(() => {
    if (!selectedAccount) {
      return details
    }

    const mapped = (selectedAccount.detalles ?? [])
      .map((item) => {
        const detailId = item.detailId ?? item.pedidoDetalleId
        if (!detailId) {
          return null
        }

        return detailsById.get(detailId) ?? null
      })
      .filter((item): item is PedidoDetalle => item !== null)

    return mapped
  }, [details, detailsById, selectedAccount])

  const subtotal = useMemo(() => {
    return selectedDetails.reduce((sum, detail) => {
      const lineSubtotal = Number(detail.subtotal ?? detail.precioUnitario * detail.cantidad)
      return sum + (Number.isFinite(lineSubtotal) ? lineSubtotal : 0)
    }, 0)
  }, [selectedDetails])

  const serviceRate = useMemo(() => {
    if (!pedido || String(pedido.tipo).toUpperCase() !== 'MESA') {
      return 0
    }

    const pedidoImpuesto = Number(pedido.impuesto ?? 0)
    if (Number.isFinite(pedidoImpuesto) && pedidoImpuesto > 0 && subtotal > 0) {
      return pedidoImpuesto / subtotal
    }

    return 0.1
  }, [pedido, subtotal])

  const serviceAmount = useMemo(() => {
    if (!pedido || String(pedido.tipo).toUpperCase() !== 'MESA') {
      return 0
    }

    if (!applyService) {
      return 0
    }

    return subtotal * serviceRate
  }, [applyService, pedido, serviceRate, subtotal])

  const totalCRC = useMemo(() => subtotal + serviceAmount, [subtotal, serviceAmount])

  const exchangeRate = useMemo(() => {
    const rawRate = Number(activeTipoCambio?.venta ?? 0)
    return Number.isFinite(rawRate) && rawRate > 0 ? rawRate : 1
  }, [activeTipoCambio])

  const totalUSD = useMemo(() => (exchangeRate > 0 ? totalCRC / exchangeRate : 0), [exchangeRate, totalCRC])

  const dueInSelectedCurrency = useMemo(() => {
    return selectedCurrency === 'CRC' ? totalCRC : totalUSD
  }, [selectedCurrency, totalCRC, totalUSD])

  const receivedNumeric = Number(receivedAmount)
  const receivedValue = Number.isFinite(receivedNumeric) ? receivedNumeric : 0

  const receivedInCRC = useMemo(() => {
    return selectedCurrency === 'CRC' ? receivedValue : receivedValue * exchangeRate
  }, [exchangeRate, receivedValue, selectedCurrency])

  const changeCRC = useMemo(() => Math.max(0, receivedInCRC - totalCRC), [receivedInCRC, totalCRC])
  const changeInSelectedCurrency = useMemo(() => {
    return selectedCurrency === 'CRC' ? changeCRC : changeCRC / exchangeRate
  }, [changeCRC, exchangeRate, selectedCurrency])

  async function handleCreateAccount() {
    if (!parsedPedidoId) {
      return
    }

    const nextName = newAccountName.trim()
    if (!nextName) {
      toast.error('Ingresa un nombre para la cuenta.')
      return
    }

    setSaving(true)
    try {
      await pedidosService.createAccount(parsedPedidoId, { nombre: nextName, activo: true })
      setNewAccountName('')
      toast.success('Cuenta creada.')
      await reloadAccountsAndPayments()
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
    if (!parsedPedidoId) {
      return
    }

    const accountId = toPositiveInt(selectedAccountId)
    const detailId = toPositiveInt(selectedDetailToSplit)

    if (!accountId) {
      toast.error('Selecciona una cuenta para dividir por producto.')
      return
    }

    if (!detailId) {
      toast.error('Selecciona un producto para asignar.')
      return
    }

    const detail = detailsById.get(detailId)

    setSaving(true)
    try {
      await pedidosService.addAccountDetail(parsedPedidoId, accountId, {
        detailId,
        pedidoDetalleId: detailId,
        productoId: detail?.productoId,
        cantidad: detail?.cantidad,
      })

      setSelectedDetailToSplit('')
      toast.success('Producto agregado a la cuenta.')
      await reloadAccountsAndPayments()
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      toast.error(backendMessage || 'No fue posible agregar el producto a la cuenta.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveAccountDetail(accountId: number, accountDetailId: number) {
    if (!parsedPedidoId) {
      return
    }

    setSaving(true)
    try {
      await pedidosService.removeAccountDetail(parsedPedidoId, accountId, accountDetailId)
      toast.success('Detalle removido de la cuenta.')
      await reloadAccountsAndPayments()
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      toast.error(backendMessage || 'No fue posible remover el detalle de la cuenta.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSavePayment() {
    if (!parsedPedidoId || !pedido) {
      return
    }

    const metodoPagoId = toPositiveInt(selectedMethodId)
    if (!metodoPagoId) {
      toast.error('Selecciona un método de pago.')
      return
    }

    if (!Number.isFinite(receivedValue) || receivedValue <= 0) {
      toast.error('Ingresa un monto recibido válido.')
      return
    }

    if (receivedValue < dueInSelectedCurrency) {
      toast.error('El monto recibido no cubre el total a pagar.')
      return
    }

    const accountId = toPositiveInt(selectedAccountId)

    const payload = {
      metodoPagoId,
      monto: dueInSelectedCurrency,
      moneda: selectedCurrency,
      montoColones: totalCRC,
      montoRecibido: receivedValue,
      montoRecibidoColones: receivedInCRC,
      vuelto: changeInSelectedCurrency,
      vueltoColones: changeCRC,
      tipoCambioId: selectedCurrency === 'USD' ? activeTipoCambio?.id : undefined,
      accountId: accountId ?? undefined,
      aplicarServicio: String(pedido.tipo).toUpperCase() === 'MESA' ? applyService : false,
      exonerarServicio: String(pedido.tipo).toUpperCase() === 'MESA' ? !applyService : true,
      referencia: paymentReference.trim() || undefined,
    }

    setSaving(true)
    try {
      if (editingPaymentId) {
        await pedidosService.updatePayment(parsedPedidoId, editingPaymentId, payload)
        toast.success('Pago actualizado.')
      } else {
        await pedidosService.createPayment(parsedPedidoId, payload)
        toast.success('Pago registrado.')
      }

      setEditingPaymentId(null)
      setReceivedAmount('')
      setPaymentReference('')
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

  async function handleCloseAndBill() {
    if (!parsedPedidoId) {
      return
    }

    setSaving(true)
    try {
      await pedidosService.bill(parsedPedidoId)
      toast.success('Pedido facturado y cerrado correctamente.')
      window.close()
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      toast.error(backendMessage || 'No fue posible cerrar la facturación.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#120e0d' }}>
        <CircularProgress sx={{ color: COLOR_GOLD }} />
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: '100vh', p: { xs: 2, md: 3 }, backgroundColor: '#120e0d', color: COLOR_TEXT }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography sx={{ color: COLOR_GOLD, fontSize: '1.8rem', fontWeight: 900 }}>Facturación</Typography>
          <Typography sx={{ color: COLOR_MUTED }}>
            Pedido #{pedido?.id} {pedido?.codigo ? `• ${pedido.codigo}` : ''}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={() => navigate('/mesas')} sx={{ color: COLOR_TEXT, borderColor: 'rgba(243,233,210,0.35)' }}>
            Volver
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleCloseAndBill()}
            disabled={saving}
            sx={{
              background: 'linear-gradient(135deg, #D4AF37 0%, #f2d36f 100%)',
              color: '#1a1208',
              fontWeight: 800,
            }}
          >
            Facturar y cerrar
          </Button>
        </Stack>
      </Stack>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <Stack spacing={2}>
        <Paper sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(212,175,55,0.2)' }}>
          <Stack spacing={1}>
            <Typography sx={{ color: COLOR_GOLD, fontWeight: 800 }}>Resumen del cobro</Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
              <Chip label={`Subtotal: ${formatCRC(subtotal)}`} sx={{ color: COLOR_TEXT }} />
              <Chip label={`Servicio: ${formatCRC(serviceAmount)}`} sx={{ color: COLOR_TEXT }} />
              <Chip label={`Total CRC: ${formatCRC(totalCRC)}`} sx={{ color: COLOR_TEXT }} />
              <Chip label={`Total USD: ${formatUSD(totalUSD)}`} sx={{ color: COLOR_TEXT }} />
            </Stack>
            <Typography sx={{ color: COLOR_MUTED, fontSize: '0.86rem' }}>
              Tipo de cambio (venta): {activeTipoCambio ? activeTipoCambio.venta.toFixed(4) : 'No disponible'}
            </Typography>
          </Stack>
        </Paper>

        <Paper sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(212,175,55,0.2)' }}>
          <Stack spacing={2}>
            <Typography sx={{ color: COLOR_GOLD, fontWeight: 800 }}>Dividir cuenta por productos</Typography>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
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
                label="Nueva cuenta"
                value={newAccountName}
                onChange={(event) => setNewAccountName(event.target.value)}
                fullWidth
                sx={{
                  '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                  '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                }}
              />
              <Button variant="outlined" onClick={() => void handleCreateAccount()} disabled={saving} sx={{ color: COLOR_GOLD, borderColor: 'rgba(212,175,55,0.35)' }}>
                Crear cuenta
              </Button>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
              <TextField
                label="Producto"
                select
                value={selectedDetailToSplit}
                onChange={(event) => setSelectedDetailToSplit(event.target.value)}
                fullWidth
                sx={{
                  '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                  '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                }}
              >
                <MenuItem value="">Seleccionar producto</MenuItem>
                {details.map((detail) => {
                  const subtotalDetail = detail.subtotal ?? detail.precioUnitario * detail.cantidad
                  return (
                    <MenuItem key={detail.id} value={String(detail.id)}>
                      {detail.producto?.nombre ?? `Producto #${detail.productoId}`} • {detail.cantidad} • {formatCRC(subtotalDetail)}
                    </MenuItem>
                  )
                })}
              </TextField>
              <Button
                variant="outlined"
                onClick={() => void handleAssignDetailToAccount()}
                disabled={saving || !selectedAccountId}
                sx={{ color: COLOR_TEXT, borderColor: 'rgba(243,233,210,0.35)' }}
              >
                Agregar a cuenta
              </Button>
            </Stack>

            {accounts.length > 0 ? (
              <Stack spacing={1}>
                {accounts.map((account) => (
                  <Paper key={account.id} sx={{ p: 1.25, backgroundColor: 'rgba(0,0,0,0.22)', border: '1px solid rgba(212,175,55,0.12)' }}>
                    <Typography sx={{ color: COLOR_GOLD, fontWeight: 700, mb: 0.5 }}>
                      {account.nombre ?? `Cuenta #${account.id}`}
                    </Typography>
                    {(account.detalles ?? []).length === 0 ? (
                      <Typography sx={{ color: COLOR_MUTED, fontSize: '0.86rem' }}>Sin productos asignados.</Typography>
                    ) : (
                      <Stack spacing={0.6}>
                        {(account.detalles ?? []).map((detail) => {
                          const detailId = detail.detailId ?? detail.pedidoDetalleId
                          const source = detailId ? detailsById.get(detailId) : null
                          const lineName = source?.producto?.nombre ?? detail.productoNombre ?? `Detalle #${detail.id}`
                          const lineSubtotal =
                            detail.subtotal ??
                            source?.subtotal ??
                            ((source?.precioUnitario ?? 0) * (source?.cantidad ?? 0))

                          return (
                            <Stack key={detail.id} direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography sx={{ color: COLOR_TEXT, fontSize: '0.9rem' }}>
                                {lineName} • {formatCRC(Number(lineSubtotal ?? 0))}
                              </Typography>
                              <Button
                                size="small"
                                onClick={() => void handleRemoveAccountDetail(account.id, detail.id)}
                                sx={{ color: '#f4a9b4' }}
                              >
                                Quitar
                              </Button>
                            </Stack>
                          )
                        })}
                      </Stack>
                    )}
                  </Paper>
                ))}
              </Stack>
            ) : null}

            <Divider sx={{ borderColor: 'rgba(212,175,55,0.18)' }} />

            <Stack spacing={1}>
              <Typography sx={{ color: COLOR_GOLD, fontWeight: 800 }}>Productos del pedido</Typography>
              {details.map((detail) => {
                const subtotalDetail = detail.subtotal ?? detail.precioUnitario * detail.cantidad
                const assigned = splitAssignedMap.get(detail.id) ?? []

                return (
                  <Stack key={detail.id} direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ justifyContent: 'space-between' }}>
                    <Typography sx={{ color: COLOR_TEXT }}>
                      {detail.producto?.nombre ?? `Producto #${detail.productoId}`} • {detail.cantidad} • {formatCRC(subtotalDetail)}
                    </Typography>
                    <Typography sx={{ color: COLOR_MUTED, fontSize: '0.86rem' }}>
                      {assigned.length > 0 ? `Asignado a cuentas: ${assigned.join(', ')}` : 'Sin dividir'}
                    </Typography>
                  </Stack>
                )
              })}
            </Stack>
          </Stack>
        </Paper>

        <Paper sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(212,175,55,0.2)' }}>
          <Stack spacing={2}>
            <Typography sx={{ color: COLOR_GOLD, fontWeight: 800 }}>Pago</Typography>

            <FormControl>
              <FormLabel sx={{ color: COLOR_TEXT }}>Método de pago</FormLabel>
              <RadioGroup
                row
                value={selectedMethodId}
                onChange={(event) => setSelectedMethodId(event.target.value)}
              >
                {methods.map((method) => (
                  <FormControlLabel key={method.id} value={String(method.id)} control={<Radio />} label={method.nombre} />
                ))}
              </RadioGroup>
            </FormControl>

            <FormControl>
              <FormLabel sx={{ color: COLOR_TEXT }}>Moneda de cobro</FormLabel>
              <RadioGroup
                row
                value={selectedCurrency}
                onChange={(event) => setSelectedCurrency(event.target.value === 'USD' ? 'USD' : 'CRC')}
              >
                <FormControlLabel value="CRC" control={<Radio />} label="Colones" />
                <FormControlLabel value="USD" control={<Radio />} label="Dolares" />
              </RadioGroup>
            </FormControl>

            {String(pedido?.tipo ?? '').toUpperCase() === 'MESA' ? (
              <FormControl>
                <FormLabel sx={{ color: COLOR_TEXT }}>Servicio</FormLabel>
                <RadioGroup
                  row
                  value={applyService ? 'SI' : 'NO'}
                  onChange={(event) => setApplyService(event.target.value === 'SI')}
                >
                  <FormControlLabel value="SI" control={<Radio />} label="Aplicar" />
                  <FormControlLabel value="NO" control={<Radio />} label="Quitar" />
                </RadioGroup>
              </FormControl>
            ) : (
              <Alert severity="info">Pedidos para llevar no aplican servicio.</Alert>
            )}

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
              <TextField
                label={`Monto recibido (${selectedCurrency})`}
                type="number"
                value={receivedAmount}
                onChange={(event) => setReceivedAmount(event.target.value)}
                fullWidth
                sx={{
                  '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                  '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                }}
              />
              <TextField
                label="Referencia"
                value={paymentReference}
                onChange={(event) => setPaymentReference(event.target.value)}
                fullWidth
                sx={{
                  '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                  '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                }}
              />
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
              <Chip
                label={selectedCurrency === 'CRC' ? `Total a pagar: ${formatCRC(dueInSelectedCurrency)}` : `Total a pagar: ${formatUSD(dueInSelectedCurrency)}`}
                sx={{ color: COLOR_TEXT }}
              />
              <Chip
                label={selectedCurrency === 'CRC' ? `Vuelto: ${formatCRC(changeInSelectedCurrency)}` : `Vuelto: ${formatUSD(changeInSelectedCurrency)}`}
                sx={{ color: COLOR_TEXT }}
              />
              <Chip label={`Vuelto en colones: ${formatCRC(changeCRC)}`} sx={{ color: COLOR_TEXT }} />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                onClick={() => {
                  setEditingPaymentId(null)
                  setReceivedAmount('')
                  setPaymentReference('')
                }}
                sx={{ color: COLOR_TEXT, borderColor: 'rgba(243,233,210,0.35)' }}
              >
                Limpiar
              </Button>
              <Button
                variant="contained"
                disabled={saving}
                onClick={() => void handleSavePayment()}
                sx={{
                  backgroundColor: '#8F1D2E',
                  '&:hover': { backgroundColor: '#a42d3e' },
                }}
              >
                {editingPaymentId ? 'Actualizar pago' : 'Registrar pago'}
              </Button>
            </Stack>
          </Stack>
        </Paper>

        <Paper sx={{ p: 2, backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(212,175,55,0.2)' }}>
          <Typography sx={{ color: COLOR_GOLD, fontWeight: 800, mb: 1 }}>Pagos registrados</Typography>
          {payments.length === 0 ? (
            <Typography sx={{ color: COLOR_MUTED }}>No hay pagos registrados todavía.</Typography>
          ) : (
            <Stack spacing={1}>
              {payments.map((payment) => {
                const methodName = methods.find((item) => item.id === payment.metodoPagoId)?.nombre ?? `Metodo #${payment.metodoPagoId}`
                const currency = String(payment.moneda ?? 'CRC').toUpperCase()
                const displayedAmount = currency === 'USD' ? formatUSD(payment.monto) : formatCRC(payment.monto)
                const displayedChange =
                  currency === 'USD'
                    ? formatUSD(Number(payment.vuelto ?? 0))
                    : formatCRC(Number(payment.vuelto ?? 0))

                return (
                  <Stack
                    key={payment.id}
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={1}
                    sx={{ justifyContent: 'space-between', borderBottom: '1px solid rgba(212,175,55,0.12)', pb: 1 }}
                  >
                    <Typography sx={{ color: COLOR_TEXT }}>
                      {methodName} • {currency} • {displayedAmount} • Vuelto {displayedChange}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        onClick={() => {
                          setEditingPaymentId(payment.id)
                          setSelectedMethodId(String(payment.metodoPagoId))
                          setSelectedCurrency(String(payment.moneda ?? 'CRC').toUpperCase() === 'USD' ? 'USD' : 'CRC')
                          const received = Number(payment.montoRecibido ?? payment.monto)
                          setReceivedAmount(Number.isFinite(received) ? String(received) : '')
                          setPaymentReference(payment.referencia ?? '')
                        }}
                        sx={{ color: COLOR_GOLD }}
                      >
                        Editar
                      </Button>
                    </Stack>
                  </Stack>
                )
              })}
            </Stack>
          )}
        </Paper>
      </Stack>
    </Box>
  )
}
