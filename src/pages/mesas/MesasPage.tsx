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
import { menuService } from '@/services/menu.service'
import { pedidosService } from '@/services/pedidos.service'
import { mesaSchema } from '@/schemas/mesa.schema'
import { mesasService } from '@/services/mesas.service'
import { pedidoSchema } from '@/schemas/pedido.schema'
import type { Mesa } from '@/types/mesa.types'
import type { Product } from '@/types/menu.types'
import type { CreatePedidoDto, Pedido, PedidoDetalle, UpdatePedidoDto } from '@/types/pedido.types'
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

const ACTIVE_ORDER_STATES = ['BORRADOR', 'EN_PREPARACION', 'LISTO']

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
  const [pedidoLoading, setPedidoLoading] = useState(false)
  const [pedidoForm, setPedidoForm] = useState<PedidoMesaFormState>(initialPedidoForm)

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
      const [mesasResponse, productsResponse] = await Promise.all([mesasService.getAll(), menuService.getProducts()])
      setMesas(unwrapMesasPayload(mesasResponse.data))
      setProducts(unwrapProductsPayload(productsResponse.data))
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

  function findProductByCode(rawCode: string): Product | null {
    const normalized = rawCode.trim().toUpperCase()
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

    const partialMatch = products.find((product) => {
      const code = String(product.codigo ?? '').trim().toUpperCase()
      return code.includes(normalized) || product.nombre.trim().toUpperCase().includes(normalized)
    })

    return partialMatch ?? null
  }

  function setDraftPedidoForMesa(mesa: Mesa, pedido?: Pedido | null) {
    setPedidoForm({
      ...initialPedidoForm,
      codigo: pedido?.codigo ?? '',
      mesaId: String(mesa.id),
      usuarioId: pedido?.usuarioId ? String(pedido.usuarioId) : user?.id ? String(user.id) : '',
      impuesto: String(pedido?.impuesto ?? 0),
    })
  }

  function unwrapPedidosPayload(payload: unknown): Pedido[] {
    if (Array.isArray(payload)) {
      return payload as Pedido[]
    }

    if (typeof payload === 'object' && payload !== null) {
      const record = payload as Record<string, unknown>
      const keys = ['data', 'items', 'results', 'pedidos']

      for (const key of keys) {
        const value = record[key]
        if (Array.isArray(value)) {
          return value as Pedido[]
        }
      }
    }

    return []
  }

  function isActivePedido(pedido: Pedido): boolean {
    return ACTIVE_ORDER_STATES.includes(String(pedido.estado).trim().toUpperCase())
  }

  async function loadMesaPedido(mesaId: number) {
    setPedidoLoading(true)

    try {
      const response = await pedidosService.getAll({ mesaId, tipo: 'MESA' })
      const pedidos = unwrapPedidosPayload(response.data)
      const pedidoSeleccionado = pedidos
        .filter((pedido) => isActivePedido(pedido) || String(pedido.estado).trim().toUpperCase() === 'FACTURADO')
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

      const detailsResponse = await pedidosService.getDetails(pedidoSeleccionado.id)
      setSelectedPedido(pedidoSeleccionado)
      setCurrentPedidoDetails(detailsResponse.data)
      setDraftPedidoForMesa(
        {
          id: mesaId,
          numero: pedidoSeleccionado.mesa?.numero ?? mesaId,
          capacidad: pedidoSeleccionado.mesa?.capacidad ?? 0,
          observacion: pedidoSeleccionado.mesa?.numero ? `Pedido activo en mesa #${pedidoSeleccionado.mesa.numero}` : undefined,
          activa: true,
        },
        pedidoSeleccionado,
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
    const product = findProductByCode(code)
    if (!product) {
      return
    }

    updatePedidoLine(index, {
      codigoProducto: product.codigo ?? String(product.id),
      productoId: String(product.id),
      productoNombre: product.nombre,
      precioUnitario: String(product.precio),
    })
  }

  async function handleSavePedido() {
    const parsedLineas = pedidoForm.lineas.map((linea) => ({
      productoId: Number(linea.productoId),
      cantidad: Number(linea.cantidad),
      precioUnitario: Number(linea.precioUnitario),
      observacion: linea.observacion.trim() || undefined,
    }))

    const validation = pedidoSchema.safeParse({
      codigo: pedidoForm.codigo.trim() || undefined,
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
      if (selectedPedido) {
        for (const detalle of validation.data.detalles) {
          await pedidosService.createDetail(selectedPedido.id, detalle)
        }

        if (validation.data.estado !== selectedPedido.estado || validation.data.impuesto !== selectedPedido.impuesto) {
          const updatePayload: UpdatePedidoDto = {
            estado: validation.data.estado,
            impuesto: validation.data.impuesto,
          }

          await pedidosService.update(selectedPedido.id, updatePayload)
        }

        toast.success('Pedido actualizado para esta mesa.')
        await loadMesaPedido(Number(validation.data.mesaId))
      } else {
        await pedidosService.create(payload)
        toast.success(`Pedido creado para Mesa #${selectedMesa?.numero ?? validation.data.mesaId}.`)
        await loadMesaPedido(Number(validation.data.mesaId))
      }

      setPedidoForm((current) => ({
        ...initialPedidoForm,
        mesaId: current.mesaId || String(validation.data.mesaId ?? ''),
        usuarioId: current.usuarioId || String(validation.data.usuarioId),
        impuesto: String(validation.data.impuesto ?? 0),
      }))
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      toast.error(backendMessage || 'No fue posible crear el pedido.')
    } finally {
      setSaving(false)
    }
  }

  async function handlePedidoStatusChange(nextEstado: 'EN_PREPARACION' | 'FACTURADO') {
    if (!selectedPedido) {
      toast.error('Primero abre o crea un pedido para esta mesa.')
      return
    }

    if (
      pedidoForm.lineas.some(
        (linea) =>
          linea.codigoProducto.trim() ||
          linea.productoId.trim() ||
          linea.precioUnitario.trim() ||
          linea.observacion.trim(),
      )
    ) {
      await handleSavePedido()
    }

    setSaving(true)
    try {
      await pedidosService.update(selectedPedido.id, { estado: nextEstado })
      toast.success(nextEstado === 'EN_PREPARACION' ? 'Comanda enviada a cocina.' : 'Pedido marcado para facturación.')
      await loadMesaPedido(Number(selectedMesa?.id ?? selectedPedido.mesaId ?? 0))
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      toast.error(backendMessage || 'No fue posible cambiar el estado del pedido.')
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
              Administra la capacidad, disponibilidad y observaciones de cada mesa para que el equipo atienda sin fricciones.
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
              '&:hover': {
                background: `linear-gradient(135deg, #e5c253 0%, #f7df8d 100%)`,
              },
            }}
          >
            Nueva mesa
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
              Ajusta el filtro o crea una nueva mesa para comenzar.
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' },
              gap: 2,
              p: 2,
            }}
          >
            {visibleMesas.map((mesa) => (
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
                  overflow: 'visible',
                  background: mesa.activa
                    ? 'linear-gradient(180deg, rgba(25,16,12,0.98) 0%, rgba(14,10,8,0.96) 100%)'
                    : 'linear-gradient(180deg, rgba(52,16,21,0.95) 0%, rgba(20,10,12,0.95) 100%)',
                  border: mesa.activa ? '1px solid rgba(212,175,55,0.42)' : '1px solid rgba(243,156,168,0.35)',
                  borderRadius: '42% / 18%',
                  boxShadow: '0 14px 34px rgba(0,0,0,0.35)',
                  color: COLOR_TEXT,
                  minHeight: 240,
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
                  '&:hover': {
                    transform: mesa.activa ? 'translateY(-4px)' : 'none',
                    boxShadow: mesa.activa ? '0 18px 40px rgba(0,0,0,0.45)' : '0 14px 34px rgba(0,0,0,0.35)',
                    borderColor: mesa.activa ? 'rgba(212,175,55,0.72)' : 'rgba(243,156,168,0.35)',
                  },
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    inset: '10px 14px auto',
                    height: 14,
                    borderRadius: '999px',
                    background: mesa.activa
                      ? 'linear-gradient(90deg, rgba(212,175,55,0.35) 0%, rgba(242,211,111,0.08) 100%)'
                      : 'linear-gradient(90deg, rgba(243,156,168,0.22) 0%, rgba(243,156,168,0.05) 100%)',
                    opacity: 0.9,
                  },
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    left: '50%',
                    bottom: -18,
                    width: '58%',
                    height: 16,
                    transform: 'translateX(-50%)',
                    borderRadius: '999px',
                    background: 'rgba(0,0,0,0.28)',
                    filter: 'blur(4px)',
                  },
                }}
              >
                <CardContent
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5,
                    height: '100%',
                    pt: 4,
                    pb: 3,
                    px: 2.5,
                  }}
                >
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography sx={{ color: COLOR_GOLD, fontWeight: 900, fontSize: '2rem', lineHeight: 1 }}>
                        #{mesa.numero}
                      </Typography>
                      <Typography sx={{ color: COLOR_MUTED, mt: 0.5 }}>Capacidad {formatCapacity(mesa.capacidad)}</Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={mesa.activa ? 'Disponible' : 'Inactiva'}
                      sx={{
                        backgroundColor: mesa.activa ? 'rgba(76,175,80,0.14)' : 'rgba(143,29,46,0.18)',
                        color: mesa.activa ? '#9ae6a0' : '#f4a7b1',
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
                    <Typography sx={{ color: COLOR_MUTED, fontSize: '0.88rem', mb: 0.5 }}>Observación</Typography>
                    <Typography sx={{ color: COLOR_TEXT }}>
                      {mesa.observacion || 'Sin observaciones. Toca la mesa para iniciar el pedido.'}
                    </Typography>
                  </Box>

                  <Stack spacing={1} sx={{ mt: 'auto' }}>
                    <Button
                      variant="contained"
                      startIcon={<RestaurantIcon />}
                      fullWidth
                      disabled={!mesa.activa}
                      onClick={(event) => {
                        event.stopPropagation()
                        openPedidoDrawer(mesa)
                      }}
                      sx={{
                        background: `linear-gradient(135deg, ${COLOR_GOLD} 0%, #f2d36f 100%)`,
                        color: '#1a1208',
                        fontWeight: 800,
                        '&:hover': {
                          background: `linear-gradient(135deg, #e5c253 0%, #f7df8d 100%)`,
                        },
                        '&.Mui-disabled': {
                          background: 'rgba(212,175,55,0.15)',
                          color: 'rgba(243,233,210,0.35)',
                        },
                      }}
                    >
                      Iniciar pedido
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
            ))}
          </Box>
        )}
      </Paper>

      <Drawer anchor="right" open={orderDrawerOpen} onClose={closePedidoDrawer}>
        <Box sx={{ width: { xs: '100vw', sm: 520 }, height: '100%', backgroundColor: '#160f0c', color: COLOR_TEXT }}>
          <Box sx={{ p: 3, borderBottom: '1px solid rgba(212,175,55,0.18)' }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography sx={{ color: COLOR_GOLD, fontWeight: 900, fontSize: '1.4rem' }}>
                  Mesa #{selectedMesa?.numero ?? ''}
                </Typography>
                <Typography sx={{ color: COLOR_MUTED, mt: 0.5 }}>
                  {selectedPedido ? 'Pedido cargado y listo para seguir agregando.' : 'Inicia el pedido aquí sin salir de la pantalla de mesas.'}
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

          <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', height: 'calc(100% - 88px)' }}>
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
                      currentPedidoDetails.map((detalle) => (
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
                          <Box>
                            <Typography sx={{ fontWeight: 700, color: COLOR_TEXT }}>
                              {detalle.producto?.nombre ?? `Producto #${detalle.productoId}`}
                            </Typography>
                            <Typography sx={{ color: COLOR_MUTED, fontSize: '0.85rem' }}>
                              Cantidad: {detalle.cantidad} {detalle.observacion ? `• ${detalle.observacion}` : ''}
                            </Typography>
                          </Box>
                          <Typography sx={{ color: COLOR_GOLD, fontWeight: 700 }}>
                            {formatCurrency(detalle.subtotal ?? detalle.precioUnitario * detalle.cantidad)}
                          </Typography>
                        </Box>
                      ))
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

            <TextField
              label="Código del pedido"
              value={pedidoForm.codigo}
              onChange={(event) => setPedidoForm((current) => ({ ...current, codigo: event.target.value }))}
              fullWidth
              sx={{
                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
              }}
            />

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
                  key={`${index}-${linea.productoId}`}
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
                        variant="text"
                        onClick={() => removePedidoLine(index)}
                        disabled={pedidoForm.lineas.length === 1}
                        sx={{ color: '#f39ca8' }}
                      >
                        Quitar
                      </Button>
                    </Stack>

                    <TextField
                      label="Código de producto"
                      value={linea.codigoProducto}
                      onChange={(event) => {
                        const nextCode = event.target.value
                        updatePedidoLine(index, { codigoProducto: nextCode })
                        applyProductCode(index, nextCode)
                      }}
                      fullWidth
                      helperText={linea.productoNombre || 'Escanea o escribe el código para autocompletar nombre y precio.'}
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
                sx={{ color: COLOR_GOLD, borderColor: 'rgba(212,175,55,0.35)' }}
              >
                Agregar producto
              </Button>
            </Stack>

            <Stack direction="row" spacing={1.5} sx={{ pt: 1 }}>
              <Button onClick={closePedidoDrawer} fullWidth sx={{ color: COLOR_TEXT }}>
                Cancelar
              </Button>
              {selectedPedido ? (
                <Button
                  variant="outlined"
                  onClick={() => void handlePedidoStatusChange('EN_PREPARACION')}
                  disabled={saving || pedidoLoading}
                  fullWidth
                  sx={{ color: COLOR_GOLD, borderColor: 'rgba(212,175,55,0.35)' }}
                >
                  Cocina
                </Button>
              ) : null}
              {selectedPedido ? (
                <Button
                  variant="outlined"
                  onClick={() => void handlePedidoStatusChange('FACTURADO')}
                  disabled={saving || pedidoLoading}
                  fullWidth
                  sx={{ color: COLOR_TEXT, borderColor: 'rgba(243,233,210,0.35)' }}
                >
                  Factura
                </Button>
              ) : null}
              <Button
                variant="contained"
                onClick={() => void handleSavePedido()}
                disabled={saving}
                fullWidth
                sx={{
                  background: `linear-gradient(135deg, ${COLOR_GOLD} 0%, #f2d36f 100%)`,
                  color: '#1a1208',
                  fontWeight: 800,
                }}
              >
                {saving ? 'Guardando...' : selectedPedido ? 'Agregar a la comanda' : 'Crear pedido'}
              </Button>
            </Stack>
          </Box>
        </Box>
      </Drawer>

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
    </Box>
  )
}