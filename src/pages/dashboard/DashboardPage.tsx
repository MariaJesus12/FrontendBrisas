import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { Alert, Box, Button, Chip, Grid, Paper, Stack, TextField, Typography } from '@mui/material'
import EventSeatIcon from '@mui/icons-material/EventSeat'
import ReceiptIcon from '@mui/icons-material/Receipt'
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu'
import StarIcon from '@mui/icons-material/Star'
import PeopleAltIcon from '@mui/icons-material/PeopleAlt'
import CampaignIcon from '@mui/icons-material/Campaign'
import QueryStatsIcon from '@mui/icons-material/QueryStats'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { normalizeRole } from '@/utils/roles'
import { tipoCambioService, type TipoCambio } from '@/services/tipo-cambio.service'
import { monedasService, type Moneda } from '@/services/monedas.service'

const COLOR_GOLD = '#D4AF37'
const COLOR_TEXT = '#F3E9D2'
const COLOR_MAROON = '#8F1D2E'

interface TipoCambioFormState {
  compra: string
  venta: string
  fecha: string
}

const initialTipoCambioForm: TipoCambioFormState = {
  compra: '',
  venta: '',
  fecha: '',
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

function normalizeTipoCambioRecord(item: unknown): TipoCambio | null {
  if (typeof item !== 'object' || item === null) {
    return null
  }

  const record = item as Record<string, unknown>
  const id = Number(record.id ?? record.tipoCambioId ?? record.tipo_cambio_id ?? 0)
  if (!Number.isFinite(id) || id <= 0) {
    return null
  }

  const compra = Number(record.compra ?? record.tipoCambioCompra ?? record.buy ?? record.valorCompra ?? record.valor ?? 0)
  const venta = Number(record.venta ?? record.tipoCambioVenta ?? record.sell ?? record.valorVenta ?? record.valor ?? 0)
  const rawActivo = record.activo ?? record.active ?? record.isActive
  const usuarioId = Number(record.usuario_id ?? record.usuarioId ?? 0)
  const activo =
    typeof rawActivo === 'number'
      ? rawActivo === 1
      : typeof rawActivo === 'string'
        ? rawActivo === '1' || rawActivo.toLowerCase() === 'true'
        : Boolean(rawActivo)

  return {
    id,
    compra: Number.isFinite(compra) ? compra : 0,
    venta: Number.isFinite(venta) ? venta : 0,
    fecha:
      typeof record.fecha === 'string'
        ? record.fecha
        : typeof record.fecha_vigencia === 'string'
          ? record.fecha_vigencia
          : typeof record.fechaVigencia === 'string'
            ? record.fechaVigencia
            : undefined,
    activo,
    usuarioId: Number.isFinite(usuarioId) && usuarioId > 0 ? usuarioId : undefined,
    createdAt:
      typeof record.createdAt === 'string'
        ? record.createdAt
        : typeof record.created_at === 'string'
          ? record.created_at
          : undefined,
    updatedAt:
      typeof record.updatedAt === 'string'
        ? record.updatedAt
        : typeof record.updated_at === 'string'
          ? record.updated_at
          : undefined,
  }
}

function normalizeMonedaRecord(item: unknown): Moneda | null {
  if (typeof item !== 'object' || item === null) {
    return null
  }

  const record = item as Record<string, unknown>
  const id = Number(record.id ?? record.monedaId ?? 0)
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
    createdAt: typeof record.created_at === 'string' ? record.created_at : undefined,
    updatedAt: typeof record.updated_at === 'string' ? record.updated_at : undefined,
  }
}

function unwrapMonedasPayload(payload: unknown): Moneda[] {
  if (Array.isArray(payload)) {
    return payload.map((item) => normalizeMonedaRecord(item)).filter((item): item is Moneda => item !== null)
  }

  if (typeof payload === 'object' && payload !== null) {
    const record = payload as Record<string, unknown>
    const keys = ['data', 'items', 'results', 'monedas']

    for (const key of keys) {
      const value = record[key]
      if (Array.isArray(value)) {
        return value.map((item) => normalizeMonedaRecord(item)).filter((item): item is Moneda => item !== null)
      }
    }
  }

  return []
}

function unwrapTipoCambioPayload(payload: unknown): TipoCambio[] {
  if (Array.isArray(payload)) {
    return payload.map((item) => normalizeTipoCambioRecord(item)).filter((item): item is TipoCambio => item !== null)
  }

  if (typeof payload === 'object' && payload !== null) {
    const record = payload as Record<string, unknown>
    const keys = ['data', 'items', 'results', 'tipoCambio', 'tiposCambio']

    for (const key of keys) {
      const value = record[key]
      if (Array.isArray(value)) {
        return value
          .map((item) => normalizeTipoCambioRecord(item))
          .filter((item): item is TipoCambio => item !== null)
      }
    }
  }

  return []
}

