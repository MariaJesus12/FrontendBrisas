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
  Drawer,
  IconButton,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import RestaurantIcon from '@mui/icons-material/Restaurant'
import EventSeatIcon from '@mui/icons-material/EventSeat'
import { toast } from 'react-toastify'
import { useAuth } from '@/hooks/useAuth'
import FacturacionModal from '@/components/facturacion/FacturacionModal'
import { menuService } from '@/services/menu.service'
import type { SendToKitchenPayload } from '@/services/pedidos.service'
import { pedidosService } from '@/services/pedidos.service'
import { reservacionesService } from '@/services/reservaciones.service'
import { mesaSchema } from '@/schemas/mesa.schema'
import { mesasService } from '@/services/mesas.service'
import { pedidoSchema } from '@/schemas/pedido.schema'
import type { Mesa } from '@/types/mesa.types'
import type { Product } from '@/types/menu.types'
import type { CreatePedidoDto, Pedido, PedidoDetalle, UpdatePedidoDto } from '@/types/pedido.types'
import { openKitchenPrintPreview } from '@/utils/kitchenPrint'
import { normalizeRole } from '@/utils/roles'

const COLOR_GOLD = '#D4AF37'
const COLOR_TEXT = '#F3E9D2'
const COLOR_MAROON = '#8F1D2E'
const COLOR_MUTED = 'rgba(243,233,210,0.7)'

interface MesaFormState {
  numero: string
  capacidad: string
  observacion: string
  activa: string
}

interface PedidoMesaLineaForm {
  codigoProducto: string
  productoId: string
  productoNombre: string
  cantidad: string
  precioUnitario: string
  observacion: string
}

interface PedidoMesaFormState {
  codigo: string
  tipo: 'MESA'
  estado: 'BORRADOR'
  mesaId: string
  usuarioId: string
  impuesto: string
  lineas: PedidoMesaLineaForm[]
}

const initialForm: MesaFormState = {
  numero: '',
  capacidad: '',
  observacion: '',
  activa: 'true',
}

const initialPedidoForm: PedidoMesaFormState = {
  codigo: '',
  tipo: 'MESA',
  estado: 'BORRADOR',
  mesaId: '',
  usuarioId: '',
  impuesto: '0',
  lineas: [
    {
      codigoProducto: '',
      productoId: '',
      productoNombre: '',
      cantidad: '1',
      precioUnitario: '',
      observacion: '',
    },
  ],
}

const OPEN_ORDER_STATES = ['BORRADOR', 'EN_PREPARACION', 'COCINA', 'LISTO']

function normalizePedidoEstado(value: unknown): string {
  return String(value ?? '').trim().toUpperCase()
}

function toPositiveInt(value: unknown): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return null
  }

  const normalized = Math.trunc(parsed)
  return normalized > 0 ? normalized : null
}

function pickPositiveInt(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const candidate = toPositiveInt(record[key])
    if (candidate) {
      return candidate
    }
  }

  return null
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

const RESERVA_ESTADOS_OCUPADA = new Set(['PENDIENTE', 'CONFIRMADA', 'CONFIRMADO'])
const RESERVA_ESTADOS_LIBRE = new Set(['ATENDIDA', 'CANCELADA'])

function normalizeReservaEstado(value: unknown): string {
  return String(value ?? '').trim().toUpperCase()
}

function normalizeReservaBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value
  }

  const normalized = String(value ?? '').trim().toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'si' || normalized === 'yes'
}

function resolveMesaReservadaByEstado(estado: unknown): boolean | null {
  const normalized = normalizeReservaEstado(estado)
  if (!normalized) {
    return null
  }

  if (RESERVA_ESTADOS_OCUPADA.has(normalized)) {
    return true
  }

  if (RESERVA_ESTADOS_LIBRE.has(normalized)) {
    return false
  }

  return null
}

function unwrapReservaArrayPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload
  }

  if (typeof payload !== 'object' || payload === null) {
    return []
  }

  const record = payload as Record<string, unknown>
  const keys = ['data', 'items', 'results', 'mesas', 'mesasEstado', 'estadoMesas', 'tables', 'content']

  for (const key of keys) {
    const value = record[key]
    if (Array.isArray(value)) {
      return value
    }
  }

  return []
}

function extractReservadaMesaIds(payload: unknown): Set<number> {
  const ids = new Set<number>()

  for (const item of unwrapReservaArrayPayload(payload)) {
    if (typeof item !== 'object' || item === null) {
      continue
    }

    const record = item as Record<string, unknown>
    const mesaRaw =
      typeof record.mesa === 'object' && record.mesa !== null ? (record.mesa as Record<string, unknown>) : null

    const mesaId = Number(
      record.mesaId ?? record.mesa_id ?? record.idMesa ?? record.id ?? record.tableId ?? mesaRaw?.id ?? 0,
    )
    if (!Number.isFinite(mesaId) || mesaId <= 0) {
      continue
    }

    const estadoValue =
      record.reservaEstado ??
      record.estadoReserva ??
      record.estado ??
      record.status

    const reservadaByEstado = resolveMesaReservadaByEstado(estadoValue)
    const reservadaByFlag =
      normalizeReservaBoolean(
        record.reservada ?? record.reserved ?? record.ocupada ?? record.estaReservada ?? record.disponible === false,
      ) || Number(record.reservaId ?? record.reserva_id ?? 0) > 0

    if ((reservadaByEstado ?? reservadaByFlag) === true) {
      ids.add(mesaId)
    }
  }

  return ids
}

function normalizeMesaRecord(item: unknown): Mesa {
  if (typeof item !== 'object' || item === null) {
    return { id: 0, numero: 0, capacidad: 0, activa: false }
  }

  const record = item as Record<string, unknown>
  const rawActiva = record.activa ?? record.active ?? record.estado ?? record.status
  const activa =
    typeof rawActiva === 'boolean'
      ? rawActiva
      : String(rawActiva ?? '').trim().toLowerCase() === 'true' ||
        String(rawActiva ?? '').trim() === '1' ||
        String(rawActiva ?? '').trim().toLowerCase() === 'activa' ||
        String(rawActiva ?? '').trim().toLowerCase() === 'active'

  return {
    id: Number(record.id ?? record.mesaId ?? record.mesa_id ?? 0),
    numero: Number(record.numero ?? record.number ?? record.nro ?? 0),
    capacidad: Number(record.capacidad ?? record.capacity ?? record.asientos ?? 0),
    observacion:
      typeof record.observacion === 'string'
        ? record.observacion
        : typeof record.observation === 'string'
          ? record.observation
          : undefined,
    activa,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : undefined,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
  }
}

