import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import VisibilityIcon from '@mui/icons-material/Visibility'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import ReceiptIcon from '@mui/icons-material/Receipt'
import { toast } from 'react-toastify'
import { useLocation } from 'react-router-dom'
import { pedidoSchema } from '@/schemas/pedido.schema'
import { mesasService } from '@/services/mesas.service'
import { menuService } from '@/services/menu.service'
import { pedidosService } from '@/services/pedidos.service'
import { usuariosService } from '@/services/usuarios.service'
import { useAuth } from '@/hooks/useAuth'
import type { Mesa } from '@/types/mesa.types'
import type { Product } from '@/types/menu.types'
import type { CreatedUser } from '@/types/usuario.types'
import type {
  CreatePedidoDto,
  EstadoPedido,
  MetodoPago,
  Pedido,
  PedidoDetalle,
  PedidoListQuery,
  PagoPedido,
  TipoPedido,
} from '@/types/pedido.types'
import { normalizeRole } from '@/utils/roles'

const COLOR_GOLD = '#D4AF37'
const COLOR_TEXT = '#F3E9D2'
const COLOR_MAROON = '#8F1D2E'
const COLOR_MUTED = 'rgba(243,233,210,0.7)'

const FALLBACK_PAYMENT_METHODS: MetodoPago[] = [
  { id: 1, nombre: 'EFECTIVO' },
  { id: 2, nombre: 'TARJETA' },
  { id: 3, nombre: 'SINPE' },
]

const ORDER_STATES: EstadoPedido[] = ['BORRADOR', 'EN_PREPARACION', 'LISTO', 'FACTURADO', 'CANCELADO']
const ORDER_TYPES: TipoPedido[] = ['MESA', 'LLEVAR']

interface PedidoFilterState {
  estado: string
  tipo: string
  mesaId: string
  usuarioId: string
  fechaDesde: string
  fechaHasta: string
}

interface PedidoLineFormState {
  productoId: string
  cantidad: string
  precioUnitario: string
  observacion: string
}

interface PedidoFormState {
  codigo: string
  mesaId: string
  usuarioId: string
  tipo: TipoPedido
  estado: EstadoPedido
  impuesto: string
  detalles: PedidoLineFormState[]
}

interface PaymentFormState {
  metodoPagoId: string
  monto: string
  referencia: string
}

const initialFilterState: PedidoFilterState = {
  estado: '',
  tipo: '',
  mesaId: '',
  usuarioId: '',
  fechaDesde: '',
  fechaHasta: '',
}

const initialPedidoForm: PedidoFormState = {
  codigo: '',
  mesaId: '',
  usuarioId: '',
  tipo: 'MESA',
  estado: 'BORRADOR',
  impuesto: '0',
  detalles: [{ productoId: '', cantidad: '1', precioUnitario: '', observacion: '' }],
}

const initialPaymentForm: PaymentFormState = {
  metodoPagoId: '',
  monto: '',
  referencia: '',
}

function toPositiveNumber(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function formatCurrency(value: number | null | undefined): string {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safeValue)
}

