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
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import StarIcon from '@mui/icons-material/Star'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu'
import { menuService } from '@/services/menu.service'
import { platoDelMesService } from '@/services/plato-del-mes.service'
import type {
  CreateDishOfMonthDto,
  DishOfMonth,
  Product,
} from '@/types/menu.types'

const COLOR_GOLD = '#D4AF37'
const COLOR_TEXT = '#F3E9D2'
const COLOR_MAROON = '#8F1D2E'

const crcFormatter = new Intl.NumberFormat('es-CR', {
  style: 'currency',
  currency: 'CRC',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

interface DishFormState {
  productId: string
  fechaInicio: string
  fechaFin: string
  descripcionEspecial: string
  activo: string
}

const initialForm: DishFormState = {
  productId: '',
  fechaInicio: '',
  fechaFin: '',
  descripcionEspecial: '',
  activo: 'true',
}

function formatDateInput(value: string | undefined): string {
  if (!value) {
    return ''
  }

  const match = value.match(/^\d{4}-\d{2}-\d{2}/)
  if (match) {
    return match[0]
  }

  return ''
}

function getTodayISODate(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDaysISODate(baseDate: string, days: number): string {
  const date = new Date(baseDate)
  if (Number.isNaN(date.getTime())) {
    return baseDate
  }

  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function toPositiveNumber(value: unknown): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

function formatCRC(value: number): string {
  if (!Number.isFinite(value)) {
    return '₡0'
  }

  return crcFormatter.format(value)
}

function extractBackendMessage(payload: unknown): string {
  if (typeof payload === 'string') {
    return payload
  }

  if (typeof payload !== 'object' || payload === null) {
    return ''
  }

  const data = payload as {
    message?: unknown
    error?: unknown
    errors?: unknown
  }

  if (typeof data.message === 'string') {
    return data.message
  }

  if (Array.isArray(data.message)) {
    return data.message.map((item) => String(item)).join(' | ')
  }

  if (typeof data.error === 'string') {
    return data.error
  }

  if (Array.isArray(data.errors)) {
    return data.errors.map((item) => String(item)).join(' | ')
  }

  return ''
}

function normalizeProductsPayload(payload: unknown): Product[] {
  if (Array.isArray(payload)) {
    const normalized: Product[] = []

    payload.forEach((item) => {
      if (typeof item !== 'object' || item === null) {
        return
      }

      const record = item as Record<string, unknown>
      const id = toPositiveNumber(record.id ?? record.productId ?? record.product_id)
      if (id === null) {
        return
      }

      const nombreValue = record.nombre ?? record.name ?? 'Producto'
      const descripcionValue = record.descripcion ?? record.description ?? ''
      const precioValue = Number(record.precio ?? record.price ?? 0)
      const categoryId =
        toPositiveNumber(
          record.categoryId ?? record.category_id ?? record.categoriaId ?? record.categoria_id,
        ) ?? 0

      normalized.push({
        id,
        codigo:
          typeof record.codigo === 'string'
            ? record.codigo
            : typeof record.code === 'string'
              ? record.code
              : undefined,
        nombre: typeof nombreValue === 'string' ? nombreValue : String(nombreValue),
        descripcion:
          typeof descripcionValue === 'string' ? descripcionValue : String(descripcionValue),
        precio: Number.isFinite(precioValue) ? precioValue : 0,
        imagen:
          typeof record.imagen === 'string'
            ? record.imagen
            : typeof record.image === 'string'
              ? record.image
              : undefined,
        categoryId,
        disponible:
          typeof record.disponible === 'boolean'
            ? record.disponible
            : typeof record.available === 'boolean'
              ? record.available
              : true,
      })
    })

    return normalized
  }

  if (typeof payload === 'object' && payload !== null) {
    const container = payload as {
      data?: unknown
      items?: unknown
      products?: unknown
      productos?: unknown
    }

    if (container.data) return normalizeProductsPayload(container.data)
    if (container.items) return normalizeProductsPayload(container.items)
    if (container.products) return normalizeProductsPayload(container.products)
    if (container.productos) return normalizeProductsPayload(container.productos)
  }

  return []
}

function normalizeDish(item: unknown): DishOfMonth | null {
  if (typeof item !== 'object' || item === null) {
    return null
  }

  const record = item as Record<string, unknown>
  const id = toPositiveNumber(record.id ?? record.dishOfMonthId ?? record.dish_of_month_id)
  const productId =
    toPositiveNumber(
      record.productoId ??
        record.producto_id ??
        record.productId ??
        record.product_id ??
        record.platoId ??
        record.plato_id,
    ) ??
    0

  if (id === null) {
    return null
  }

  const productRecord =
    typeof record.product === 'object' && record.product !== null
      ? (record.product as Record<string, unknown>)
      : typeof record.plato === 'object' && record.plato !== null
        ? (record.plato as Record<string, unknown>)
        : null

  return {
    id,
    productId,
    productoId:
      toPositiveNumber(record.productoId ?? record.producto_id ?? record.productId ?? record.product_id) ??
      undefined,
    product: productRecord
      ? {
          id: toPositiveNumber(productRecord.id) ?? productId,
          codigo:
            typeof productRecord.codigo === 'string'
              ? productRecord.codigo
              : typeof productRecord.code === 'string'
                ? productRecord.code
                : undefined,
          nombre:
            typeof productRecord.nombre === 'string'
              ? productRecord.nombre
              : typeof productRecord.name === 'string'
                ? productRecord.name
                : 'Producto',
          descripcion:
            typeof productRecord.descripcion === 'string'
              ? productRecord.descripcion
              : typeof productRecord.description === 'string'
                ? productRecord.description
                : '',
          precio: Number(productRecord.precio ?? productRecord.price ?? 0) || 0,
          imagen:
            typeof productRecord.imagen === 'string'
              ? productRecord.imagen
              : typeof productRecord.image === 'string'
                ? productRecord.image
                : undefined,
          categoryId:
            toPositiveNumber(
              productRecord.categoryId ??
                productRecord.category_id ??
                productRecord.categoriaId ??
                productRecord.categoria_id,
            ) ?? 0,
          disponible:
            typeof productRecord.disponible === 'boolean'
              ? productRecord.disponible
              : typeof productRecord.available === 'boolean'
                ? productRecord.available
                : true,
        }
      : undefined,
    descripcionEspecial:
      typeof record.descripcionEspecial === 'string'
        ? record.descripcionEspecial
        : typeof record.descripcion === 'string'
          ? record.descripcion
          : typeof record.description === 'string'
            ? record.description
            : undefined,
    activo:
      typeof record.activo === 'boolean'
        ? record.activo
        : typeof record.active === 'boolean'
          ? record.active
          : undefined,
    fechaInicio:
      typeof record.fechaInicio === 'string'
        ? record.fechaInicio
        : typeof record.fecha_inicio === 'string'
          ? record.fecha_inicio
          : typeof record.startDate === 'string'
            ? record.startDate
            : undefined,
    fechaFin:
      typeof record.fechaFin === 'string'
        ? record.fechaFin
        : typeof record.fecha_fin === 'string'
          ? record.fecha_fin
          : typeof record.endDate === 'string'
            ? record.endDate
            : undefined,
    mes: toPositiveNumber(record.mes ?? record.month) ?? undefined,
    anio: toPositiveNumber(record.anio ?? record.year) ?? undefined,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : undefined,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
  }
}

function resolveDishProductId(dish: DishOfMonth): number {
  return toPositiveNumber(dish.productId) ?? toPositiveNumber(dish.productoId) ?? 0
}

function normalizeDishPayload(payload: unknown): DishOfMonth | null {
  const single = normalizeDish(payload)
  if (single) {
    return single
  }

  if (typeof payload === 'object' && payload !== null) {
    const container = payload as {
      data?: unknown
      item?: unknown
      dishOfMonth?: unknown
      dish_of_month?: unknown
      current?: unknown
    }

    if (container.data) return normalizeDishPayload(container.data)
    if (container.item) return normalizeDishPayload(container.item)
    if (container.dishOfMonth) return normalizeDishPayload(container.dishOfMonth)
    if (container.dish_of_month) return normalizeDishPayload(container.dish_of_month)
    if (container.current) return normalizeDishPayload(container.current)
  }

  return null
}

function normalizeDishHistoryPayload(payload: unknown): DishOfMonth[] {
  if (Array.isArray(payload)) {
    return payload
      .map((item) => normalizeDish(item))
      .filter((item): item is DishOfMonth => item !== null)
  }

  if (typeof payload === 'object' && payload !== null) {
    const container = payload as {
      data?: unknown
      items?: unknown
      history?: unknown
      historial?: unknown
    }

    if (container.data) return normalizeDishHistoryPayload(container.data)
    if (container.items) return normalizeDishHistoryPayload(container.items)
    if (container.history) return normalizeDishHistoryPayload(container.history)
    if (container.historial) return normalizeDishHistoryPayload(container.historial)
  }

  return []
}

function formatMonthYear(dish: DishOfMonth): string {
  if (dish.mes && dish.anio) {
    return `${dish.mes}/${dish.anio}`
  }

  return 'Sin periodo'
}

function formatDateRange(dish: DishOfMonth): string {
  const start = formatDateInput(dish.fechaInicio)
  const end = formatDateInput(dish.fechaFin)

  if (start && end) {
    return `${start} al ${end}`
  }

  if (start) {
    return `Desde ${start}`
  }

  if (end) {
    return `Hasta ${end}`
  }

  return 'Sin rango definido'
}

export default function PlatoDelMesPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [currentDish, setCurrentDish] = useState<DishOfMonth | null>(null)
  const [history, setHistory] = useState<DishOfMonth[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [submitting, setSubmitting] = useState<boolean>(false)

  const [message, setMessage] = useState<string>('')
  const [messageSeverity, setMessageSeverity] = useState<'info' | 'success' | 'error'>('info')

  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false)
  const [editingDishId, setEditingDishId] = useState<number | null>(null)
  const [form, setForm] = useState<DishFormState>(initialForm)

  const productById = useMemo(() => {
    const map = new Map<number, Product>()
    products.forEach((product) => map.set(product.id, product))
    return map
  }, [products])

  const loadData = async () => {
    setLoading(true)
    try {
      const [productsResponse, currentResponse, historyResponse] = await Promise.all([
        menuService.getProducts(),
        platoDelMesService.getCurrent().catch((error) => {
          if (axios.isAxiosError(error) && error.response?.status === 404) {
            return { data: null }
          }

          throw error
        }),
        platoDelMesService.getHistory().catch((error) => {
          if (axios.isAxiosError(error) && error.response?.status === 404) {
            return { data: [] }
          }

          throw error
        }),
      ])

      setProducts(normalizeProductsPayload(productsResponse.data))
      setCurrentDish(normalizeDishPayload(currentResponse.data))
      setHistory(normalizeDishHistoryPayload(historyResponse.data))
      setMessage('')
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const backendMessage = extractBackendMessage(error.response?.data)
        setMessage(
          backendMessage ||
            `No se pudo cargar Plato del Mes (HTTP ${error.response?.status ?? 'sin código'}).`,
        )
      } else {
        setMessage('No se pudo cargar Plato del Mes.')
      }
      setMessageSeverity('error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const getDishProduct = (dish: DishOfMonth): Product | null => {
    const resolvedProductId = resolveDishProductId(dish)
    return dish.product ?? productById.get(resolvedProductId) ?? null
  }

  const openCreateDialog = () => {
    setEditingDishId(null)
    const today = getTodayISODate()
    setForm({
      ...initialForm,
      productId: String(products[0]?.id ?? ''),
      fechaInicio: today,
      fechaFin: addDaysISODate(today, 30),
    })
    setIsDialogOpen(true)
  }

  const openEditDialog = (dish: DishOfMonth) => {
    setEditingDishId(dish.id)
    setForm({
      productId: String(resolveDishProductId(dish)),
      fechaInicio: formatDateInput(dish.fechaInicio),
      fechaFin: formatDateInput(dish.fechaFin),
      descripcionEspecial: dish.descripcionEspecial ?? '',
      activo: String(dish.activo ?? true),
    })
    setIsDialogOpen(true)
  }

  const closeDialog = () => {
    if (submitting) {
      return
    }
    setIsDialogOpen(false)
  }

  const handleSave = async () => {
    const parsedProductId = Number(form.productId)
    if (!Number.isFinite(parsedProductId) || parsedProductId <= 0) {
      setMessage('Selecciona un producto para continuar.')
      setMessageSeverity('error')
      return
    }

    const startDate = form.fechaInicio.trim()
    const endDate = form.fechaFin.trim()

    if (!startDate || !endDate) {
      setMessage('La fecha de inicio y la fecha de fin son obligatorias.')
      setMessageSeverity('error')
      return
    }

    if (new Date(startDate).getTime() > new Date(endDate).getTime()) {
      setMessage('La fecha de inicio no puede ser mayor a la fecha de fin.')
      setMessageSeverity('error')
      return
    }

    const payload: CreateDishOfMonthDto = {
      productId: parsedProductId,
      productoId: parsedProductId,
      fechaInicio: startDate,
      fechaFin: endDate,
      descripcionEspecial: form.descripcionEspecial.trim() || undefined,
      activo: form.activo === 'true',
    }

    setSubmitting(true)
    try {
      if (editingDishId === null) {
        await platoDelMesService.create(payload)
      } else {
        await platoDelMesService.update(editingDishId, payload)
      }

      await loadData()
      setIsDialogOpen(false)
      setMessage(editingDishId === null ? 'Plato del mes creado correctamente.' : 'Plato del mes actualizado correctamente.')
      setMessageSeverity('success')
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const backendMessage = extractBackendMessage(error.response?.data)
        setMessage(backendMessage || 'No se pudo guardar Plato del Mes.')
      } else {
        setMessage('No se pudo guardar Plato del Mes.')
      }
      setMessageSeverity('error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (dish: DishOfMonth) => {
    if (!window.confirm('¿Eliminar este registro de Plato del Mes?')) {
      return
    }

    try {
      await platoDelMesService.delete(dish.id)
      await loadData()
      setMessage('Registro eliminado correctamente.')
      setMessageSeverity('success')
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const backendMessage = extractBackendMessage(error.response?.data)
        setMessage(backendMessage || 'No se pudo eliminar el registro.')
      } else {
        setMessage('No se pudo eliminar el registro.')
      }
      setMessageSeverity('error')
    }
  }

  return (
    <Box sx={{ color: COLOR_TEXT }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <StarIcon sx={{ color: COLOR_GOLD }} />
        <Typography
          variant="h4"
          sx={{ fontWeight: 'bold', color: COLOR_GOLD, fontFamily: '"Playfair Display", serif' }}
        >
          Plato del Mes
        </Typography>
      </Box>

      <Paper
        sx={{
          p: 3,
          borderRadius: 2,
          backgroundColor: 'rgba(10,10,10,0.72)',
          border: '1px solid rgba(212,175,55,0.45)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
          mb: 3,
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', md: 'center' } }}
        >
          <Typography sx={{ color: 'rgba(243,233,210,0.82)' }}>
            Gestión del plato destacado actual y su historial.
          </Typography>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreateDialog}
            disabled={products.length === 0}
            sx={{ backgroundColor: COLOR_MAROON, '&:hover': { backgroundColor: '#781826' } }}
          >
            Nuevo Plato del Mes
          </Button>
        </Stack>
      </Paper>

      {message ? (
        <Alert severity={messageSeverity} sx={{ mb: 2 }}>
          {message}
        </Alert>
      ) : null}

      {loading ? (
        <Box
          sx={{
            py: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 2,
            backgroundColor: 'rgba(10,10,10,0.72)',
            border: '1px solid rgba(212,175,55,0.45)',
          }}
        >
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={2.5}>
          <Paper
            sx={{
              p: 2.2,
              borderRadius: 2,
              backgroundColor: 'rgba(10,10,10,0.72)',
              border: '1px solid rgba(212,175,55,0.45)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
            }}
          >
            <Typography
              variant="h6"
              sx={{ color: COLOR_GOLD, mb: 1.5, fontFamily: '"Playfair Display", serif' }}
            >
              Plato del Mes Actual
            </Typography>

            {currentDish ? (
              <Card
                sx={{
                  border: '1px solid rgba(212,175,55,0.4)',
                  borderRadius: 2,
                  background: 'rgba(16, 16, 16, 0.6)',
                }}
              >
                <CardContent sx={{ p: 2 }}>
                  {(() => {
                    const product = getDishProduct(currentDish)
                    return (
                      <Stack spacing={1}>
                        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box>
                            <Typography sx={{ fontFamily: '"Playfair Display", serif', fontSize: '1.25rem' }}>
                              {product?.nombre ?? 'Producto'}
                            </Typography>
                            <Typography sx={{ color: COLOR_GOLD, fontWeight: 700 }}>
                              {formatCRC(product?.precio ?? 0)}
                            </Typography>
                          </Box>

                          <Stack direction="row" spacing={0.4}>
                            <IconButton size="small" onClick={() => openEditDialog(currentDish)}>
                              <EditIcon sx={{ color: COLOR_GOLD }} fontSize="small" />
                            </IconButton>
                            <IconButton size="small" onClick={() => handleDelete(currentDish)}>
                              <DeleteIcon sx={{ color: '#ff8484' }} fontSize="small" />
                            </IconButton>
                          </Stack>
                        </Stack>

                        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                          <Chip
                            label={currentDish.activo === false ? 'Inactivo' : 'Activo'}
                            size="small"
                            variant="outlined"
                            sx={{
                              color: currentDish.activo === false ? '#ffd0d0' : '#93ffb0',
                              border: `1px solid ${currentDish.activo === false ? 'rgba(255,132,132,0.45)' : 'rgba(147,255,176,0.45)'}`,
                            }}
                          />
                          <Chip
                            label={formatMonthYear(currentDish)}
                            size="small"
                            variant="outlined"
                            sx={{ color: COLOR_TEXT, border: '1px solid rgba(212,175,55,0.5)' }}
                          />
                          <Chip
                            label={formatDateRange(currentDish)}
                            size="small"
                            variant="outlined"
                            sx={{ color: COLOR_TEXT, border: '1px solid rgba(212,175,55,0.5)' }}
                          />
                        </Stack>

                        <Typography sx={{ color: 'rgba(243,233,210,0.82)' }}>
                          {currentDish.descripcionEspecial ?? product?.descripcion ?? 'Sin descripción especial.'}
                        </Typography>
                      </Stack>
                    )
                  })()}
                </CardContent>
              </Card>
            ) : (
              <Typography sx={{ color: 'rgba(243,233,210,0.75)' }}>
                Todavía no hay plato del mes activo.
              </Typography>
            )}
          </Paper>

          <Paper
            sx={{
              p: 2.2,
              borderRadius: 2,
              backgroundColor: 'rgba(10,10,10,0.72)',
              border: '1px solid rgba(212,175,55,0.45)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
            }}
          >
            <Typography
              variant="h6"
              sx={{ color: COLOR_GOLD, mb: 1.5, fontFamily: '"Playfair Display", serif' }}
            >
              Historial
            </Typography>

            <Stack spacing={1}>
              {history.length === 0 ? (
                <Typography sx={{ color: 'rgba(243,233,210,0.75)' }}>
                  No hay historial para mostrar.
                </Typography>
              ) : null}

              {history.map((dish) => {
                const product = getDishProduct(dish)
                return (
                  <Box
                    key={dish.id}
                    sx={{
                      px: 1.5,
                      py: 1,
                      borderRadius: 1.5,
                      border: '1px solid rgba(212,175,55,0.32)',
                      backgroundColor: 'rgba(212,175,55,0.04)',
                    }}
                  >
                    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography sx={{ color: COLOR_GOLD, fontWeight: 700 }}>
                          {product?.nombre ?? 'Producto'}
                        </Typography>
                        <Typography sx={{ color: 'rgba(243,233,210,0.78)', fontSize: '0.9rem' }}>
                          {formatMonthYear(dish)} · {formatDateRange(dish)} · {formatCRC(product?.precio ?? 0)}
                        </Typography>
                      </Box>

                      <Stack direction="row" spacing={0.4}>
                        <IconButton size="small" onClick={() => openEditDialog(dish)}>
                          <EditIcon sx={{ color: COLOR_GOLD }} fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDelete(dish)}>
                          <DeleteIcon sx={{ color: '#ff8484' }} fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Stack>
                  </Box>
                )
              })}
            </Stack>
          </Paper>
        </Stack>
      )}

      <Dialog open={isDialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>{editingDishId === null ? 'Nuevo Plato del Mes' : 'Editar Plato del Mes'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Producto"
              select
              value={form.productId}
              onChange={(event) => setForm((prev) => ({ ...prev, productId: event.target.value }))}
              fullWidth
            >
              {products.map((product) => (
                <MenuItem key={product.id} value={String(product.id)}>
                  {product.nombre} · {formatCRC(product.precio)}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Descripción especial"
              value={form.descripcionEspecial}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, descripcionEspecial: event.target.value }))
              }
              fullWidth
              multiline
              minRows={3}
            />

            <TextField
              label="Fecha inicio"
              type="date"
              value={form.fechaInicio}
              onChange={(event) => setForm((prev) => ({ ...prev, fechaInicio: event.target.value }))}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />

            <TextField
              label="Fecha fin"
              type="date"
              value={form.fechaFin}
              onChange={(event) => setForm((prev) => ({ ...prev, fechaFin: event.target.value }))}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />

            <TextField
              label="Estado"
              select
              value={form.activo}
              onChange={(event) => setForm((prev) => ({ ...prev, activo: event.target.value }))}
              fullWidth
            >
              <MenuItem value="true">Activo</MenuItem>
              <MenuItem value="false">Inactivo</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSave} variant="contained" disabled={submitting} startIcon={<RestaurantMenuIcon />}>
            {submitting ? <CircularProgress size={18} color="inherit" /> : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