function normalizePedidoRecord(item: unknown): Pedido {
  if (typeof item !== 'object' || item === null) {
    return { id: 0, tipo: 'MESA', estado: 'BORRADOR' }
  }

  const record = item as Record<string, unknown>
  const mesaRaw = typeof record.mesa === 'object' && record.mesa !== null ? (record.mesa as Record<string, unknown>) : null
  const usuarioRaw =
    typeof record.usuario === 'object' && record.usuario !== null
      ? (record.usuario as Record<string, unknown>)
      : null
  const pedidoRaw = typeof record.pedido === 'object' && record.pedido !== null ? (record.pedido as Record<string, unknown>) : null

  const pedidoId =
    pickPositiveInt(record, ['id', 'pedidoId', 'pedido_id', 'idPedido', 'orderId', 'order_id']) ??
    (pedidoRaw ? pickPositiveInt(pedidoRaw, ['id', 'pedidoId', 'pedido_id', 'idPedido']) : null) ??
    0

  const mesaId =
    pickPositiveInt(record, ['mesaId', 'mesa_id', 'idMesa']) ??
    (mesaRaw ? pickPositiveInt(mesaRaw, ['id', 'mesaId', 'mesa_id']) : null) ??
    undefined

  const usuarioId =
    pickPositiveInt(record, ['usuarioId', 'usuario_id', 'idUsuario']) ??
    (usuarioRaw ? pickPositiveInt(usuarioRaw, ['id', 'usuarioId', 'usuario_id']) : null) ??
    undefined

  return {
    id: pedidoId,
    codigo:
      typeof record.codigo === 'string'
        ? record.codigo
        : typeof record.code === 'string'
          ? record.code
          : undefined,
    mesaId,
    mesa: mesaRaw
      ? {
          id: Number(mesaRaw.id ?? mesaRaw.mesaId ?? mesaRaw.mesa_id ?? 0) || undefined,
          numero: Number(mesaRaw.numero ?? mesaRaw.number ?? 0) || undefined,
          capacidad: Number(mesaRaw.capacidad ?? mesaRaw.capacity ?? 0) || undefined,
          activa:
            typeof mesaRaw.activa === 'boolean'
              ? mesaRaw.activa
              : typeof mesaRaw.active === 'boolean'
                ? mesaRaw.active
                : undefined,
        }
      : undefined,
    usuarioId,
    usuario: usuarioRaw
      ? {
          id: Number(usuarioRaw.id ?? usuarioRaw.usuarioId ?? usuarioRaw.usuario_id ?? 0) || undefined,
          nombre:
            typeof usuarioRaw.nombre === 'string'
              ? usuarioRaw.nombre
              : typeof usuarioRaw.name === 'string'
                ? usuarioRaw.name
                : undefined,
          usuario:
            typeof usuarioRaw.usuario === 'string'
              ? usuarioRaw.usuario
              : typeof usuarioRaw.username === 'string'
                ? usuarioRaw.username
                : undefined,
          email: typeof usuarioRaw.email === 'string' ? usuarioRaw.email : undefined,
        }
      : undefined,
    tipo:
      typeof record.tipo === 'string'
        ? record.tipo
        : typeof record.type === 'string'
          ? record.type
          : 'MESA',
    estado:
      typeof record.estado === 'string'
        ? record.estado
        : typeof record.status === 'string'
          ? record.status
          : 'BORRADOR',
    impuesto: Number(record.impuesto ?? record.tax ?? 0) || 0,
    total: Number(record.total ?? record.montoTotal ?? record.monto_total ?? 0) || 0,
    totalPagado: Number(record.totalPagado ?? record.total_pagado ?? record.pagado ?? 0) || 0,
    saldoPendiente: Number(record.saldoPendiente ?? record.saldo_pendiente ?? record.saldo ?? 0) || 0,
    detalles: Array.isArray(record.detalles) ? (record.detalles as PedidoDetalle[]) : undefined,
    createdAt:
      typeof record.createdAt === 'string'
        ? record.createdAt
        : typeof record.created_at === 'string'
          ? record.created_at
          : typeof record.fechaCreacion === 'string'
            ? record.fechaCreacion
            : undefined,
    updatedAt:
      typeof record.updatedAt === 'string'
        ? record.updatedAt
        : typeof record.updated_at === 'string'
          ? record.updated_at
          : typeof record.fechaActualizacion === 'string'
            ? record.fechaActualizacion
            : undefined,
  }
}

function normalizePedidoDetailRecord(item: unknown): PedidoDetalle {
  if (typeof item !== 'object' || item === null) {
    return {
      id: 0,
      productoId: 0,
      cantidad: 0,
      precioUnitario: 0,
    }
  }

  const record = item as Record<string, unknown>
  const productoRaw =
    typeof record.producto === 'object' && record.producto !== null
      ? (record.producto as Record<string, unknown>)
      : null

  return {
    id: Number(record.id ?? record.detalleId ?? record.detalle_id ?? 0),
    productoId: Number(record.productoId ?? record.producto_id ?? record.productId ?? productoRaw?.id ?? 0),
    producto: productoRaw
      ? {
          id: Number(productoRaw.id ?? productoRaw.productoId ?? productoRaw.producto_id ?? 0) || undefined,
          nombre:
            typeof productoRaw.nombre === 'string'
              ? productoRaw.nombre
              : typeof productoRaw.name === 'string'
                ? productoRaw.name
                : undefined,
          precio: Number(productoRaw.precio ?? productoRaw.price ?? 0) || undefined,
        }
      : undefined,
    cantidad: Number(record.cantidad ?? record.qty ?? 0),
    precioUnitario: Number(record.precioUnitario ?? record.precio_unitario ?? record.price ?? 0),
    observacion:
      typeof record.observacion === 'string'
        ? record.observacion
        : typeof record.note === 'string'
          ? record.note
          : undefined,
    subtotal: Number(record.subtotal ?? record.lineTotal ?? record.line_total ?? 0) || undefined,
  }
}

function extractArrayFromPayload(payload: unknown, keys: string[]): unknown[] {
  if (Array.isArray(payload)) {
    return payload
  }

  if (typeof payload !== 'object' || payload === null) {
    return []
  }

  const record = payload as Record<string, unknown>

  for (const key of keys) {
    const value = record[key]
    if (Array.isArray(value)) {
      return value
    }
    if (typeof value === 'object' && value !== null) {
      for (const nestedKey of keys) {
        const nestedValue = (value as Record<string, unknown>)[nestedKey]
        if (Array.isArray(nestedValue)) {
          return nestedValue
        }
      }
    }
  }

  for (const value of Object.values(record)) {
    if (Array.isArray(value)) {
      return value
    }
  }

  return []
}

function unwrapMesasPayload(payload: unknown): Mesa[] {
  if (Array.isArray(payload)) {
    return payload.map((item) => normalizeMesaRecord(item))
  }

  if (typeof payload === 'object' && payload !== null) {
    const record = payload as Record<string, unknown>
    const keys = ['data', 'items', 'mesas', 'results']

    for (const key of keys) {
      const value = record[key]
      if (Array.isArray(value)) {
        return value.map((item) => normalizeMesaRecord(item))
      }
    }
  }

  return []
}

function normalizeProductRecord(item: unknown): Product | null {
  if (typeof item !== 'object' || item === null) {
    return null
  }

  const record = item as Record<string, unknown>
  const id = Number(record.id ?? record.productId ?? record.product_id ?? 0)
  if (!Number.isFinite(id) || id <= 0) {
    return null
  }

  const precio = Number(record.precio ?? record.price ?? 0)
  const codigoValue = record.codigo ?? record.code ?? record.sku

  return {
    id,
    codigo: typeof codigoValue === 'string' ? codigoValue : codigoValue != null ? String(codigoValue) : undefined,
    nombre:
      typeof record.nombre === 'string'
        ? record.nombre
        : typeof record.name === 'string'
          ? record.name
          : `Producto ${id}`,
    descripcion:
      typeof record.descripcion === 'string'
        ? record.descripcion
        : typeof record.description === 'string'
          ? record.description
          : '',
    precio: Number.isFinite(precio) ? precio : 0,
    imagen:
      typeof record.imagen === 'string'
        ? record.imagen
        : typeof record.image === 'string'
          ? record.image
          : undefined,
    categoryId: Number(record.categoryId ?? record.category_id ?? record.categoriaId ?? record.categoria_id ?? 0),
    category: undefined,
    disponible:
      typeof record.disponible === 'boolean'
        ? record.disponible
        : typeof record.available === 'boolean'
          ? record.available
          : true,
  }
}

function unwrapProductsPayload(payload: unknown): Product[] {
  if (Array.isArray(payload)) {
    return payload.map((item) => normalizeProductRecord(item)).filter((item): item is Product => item !== null)
  }

  if (typeof payload === 'object' && payload !== null) {
    const record = payload as Record<string, unknown>
    const keys = ['data', 'items', 'products', 'platos', 'results']

    for (const key of keys) {
      const value = record[key]
      if (Array.isArray(value)) {
        return value.map((item) => normalizeProductRecord(item)).filter((item): item is Product => item !== null)
      }
    }
  }

  return []
}