function formatDateTime(value?: string): string {
  if (!value) {
    return 'Sin fecha'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString('es-CR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
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

function unwrapArrayPayload<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[]
  }

  if (typeof payload === 'object' && payload !== null) {
    const record = payload as Record<string, unknown>
    const keys = ['data', 'items', 'results', 'pedidos', 'details', 'payments', 'methods', 'metodos']

    for (const key of keys) {
      const value = record[key]
      if (Array.isArray(value)) {
        return value as T[]
      }
    }
  }

  return []
}

function getUserDisplayName(user: CreatedUser): string {
  const record = user as unknown as Record<string, unknown>
  const directName = record.nombre ?? record.name ?? ''
  const identifier = record.usuario ?? record.email ?? record.username ?? ''
  const name = typeof directName === 'string' ? directName : String(directName)
  const idPart = typeof identifier === 'string' ? identifier : String(identifier)

  if (name && idPart) {
    return `${name} • ${idPart}`
  }

  return name || idPart || `Usuario #${user.id}`
}

function getMesaDisplayName(mesa: Mesa): string {
  const details = mesa.observacion ? ` • ${mesa.observacion}` : ''
  return `Mesa #${mesa.numero} (${mesa.capacidad})${details}`
}

function getProductDisplayName(product: Product): string {
  const code = product.codigo ? `${product.codigo} • ` : ''
  return `${code}${product.nombre}`
}

function getPedidoMesaLabel(pedido: Pedido): string {
  if (String(pedido.tipo).toUpperCase() === 'LLEVAR') {
    return 'Llevar'
  }

  if (pedido.mesa?.numero) {
    return `Mesa #${pedido.mesa.numero}`
  }

  if (pedido.mesaId) {
    return `Mesa #${pedido.mesaId}`
  }

  return 'Sin mesa'
}

function getPedidoUserLabel(pedido: Pedido, users: CreatedUser[]): string {
  if (pedido.usuario?.nombre) {
    return pedido.usuario.nombre
  }

  if (pedido.usuarioId) {
    const matched = users.find((user) => user.id === pedido.usuarioId)
    if (matched) {
      return getUserDisplayName(matched)
    }

    return `Usuario #${pedido.usuarioId}`
  }

  return 'Sin usuario'
}

function getStatusTone(status: string): 'default' | 'warning' | 'success' | 'error' | 'info' {
  const normalized = status.trim().toUpperCase()

  if (normalized === 'BORRADOR') return 'default'
  if (normalized === 'EN_PREPARACION') return 'warning'
  if (normalized === 'LISTO') return 'info'
  if (normalized === 'FACTURADO') return 'success'
  if (normalized === 'CANCELADO') return 'error'

  return 'default'
}

function canDeletePedido(estado: string): boolean {
  const normalized = estado.trim().toUpperCase()
  return normalized === 'BORRADOR' || normalized === 'CANCELADO'
}

export default function PedidosPage() {
  const { user } = useAuth()
  const location = useLocation()
  const currentRole = normalizeRole(user)
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [users, setUsers] = useState<CreatedUser[]>(
    user
      ? [
          {
            id: user.id,
            nombre: user.nombre,
            email: user.email,
            rol: user.rol,
          },
        ]
      : [],
  )
  const [paymentMethods, setPaymentMethods] = useState<MetodoPago[]>(FALLBACK_PAYMENT_METHODS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterForm, setFilterForm] = useState<PedidoFilterState>(initialFilterState)
  const [pedidoForm, setPedidoForm] = useState<PedidoFormState>(initialPedidoForm)
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(initialPaymentForm)
  const [pedidoDialogMode, setPedidoDialogMode] = useState<'create' | 'edit' | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null)
  const [currentDetails, setCurrentDetails] = useState<PedidoDetalle[]>([])
  const [currentPayments, setCurrentPayments] = useState<PagoPedido[]>([])
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [editingDetailId, setEditingDetailId] = useState<number | null>(null)
  const [detailForm, setDetailForm] = useState({
    productoId: '',
    cantidad: '1',
    precioUnitario: '',
    observacion: '',
  })
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [editingPaymentId, setEditingPaymentId] = useState<number | null>(null)

  const mesaSelection = useMemo(() => {
    const state = location.state as { mesaId?: number; mesaNumero?: number } | null
    return state?.mesaId ? { mesaId: state.mesaId, mesaNumero: state.mesaNumero } : null
  }, [location.state])

  useEffect(() => {
    if (user?.id) {
      setPedidoForm((current) =>
        current.usuarioId ? current : { ...current, usuarioId: String(user.id) },
      )
    }
  }, [user])

  useEffect(() => {
    void loadInitialData()
  }, [])

  useEffect(() => {
    if (!mesaSelection) {
      return
    }

    setPedidoDialogMode('create')
    setPedidoForm((current) => ({
      ...initialPedidoForm,
      usuarioId: current.usuarioId || (user ? String(user.id) : ''),
      mesaId: String(mesaSelection.mesaId),
      tipo: 'MESA',
    }))
  }, [mesaSelection, user])

  async function loadInitialData() {
    setLoading(true)
    setError(null)

    try {
      const requestList = [pedidosService.getAll(), mesasService.getAll(), menuService.getProducts(), pedidosService.getPaymentMethods()]

      if (currentRole === 'ADMIN') {
        requestList.splice(3, 0, usuariosService.listUsers())
      }

      const responses = await Promise.all(requestList)
      const [pedidosResponse, mesasResponse, productsResponse] = responses
      const usersResponse = currentRole === 'ADMIN' ? responses[3] : null
      const paymentMethodsResponse = currentRole === 'ADMIN' ? responses[4] : responses[3]

      setPedidos(unwrapArrayPayload<Pedido>(pedidosResponse.data))
      setMesas(unwrapArrayPayload<Mesa>(mesasResponse.data))
      setProducts(unwrapArrayPayload<Product>(productsResponse.data))
      if (usersResponse) {
        setUsers(unwrapArrayPayload<CreatedUser>(usersResponse.data))
      } else if (user) {
        setUsers([
          {
            id: user.id,
            nombre: user.nombre,
            email: user.email,
            rol: user.rol,
          },
        ])
      }

      const methods = unwrapArrayPayload<MetodoPago>(paymentMethodsResponse.data)
      setPaymentMethods(methods.length > 0 ? methods : FALLBACK_PAYMENT_METHODS)
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      const fallbackMessage = backendMessage || 'No fue posible cargar los pedidos.'
      setError(fallbackMessage)
      toast.error(fallbackMessage)
    } finally {
      setLoading(false)
    }
  }

  async function loadPedidos(filters?: PedidoFilterState) {
    setLoading(true)
    setError(null)

    try {
      const activeFilters = filters ?? filterForm
      const query: PedidoListQuery = {}

      if (activeFilters.estado) query.estado = activeFilters.estado
      if (activeFilters.tipo) query.tipo = activeFilters.tipo
      if (activeFilters.mesaId) query.mesaId = Number(activeFilters.mesaId)
      if (activeFilters.usuarioId) query.usuarioId = Number(activeFilters.usuarioId)
      if (activeFilters.fechaDesde) query.fechaDesde = activeFilters.fechaDesde
      if (activeFilters.fechaHasta) query.fechaHasta = activeFilters.fechaHasta

      const response = await pedidosService.getAll(query)
      setPedidos(unwrapArrayPayload<Pedido>(response.data))
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      const fallbackMessage = backendMessage || 'No fue posible cargar los pedidos.'
      setError(fallbackMessage)
      toast.error(fallbackMessage)
    } finally {
      setLoading(false)
    }
  }

  const activeMesas = useMemo(() => mesas.filter((mesa) => mesa.activa), [mesas])

  const summary = useMemo(() => {
    const totalPedidos = pedidos.length
    const borradores = pedidos.filter((pedido) => String(pedido.estado).toUpperCase() === 'BORRADOR').length
    const facturados = pedidos.filter((pedido) => String(pedido.estado).toUpperCase() === 'FACTURADO').length
    const conMesa = pedidos.filter((pedido) => String(pedido.tipo).toUpperCase() === 'MESA').length

    return { totalPedidos, borradores, facturados, conMesa }
  }, [pedidos])

  const sortedPedidos = useMemo(() => {
    return [...pedidos].sort((left, right) => {
      const rightDate = right.createdAt ? new Date(right.createdAt).getTime() : 0
      const leftDate = left.createdAt ? new Date(left.createdAt).getTime() : 0
      return rightDate - leftDate
    })
  }, [pedidos])

  function resetPedidoForm() {
    setPedidoForm(initialPedidoForm)
  }

  function openCreateDialog() {
    setPedidoDialogMode('create')
    setSelectedPedido(null)
    resetPedidoForm()
  }

  function openEditDialog(pedido: Pedido) {
    setPedidoDialogMode('edit')
    setSelectedPedido(pedido)
    setPedidoForm({
      codigo: pedido.codigo ?? '',
      mesaId: pedido.mesaId ? String(pedido.mesaId) : '',
      usuarioId: pedido.usuarioId ? String(pedido.usuarioId) : '',
      tipo: String(pedido.tipo).toUpperCase() === 'LLEVAR' ? 'LLEVAR' : 'MESA',
      estado: normalizeOrderState(String(pedido.estado)),
      impuesto: String(pedido.impuesto ?? 0),
      detalles: initialPedidoForm.detalles,
    })
  }

  function closePedidoDialog() {
    setPedidoDialogMode(null)
  }

  function normalizeOrderState(value: string): EstadoPedido {
    const upper = value.trim().toUpperCase()
    return ORDER_STATES.includes(upper as EstadoPedido) ? (upper as EstadoPedido) : 'BORRADOR'
  }

  function normalizeOrderType(value: string): TipoPedido {
    const upper = value.trim().toUpperCase()
    return ORDER_TYPES.includes(upper as TipoPedido) ? (upper as TipoPedido) : 'MESA'
  }

  function addPedidoLine() {
    setPedidoForm((current) => ({
      ...current,
      detalles: [
        ...current.detalles,
        { productoId: '', cantidad: '1', precioUnitario: '', observacion: '' },
      ],
    }))
  }

  function updatePedidoLine(index: number, nextValue: Partial<PedidoLineFormState>) {
    setPedidoForm((current) => ({
      ...current,
      detalles: current.detalles.map((line, lineIndex) => (lineIndex === index ? { ...line, ...nextValue } : line)),
    }))
  }

  function removePedidoLine(index: number) {
    setPedidoForm((current) => ({
      ...current,
      detalles: current.detalles.filter((_, lineIndex) => lineIndex !== index),
    }))
  }

  async function handleSavePedido() {
    const validation = pedidoSchema.safeParse({
      codigo: pedidoForm.codigo.trim() || undefined,
      mesaId: pedidoForm.tipo === 'MESA' ? pedidoForm.mesaId : undefined,
      usuarioId: pedidoForm.usuarioId,
      tipo: pedidoForm.tipo,
      estado: pedidoForm.estado,
      impuesto: pedidoForm.impuesto,
      detalles: pedidoForm.detalles.map((line) => ({
        productoId: line.productoId,
        cantidad: line.cantidad,
        precioUnitario: line.precioUnitario,
        observacion: line.observacion.trim() || undefined,
      })),
    })

    if (!validation.success) {
      const firstIssue = validation.error.issues[0]
      toast.error(firstIssue?.message ?? 'Revisa los datos del pedido.')
      return
    }

    const payload: CreatePedidoDto = {
      codigo: validation.data.codigo,
      mesaId: validation.data.mesaId,
      usuarioId: validation.data.usuarioId,
      tipo: validation.data.tipo,
      estado: validation.data.estado,
      impuesto: validation.data.impuesto,
      detalles: validation.data.detalles,
    }

    setSaving(true)

    try {
      if (pedidoDialogMode === 'edit' && selectedPedido) {
        await pedidosService.update(selectedPedido.id, payload)
        toast.success('Pedido actualizado.')
      } else {
        await pedidosService.create(payload)
        toast.success('Pedido creado.')
      }

      closePedidoDialog()
      await loadPedidos()
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      toast.error(backendMessage || 'No fue posible guardar el pedido.')
    } finally {
      setSaving(false)
    }
  }

  async function openDetailsDialog(pedido: Pedido) {
    setSelectedPedido(pedido)
    setDetailsOpen(true)
    setLoadingDetails(true)

    try {
      const [pedidoResponse, detailsResponse, paymentsResponse] = await Promise.all([
        pedidosService.getById(pedido.id),
        pedidosService.getDetails(pedido.id),
        pedidosService.getPayments(pedido.id),
      ])

      setSelectedPedido(pedidoResponse.data)
      setCurrentDetails(unwrapArrayPayload<PedidoDetalle>(detailsResponse.data))
      setCurrentPayments(unwrapArrayPayload<PagoPedido>(paymentsResponse.data))
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      toast.error(backendMessage || 'No fue posible cargar el detalle del pedido.')
    } finally {
      setLoadingDetails(false)
    }
  }

  function closeDetailsDialog() {
    setDetailsOpen(false)
    setSelectedPedido(null)
    setCurrentDetails([])
    setCurrentPayments([])
  }

  function openCreateDetailDialog() {
    setEditingDetailId(null)
    setDetailForm({ productoId: '', cantidad: '1', precioUnitario: '', observacion: '' })
    setDetailDialogOpen(true)
  }

  function openEditDetailDialog(detail: PedidoDetalle) {
    setEditingDetailId(detail.id)
    setDetailForm({
      productoId: String(detail.productoId),
      cantidad: String(detail.cantidad),
      precioUnitario: String(detail.precioUnitario),
      observacion: detail.observacion ?? '',
    })
    setDetailDialogOpen(true)
  }

  async function handleSaveDetail() {
    if (!selectedPedido) {
      return
    }

    const productoId = toPositiveNumber(detailForm.productoId)
    const cantidad = Number(detailForm.cantidad)
    const precioUnitario = Number(detailForm.precioUnitario)

    if (!productoId || !Number.isFinite(cantidad) || cantidad <= 0 || !Number.isFinite(precioUnitario) || precioUnitario < 0) {
      toast.error('Completa una línea válida antes de guardar.')
      return
    }

    setSaving(true)

    try {
      const payload = {
        productoId,
        cantidad,
        precioUnitario,
        observacion: detailForm.observacion.trim() || undefined,
      }

      if (editingDetailId !== null) {
        await pedidosService.updateDetail(selectedPedido.id, editingDetailId, payload)
        toast.success('Línea actualizada.')
      } else {
        await pedidosService.createDetail(selectedPedido.id, payload)
        toast.success('Línea agregada.')
      }

      setDetailDialogOpen(false)
      await openDetailsDialog(selectedPedido)
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      toast.error(backendMessage || 'No fue posible guardar la línea.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteDetail(detail: PedidoDetalle) {
    if (!selectedPedido) {
      return
    }

    setSaving(true)
    try {
      await pedidosService.deleteDetail(selectedPedido.id, detail.id)
      toast.success('Línea eliminada.')
      await openDetailsDialog(selectedPedido)
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      toast.error(backendMessage || 'No fue posible eliminar la línea.')
    } finally {
      setSaving(false)
    }
  }

  function openCreatePaymentDialog() {
    setEditingPaymentId(null)
    setPaymentForm(initialPaymentForm)
    setPaymentDialogOpen(true)
  }

  function openEditPaymentDialog(payment: PagoPedido) {
    setEditingPaymentId(payment.id)
    setPaymentForm({
      metodoPagoId: String(payment.metodoPagoId),
      monto: String(payment.monto),
      referencia: payment.referencia ?? '',
    })
    setPaymentDialogOpen(true)
  }

  async function handleSavePayment() {
    if (!selectedPedido) {
      return
    }

    const metodoPagoId = toPositiveNumber(paymentForm.metodoPagoId)
    const monto = Number(paymentForm.monto)

    if (!metodoPagoId || !Number.isFinite(monto) || monto <= 0) {
      toast.error('Completa un método de pago y un monto válido.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        metodoPagoId,
        monto,
        referencia: paymentForm.referencia.trim() || undefined,
      }

      if (editingPaymentId !== null) {
        await pedidosService.updatePayment(selectedPedido.id, editingPaymentId, payload)
        toast.success('Pago actualizado.')
      } else {
        await pedidosService.createPayment(selectedPedido.id, payload)
        toast.success('Pago registrado.')
      }

      setPaymentDialogOpen(false)
      await openDetailsDialog(selectedPedido)
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      toast.error(backendMessage || 'No fue posible guardar el pago.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeletePayment(payment: PagoPedido) {
    if (!selectedPedido) {
      return
    }

    setSaving(true)
    try {
      await pedidosService.deletePayment(selectedPedido.id, payment.id)
      toast.success('Pago eliminado.')
      await openDetailsDialog(selectedPedido)
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      toast.error(backendMessage || 'No fue posible eliminar el pago.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeletePedido(pedido: Pedido) {
    setSaving(true)
    try {
      await pedidosService.delete(pedido.id)
      toast.success(`Pedido ${pedido.codigo ?? `#${pedido.id}`} eliminado.`)
      await loadPedidos()
      if (selectedPedido?.id === pedido.id) {
        closeDetailsDialog()
      }
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      toast.error(backendMessage || 'No fue posible eliminar el pedido.')
    } finally {
      setSaving(false)
    }
  }

  const detailBalance = useMemo(() => {
    const total = selectedPedido?.total ?? 0
    const paid = selectedPedido?.totalPagado ?? currentPayments.reduce((sum, payment) => sum + payment.monto, 0)
    return Math.max(total - paid, 0)
  }, [selectedPedido, currentPayments])

  return (
    <Box sx={{ color: COLOR_TEXT }}>
      <Paper
        sx={{
          p: { xs: 2.5, md: 3.5 },
          mb: 3,
          borderRadius: 3,
          background:
            'linear-gradient(135deg, rgba(20,12,10,0.95) 0%, rgba(36,18,11,0.9) 100%), radial-gradient(circle at top right, rgba(212,175,55,0.2) 0%, transparent 32%)',
          border: '1px solid rgba(212,175,55,0.4)',
          boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}
        >
          <Box>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1 }}>
              <ReceiptIcon sx={{ color: COLOR_GOLD }} />
              <Typography
                variant="h4"
                sx={{ fontWeight: 800, color: COLOR_GOLD, fontFamily: '"Cormorant Garamond", serif' }}
              >
                Pedidos
              </Typography>
            </Stack>
            <Typography sx={{ color: COLOR_MUTED, maxWidth: 760 }}>
              Gestiona pedidos por mesa o para llevar, controla detalles, pagos y estado operativo en un solo lugar.
            </Typography>
          </Box>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreateDialog}
            sx={{
              alignSelf: { xs: 'stretch', md: 'center' },
              background: `linear-gradient(135deg, ${COLOR_GOLD} 0%, #f2d36f 100%)`,
              color: '#1a1208',
              fontWeight: 700,
              '&:hover': { background: `linear-gradient(135deg, #e5c253 0%, #f7df8d 100%)` },
            }}
          >
            Nuevo pedido
          </Button>
        </Stack>
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
          gap: 2,
          mb: 3,
        }}
      >
        {[
          { label: 'Pedidos', value: summary.totalPedidos },
          { label: 'Borradores', value: summary.borradores },
          { label: 'Facturados', value: summary.facturados },
          { label: 'Pedidos por mesa', value: summary.conMesa },
        ].map((item) => (
          <Card
            key={item.label}
            sx={{
              backgroundColor: 'rgba(10,10,10,0.72)',
              border: '1px solid rgba(212,175,55,0.28)',
              color: COLOR_TEXT,
              boxShadow: '0 10px 28px rgba(0,0,0,0.3)',
            }}
          >
            <CardContent>
              <Typography sx={{ color: COLOR_MUTED, fontSize: '0.9rem' }}>{item.label}</Typography>
              <Typography variant="h5" sx={{ color: COLOR_GOLD, fontWeight: 800, mt: 0.5 }}>
                {item.value}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Paper
        sx={{
          p: 2.5,
          mb: 3,
          borderRadius: 3,
          backgroundColor: 'rgba(10,10,10,0.72)',
          border: '1px solid rgba(212,175,55,0.28)',
        }}
      >
        <Stack spacing={2}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
              gap: 2,
            }}
          >
            <TextField
              select
              fullWidth
              label="Estado"
              value={filterForm.estado}
              onChange={(event) => setFilterForm((current) => ({ ...current, estado: event.target.value }))}
              sx={{
                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
              }}
            >
              <MenuItem value="">Todos</MenuItem>
              {ORDER_STATES.map((state) => (
                <MenuItem key={state} value={state}>
                  {state}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              fullWidth
              label="Tipo"
              value={filterForm.tipo}
              onChange={(event) => setFilterForm((current) => ({ ...current, tipo: event.target.value }))}
              sx={{
                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
              }}
            >
              <MenuItem value="">Todos</MenuItem>
              {ORDER_TYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              fullWidth
              label="Mesa"
              value={filterForm.mesaId}
              onChange={(event) => setFilterForm((current) => ({ ...current, mesaId: event.target.value }))}
              sx={{
                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
              }}
            >
              <MenuItem value="">Todas</MenuItem>
              {mesas.map((mesa) => (
                <MenuItem key={mesa.id} value={mesa.id}>
                  {getMesaDisplayName(mesa)}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
              gap: 2,
            }}
          >
            <TextField
              select
              fullWidth
              label="Usuario"
              value={filterForm.usuarioId}
              onChange={(event) => setFilterForm((current) => ({ ...current, usuarioId: event.target.value }))}
              sx={{
                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
              }}
            >
              <MenuItem value="">Todos</MenuItem>
              {users.map((user) => (
                <MenuItem key={user.id} value={user.id}>
                  {getUserDisplayName(user)}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Desde"
              type="date"
              value={filterForm.fechaDesde}
              onChange={(event) => setFilterForm((current) => ({ ...current, fechaDesde: event.target.value }))}
              sx={{
                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
              }}
            />

            <TextField
              label="Hasta"
              type="date"
              value={filterForm.fechaHasta}
              onChange={(event) => setFilterForm((current) => ({ ...current, fechaHasta: event.target.value }))}
              sx={{
                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
              }}
            />
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              onClick={() => {
                setFilterForm(initialFilterState)
                void loadPedidos(initialFilterState)
              }}
              sx={{ color: COLOR_TEXT, borderColor: 'rgba(212,175,55,0.45)' }}
            >
              Limpiar
            </Button>
            <Button
              variant="contained"
              onClick={() => void loadPedidos(filterForm)}
              sx={{ backgroundColor: COLOR_MAROON, '&:hover': { backgroundColor: '#a42535' } }}
            >
              Filtrar
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {error ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      ) : null}

      <Paper
        sx={{
          overflow: 'hidden',
          borderRadius: 3,
          backgroundColor: 'rgba(10,10,10,0.72)',
          border: '1px solid rgba(212,175,55,0.28)',
          boxShadow: '0 12px 30px rgba(0,0,0,0.32)',
        }}
      >
        {loading ? (
          <Box sx={{ py: 10, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress sx={{ color: COLOR_GOLD }} />
          </Box>
        ) : sortedPedidos.length === 0 ? (
          <Box sx={{ py: 8, px: 3, textAlign: 'center' }}>
            <Typography variant="h6" sx={{ color: COLOR_GOLD, fontWeight: 700, mb: 1 }}>
              No hay pedidos para mostrar
            </Typography>
            <Typography sx={{ color: COLOR_MUTED }}>
              Crea un pedido nuevo o ajusta los filtros para revisar otro rango.
            </Typography>
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: COLOR_GOLD, fontWeight: 700 }}>Código</TableCell>
                <TableCell sx={{ color: COLOR_GOLD, fontWeight: 700 }}>Mesa</TableCell>
                <TableCell sx={{ color: COLOR_GOLD, fontWeight: 700 }}>Usuario</TableCell>
                <TableCell sx={{ color: COLOR_GOLD, fontWeight: 700 }}>Tipo</TableCell>
                <TableCell sx={{ color: COLOR_GOLD, fontWeight: 700 }}>Estado</TableCell>
                <TableCell sx={{ color: COLOR_GOLD, fontWeight: 700 }}>Total</TableCell>
                <TableCell sx={{ color: COLOR_GOLD, fontWeight: 700 }}>Saldo</TableCell>
                <TableCell sx={{ color: COLOR_GOLD, fontWeight: 700 }}>Creado</TableCell>
                <TableCell sx={{ color: COLOR_GOLD, fontWeight: 700 }} align="right">
                  Acciones
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedPedidos.map((pedido) => {
                const total = pedido.total ?? 0
                const saldo = pedido.saldoPendiente ?? Math.max(total - (pedido.totalPagado ?? 0), 0)

                return (
                  <TableRow key={pedido.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell sx={{ color: COLOR_TEXT, fontWeight: 700 }}>{pedido.codigo ?? `#${pedido.id}`}</TableCell>
                    <TableCell sx={{ color: COLOR_TEXT }}>{getPedidoMesaLabel(pedido)}</TableCell>
                    <TableCell sx={{ color: COLOR_MUTED }}>{getPedidoUserLabel(pedido, users)}</TableCell>
                    <TableCell sx={{ color: COLOR_MUTED }}>{pedido.tipo}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={String(pedido.estado)}
                        color={getStatusTone(String(pedido.estado))}
                        sx={{ fontWeight: 700 }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: COLOR_TEXT }}>{formatCurrency(total)}</TableCell>
                    <TableCell sx={{ color: saldo > 0 ? '#f7b267' : '#9ae6a0' }}>{formatCurrency(saldo)}</TableCell>
                    <TableCell sx={{ color: COLOR_MUTED }}>{formatDateTime(pedido.createdAt)}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                        <IconButton onClick={() => void openDetailsDialog(pedido)} sx={{ color: COLOR_GOLD }}>
                          <VisibilityIcon />
                        </IconButton>
                        <IconButton onClick={() => openEditDialog(pedido)} sx={{ color: COLOR_GOLD }}>
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          onClick={() => void handleDeletePedido(pedido)}
                          disabled={saving || !canDeletePedido(String(pedido.estado))}
                          sx={{ color: canDeletePedido(String(pedido.estado)) ? '#f39ca8' : 'rgba(243,233,210,0.35)' }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Dialog open={pedidoDialogMode !== null} onClose={closePedidoDialog} fullWidth maxWidth="lg">
        <DialogTitle sx={{ backgroundColor: '#160f0c', color: COLOR_GOLD, fontWeight: 800 }}>
          {pedidoDialogMode === 'edit' ? 'Editar pedido' : 'Nuevo pedido'}
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#160f0c', pt: 3 }}>
          <Stack spacing={3}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                gap: 2,
              }}
            >
              <TextField
                label="Código"
                value={pedidoForm.codigo}
                onChange={(event) => setPedidoForm((current) => ({ ...current, codigo: event.target.value }))}
                fullWidth
                sx={{
                  '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                  '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                }}
              />

              <TextField
                select
                label="Tipo"
                value={pedidoForm.tipo}
                onChange={(event) =>
                  setPedidoForm((current) => ({
                    ...current,
                    tipo: normalizeOrderType(event.target.value),
                    mesaId: event.target.value === 'LLEVAR' ? '' : current.mesaId,
                  }))
                }
                fullWidth
                sx={{
                  '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                  '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                }}
              >
                {ORDER_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Estado"
                value={pedidoForm.estado}
                onChange={(event) =>
                  setPedidoForm((current) => ({ ...current, estado: normalizeOrderState(event.target.value) }))
                }
                fullWidth
                sx={{
                  '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                  '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                }}
              >
                {ORDER_STATES.map((state) => (
                  <MenuItem key={state} value={state}>
                    {state}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Usuario"
                value={pedidoForm.usuarioId}
                onChange={(event) => setPedidoForm((current) => ({ ...current, usuarioId: event.target.value }))}
                fullWidth
                sx={{
                  '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                  '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                }}
              >
                <MenuItem value="">Selecciona un usuario</MenuItem>
                {users.map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    {getUserDisplayName(user)}
                  </MenuItem>
                ))}
              </TextField>

              {pedidoForm.tipo === 'MESA' ? (
                <TextField
                  select
                  label="Mesa"
                  value={pedidoForm.mesaId}
                  onChange={(event) => setPedidoForm((current) => ({ ...current, mesaId: event.target.value }))}
                  fullWidth
                  sx={{
                    '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                    '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                  }}
                >
                  <MenuItem value="">Selecciona una mesa activa</MenuItem>
                  {activeMesas.map((mesa) => (
                    <MenuItem key={mesa.id} value={mesa.id}>
                      {getMesaDisplayName(mesa)}
                    </MenuItem>
                  ))}
                </TextField>
              ) : (
                <TextField
                  label="Mesa"
                  value="Llevar"
                  fullWidth
                  disabled
                  sx={{
                    '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                    '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                  }}
                />
              )}

              <TextField
                label="Impuesto"
                value={pedidoForm.impuesto}
                onChange={(event) => setPedidoForm((current) => ({ ...current, impuesto: event.target.value }))}
                type="number"
                fullWidth
                sx={{
                  '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                  '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                }}
              />
            </Box>

            <Divider sx={{ borderColor: 'rgba(212,175,55,0.18)' }} />

            {pedidoDialogMode === 'create' ? (
              <Stack spacing={2}>
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography sx={{ color: COLOR_GOLD, fontWeight: 700 }}>Detalle inicial</Typography>
                    <Typography sx={{ color: COLOR_MUTED, fontSize: '0.92rem' }}>
                      Agrega las líneas base del pedido antes de enviarlo a cocina.
                    </Typography>
                  </Box>
                  <Button
                    startIcon={<AddIcon />}
                    onClick={addPedidoLine}
                    sx={{ color: COLOR_GOLD, borderColor: 'rgba(212,175,55,0.45)' }}
                    variant="outlined"
                  >
                    Agregar línea
                  </Button>
                </Stack>

                <Stack spacing={2}>
                  {pedidoForm.detalles.map((line, index) => (
                    <Paper
                      key={`${index}-${line.productoId}`}
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(212,175,55,0.16)',
                      }}
                    >
                      <Stack spacing={2}>
                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(0, 1fr))' },
                            gap: 2,
                          }}
                        >
                          {products.length > 0 ? (
                            <TextField
                              select
                              label="Producto"
                              value={line.productoId}
                              onChange={(event) => updatePedidoLine(index, { productoId: event.target.value })}
                              fullWidth
                              sx={{
                                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                                '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                              }}
                            >
                              <MenuItem value="">Selecciona un producto</MenuItem>
                              {products.map((product) => (
                                <MenuItem key={product.id} value={product.id}>
                                  {getProductDisplayName(product)}
                                </MenuItem>
                              ))}
                            </TextField>
                          ) : (
                            <TextField
                              label="Producto ID"
                              value={line.productoId}
                              onChange={(event) => updatePedidoLine(index, { productoId: event.target.value })}
                              type="number"
                              sx={{
                                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                                '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                              }}
                            />
                          )}
                          <TextField
                            label="Cantidad"
                            value={line.cantidad}
                            onChange={(event) => updatePedidoLine(index, { cantidad: event.target.value })}
                            type="number"
                            sx={{
                              '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                              '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                            }}
                          />
                          <TextField
                            label="Precio unitario"
                            value={line.precioUnitario}
                            onChange={(event) => updatePedidoLine(index, { precioUnitario: event.target.value })}
                            type="number"
                            sx={{
                              '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                              '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                            }}
                          />
                          <TextField
                            label="Observación"
                            value={line.observacion}
                            onChange={(event) => updatePedidoLine(index, { observacion: event.target.value })}
                            sx={{
                              '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                              '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                            }}
                          />
                        </Box>
                        <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
                          <Button
                            color="error"
                            onClick={() => removePedidoLine(index)}
                            disabled={pedidoForm.detalles.length === 1}
                          >
                            Quitar línea
                          </Button>
                        </Stack>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              </Stack>
            ) : (
              <Alert severity="info">
                En la edición se ajusta la cabecera del pedido. Las líneas se administran desde el panel de detalle.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#160f0c', p: 2.5 }}>
          <Button onClick={closePedidoDialog} sx={{ color: COLOR_TEXT }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleSavePedido()}
            disabled={saving}
            sx={{ backgroundColor: COLOR_MAROON, '&:hover': { backgroundColor: '#a42535' } }}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={detailsOpen} onClose={closeDetailsDialog} fullWidth maxWidth="lg">
        <DialogTitle sx={{ backgroundColor: '#160f0c', color: COLOR_GOLD, fontWeight: 800 }}>
          Detalle del pedido {selectedPedido ? selectedPedido.codigo ?? `#${selectedPedido.id}` : ''}
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#160f0c', pt: 3 }}>
          {loadingDetails ? (
            <Box sx={{ py: 8, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress sx={{ color: COLOR_GOLD }} />
            </Box>
          ) : selectedPedido ? (
            <Stack spacing={3}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
                  gap: 2,
                }}
              >
                {[
                  { label: 'Código', value: selectedPedido.codigo ?? `#${selectedPedido.id}` },
                  { label: 'Mesa', value: getPedidoMesaLabel(selectedPedido) },
                  { label: 'Total', value: formatCurrency(selectedPedido.total ?? 0) },
                  { label: 'Saldo pendiente', value: formatCurrency(detailBalance) },
                ].map((item) => (
                  <Paper
                    key={item.label}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(212,175,55,0.16)',
                    }}
                  >
                    <Typography sx={{ color: COLOR_MUTED, fontSize: '0.86rem' }}>{item.label}</Typography>
                    <Typography sx={{ color: COLOR_TEXT, fontWeight: 700, mt: 0.4 }}>{item.value}</Typography>
                  </Paper>
                ))}
              </Box>

              <Paper
                sx={{
                  p: 2,
                  borderRadius: 2,
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(212,175,55,0.16)',
                }}
              >
                <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography sx={{ color: COLOR_GOLD, fontWeight: 700 }}>Detalle del pedido</Typography>
                  <Button startIcon={<AddIcon />} variant="outlined" onClick={openCreateDetailDialog} sx={{ color: COLOR_GOLD }}>
                    Agregar línea
                  </Button>
                </Stack>

                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: COLOR_GOLD }}>Producto</TableCell>
                      <TableCell sx={{ color: COLOR_GOLD }}>Cantidad</TableCell>
                      <TableCell sx={{ color: COLOR_GOLD }}>Precio</TableCell>
                      <TableCell sx={{ color: COLOR_GOLD }}>Subtotal</TableCell>
                      <TableCell sx={{ color: COLOR_GOLD }}>Observación</TableCell>
                      <TableCell sx={{ color: COLOR_GOLD }} align="right">
                        Acciones
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {currentDetails.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} sx={{ color: COLOR_MUTED }}>
                          No hay líneas registradas.
                        </TableCell>
                      </TableRow>
                    ) : (
                      currentDetails.map((detail) => (
                        <TableRow key={detail.id}>
                          <TableCell sx={{ color: COLOR_TEXT }}>
                            {detail.producto?.nombre ? detail.producto.nombre : `Producto #${detail.productoId}`}
                          </TableCell>
                          <TableCell sx={{ color: COLOR_TEXT }}>{detail.cantidad}</TableCell>
                          <TableCell sx={{ color: COLOR_TEXT }}>{formatCurrency(detail.precioUnitario)}</TableCell>
                          <TableCell sx={{ color: COLOR_TEXT }}>
                            {formatCurrency(detail.subtotal ?? detail.precioUnitario * detail.cantidad)}
                          </TableCell>
                          <TableCell sx={{ color: COLOR_MUTED }}>{detail.observacion || 'Sin observación'}</TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                              <IconButton onClick={() => openEditDetailDialog(detail)} sx={{ color: COLOR_GOLD }}>
                                <EditIcon />
                              </IconButton>
                              <IconButton onClick={() => void handleDeleteDetail(detail)} sx={{ color: '#f39ca8' }}>
                                <DeleteIcon />
                              </IconButton>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Paper>

              <Paper
                sx={{
                  p: 2,
                  borderRadius: 2,
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(212,175,55,0.16)',
                }}
              >
                <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography sx={{ color: COLOR_GOLD, fontWeight: 700 }}>Pagos</Typography>
                  <Button startIcon={<AttachMoneyIcon />} variant="outlined" onClick={openCreatePaymentDialog} sx={{ color: COLOR_GOLD }}>
                    Registrar pago
                  </Button>
                </Stack>

                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: COLOR_GOLD }}>Método</TableCell>
                      <TableCell sx={{ color: COLOR_GOLD }}>Monto</TableCell>
                      <TableCell sx={{ color: COLOR_GOLD }}>Referencia</TableCell>
                      <TableCell sx={{ color: COLOR_GOLD }} align="right">
                        Acciones
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {currentPayments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} sx={{ color: COLOR_MUTED }}>
                          No hay pagos registrados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      currentPayments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell sx={{ color: COLOR_TEXT }}>
                            {payment.metodoPago?.nombre ?? `Método #${payment.metodoPagoId}`}
                          </TableCell>
                          <TableCell sx={{ color: COLOR_TEXT }}>{formatCurrency(payment.monto)}</TableCell>
                          <TableCell sx={{ color: COLOR_MUTED }}>{payment.referencia || 'Sin referencia'}</TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                              <IconButton onClick={() => openEditPaymentDialog(payment)} sx={{ color: COLOR_GOLD }}>
                                <EditIcon />
                              </IconButton>
                              <IconButton onClick={() => void handleDeletePayment(payment)} sx={{ color: '#f39ca8' }}>
                                <DeleteIcon />
                              </IconButton>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Paper>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#160f0c', p: 2.5 }}>
          <Button onClick={closeDetailsDialog} sx={{ color: COLOR_TEXT }}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={detailDialogOpen} onClose={() => setDetailDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ backgroundColor: '#160f0c', color: COLOR_GOLD, fontWeight: 800 }}>
          {editingDetailId !== null ? 'Editar línea' : 'Nueva línea'}
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#160f0c', pt: 3 }}>
          <Stack spacing={2}>
            {products.length > 0 ? (
              <TextField
                select
                label="Producto"
                value={detailForm.productoId}
                onChange={(event) => setDetailForm((current) => ({ ...current, productoId: event.target.value }))}
                fullWidth
                sx={{
                  '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                  '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                }}
              >
                <MenuItem value="">Selecciona un producto</MenuItem>
                {products.map((product) => (
                  <MenuItem key={product.id} value={product.id}>
                    {getProductDisplayName(product)}
                  </MenuItem>
                ))}
              </TextField>
            ) : (
              <TextField
                label="Producto ID"
                value={detailForm.productoId}
                onChange={(event) => setDetailForm((current) => ({ ...current, productoId: event.target.value }))}
                type="number"
                fullWidth
                sx={{
                  '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                  '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                }}
              />
            )}
            <TextField
              label="Cantidad"
              value={detailForm.cantidad}
              onChange={(event) => setDetailForm((current) => ({ ...current, cantidad: event.target.value }))}
              type="number"
              fullWidth
              sx={{
                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
              }}
            />
            <TextField
              label="Precio unitario"
              value={detailForm.precioUnitario}
              onChange={(event) => setDetailForm((current) => ({ ...current, precioUnitario: event.target.value }))}
              type="number"
              fullWidth
              sx={{
                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
              }}
            />
            <TextField
              label="Observación"
              value={detailForm.observacion}
              onChange={(event) => setDetailForm((current) => ({ ...current, observacion: event.target.value }))}
              fullWidth
              multiline
              minRows={3}
              sx={{
                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#160f0c', p: 2.5 }}>
          <Button onClick={() => setDetailDialogOpen(false)} sx={{ color: COLOR_TEXT }}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={() => void handleSaveDetail()} disabled={saving} sx={{ backgroundColor: COLOR_MAROON }}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={paymentDialogOpen} onClose={() => setPaymentDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ backgroundColor: '#160f0c', color: COLOR_GOLD, fontWeight: 800 }}>
          {editingPaymentId !== null ? 'Editar pago' : 'Registrar pago'}
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#160f0c', pt: 3 }}>
          <Stack spacing={2}>
            <TextField
              select
              label="Método de pago"
              value={paymentForm.metodoPagoId}
              onChange={(event) => setPaymentForm((current) => ({ ...current, metodoPagoId: event.target.value }))}
              fullWidth
              sx={{
                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
              }}
            >
              <MenuItem value="">Selecciona un método</MenuItem>
              {paymentMethods.map((method) => (
                <MenuItem key={method.id} value={method.id}>
                  {method.nombre}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Monto"
              value={paymentForm.monto}
              onChange={(event) => setPaymentForm((current) => ({ ...current, monto: event.target.value }))}
              type="number"
              fullWidth
              sx={{
                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
              }}
            />
            <TextField
              label="Referencia"
              value={paymentForm.referencia}
              onChange={(event) => setPaymentForm((current) => ({ ...current, referencia: event.target.value }))}
              fullWidth
              sx={{
                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#160f0c', p: 2.5 }}>
          <Button onClick={() => setPaymentDialogOpen(false)} sx={{ color: COLOR_TEXT }}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={() => void handleSavePayment()} disabled={saving} sx={{ backgroundColor: COLOR_MAROON }}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
