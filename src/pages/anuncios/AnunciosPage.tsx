import { useEffect, useState } from 'react'
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
import CampaignIcon from '@mui/icons-material/Campaign'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import ImageIcon from '@mui/icons-material/Image'
import type { Announcement, AnnouncementType, CreateAnnouncementDto } from '@/types/announcement.types'
import { announcementsService } from '@/services/announcements.service'

const COLOR_GOLD = '#D4AF37'
const COLOR_TEXT = '#F3E9D2'
const COLOR_MAROON = '#8F1D2E'

interface AnnouncementFormState {
  titulo: string
  descripcion: string
  imagen: string
  fechaInicio: string
  fechaFin: string
  horaInicio: string
  horaFin: string
  prioridad: string
  activo: string
  tipo: string
}

const ANNOUNCEMENT_TYPES: AnnouncementType[] = [
  'PROMOCION',
  'EVENTO',
  'INFORMATIVO',
  'PLATO_DEL_DIA',
]

function normalizeAnnouncementType(value: unknown): AnnouncementType {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : ''

  if (raw === 'INFO' || raw === 'AVISO') {
    return 'INFORMATIVO'
  }

  if (raw === 'PROMOCION' || raw === 'EVENTO' || raw === 'INFORMATIVO' || raw === 'PLATO_DEL_DIA') {
    return raw
  }

  return 'PROMOCION'
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

function toPositiveNumber(value: unknown): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

function toActiveFlag(value: unknown): number {
  if (typeof value === 'boolean') {
    return value ? 1 : 0
  }

  if (typeof value === 'number') {
    return value === 1 ? 1 : 0
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (
      normalized === '1' ||
      normalized === 'true' ||
      normalized === 'activo' ||
      normalized === 'activa' ||
      normalized === 'active' ||
      normalized === 'publicado' ||
      normalized === 'published'
    ) {
      return 1
    }
    return 0
  }

  return 0
}

function normalizeAnnouncement(item: unknown): Announcement | null {
  if (typeof item !== 'object' || item === null) {
    return null
  }

  const record = item as Record<string, unknown>
  const id = toPositiveNumber(record.id ?? record.announcementId ?? record.announcement_id)
  if (id === null) {
    return null
  }

  const prioridad = Number(record.prioridad ?? record.priority ?? 0)
  const activoValue =
    record.activo ??
    record.active ??
    record.isActive ??
    record.is_active ??
    record.visible ??
    record.publicado ??
    record.published ??
    0

  return {
    id,
    titulo:
      typeof record.titulo === 'string'
        ? record.titulo
        : typeof record.title === 'string'
          ? record.title
          : `Anuncio #${id}`,
    descripcion:
      typeof record.descripcion === 'string'
        ? record.descripcion
        : typeof record.description === 'string'
          ? record.description
          : undefined,
    imagen:
      typeof record.imagen === 'string'
        ? record.imagen
        : typeof record.image === 'string'
          ? record.image
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
    horaInicio:
      typeof record.horaInicio === 'string'
        ? record.horaInicio
        : typeof record.hora_inicio === 'string'
          ? record.hora_inicio
          : typeof record.startTime === 'string'
            ? record.startTime
            : undefined,
    horaFin:
      typeof record.horaFin === 'string'
        ? record.horaFin
        : typeof record.hora_fin === 'string'
          ? record.hora_fin
          : typeof record.endTime === 'string'
            ? record.endTime
            : undefined,
    prioridad: Number.isFinite(prioridad) ? prioridad : 0,
    activo: toActiveFlag(activoValue),
    tipo:
      typeof record.tipo === 'string'
        ? normalizeAnnouncementType(record.tipo)
        : typeof record.tipoenum === 'string'
          ? normalizeAnnouncementType(record.tipoenum)
        : typeof record.type === 'string'
          ? normalizeAnnouncementType(record.type)
          : undefined,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : undefined,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
  }
}

function normalizeAnnouncementsPayload(payload: unknown): Announcement[] {
  if (Array.isArray(payload)) {
    return payload
      .map((item) => normalizeAnnouncement(item))
      .filter((item): item is Announcement => item !== null)
  }

  if (typeof payload === 'object' && payload !== null) {
    const container = payload as {
      data?: unknown
      items?: unknown
      announcements?: unknown
      anuncios?: unknown
      history?: unknown
      historial?: unknown
    }

    if (container.data) return normalizeAnnouncementsPayload(container.data)
    if (container.items) return normalizeAnnouncementsPayload(container.items)
    if (container.announcements) return normalizeAnnouncementsPayload(container.announcements)
    if (container.anuncios) return normalizeAnnouncementsPayload(container.anuncios)
    if (container.history) return normalizeAnnouncementsPayload(container.history)
    if (container.historial) return normalizeAnnouncementsPayload(container.historial)
  }

  return []
}

function formatDateRange(announcement: Announcement): string {
  const start = formatDateInput(announcement.fechaInicio)
  const end = formatDateInput(announcement.fechaFin)

  if (start && end) {
    return `${start} al ${end}`
  }

  if (start) {
    return `Desde ${start}`
  }

  if (end) {
    return `Hasta ${end}`
  }

  return 'Sin rango de fechas'
}

function formatTimeRange(announcement: Announcement): string {
  const start = announcement.horaInicio ?? ''
  const end = announcement.horaFin ?? ''

  if (start && end) {
    return `${start} - ${end}`
  }

  if (start) {
    return `Desde ${start}`
  }

  if (end) {
    return `Hasta ${end}`
  }

  return 'Sin rango de horas'
}

const defaultDate = getTodayISODate()

const initialForm: AnnouncementFormState = {
  titulo: '',
  descripcion: '',
  imagen: '',
  fechaInicio: defaultDate,
  fechaFin: addDaysISODate(defaultDate, 21),
  horaInicio: '00:00',
  horaFin: '23:59',
  prioridad: '10',
  activo: '1',
  tipo: 'PROMOCION',
}

export default function AnunciosPage() {
  const [currentAnnouncements, setCurrentAnnouncements] = useState<Announcement[]>([])
  const [historyAnnouncements, setHistoryAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [message, setMessage] = useState<string>('')
  const [messageSeverity, setMessageSeverity] = useState<'info' | 'success' | 'error'>('info')

  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false)
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<number | null>(null)
  const [form, setForm] = useState<AnnouncementFormState>(initialForm)

  const loadData = async () => {
    setLoading(true)

    try {
      const [currentResponse, historyResponse] = await Promise.all([
        announcementsService.getCurrent().catch((error) => {
          if (axios.isAxiosError(error) && error.response?.status === 404) {
            return { data: [] }
          }

          throw error
        }),
        announcementsService.getHistory().catch((error) => {
          if (axios.isAxiosError(error) && error.response?.status === 404) {
            return { data: [] }
          }

          throw error
        }),
      ])

      const current = normalizeAnnouncementsPayload(currentResponse.data).sort(
        (a, b) => (b.prioridad ?? 0) - (a.prioridad ?? 0),
      )
      const history = normalizeAnnouncementsPayload(historyResponse.data).sort(
        (a, b) => (b.prioridad ?? 0) - (a.prioridad ?? 0),
      )

      setCurrentAnnouncements(current)
      setHistoryAnnouncements(history)
      setMessage('')
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const backendMessage = extractBackendMessage(error.response?.data)
        setMessage(
          backendMessage ||
            `No se pudieron cargar anuncios (HTTP ${error.response?.status ?? 'sin código'}).`,
        )
      } else {
        setMessage('No se pudieron cargar anuncios.')
      }
      setMessageSeverity('error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const openCreateDialog = () => {
    setEditingAnnouncementId(null)
    setForm(initialForm)
    setIsDialogOpen(true)
  }

  const openEditDialog = (announcement: Announcement) => {
    setEditingAnnouncementId(announcement.id)
    setForm({
      titulo: announcement.titulo,
      descripcion: announcement.descripcion ?? '',
      imagen: announcement.imagen ?? '',
      fechaInicio: formatDateInput(announcement.fechaInicio),
      fechaFin: formatDateInput(announcement.fechaFin),
      horaInicio: announcement.horaInicio ?? '00:00',
      horaFin: announcement.horaFin ?? '23:59',
      prioridad: String(announcement.prioridad ?? 10),
      activo: String(typeof announcement.activo === 'boolean' ? (announcement.activo ? 1 : 0) : Number(announcement.activo) || 0),
      tipo: normalizeAnnouncementType(announcement.tipo),
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
    if (!form.titulo.trim()) {
      setMessage('El título del anuncio es obligatorio.')
      setMessageSeverity('error')
      return
    }

    if (!form.fechaInicio.trim() || !form.fechaFin.trim()) {
      setMessage('La fecha de inicio y fecha de fin son obligatorias.')
      setMessageSeverity('error')
      return
    }

    if (new Date(form.fechaInicio).getTime() > new Date(form.fechaFin).getTime()) {
      setMessage('La fecha de inicio no puede ser mayor que la fecha de fin.')
      setMessageSeverity('error')
      return
    }

    const prioridad = Number(form.prioridad)
    if (!Number.isFinite(prioridad)) {
      setMessage('La prioridad debe ser un número válido.')
      setMessageSeverity('error')
      return
    }

    const activo = Number(form.activo)
    if (![0, 1].includes(activo)) {
      setMessage('El estado activo debe ser 1 o 0.')
      setMessageSeverity('error')
      return
    }

    const tipo = normalizeAnnouncementType(form.tipo)

    const payload: CreateAnnouncementDto = {
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim() || undefined,
      imagen: form.imagen.trim() || undefined,
      fechaInicio: form.fechaInicio,
      fechaFin: form.fechaFin,
      horaInicio: form.horaInicio || undefined,
      horaFin: form.horaFin || undefined,
      prioridad,
      activo: activo === 1,
      tipo,
    }

    setSubmitting(true)

    try {
      if (editingAnnouncementId === null) {
        await announcementsService.create(payload)
      } else {
        await announcementsService.update(editingAnnouncementId, payload)
      }

      await loadData()
      setIsDialogOpen(false)
      setMessage(editingAnnouncementId === null ? 'Anuncio creado correctamente.' : 'Anuncio actualizado correctamente.')
      setMessageSeverity('success')
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const backendMessage = extractBackendMessage(error.response?.data)
        setMessage(backendMessage || 'No se pudo guardar el anuncio.')
      } else {
        setMessage('No se pudo guardar el anuncio.')
      }
      setMessageSeverity('error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (announcement: Announcement) => {
    if (!window.confirm(`¿Eliminar el anuncio "${announcement.titulo}"?`)) {
      return
    }

    try {
      await announcementsService.delete(announcement.id)
      await loadData()
      setMessage('Anuncio eliminado correctamente.')
      setMessageSeverity('success')
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const backendMessage = extractBackendMessage(error.response?.data)
        setMessage(backendMessage || 'No se pudo eliminar el anuncio.')
      } else {
        setMessage('No se pudo eliminar el anuncio.')
      }
      setMessageSeverity('error')
    }
  }

  const renderAnnouncementCard = (announcement: Announcement) => {
    return (
      <Card
        key={announcement.id}
        sx={{
          border: '1px solid rgba(212,175,55,0.4)',
          borderRadius: 2,
          background: 'rgba(16, 16, 16, 0.6)',
        }}
      >
        <CardContent sx={{ p: 2 }}>
          <Stack spacing={1.2}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box>
                <Typography sx={{ fontFamily: '"Playfair Display", serif', fontSize: '1.2rem', color: COLOR_TEXT }}>
                  {announcement.titulo}
                </Typography>
                <Typography sx={{ color: 'rgba(243,233,210,0.8)', fontSize: '0.95rem' }}>
                  {announcement.descripcion ?? 'Sin descripción.'}
                </Typography>
              </Box>

              <Stack direction="row" spacing={0.4}>
                <IconButton size="small" onClick={() => openEditDialog(announcement)}>
                  <EditIcon sx={{ color: COLOR_GOLD }} fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={() => handleDelete(announcement)}>
                  <DeleteIcon sx={{ color: '#ff8484' }} fontSize="small" />
                </IconButton>
              </Stack>
            </Stack>

            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
              <Chip
                label={`Prioridad ${announcement.prioridad ?? 0}`}
                size="small"
                variant="outlined"
                sx={{ color: COLOR_TEXT, borderColor: 'rgba(212,175,55,0.55)' }}
              />
              <Chip
                label={announcement.tipo ?? 'GENERAL'}
                size="small"
                variant="outlined"
                sx={{ color: COLOR_GOLD, borderColor: 'rgba(212,175,55,0.75)' }}
              />
              <Chip
                label={Number(announcement.activo ?? 0) === 1 ? 'Activo' : 'Inactivo'}
                size="small"
                variant="outlined"
                sx={{
                  color: Number(announcement.activo ?? 0) === 1 ? '#93ffb0' : '#ffd0d0',
                  border: `1px solid ${Number(announcement.activo ?? 0) === 1 ? 'rgba(147,255,176,0.45)' : 'rgba(255,132,132,0.45)'}`,
                }}
              />
              <Chip
                label={formatDateRange(announcement)}
                size="small"
                variant="outlined"
                sx={{ color: COLOR_TEXT, borderColor: 'rgba(212,175,55,0.45)' }}
              />
              <Chip
                label={formatTimeRange(announcement)}
                size="small"
                variant="outlined"
                sx={{ color: COLOR_TEXT, borderColor: 'rgba(212,175,55,0.45)' }}
              />
              {announcement.imagen ? (
                <Chip
                  icon={<ImageIcon />}
                  label="Con imagen"
                  size="small"
                  variant="outlined"
                  sx={{ color: COLOR_TEXT, borderColor: 'rgba(212,175,55,0.45)' }}
                />
              ) : null}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    )
  }

  return (
    <Box sx={{ color: COLOR_TEXT }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <CampaignIcon sx={{ color: COLOR_GOLD }} />
        <Typography
          variant="h4"
          sx={{ fontWeight: 'bold', color: COLOR_GOLD, fontFamily: '"Playfair Display", serif' }}
        >
          Anuncios
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
            Gestiona anuncios activos e historial para la portada pública.
          </Typography>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreateDialog}
            sx={{ backgroundColor: COLOR_MAROON, '&:hover': { backgroundColor: '#781826' } }}
          >
            Nuevo Anuncio
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
              Anuncios Activos
            </Typography>

            <Stack spacing={1.2}>
              {currentAnnouncements.length === 0 ? (
                <Typography sx={{ color: 'rgba(243,233,210,0.75)' }}>
                  No hay anuncios activos para mostrar.
                </Typography>
              ) : null}
              {currentAnnouncements.map((announcement) => renderAnnouncementCard(announcement))}
            </Stack>
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

            <Stack spacing={1.2}>
              {historyAnnouncements.length === 0 ? (
                <Typography sx={{ color: 'rgba(243,233,210,0.75)' }}>
                  No hay historial para mostrar.
                </Typography>
              ) : null}
              {historyAnnouncements.map((announcement) => renderAnnouncementCard(announcement))}
            </Stack>
          </Paper>
        </Stack>
      )}

      <Dialog open={isDialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle sx={{ backgroundColor: '#160f0c', color: COLOR_GOLD, fontWeight: 800 }}>
          {editingAnnouncementId === null ? 'Nuevo Anuncio' : 'Editar Anuncio'}
        </DialogTitle>
        <DialogContent
          sx={{
            backgroundColor: '#160f0c',
            pt: 3,
            '& .MuiInputLabel-root, & .MuiInputBase-input, & .MuiSelect-select, & .MuiFormHelperText-root': {
              color: COLOR_TEXT,
            },
            '& .MuiInputBase-input': {
              WebkitTextFillColor: COLOR_TEXT,
            },
            '& .MuiOutlinedInput-root': {
              color: COLOR_TEXT,
              backgroundColor: 'rgba(255,255,255,0.03)',
            },
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(212,175,55,0.35)',
            },
          }}
        >
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Título"
              value={form.titulo}
              onChange={(event) => setForm((prev) => ({ ...prev, titulo: event.target.value }))}
              fullWidth
            />

            <TextField
              label="Descripción"
              value={form.descripcion}
              onChange={(event) => setForm((prev) => ({ ...prev, descripcion: event.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />

            <TextField
              label="Imagen (URL)"
              value={form.imagen}
              onChange={(event) => setForm((prev) => ({ ...prev, imagen: event.target.value }))}
              fullWidth
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

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Hora inicio"
                type="time"
                value={form.horaInicio}
                onChange={(event) => setForm((prev) => ({ ...prev, horaInicio: event.target.value }))}
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />

              <TextField
                label="Hora fin"
                type="time"
                value={form.horaFin}
                onChange={(event) => setForm((prev) => ({ ...prev, horaFin: event.target.value }))}
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Prioridad"
                type="number"
                value={form.prioridad}
                onChange={(event) => setForm((prev) => ({ ...prev, prioridad: event.target.value }))}
                fullWidth
              />

              <TextField
                label="Activo"
                select
                value={form.activo}
                onChange={(event) => setForm((prev) => ({ ...prev, activo: event.target.value }))}
                fullWidth
              >
                <MenuItem value="1">Sí (1)</MenuItem>
                <MenuItem value="0">No (0)</MenuItem>
              </TextField>
            </Stack>

            <TextField
              label="Tipo"
              select
              value={form.tipo}
              onChange={(event) => setForm((prev) => ({ ...prev, tipo: event.target.value }))}
              fullWidth
            >
              {ANNOUNCEMENT_TYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#160f0c', p: 2.5 }}>
          <Button onClick={closeDialog} disabled={submitting} sx={{ color: COLOR_TEXT }}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={submitting}
            sx={{ backgroundColor: COLOR_MAROON, '&:hover': { backgroundColor: '#a42535' } }}
          >
            {submitting ? <CircularProgress size={18} color="inherit" /> : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