function formatCapacity(value: number): string {
  return `${value} ${value === 1 ? 'persona' : 'personas'}`
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

function getDrawerActionButtonSx(variant: 'gold' | 'neutral' | 'danger' = 'gold') {
  const palette =
    variant === 'danger'
      ? {
          color: '#f39ca8',
          borderColor: 'rgba(243,156,168,0.35)',
          hoverBg: 'rgba(243,156,168,0.12)',
          disabledColor: 'rgba(243,156,168,0.35)',
          disabledBorder: 'rgba(243,156,168,0.2)',
        }
      : variant === 'neutral'
        ? {
            color: COLOR_TEXT,
            borderColor: 'rgba(243,233,210,0.35)',
            hoverBg: 'rgba(243,233,210,0.1)',
            disabledColor: 'rgba(243,233,210,0.35)',
            disabledBorder: 'rgba(243,233,210,0.2)',
          }
        : {
            color: COLOR_GOLD,
            borderColor: 'rgba(212,175,55,0.35)',
            hoverBg: 'rgba(212,175,55,0.12)',
            disabledColor: 'rgba(212,175,55,0.35)',
            disabledBorder: 'rgba(212,175,55,0.2)',
          }

  return {
    color: palette.color,
    borderColor: palette.borderColor,
    backgroundColor: 'rgba(255,255,255,0.02)',
    fontWeight: 700,
    borderRadius: 2,
    '&:hover': {
      borderColor: palette.color,
      backgroundColor: palette.hoverBg,
    },
    '&.Mui-disabled': {
      color: palette.disabledColor,
      borderColor: palette.disabledBorder,
      backgroundColor: 'rgba(255,255,255,0.015)',
    },
  }
}

function getDrawerIconButtonSx(variant: 'gold' | 'danger' = 'gold') {
  const palette =
    variant === 'danger'
      ? {
          color: '#f39ca8',
          border: 'rgba(243,156,168,0.35)',
          hoverBg: 'rgba(243,156,168,0.12)',
        }
      : {
          color: COLOR_GOLD,
          border: 'rgba(212,175,55,0.35)',
          hoverBg: 'rgba(212,175,55,0.12)',
        }

  return {
    color: palette.color,
    border: `1px solid ${palette.border}`,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.02)',
    '&:hover': {
      backgroundColor: palette.hoverBg,
    },
  }
}