const adminCards = [
  { label: 'Estadísticas productos', icon: QueryStatsIcon, path: '/admin/estadisticas-productos' },
  { label: 'Mesas', icon: EventSeatIcon, path: '/mesas' },
  { label: 'Reservaciones', icon: EventSeatIcon, path: '/reservaciones' },
  { label: 'Pedidos para llevar', icon: ReceiptIcon, path: '/pedidos-llevar' },
  { label: 'Pedidos', icon: ReceiptIcon, path: '/pedidos' },
  { label: 'Platos en Menú', icon: RestaurantMenuIcon, path: '/menu' },
  { label: 'Plato del Mes', icon: StarIcon, path: '/plato-del-mes' },
  { label: 'Anuncios', icon: CampaignIcon, path: '/anuncios' },
  { label: 'Usuarios', icon: PeopleAltIcon, path: '/usuarios' },
]

const staffCards = [
  { label: 'Mesas', icon: EventSeatIcon, path: '/mesas' },
  { label: 'Reservaciones', icon: EventSeatIcon, path: '/reservaciones' },
  { label: 'Pedidos', icon: ReceiptIcon, path: '/pedidos' },
]

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const role = normalizeRole(user)
  const cards = role === 'ADMIN' ? adminCards : staffCards
  const isMesero = role === 'MESERO'
  const [tipoCambioList, setTipoCambioList] = useState<TipoCambio[]>([])
  const [selectedTipoCambioId, setSelectedTipoCambioId] = useState('')
  const [tipoCambioForm, setTipoCambioForm] = useState<TipoCambioFormState>(initialTipoCambioForm)
  const [tipoCambioLoading, setTipoCambioLoading] = useState(false)
  const [tipoCambioSaving, setTipoCambioSaving] = useState(false)
  const [tipoCambioError, setTipoCambioError] = useState<string | null>(null)
  const [monedasList, setMonedasList] = useState<Moneda[]>([])
  const [monedasLoading, setMonedasLoading] = useState(false)
  const [monedasError, setMonedasError] = useState<string | null>(null)

  const latestTipoCambio = useMemo(() => {
    if (tipoCambioList.length === 0) {
      return null
    }

    return [...tipoCambioList].sort((left, right) => {
      const rightDate = right.fecha ?? right.updatedAt ?? right.createdAt ?? ''
      const leftDate = left.fecha ?? left.updatedAt ?? left.createdAt ?? ''
      return new Date(rightDate).getTime() - new Date(leftDate).getTime()
    })[0]
  }, [tipoCambioList])

  useEffect(() => {
    if (!isMesero) {
      return
    }

    void loadTipoCambioList()
    void loadMonedasList()
  }, [isMesero])

  async function loadMonedasList() {
    setMonedasLoading(true)
    setMonedasError(null)

    try {
      const response = await monedasService.getAll()
      const list = unwrapMonedasPayload(response.data)
      setMonedasList(list)
    } catch (error) {
      const backendMessage =
        axios.isAxiosError(error) && error.response ? extractBackendMessage(error.response.data) : ''
      setMonedasError(backendMessage || 'No fue posible cargar las monedas del sistema.')
    } finally {
      setMonedasLoading(false)
    }
  }

  async function loadTipoCambioList() {
    setTipoCambioLoading(true)
    setTipoCambioError(null)

    try {
      const response = await tipoCambioService.getAll()
      const list = unwrapTipoCambioPayload(response.data)
      setTipoCambioList(list)

      if (list.length > 0 && !selectedTipoCambioId) {
        const first = list[0]
        setSelectedTipoCambioId(String(first.id))
        setTipoCambioForm({
          compra: String(first.compra),
          venta: String(first.venta),
          fecha: first.fecha ?? '',
        })
      }
    } catch (error) {
      const backendMessage =
        axios.isAxiosError(error) && error.response ? extractBackendMessage(error.response.data) : ''
      setTipoCambioError(backendMessage || 'No fue posible cargar los tipos de cambio.')
    } finally {
      setTipoCambioLoading(false)
    }
  }

  async function handleCreateTipoCambio() {
    const compra = Number(tipoCambioForm.compra)
    const venta = Number(tipoCambioForm.venta)

    if (!Number.isFinite(compra) || compra <= 0 || !Number.isFinite(venta) || venta <= 0) {
      setTipoCambioError('Ingresa valores válidos para compra y venta.')
      return
    }

    const usuarioId = Number(user?.id ?? 0)
    if (!Number.isFinite(usuarioId) || usuarioId <= 0) {
      setTipoCambioError('No se pudo identificar el usuario para registrar el tipo de cambio.')
      return
    }

    const fecha = tipoCambioForm.fecha || new Date().toISOString().slice(0, 10)

    setTipoCambioSaving(true)
    setTipoCambioError(null)

    try {
      await tipoCambioService.create({
        fecha,
        compra,
        venta,
        activo: true,
        usuarioId,
      })

      await loadTipoCambioList()
      setTipoCambioForm(initialTipoCambioForm)
      setSelectedTipoCambioId('')
    } catch (error) {
      const backendMessage =
        axios.isAxiosError(error) && error.response ? extractBackendMessage(error.response.data) : ''
      setTipoCambioError(backendMessage || 'No fue posible crear el tipo de cambio.')
    } finally {
      setTipoCambioSaving(false)
    }
  }

  async function handleUpdateTipoCambio() {
    const id = Number(selectedTipoCambioId)
    if (!Number.isFinite(id) || id <= 0) {
      setTipoCambioError('Selecciona un tipo de cambio para actualizar.')
      return
    }

    const compra = Number(tipoCambioForm.compra)
    const venta = Number(tipoCambioForm.venta)

    if (!Number.isFinite(compra) || compra <= 0 || !Number.isFinite(venta) || venta <= 0) {
      setTipoCambioError('Ingresa valores válidos para compra y venta.')
      return
    }

    const usuarioId = Number(user?.id ?? 0)
    if (!Number.isFinite(usuarioId) || usuarioId <= 0) {
      setTipoCambioError('No se pudo identificar el usuario para actualizar el tipo de cambio.')
      return
    }

    const fecha = tipoCambioForm.fecha || new Date().toISOString().slice(0, 10)

    setTipoCambioSaving(true)
    setTipoCambioError(null)

    try {
      await tipoCambioService.update(id, {
        fecha,
        compra,
        venta,
        activo: true,
        usuarioId,
      })

      await loadTipoCambioList()
    } catch (error) {
      const backendMessage =
        axios.isAxiosError(error) && error.response ? extractBackendMessage(error.response.data) : ''
      setTipoCambioError(backendMessage || 'No fue posible actualizar el tipo de cambio.')
    } finally {
      setTipoCambioSaving(false)
    }
  }

  return (
    <Box sx={{ color: COLOR_TEXT }}>
      <Typography
        variant="h4"
        sx={{ fontWeight: 'bold', color: COLOR_GOLD, fontFamily: '"Playfair Display", serif' }}
        gutterBottom
      >
        Dashboard
      </Typography>
      <Typography variant="body1" sx={{ mb: 3, color: 'rgba(243,233,210,0.8)' }}>
        {role === 'ADMIN'
          ? 'Bienvenido al panel de gestión de Brisas'
          : 'Panel operativo para mesas, reservaciones y pedidos'}
      </Typography>
      <Grid container spacing={3}>
        {cards.map(({ label, icon: Icon, path }) => (
          <Grid key={label} size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper
              component="button"
              type="button"
              onClick={() => navigate(path)}
              sx={{
                width: '100%',
                p: 3,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1,
                backgroundColor: 'rgba(10,10,10,0.72)',
                border: '1px solid rgba(212,175,55,0.45)',
                color: COLOR_TEXT,
                boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease',
                '&:hover': {
                  transform: 'translateY(-3px)',
                  borderColor: 'rgba(212,175,55,0.68)',
                  boxShadow: '0 14px 36px rgba(0,0,0,0.45)',
                },
                '&:focus-visible': {
                  outline: '2px solid rgba(212,175,55,0.95)',
                  outlineOffset: 2,
                },
              }}
            >
              <Box
                sx={{
                  color: COLOR_GOLD,
                  border: '1px solid rgba(212,175,55,0.55)',
                  backgroundColor: 'rgba(212,175,55,0.08)',
                  borderRadius: '50%',
                  p: 1.5,
                  display: 'flex',
                }}
              >
                <Icon />
              </Box>
              <Typography
                variant="h6"
                sx={{ fontWeight: 500, fontFamily: '"Cormorant Garamond", serif' }}
                align="center"
              >
                {label}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {isMesero ? (
        <Paper
          sx={{
            mt: 3,
            p: { xs: 2, md: 3 },
            borderRadius: 3,
            backgroundColor: 'rgba(10,10,10,0.72)',
            border: '1px solid rgba(212,175,55,0.32)',
            boxShadow: '0 12px 30px rgba(0,0,0,0.3)',
          }}
        >
          <Stack spacing={2.5}>
            <Box>
              <Typography
                variant="h5"
                sx={{ fontWeight: 800, color: COLOR_GOLD, fontFamily: '"Cormorant Garamond", serif' }}
              >
                Tipo de cambio
              </Typography>
              <Typography sx={{ color: 'rgba(243,233,210,0.8)', mt: 0.5 }}>
                Consulta y actualiza el tipo de cambio vigente para operaciones del día.
              </Typography>
            </Box>

            {latestTipoCambio ? (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Paper
                  sx={{
                    p: 1.5,
                    flex: 1,
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(212,175,55,0.18)',
                  }}
                >
                  <Typography sx={{ color: 'rgba(243,233,210,0.72)', fontSize: '0.85rem' }}>Compra</Typography>
                  <Typography sx={{ color: COLOR_TEXT, fontWeight: 700 }}>{latestTipoCambio.compra.toFixed(4)}</Typography>
                </Paper>
                <Paper
                  sx={{
                    p: 1.5,
                    flex: 1,
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(212,175,55,0.18)',
                  }}
                >
                  <Typography sx={{ color: 'rgba(243,233,210,0.72)', fontSize: '0.85rem' }}>Venta</Typography>
                  <Typography sx={{ color: COLOR_GOLD, fontWeight: 800, fontSize: '1.1rem' }}>
                    {latestTipoCambio.venta.toFixed(4)}
                  </Typography>
                </Paper>
              </Stack>
            ) : null}

            {monedasError ? <Alert severity="warning">{monedasError}</Alert> : null}

            <Paper
              sx={{
                p: 1.5,
                backgroundColor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(212,175,55,0.18)',
              }}
            >
              <Typography sx={{ color: 'rgba(243,233,210,0.72)', fontSize: '0.85rem', mb: 1 }}>
                Monedas registradas en el sistema
              </Typography>
              {monedasLoading ? (
                <Typography sx={{ color: COLOR_TEXT }}>Cargando monedas...</Typography>
              ) : (
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                  {monedasList.length > 0 ? (
                    monedasList.map((moneda) => {
                      const label = moneda.codigo ?? moneda.nombre ?? `Moneda ${moneda.id}`
                      const chipLabel = moneda.simbolo ? `${label} (${moneda.simbolo})` : label

                      return (
                        <Chip
                          key={moneda.id}
                          label={chipLabel}
                          size="small"
                          sx={{
                            color: COLOR_TEXT,
                            backgroundColor: 'rgba(212,175,55,0.14)',
                            border: '1px solid rgba(212,175,55,0.3)',
                            '& .MuiChip-label': { color: COLOR_TEXT },
                          }}
                        />
                      )
                    })
                  ) : (
                    <Typography sx={{ color: COLOR_TEXT }}>No hay monedas disponibles.</Typography>
                  )}
                </Stack>
              )}
            </Paper>

            {tipoCambioError ? <Alert severity="error">{tipoCambioError}</Alert> : null}

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                gap: 2,
              }}
            >
              <TextField
                label="Compra"
                type="number"
                value={tipoCambioForm.compra}
                onChange={(event) => setTipoCambioForm((current) => ({ ...current, compra: event.target.value }))}
                fullWidth
                sx={{
                  '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                  '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                }}
              />

              <TextField
                label="Venta"
                type="number"
                value={tipoCambioForm.venta}
                onChange={(event) => setTipoCambioForm((current) => ({ ...current, venta: event.target.value }))}
                fullWidth
                sx={{
                  '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                  '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                }}
              />

              <TextField
                label="Fecha"
                type="date"
                value={tipoCambioForm.fecha}
                onChange={(event) => setTipoCambioForm((current) => ({ ...current, fecha: event.target.value }))}
                fullWidth
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
                  setSelectedTipoCambioId('')
                  setTipoCambioForm(initialTipoCambioForm)
                }}
                sx={{ color: COLOR_TEXT, borderColor: 'rgba(212,175,55,0.38)' }}
                disabled={tipoCambioSaving || tipoCambioLoading}
              >
                Limpiar
              </Button>
              <Button
                variant="outlined"
                onClick={() => void loadTipoCambioList()}
                sx={{ color: COLOR_GOLD, borderColor: 'rgba(212,175,55,0.45)' }}
                disabled={tipoCambioSaving || tipoCambioLoading}
              >
                Recargar
              </Button>
              <Button
                variant="contained"
                onClick={() => void handleCreateTipoCambio()}
                disabled={tipoCambioSaving || tipoCambioLoading}
                sx={{ backgroundColor: COLOR_MAROON, '&:hover': { backgroundColor: '#a42535' } }}
              >
                Agregar
              </Button>
              <Button
                variant="contained"
                onClick={() => void handleUpdateTipoCambio()}
                disabled={tipoCambioSaving || tipoCambioLoading || !selectedTipoCambioId}
                sx={{
                  background: 'linear-gradient(135deg, #D4AF37 0%, #f2d36f 100%)',
                  color: '#1a1208',
                  fontWeight: 700,
                }}
              >
                Actualizar
              </Button>
            </Stack>
          </Stack>
        </Paper>
      ) : null}
    </Box>
  )
}