export default function MesasPage() {
  const { user } = useAuth()
  const currentRole = normalizeRole(user)
  const isAdmin = currentRole === 'ADMIN'
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [onlyActive, setOnlyActive] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingMesa, setEditingMesa] = useState<Mesa | null>(null)
  const [form, setForm] = useState<MesaFormState>(initialForm)
  const [orderDrawerOpen, setOrderDrawerOpen] = useState(false)
  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null)
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null)
  const [currentPedidoDetails, setCurrentPedidoDetails] = useState<PedidoDetalle[]>([])
  const [openPedidosByMesa, setOpenPedidosByMesa] = useState<Record<number, Pedido>>({})
  const [reservadasByMesa, setReservadasByMesa] = useState<Record<number, boolean>>({})
  const [pedidoLoading, setPedidoLoading] = useState(false)
  const [pedidoForm, setPedidoForm] = useState<PedidoMesaFormState>(initialPedidoForm)
  const [invoicePreviewOpen, setInvoicePreviewOpen] = useState(false)
  const [invoicePreviewPedido, setInvoicePreviewPedido] = useState<Pedido | null>(null)
  const [invoicePreviewDetails, setInvoicePreviewDetails] = useState<PedidoDetalle[]>([])
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [editingDetail, setEditingDetail] = useState<PedidoDetalle | null>(null)
  const [detailForm, setDetailForm] = useState({
    cantidad: '1',
    precioUnitario: '0',
    observacion: '',
  })

  useEffect(() => {
    if (user?.id) {
      setPedidoForm((current) => ({ ...current, usuarioId: String(user.id) }))
    }
  }, [user])

  useEffect(() => {
    void loadMesas()
  }, [])

  async function loadMesas() {
    setLoading(true)
    setError(null)

    try {
      const [mesasResponse, productsResponse, pedidosResponse, reservasMesasResponse] = await Promise.all([
        mesasService.getAll(),
        menuService.getProducts(),
        pedidosService.getAll({ tipo: 'MESA' }),
        reservacionesService.getMesasEstado({ includeInactive: true }).catch(() => null),
      ])
      setMesas(unwrapMesasPayload(mesasResponse.data))
      setProducts(unwrapProductsPayload(productsResponse.data))
      const pedidos = unwrapPedidosPayload(pedidosResponse.data)
      const openByMesa = pedidos
        .filter((pedido) => {
          const mesaId = Number(pedido.mesaId ?? pedido.mesa?.id ?? 0)
          if (!Number.isFinite(mesaId) || mesaId <= 0) {
            return false
          }

          return OPEN_ORDER_STATES.includes(normalizePedidoEstado(pedido.estado))
        })
        .sort((left, right) => {
          const rightDate = right.createdAt ? new Date(right.createdAt).getTime() : 0
          const leftDate = left.createdAt ? new Date(left.createdAt).getTime() : 0
          return rightDate - leftDate
        })
        .reduce<Record<number, Pedido>>((acc, pedido) => {
          const mesaId = Number(pedido.mesaId ?? pedido.mesa?.id ?? 0)
          if (!acc[mesaId]) {
            acc[mesaId] = pedido
          }
          return acc
        }, {})

      setOpenPedidosByMesa(openByMesa)
      const fromMesasEstado = reservasMesasResponse ? extractReservadaMesaIds(reservasMesasResponse.data) : new Set<number>()
      const reservadasMap: Record<number, boolean> = {}
      for (const mesaId of fromMesasEstado) {
        reservadasMap[mesaId] = true
      }
      setReservadasByMesa(reservadasMap)
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      const fallbackMessage = backendMessage || 'No fue posible cargar las mesas.'
      setError(fallbackMessage)
      toast.error(fallbackMessage)
    } finally {
      setLoading(false)
    }
  }

  const visibleMesas = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return mesas.filter((mesa) => {
      if (onlyActive && !mesa.activa) {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      return [mesa.numero, mesa.capacidad, mesa.observacion ?? '', mesa.id]
        .map((value) => String(value).toLowerCase())
        .some((value) => value.includes(normalizedSearch))
    })
  }, [mesas, onlyActive, search])

  const stats = useMemo(() => {
    const total = mesas.length
    const activas = mesas.filter((mesa) => mesa.activa).length
    const inactivas = total - activas
    const capacidadTotal = mesas.filter((mesa) => mesa.activa).reduce((sum, mesa) => sum + mesa.capacidad, 0)

    return { total, activas, inactivas, capacidadTotal }
  }, [mesas])

  function openCreateDialog() {
    setEditingMesa(null)
    setForm(initialForm)
    setDialogOpen(true)
  }

  function openEditDialog(mesa: Mesa) {
    setEditingMesa(mesa)
    setForm({
      numero: String(mesa.numero),
      capacidad: String(mesa.capacidad),
      observacion: mesa.observacion ?? '',
      activa: mesa.activa ? 'true' : 'false',
    })
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
  }

  async function handleSaveMesa() {
    const validation = mesaSchema.safeParse({
      numero: form.numero,
      capacidad: form.capacidad,
      observacion: form.observacion.trim() || undefined,
      activa: form.activa === 'true',
    })

    if (!validation.success) {
      const firstIssue = validation.error.issues[0]
      toast.error(firstIssue?.message ?? 'Revisa los datos de la mesa.')
      return
    }

    setSaving(true)

    try {
      const payload = {
        numero: validation.data.numero,
        capacidad: validation.data.capacidad,
        observacion: validation.data.observacion,
        activa: validation.data.activa,
      }

      if (editingMesa) {
        await mesasService.update(editingMesa.id, payload)
        toast.success(`Mesa #${payload.numero} actualizada.`)
      } else {
        await mesasService.create(payload)
        toast.success(`Mesa #${payload.numero} creada.`)
      }

      closeDialog()
      await loadMesas()
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      toast.error(backendMessage || 'No fue posible guardar la mesa.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivateMesa(mesa: Mesa) {
    setSaving(true)

    try {
      await mesasService.delete(mesa.id)
      toast.success(`Mesa #${mesa.numero} desactivada.`)
      await loadMesas()
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      toast.error(backendMessage || 'No fue posible desactivar la mesa.')
    } finally {
      setSaving(false)
    }
  }

  function findProductByQuery(rawQuery: string): Product | null {
    const normalized = rawQuery.trim().toUpperCase()
    if (!normalized) {
      return null
    }

    const exactMatch = products.find((product) => String(product.codigo ?? '').trim().toUpperCase() === normalized)
    if (exactMatch) {
      return exactMatch
    }

    const idMatch = products.find((product) => String(product.id) === normalized)
    if (idMatch) {
      return idMatch
    }

    const exactNameMatch = products.find((product) => product.nombre.trim().toUpperCase() === normalized)
    if (exactNameMatch) {
      return exactNameMatch
    }

    const partialMatch = products.find((product) => {
      const code = String(product.codigo ?? '').trim().toUpperCase()
      return code.includes(normalized) || product.nombre.trim().toUpperCase().includes(normalized)
    })

    return partialMatch ?? null
  }

  function setDraftPedidoForMesa(mesa: Mesa, pedido?: Pedido | null) {
    setPedidoForm({
      ...initialPedidoForm,
      mesaId: String(mesa.id),
      usuarioId: pedido?.usuarioId ? String(pedido.usuarioId) : user?.id ? String(user.id) : '',
      impuesto: String(pedido?.impuesto ?? 0),
    })
  }

  function unwrapPedidosPayload(payload: unknown): Pedido[] {
    const rawItems = extractArrayFromPayload(payload, ['data', 'items', 'results', 'pedidos'])
    return rawItems.map((item) => normalizePedidoRecord(item))
  }

  function unwrapPedidoDetailsPayload(payload: unknown): PedidoDetalle[] {
    const rawItems = extractArrayFromPayload(payload, ['data', 'items', 'results', 'details', 'detalles'])
    return rawItems.map((item) => normalizePedidoDetailRecord(item))
  }

  function mergePedidoDetails(base: PedidoDetalle[], fallback: PedidoDetalle[]): PedidoDetalle[] {
    const byKey = new Map<string, PedidoDetalle>()

    for (const detail of [...base, ...fallback]) {
      const key =
        detail.id > 0
          ? `id:${detail.id}`
          : `tmp:${detail.productoId}:${detail.cantidad}:${detail.precioUnitario}:${detail.observacion ?? ''}`

      if (!byKey.has(key)) {
        byKey.set(key, detail)
      }
    }

    return Array.from(byKey.values())
  }

  function isActivePedido(pedido: Pedido): boolean {
    return OPEN_ORDER_STATES.includes(normalizePedidoEstado(pedido.estado))
  }

  async function loadMesaPedido(mesaId: number) {
    setPedidoLoading(true)

    try {
      const response = await pedidosService.getAll({ mesaId, tipo: 'MESA' })
      const pedidos = unwrapPedidosPayload(response.data)
      const pedidoSeleccionado = pedidos
        .filter((pedido) => isActivePedido(pedido) && toPositiveInt(pedido.id) !== null)
        .sort((left, right) => {
          const rightDate = right.createdAt ? new Date(right.createdAt).getTime() : 0
          const leftDate = left.createdAt ? new Date(left.createdAt).getTime() : 0
          return rightDate - leftDate
        })[0]

      if (!pedidoSeleccionado) {
        setSelectedPedido(null)
        setCurrentPedidoDetails([])
        setDraftPedidoForMesa({ id: mesaId, numero: mesaId, capacidad: 0, activa: true })
        return
      }

      const [pedidoByIdResult, detailsResult] = await Promise.allSettled([
        pedidosService.getById(pedidoSeleccionado.id),
        pedidosService.getDetails(pedidoSeleccionado.id),
      ])

      const hydratedPedido =
        pedidoByIdResult.status === 'fulfilled'
          ? normalizePedidoRecord(pedidoByIdResult.value.data)
          : pedidoSeleccionado

      const parsedDetails =
        detailsResult.status === 'fulfilled' ? unwrapPedidoDetailsPayload(detailsResult.value.data) : []

      const fallbackDetails = Array.isArray(hydratedPedido.detalles)
        ? hydratedPedido.detalles.map((item) => normalizePedidoDetailRecord(item))
        : Array.isArray(pedidoSeleccionado.detalles)
          ? pedidoSeleccionado.detalles.map((item) => normalizePedidoDetailRecord(item))
          : []

      setSelectedPedido(hydratedPedido)
      setCurrentPedidoDetails(mergePedidoDetails(parsedDetails, fallbackDetails))
      setDraftPedidoForMesa(
        {
          id: mesaId,
          numero: hydratedPedido.mesa?.numero ?? mesaId,
          capacidad: hydratedPedido.mesa?.capacidad ?? 0,
          observacion: hydratedPedido.mesa?.numero ? `Pedido activo en mesa #${hydratedPedido.mesa.numero}` : undefined,
          activa: true,
        },
        hydratedPedido,
      )
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      toast.error(backendMessage || 'No fue posible cargar el pedido de la mesa.')
      setSelectedPedido(null)
      setCurrentPedidoDetails([])
      setDraftPedidoForMesa({ id: mesaId, numero: mesaId, capacidad: 0, activa: true })
    } finally {
      setPedidoLoading(false)
    }
  }

  function openPedidoDrawer(mesa: Mesa) {
    if (!mesa.activa) {
      return
    }

    setSelectedMesa(mesa)
    setOrderDrawerOpen(true)
    void loadMesaPedido(mesa.id)
  }

  function closePedidoDrawer() {
    setOrderDrawerOpen(false)
    setSelectedMesa(null)
    setSelectedPedido(null)
    setCurrentPedidoDetails([])
    setPedidoForm(initialPedidoForm)
    setInvoicePreviewOpen(false)
    setInvoicePreviewPedido(null)
    setInvoicePreviewDetails([])
    setDetailDialogOpen(false)
    setEditingDetail(null)
  }

  function updatePedidoLine(index: number, nextValue: Partial<PedidoMesaLineaForm>) {
    setPedidoForm((current) => ({
      ...current,
      lineas: current.lineas.map((linea, lineIndex) => (lineIndex === index ? { ...linea, ...nextValue } : linea)),
    }))
  }

  function addPedidoLine() {
    setPedidoForm((current) => ({
      ...current,
      lineas: [
        ...current.lineas,
        {
          codigoProducto: '',
          productoId: '',
          productoNombre: '',
          cantidad: '1',
          precioUnitario: '',
          observacion: '',
        },
      ],
    }))
  }

  function removePedidoLine(index: number) {
    setPedidoForm((current) => ({
      ...current,
      lineas: current.lineas.filter((_, lineIndex) => lineIndex !== index),
    }))
  }

  function applyProductCode(index: number, code: string) {
    const product = findProductByQuery(code)
    if (!product) {
      updatePedidoLine(index, {
        codigoProducto: code,
        productoId: '',
        productoNombre: '',
      })
      return
    }

    updatePedidoLine(index, {
      codigoProducto: code,
      productoId: String(product.id),
      productoNombre: product.nombre,
      precioUnitario: String(product.precio),
    })
  }

  function hasDraftPedidoLineData(): boolean {
    return pedidoForm.lineas.some(
      (linea) =>
        linea.codigoProducto.trim() ||
        linea.productoId.trim() ||
        linea.precioUnitario.trim() ||
        linea.observacion.trim(),
    )
  }

  function resolvePedidoId(detail?: PedidoDetalle): number | null {
    const fromDetail = detail
      ? toPositiveInt((detail as unknown as Record<string, unknown>).pedidoId) ??
        toPositiveInt((detail as unknown as Record<string, unknown>).pedido_id)
      : null

    const fromSelected = toPositiveInt(selectedPedido?.id)
    const fromInvoicePreview = toPositiveInt(invoicePreviewPedido?.id)
    const fromMesaMap = selectedMesa ? toPositiveInt(openPedidosByMesa[selectedMesa.id]?.id) : null

    return fromDetail ?? fromSelected ?? fromInvoicePreview ?? fromMesaMap ?? null
  }

  async function handleSavePedido(): Promise<boolean> {
    const parsedLineas = pedidoForm.lineas.map((linea) => ({
      productoId: Number(linea.productoId),
      cantidad: Number(linea.cantidad),
      precioUnitario: Number(linea.precioUnitario),
      observacion: linea.observacion.trim() || undefined,
    }))

    const validation = pedidoSchema.safeParse({
      codigo: undefined,
      mesaId: pedidoForm.mesaId,
      usuarioId: pedidoForm.usuarioId,
      tipo: pedidoForm.tipo,
      estado: pedidoForm.estado,
      impuesto: pedidoForm.impuesto,
      detalles: parsedLineas,
    })

    if (!validation.success) {
      const firstIssue = validation.error.issues[0]
      toast.error(firstIssue?.message ?? 'Revisa el pedido antes de guardarlo.')
      return false
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
      if (selectedPedido) {
        const pedidoId = resolvePedidoId()
        if (!pedidoId) {
          toast.error('No se encontro un id de pedido valido para actualizar esta mesa.')
          return false
        }

        for (const detalle of validation.data.detalles) {
          await pedidosService.createDetail(pedidoId, detalle)
        }

        if (validation.data.estado !== selectedPedido.estado || validation.data.impuesto !== selectedPedido.impuesto) {
          const updatePayload: UpdatePedidoDto = {
            estado: validation.data.estado,
            impuesto: validation.data.impuesto,
          }

          await pedidosService.update(pedidoId, updatePayload)
        }

        toast.success('Pedido actualizado para esta mesa.')
        await Promise.all([loadMesaPedido(Number(validation.data.mesaId)), loadMesas()])
      } else {
        const mesaId = Number(validation.data.mesaId)
        const pedidoAbierto = openPedidosByMesa[mesaId]
        if (pedidoAbierto) {
          toast.info(`La mesa ya tiene un pedido abierto (${pedidoAbierto.codigo ?? `#${pedidoAbierto.id}`}).`)
          await loadMesaPedido(mesaId)
          return false
        }

        await pedidosService.create(payload)
        toast.success(`Pedido creado para Mesa #${selectedMesa?.numero ?? validation.data.mesaId}.`)
        await Promise.all([loadMesaPedido(Number(validation.data.mesaId)), loadMesas()])
      }

      setPedidoForm((current) => ({
        ...initialPedidoForm,
        mesaId: current.mesaId || String(validation.data.mesaId ?? ''),
        usuarioId: current.usuarioId || String(validation.data.usuarioId),
        impuesto: String(validation.data.impuesto ?? 0),
      }))
      return true
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      toast.error(backendMessage || 'No fue posible crear el pedido.')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleSendToKitchen() {
    if (!selectedPedido) {
      toast.error('Primero abre o crea un pedido para esta mesa.')
      return
    }

    const pedidoId = resolvePedidoId()
    if (!pedidoId) {
      toast.error('No se encontro un id de pedido valido para enviar a cocina.')
      return
    }

    const printWindow = window.open('', '_blank', 'width=420,height=720')
    if (!printWindow) {
      toast.error('No se pudo abrir la ventana de impresión. Revisa el bloqueador de popups.')
      return
    }
    if (hasDraftPedidoLineData()) {
      const saved = await handleSavePedido()
      if (!saved) {
        printWindow.close()
        return
      }
    }

    setSaving(true)
    try {
      const kitchenPayload: SendToKitchenPayload = {
        pedidoId,
        codigo: selectedPedido.codigo,
        mesaNumero:
          Number(selectedMesa?.numero ?? selectedPedido.mesa?.numero ?? 0) > 0
            ? Number(selectedMesa?.numero ?? selectedPedido.mesa?.numero)
            : undefined,
        productos: currentPedidoDetails.map((detail) => ({
          producto:
            detail.producto?.nombre ??
            detail.productoNombre ??
            products.find((product) => product.id === detail.productoId)?.nombre ??
            `Producto #${detail.productoId}`,
          cantidad: Number(detail.cantidad ?? 0) > 0 ? Number(detail.cantidad) : 1,
          observacion: detail.observacion?.trim() || undefined,
        })),
      }

      openKitchenPrintPreview(printWindow, {
        pedidoId,
        codigo: selectedPedido.codigo,
        locationLabel: selectedMesa?.numero ? `Mesa #${selectedMesa.numero}` : undefined,
        productos: kitchenPayload.productos,
      }, async () => {
        setSaving(true)
        try {
          await pedidosService.sendToKitchen(pedidoId, kitchenPayload)
          toast.success('Comanda enviada a cocina.')
          await Promise.all([loadMesaPedido(Number(selectedMesa?.id ?? selectedPedido.mesaId ?? 0)), loadMesas()])
          return { ok: true }
        } catch (requestError) {
          const backendMessage =
            axios.isAxiosError(requestError) && requestError.response
              ? extractBackendMessage(requestError.response.data)
              : ''
          const message = backendMessage || 'No fue posible enviar la comanda a cocina.'
          toast.error(message)
          return { ok: false, message }
        } finally {
          setSaving(false)
        }
      })
    } catch (requestError) {
      printWindow.close()
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      toast.error(backendMessage || 'No fue posible enviar la comanda a cocina.')
    } finally {
      setSaving(false)
    }
  }

  async function openInvoicePreview() {
    if (!selectedPedido) {
      toast.error('Primero abre o crea un pedido para esta mesa.')
      return
    }

    const pedidoId = resolvePedidoId()
    if (!pedidoId) {
      toast.error('No se encontro un id de pedido valido para la factura.')
      return
    }

    if (hasDraftPedidoLineData()) {
      toast.info('Hay lineas sin guardar. Guardalas para incluirlas en la facturación.')
    }

    setInvoicePreviewPedido(selectedPedido)
    setInvoicePreviewDetails(currentPedidoDetails)
    setInvoicePreviewOpen(true)
  }

  function openEditDetailDialog(detail: PedidoDetalle) {
    setEditingDetail(detail)
    setDetailForm({
      cantidad: String(detail.cantidad),
      precioUnitario: String(detail.precioUnitario),
      observacion: detail.observacion ?? '',
    })
    setDetailDialogOpen(true)
  }

  async function handleSaveDetailUpdate() {
    if (!selectedPedido || !editingDetail) {
      return
    }

    const pedidoId = resolvePedidoId(editingDetail)
    if (!pedidoId) {
      toast.error('No se encontro un id de pedido valido para editar esta linea.')
      return
    }

    const cantidad = Number(detailForm.cantidad)
    const precioUnitario = Number(detailForm.precioUnitario)

    if (!Number.isFinite(cantidad) || cantidad <= 0 || !Number.isFinite(precioUnitario) || precioUnitario < 0) {
      toast.error('Revisa cantidad y precio para actualizar la línea.')
      return
    }

    setSaving(true)
    try {
      await pedidosService.updateDetail(pedidoId, editingDetail.id, {
        productoId: editingDetail.productoId,
        cantidad,
        precioUnitario,
        observacion: detailForm.observacion.trim() || undefined,
      })

      toast.success('Producto actualizado en el pedido.')
      setDetailDialogOpen(false)
      setEditingDetail(null)
      await loadMesaPedido(Number(selectedMesa?.id ?? selectedPedido.mesaId ?? 0))
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      toast.error(backendMessage || 'No fue posible actualizar la línea del pedido.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteCurrentDetail(detail: PedidoDetalle) {
    if (!selectedPedido) {
      return
    }

    const pedidoId = resolvePedidoId(detail)
    if (!pedidoId) {
      toast.error('No se encontro un id de pedido valido para eliminar esta linea.')
      return
    }

    setSaving(true)
    try {
      await pedidosService.deleteDetail(pedidoId, detail.id)
      toast.success('Producto eliminado del pedido.')
      await loadMesaPedido(Number(selectedMesa?.id ?? selectedPedido.mesaId ?? 0))
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      toast.error(backendMessage || 'No fue posible eliminar la línea del pedido.')
    } finally {
      setSaving(false)
    }
  }

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
              <EventSeatIcon sx={{ color: COLOR_GOLD }} />
              <Typography
                variant="h4"
                sx={{ fontWeight: 800, color: COLOR_GOLD, fontFamily: '"Cormorant Garamond", serif' }}
              >
                Mesas
              </Typography>
            </Stack>
            <Typography sx={{ color: COLOR_MUTED, maxWidth: 760 }}>
              Visualiza el estado de cada mesa y gestiona el pedido activo sin abrir comandas duplicadas.
            </Typography>
          </Box>

          {isAdmin ? (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openCreateDialog}
              sx={{
                alignSelf: { xs: 'stretch', md: 'center' },
                background: `linear-gradient(135deg, ${COLOR_GOLD} 0%, #f2d36f 100%)`,
                color: '#1a1208',
                fontWeight: 700,
                '&:hover': {
                  background: `linear-gradient(135deg, #e5c253 0%, #f7df8d 100%)`,
                },
              }}
            >
              Nueva mesa
            </Button>
          ) : null}
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
          { label: 'Total', value: stats.total },
          { label: 'Activas', value: stats.activas },
          { label: 'Inactivas', value: stats.inactivas },
          { label: 'Capacidad activa', value: formatCapacity(stats.capacidadTotal) },
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
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' } }}>
          <TextField
            fullWidth
            label="Buscar mesa"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            sx={{
              '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
              '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
            }}
          />
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: { md: 240 } }}>
            <Switch checked={onlyActive} onChange={(event) => setOnlyActive(event.target.checked)} />
            <Typography sx={{ color: COLOR_TEXT }}>Solo activas</Typography>
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
        <Box sx={{ p: 2.5, pb: 0 }}>
          <Typography variant="h6" sx={{ color: COLOR_GOLD, fontWeight: 700 }}>
            Estado de mesas
          </Typography>
          <Typography sx={{ color: COLOR_MUTED, mt: 0.5 }}>
            Diseño unificado con reservas para identificar disponibilidad y abrir gestión del pedido.
          </Typography>
        </Box>

        {loading ? (
          <Box sx={{ py: 10, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress sx={{ color: COLOR_GOLD }} />
          </Box>
        ) : visibleMesas.length === 0 ? (
          <Box sx={{ py: 8, px: 3, textAlign: 'center' }}>
            <Typography variant="h6" sx={{ color: COLOR_GOLD, fontWeight: 700, mb: 1 }}>
              No hay mesas para mostrar
            </Typography>
            <Typography sx={{ color: COLOR_MUTED }}>
              Ajusta los filtros para localizar mesas registradas.
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(3, minmax(0, 1fr))',
                lg: 'repeat(4, minmax(0, 1fr))',
              },
              gap: 2,
              p: 2,
            }}
          >
            {visibleMesas.map((mesa) => {
              const activePedido = openPedidosByMesa[mesa.id]
              const isMesaOccupied = Boolean(activePedido)
              const isMesaReserved = Boolean(reservadasByMesa[mesa.id])

              return (
              <Card
                key={mesa.id}
                onClick={() => openPedidoDrawer(mesa)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    openPedidoDrawer(mesa)
                  }
                }}
                sx={{
                  position: 'relative',
                  cursor: mesa.activa ? 'pointer' : 'default',
                  borderRadius: 2,
                  border: !mesa.activa
                    ? '1px solid rgba(143,29,46,0.8)'
                    : isMesaReserved
                      ? '1px solid rgba(143,29,46,0.8)'
                      : isMesaOccupied
                        ? '1px solid rgba(245,158,11,0.75)'
                        : '1px solid rgba(52,211,153,0.45)',
                  backgroundColor: !mesa.activa
                    ? 'rgba(143,29,46,0.17)'
                    : isMesaReserved
                      ? 'rgba(143,29,46,0.17)'
                      : isMesaOccupied
                        ? 'rgba(120,73,15,0.22)'
                        : 'rgba(16,90,57,0.14)',
                  boxShadow: '0 10px 26px rgba(0,0,0,0.35)',
                  color: COLOR_TEXT,
                  minHeight: 250,
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
                  '&:hover': {
                    transform: mesa.activa ? 'translateY(-4px)' : 'none',
                    boxShadow: mesa.activa ? '0 16px 30px rgba(0,0,0,0.42)' : '0 10px 26px rgba(0,0,0,0.35)',
                    borderColor: mesa.activa ? 'rgba(212,175,55,0.65)' : 'rgba(143,29,46,0.8)',
                  },
                }}
              >
                <CardContent
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5,
                    height: '100%',
                    pt: 2,
                    pb: 3,
                    px: 2.5,
                  }}
                >
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="h6" sx={{ color: COLOR_TEXT, fontWeight: 700 }}>
                        Mesa #{mesa.numero}
                      </Typography>
                      <Typography sx={{ color: 'rgba(243,233,210,0.88)', mt: 0.35 }}>
                        Capacidad: {mesa.capacidad} persona(s)
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={
                        !mesa.activa
                          ? 'Inactiva'
                          : isMesaReserved
                            ? 'Reservada'
                            : isMesaOccupied
                              ? 'Ocupada'
                              : 'Disponible'
                      }
                      sx={{
                        bgcolor: !mesa.activa
                          ? 'rgba(143,29,46,0.88)'
                          : isMesaReserved
                            ? COLOR_MAROON
                            : isMesaOccupied
                              ? 'rgba(245,158,11,0.9)'
                              : 'rgba(16,185,129,0.85)',
                        color: !mesa.activa
                          ? '#fff'
                          : isMesaReserved
                            ? '#fff'
                            : isMesaOccupied
                              ? '#1a1208'
                              : '#fff',
                        fontWeight: 700,
                      }}
                    />
                  </Stack>

                  <Box
                    sx={{
                      flexGrow: 1,
                      p: 1.5,
                      borderRadius: 2,
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(212,175,55,0.12)',
                    }}
                  >
                    <Typography sx={{ color: 'rgba(243,233,210,0.8)', mb: 0.35 }}>
                      Estado mesa: {mesa.activa ? 'Activa' : 'Inactiva'}
                    </Typography>
                    {activePedido?.codigo ? (
                      <Typography sx={{ color: 'rgba(243,233,210,0.8)', mb: 0.35 }}>
                        Pedido activo: {activePedido.codigo}
                      </Typography>
                    ) : null}
                    <Typography sx={{ color: COLOR_MUTED, fontSize: '0.88rem', mb: 0.4 }}>Observación</Typography>
                    <Typography sx={{ color: COLOR_TEXT }}>
                      {mesa.observacion || 'Sin observaciones. Toca la mesa para gestionar el pedido.'}
                    </Typography>
                  </Box>

                  <Stack spacing={1} sx={{ mt: 'auto' }}>
                    <Button
                      variant="outlined"
                      startIcon={<RestaurantIcon />}
                      fullWidth
                      disabled={!mesa.activa}
                      onClick={(event) => {
                        event.stopPropagation()
                        openPedidoDrawer(mesa)
                      }}
                      sx={{
                        borderColor: 'rgba(212,175,55,0.45)',
                        color: COLOR_GOLD,
                        fontWeight: 800,
                        '&:hover': {
                          borderColor: COLOR_GOLD,
                          backgroundColor: 'rgba(212,175,55,0.1)',
                        },
                        '&.Mui-disabled': {
                          borderColor: 'rgba(212,175,55,0.15)',
                          backgroundColor: 'rgba(212,175,55,0.04)',
                          color: 'rgba(243,233,210,0.35)',
                        },
                      }}
                    >
                      {isMesaOccupied ? 'Gestionar pedido' : 'Iniciar pedido'}
                    </Button>

                    {isAdmin ? (
                      <Stack direction="row" spacing={1}>
                        <Button
                          variant="outlined"
                          fullWidth
                          startIcon={<EditIcon />}
                          onClick={(event) => {
                            event.stopPropagation()
                            openEditDialog(mesa)
                          }}
                          sx={{ color: COLOR_TEXT, borderColor: 'rgba(212,175,55,0.35)' }}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="outlined"
                          fullWidth
                          startIcon={<DeleteIcon />}
                          onClick={(event) => {
                            event.stopPropagation()
                            void handleDeactivateMesa(mesa)
                          }}
                          disabled={saving || !mesa.activa}
                          sx={{ color: '#f39ca8', borderColor: 'rgba(243,156,168,0.35)' }}
                        >
                          Desactivar
                        </Button>
                      </Stack>
                    ) : null}
                  </Stack>
                </CardContent>
              </Card>
              )
            })}
          </Box>
        )}
      </Paper>

      <Drawer anchor="right" open={orderDrawerOpen} onClose={closePedidoDrawer}>
        <Box
          sx={{
            width: { xs: '100vw', sm: 520 },
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#160f0c',
            color: COLOR_TEXT,
          }}
        >
          <Box sx={{ p: 3, borderBottom: '1px solid rgba(212,175,55,0.18)' }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography sx={{ color: COLOR_GOLD, fontWeight: 900, fontSize: '1.4rem' }}>
                  Mesa #{selectedMesa?.numero ?? ''}
                </Typography>
                <Typography sx={{ color: COLOR_MUTED, mt: 0.5 }}>
                  {selectedPedido
                    ? 'Pedido abierto: agrega líneas, envía a cocina y factura al cierre del servicio.'
                    : 'No hay pedido abierto en esta mesa. Crea uno para iniciar el servicio.'}
                </Typography>
              </Box>
              <Chip
                label={selectedPedido ? String(selectedPedido.estado) : 'SIN PEDIDO'}
                sx={{
                  backgroundColor: selectedPedido ? 'rgba(212,175,55,0.18)' : 'rgba(255,255,255,0.06)',
                  color: COLOR_TEXT,
                  fontWeight: 700,
                }}
              />
            </Stack>
          </Box>

          <Box
            sx={{
              p: 3,
              pb: 3,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              overflowY: 'auto',
              flex: 1,
              minHeight: 0,
            }}
          >
            {pedidoLoading ? (
              <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress sx={{ color: COLOR_GOLD }} />
              </Box>
            ) : null}

            {selectedPedido ? (
              <Paper
                sx={{
                  p: 2,
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(212,175,55,0.15)',
                  borderRadius: 2,
                }}
              >
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography sx={{ color: COLOR_GOLD, fontWeight: 800 }}>{selectedPedido.codigo || 'Pedido sin código'}</Typography>
                      <Typography sx={{ color: COLOR_MUTED, fontSize: '0.9rem' }}>
                        Creado {selectedPedido.createdAt ? new Date(selectedPedido.createdAt).toLocaleString('es-CR') : 'sin fecha'}
                      </Typography>
                    </Box>
                    <Chip
                      label={selectedPedido.estado}
                      sx={{
                        backgroundColor: 'rgba(212,175,55,0.15)',
                        color: COLOR_TEXT,
                        fontWeight: 700,
                      }}
                    />
                  </Stack>

                  <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
                    <Chip label={`Total ${formatCurrency(selectedPedido.total)}`} sx={{ color: COLOR_TEXT, backgroundColor: 'rgba(255,255,255,0.05)' }} />
                    <Chip label={`Pagado ${formatCurrency(selectedPedido.totalPagado)}`} sx={{ color: COLOR_TEXT, backgroundColor: 'rgba(255,255,255,0.05)' }} />
                    <Chip label={`Pendiente ${formatCurrency(selectedPedido.saldoPendiente)}`} sx={{ color: COLOR_TEXT, backgroundColor: 'rgba(255,255,255,0.05)' }} />
                  </Stack>

                  <Divider sx={{ borderColor: 'rgba(212,175,55,0.12)' }} />

                  <Stack spacing={1.25}>
                    <Typography sx={{ color: COLOR_GOLD, fontWeight: 700 }}>Contenido actual</Typography>
                    {currentPedidoDetails.length > 0 ? (
                      currentPedidoDetails.map((detalle) => {
                        const matchedProduct = products.find((product) => product.id === detalle.productoId)
                        const productName =
                          detalle.producto?.nombre ?? detalle.productoNombre ?? matchedProduct?.nombre ?? 'Producto'
                        const subtotal = detalle.subtotal ?? detalle.precioUnitario * detalle.cantidad

                        return (
                          <Box
                            key={detalle.id}
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: 2,
                              p: 1.25,
                              borderRadius: 1.5,
                              backgroundColor: 'rgba(255,255,255,0.03)',
                            }}
                          >
                            <Stack spacing={0.45} sx={{ minWidth: 0 }}>
                              <Typography sx={{ fontWeight: 700, color: COLOR_TEXT }}>
                                Producto: {productName}
                              </Typography>
                              <Typography sx={{ color: COLOR_MUTED, fontSize: '0.85rem' }}>
                                Cantidad: {detalle.cantidad}
                              </Typography>
                              <Typography sx={{ color: COLOR_MUTED, fontSize: '0.85rem' }}>
                                Observaciones: {detalle.observacion?.trim() || 'Sin observaciones'}
                              </Typography>
                              <Typography sx={{ color: COLOR_MUTED, fontSize: '0.85rem' }}>
                                Precio unitario: {formatCurrency(detalle.precioUnitario)}
                              </Typography>
                            </Stack>

                            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                              <Typography sx={{ color: COLOR_GOLD, fontWeight: 700 }}>Subtotal: {formatCurrency(subtotal)}</Typography>
                              <IconButton
                                size="small"
                                onClick={() => openEditDetailDialog(detalle)}
                                sx={getDrawerIconButtonSx('gold')}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => void handleDeleteCurrentDetail(detalle)}
                                sx={getDrawerIconButtonSx('danger')}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Stack>
                          </Box>
                        )
                      })
                    ) : (
                      <Typography sx={{ color: COLOR_MUTED }}>Aún no hay líneas guardadas para esta mesa.</Typography>
                    )}
                  </Stack>
                </Stack>
              </Paper>
            ) : (
              <Paper
                sx={{
                  p: 2,
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(212,175,55,0.15)',
                  borderRadius: 2,
                }}
              >
                <Typography sx={{ color: COLOR_GOLD, fontWeight: 700, mb: 0.5 }}>Mesa libre</Typography>
                <Typography sx={{ color: COLOR_MUTED }}>
                  No hay un pedido abierto todavía. Agrega productos y se creará la comanda al guardar.
                </Typography>
              </Paper>
            )}

            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <TextField
                label="Mesa"
                value={pedidoForm.mesaId}
                fullWidth
                disabled
                sx={{
                  '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                  '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                }}
              />
              <TextField
                label="Impuesto"
                value={pedidoForm.impuesto}
                onChange={(event) => setPedidoForm((current) => ({ ...current, impuesto: event.target.value }))}
                fullWidth
                type="number"
                sx={{
                  '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                  '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                }}
              />
            </Stack>

            <Divider sx={{ borderColor: 'rgba(212,175,55,0.18)' }} />

            <Stack spacing={2}>
              {pedidoForm.lineas.map((linea, index) => (
                <Paper
                  key={`line-${index}`}
                  sx={{
                    p: 2,
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(212,175,55,0.15)',
                    borderRadius: 2,
                  }}
                >
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography sx={{ color: COLOR_GOLD, fontWeight: 700 }}>Línea {index + 1}</Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => removePedidoLine(index)}
                        disabled={pedidoForm.lineas.length === 1}
                        sx={getDrawerActionButtonSx('danger')}
                      >
                        Quitar
                      </Button>
                    </Stack>

                    <TextField
                      label="Código o nombre"
                      value={linea.codigoProducto}
                      onChange={(event) => {
                        const nextCode = event.target.value
                        updatePedidoLine(index, { codigoProducto: nextCode })
                        applyProductCode(index, nextCode)
                      }}
                      fullWidth
                      helperText={linea.productoNombre || 'Escribe código o nombre para autocompletar producto y precio.'}
                      sx={{
                        '& .MuiFormHelperText-root': { color: COLOR_MUTED },
                        '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                        '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                      }}
                    />

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                      <TextField
                        label="Producto"
                        value={linea.productoNombre}
                        fullWidth
                        disabled
                        sx={{
                          '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                          '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                        }}
                      />
                      <TextField
                        label="Cantidad"
                        type="number"
                        value={linea.cantidad}
                        onChange={(event) => updatePedidoLine(index, { cantidad: event.target.value })}
                        sx={{
                          width: { xs: '100%', sm: 120 },
                          '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                          '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                        }}
                      />
                      <TextField
                        label="Precio"
                        type="number"
                        value={linea.precioUnitario}
                        onChange={(event) => updatePedidoLine(index, { precioUnitario: event.target.value })}
                        sx={{
                          width: { xs: '100%', sm: 140 },
                          '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                          '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                        }}
                      />
                    </Stack>

                    <TextField
                      label="Observación"
                      value={linea.observacion}
                      onChange={(event) => updatePedidoLine(index, { observacion: event.target.value })}
                      fullWidth
                      multiline
                      minRows={2}
                      sx={{
                        '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                        '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                      }}
                    />
                  </Stack>
                </Paper>
              ))}

              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={addPedidoLine}
                sx={getDrawerActionButtonSx('gold')}
              >
                Agregar producto
              </Button>
            </Stack>

            <Paper
              sx={{
                mt: 1,
                p: 1.25,
                borderRadius: 2,
                backgroundColor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(212,175,55,0.15)',
              }}
            >
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                  gap: 1.25,
                }}
              >
                <Button onClick={closePedidoDrawer} variant="outlined" sx={getDrawerActionButtonSx('neutral')}>
                  Cancelar
                </Button>
                {selectedPedido ? (
                  <Button
                    variant="outlined"
                    onClick={() => void handleSendToKitchen()}
                    disabled={saving || pedidoLoading}
                    sx={getDrawerActionButtonSx('gold')}
                  >
                    Enviar a cocina
                  </Button>
                ) : null}
                {selectedPedido ? (
                  <Button
                    variant="outlined"
                    onClick={() => void openInvoicePreview()}
                    disabled={saving || pedidoLoading}
                    sx={getDrawerActionButtonSx('neutral')}
                  >
                    Facturar
                  </Button>
                ) : null}
                <Button
                  variant="contained"
                  onClick={() => void handleSavePedido()}
                  disabled={saving}
                  sx={{
                    background: `linear-gradient(135deg, ${COLOR_GOLD} 0%, #f2d36f 100%)`,
                    color: '#1a1208',
                    fontWeight: 800,
                    borderRadius: 2,
                    minHeight: 44,
                    whiteSpace: 'normal',
                    lineHeight: 1.2,
                    '&:hover': {
                      background: 'linear-gradient(135deg, #e5c253 0%, #f7df8d 100%)',
                    },
                    '&.Mui-disabled': {
                      background: 'rgba(212,175,55,0.2)',
                      color: 'rgba(26,18,8,0.65)',
                    },
                  }}
                >
                  {saving ? 'Guardando...' : selectedPedido ? 'Agregar a la comanda' : 'Crear pedido'}
                </Button>
              </Box>
            </Paper>
          </Box>
        </Box>
      </Drawer>

      <FacturacionModal
        open={invoicePreviewOpen}
        pedidoId={resolvePedidoId()}
        pedidoFallback={invoicePreviewPedido}
        detailsFallback={invoicePreviewDetails}
        onClose={() => {
          if (!saving) {
            setInvoicePreviewOpen(false)
          }
        }}
        onFacturado={async () => {
          const mesaId = Number(selectedMesa?.id ?? invoicePreviewPedido?.mesaId ?? 0)
          if (mesaId > 0) {
            await Promise.all([loadMesaPedido(mesaId), loadMesas()])
          } else {
            await loadMesas()
          }

          setInvoicePreviewPedido(null)
          setInvoicePreviewDetails([])
        }}
      />

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle sx={{ backgroundColor: '#160f0c', color: COLOR_GOLD, fontWeight: 800 }}>
          {editingMesa ? `Editar mesa #${editingMesa.numero}` : 'Nueva mesa'}
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#160f0c', pt: 3 }}>
          <Stack spacing={2}>
            <TextField
              label="Número de mesa"
              value={form.numero}
              onChange={(event) => setForm((current) => ({ ...current, numero: event.target.value }))}
              fullWidth
              type="number"
              sx={{
                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
              }}
            />
            <TextField
              label="Capacidad"
              value={form.capacidad}
              onChange={(event) => setForm((current) => ({ ...current, capacidad: event.target.value }))}
              fullWidth
              type="number"
              sx={{
                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
              }}
            />
            <TextField
              label="Observación"
              value={form.observacion}
              onChange={(event) => setForm((current) => ({ ...current, observacion: event.target.value }))}
              fullWidth
              multiline
              minRows={3}
              sx={{
                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
              }}
            />
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Switch
                checked={form.activa === 'true'}
                onChange={(event) => setForm((current) => ({ ...current, activa: event.target.checked ? 'true' : 'false' }))}
              />
              <Typography sx={{ color: COLOR_TEXT }}>Mesa activa</Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#160f0c', p: 2.5 }}>
          <Button onClick={closeDialog} sx={{ color: COLOR_TEXT }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleSaveMesa()}
            disabled={saving}
            sx={{ backgroundColor: COLOR_MAROON, '&:hover': { backgroundColor: '#a42535' } }}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={detailDialogOpen} onClose={() => setDetailDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ backgroundColor: '#160f0c', color: COLOR_GOLD, fontWeight: 800 }}>
          Editar producto del pedido
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#160f0c', pt: 3 }}>
          <Stack spacing={2}>
            <TextField
              label="Producto"
              value={
                editingDetail
                  ? editingDetail.producto?.nombre ??
                    editingDetail.productoNombre ??
                    products.find((product) => product.id === editingDetail.productoId)?.nombre ??
                    'Producto'
                  : ''
              }
              fullWidth
              disabled
              sx={{
                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
              }}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
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
            </Stack>
            <TextField
              label="Observación"
              value={detailForm.observacion}
              onChange={(event) => setDetailForm((current) => ({ ...current, observacion: event.target.value }))}
              fullWidth
              multiline
              minRows={2}
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
          <Button
            variant="contained"
            onClick={() => void handleSaveDetailUpdate()}
            disabled={saving || !editingDetail}
            sx={{ backgroundColor: COLOR_MAROON, '&:hover': { backgroundColor: '#a42535' } }}
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}