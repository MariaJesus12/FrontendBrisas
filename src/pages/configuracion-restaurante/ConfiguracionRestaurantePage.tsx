import { useEffect, useState } from 'react'
import axios from 'axios'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import StorefrontIcon from '@mui/icons-material/Storefront'
import type { RestaurantConfig, UpsertRestaurantConfigDto } from '@/types/configuracion-restaurante.types'
import {
  normalizeRestaurantConfigListPayload,
  normalizeRestaurantConfigPayload,
  restaurantConfigService,
} from '@/services/configuracion-restaurante.service'

const COLOR_GOLD = '#D4AF37'
const COLOR_TEXT = '#F3E9D2'
const COLOR_MAROON = '#8F1D2E'

interface RestaurantConfigFormState {
  nombre: string
  telefono: string
  whatsapp: string
  instagramUrl: string
  facebookUrl: string
  tripadvisorUrl: string
  googleMapsUrl: string
  direccion: string
  horario: string
}

const initialForm: RestaurantConfigFormState = {
  nombre: 'Brisas del Lago',
  telefono: '',
  whatsapp: '',
  instagramUrl: '',
  facebookUrl: '',
  tripadvisorUrl: '',
  googleMapsUrl: '',
  direccion: '',
  horario: '',
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

function sanitizeWhatsapp(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  const waMatch = trimmed.match(/wa\.me\/(\d+)/i)
  if (waMatch?.[1]) {
    return waMatch[1]
  }

  const digits = trimmed.replace(/\D/g, '')
  return digits || trimmed
}

function fromConfig(config: RestaurantConfig): RestaurantConfigFormState {
  return {
    nombre: config.nombre,
    telefono: config.telefono,
    whatsapp: config.whatsapp,
    instagramUrl: config.instagramUrl ?? '',
    facebookUrl: config.facebookUrl ?? '',
    tripadvisorUrl: config.tripadvisorUrl ?? '',
    googleMapsUrl: config.googleMapsUrl ?? '',
    direccion: config.direccion,
    horario: config.horario,
  }
}

export default function ConfiguracionRestaurantePage() {
  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const [configId, setConfigId] = useState<number | null>(null)
  const [form, setForm] = useState<RestaurantConfigFormState>(initialForm)
  const [message, setMessage] = useState<string>('')
  const [messageSeverity, setMessageSeverity] = useState<'info' | 'success' | 'error'>('info')

  const handleFormChange = (field: keyof RestaurantConfigFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const loadConfig = async () => {
    setLoading(true)
    try {
      const currentResponse = await restaurantConfigService.getCurrent().catch((error) => {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          return { data: null }
        }
        throw error
      })

      let currentConfig = normalizeRestaurantConfigPayload(currentResponse.data)

      if (!currentConfig) {
        const allResponse = await restaurantConfigService.getAll().catch((error) => {
          if (axios.isAxiosError(error) && error.response?.status === 404) {
            return { data: [] }
          }
          throw error
        })

        const allConfigs = normalizeRestaurantConfigListPayload(allResponse.data)
        currentConfig = allConfigs[0] ?? null
      }

      if (currentConfig) {
        setConfigId(typeof currentConfig.id === 'number' ? currentConfig.id : null)
        setForm(fromConfig(currentConfig))
        setMessage('Configuración cargada correctamente.')
        setMessageSeverity('success')
      } else {
        setConfigId(null)
        setForm(initialForm)
        setMessage('No existe una configuración guardada. Completa el formulario y presiona Guardar.')
        setMessageSeverity('info')
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const backendMessage = extractBackendMessage(error.response?.data)
        setMessage(
          backendMessage ||
            `No se pudo cargar la configuración (HTTP ${error.response?.status ?? 'sin código'}).`,
        )
      } else {
        setMessage('No se pudo cargar la configuración del restaurante.')
      }
      setMessageSeverity('error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConfig()
  }, [])

  const handleSave = async () => {
    const payload: UpsertRestaurantConfigDto = {
      nombre: form.nombre.trim(),
      telefono: form.telefono.trim(),
      whatsapp: sanitizeWhatsapp(form.whatsapp),
      instagramUrl: form.instagramUrl.trim() || undefined,
      facebookUrl: form.facebookUrl.trim() || undefined,
      tripadvisorUrl: form.tripadvisorUrl.trim() || undefined,
      googleMapsUrl: form.googleMapsUrl.trim() || undefined,
      direccion: form.direccion.trim(),
      horario: form.horario.trim(),
    }

    if (!payload.nombre || !payload.telefono || !payload.whatsapp || !payload.direccion || !payload.horario) {
      setMessage('Nombre, teléfono, WhatsApp, dirección y horario son obligatorios.')
      setMessageSeverity('error')
      return
    }

    setSaving(true)
    try {
      const response =
        configId === null
          ? await restaurantConfigService.create(payload)
          : await restaurantConfigService.update(configId, payload)

      const saved = normalizeRestaurantConfigPayload(response.data)
      if (saved) {
        setConfigId(typeof saved.id === 'number' ? saved.id : configId)
        setForm(fromConfig(saved))
      }

      setMessage(configId === null ? 'Configuración creada correctamente.' : 'Configuración actualizada correctamente.')
      setMessageSeverity('success')
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const backendMessage = extractBackendMessage(error.response?.data)
        setMessage(backendMessage || 'No se pudo guardar la configuración del restaurante.')
      } else {
        setMessage('No se pudo guardar la configuración del restaurante.')
      }
      setMessageSeverity('error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box>
      <Stack direction="row" spacing={1.1} sx={{ alignItems: 'center', mb: 2 }}>
        <StorefrontIcon sx={{ color: COLOR_GOLD }} />
        <Typography variant="h4" sx={{ color: COLOR_GOLD, fontWeight: 800, fontFamily: '"Playfair Display", serif' }}>
          Configuración del Restaurante
        </Typography>
      </Stack>

      <Typography sx={{ color: 'rgba(243,233,210,0.85)', mb: 3 }}>
        Gestiona los datos públicos de contacto, horarios, dirección y redes sociales.
      </Typography>

      {message ? (
        <Alert severity={messageSeverity} sx={{ mb: 2 }}>
          {message}
        </Alert>
      ) : null}

      {loading ? (
        <Paper
          sx={{
            p: 5,
            borderRadius: 2,
            backgroundColor: 'rgba(10,10,10,0.72)',
            border: '1px solid rgba(212,175,55,0.45)',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <CircularProgress />
        </Paper>
      ) : (
        <Paper
          sx={{
            p: { xs: 2, md: 3 },
            borderRadius: 2,
            backgroundColor: 'rgba(10,10,10,0.72)',
            border: '1px solid rgba(212,175,55,0.45)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
            '& .MuiInputLabel-root, & .MuiInputBase-input, & .MuiFormHelperText-root': {
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
          <Stack spacing={2}>
            <TextField
              label="Nombre del restaurante"
              value={form.nombre}
              onChange={(event) => handleFormChange('nombre', event.target.value)}
              fullWidth
            />

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="Teléfono"
                value={form.telefono}
                onChange={(event) => handleFormChange('telefono', event.target.value)}
                fullWidth
              />
              <TextField
                label="WhatsApp"
                value={form.whatsapp}
                onChange={(event) => handleFormChange('whatsapp', event.target.value)}
                fullWidth
                helperText="Puedes ingresar solo números (ejemplo: 50687945132) o una URL wa.me."
              />
            </Stack>

            <TextField
              label="Dirección"
              value={form.direccion}
              onChange={(event) => handleFormChange('direccion', event.target.value)}
              fullWidth
              multiline
              minRows={2}
            />

            <TextField
              label="Horario"
              value={form.horario}
              onChange={(event) => handleFormChange('horario', event.target.value)}
              fullWidth
              helperText="Ejemplo: Lunes a Domingo 8:00am - 10:00pm"
            />

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="Instagram URL"
                value={form.instagramUrl}
                onChange={(event) => handleFormChange('instagramUrl', event.target.value)}
                fullWidth
              />
              <TextField
                label="Facebook URL"
                value={form.facebookUrl}
                onChange={(event) => handleFormChange('facebookUrl', event.target.value)}
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="TripAdvisor URL"
                value={form.tripadvisorUrl}
                onChange={(event) => handleFormChange('tripadvisorUrl', event.target.value)}
                fullWidth
              />
              <TextField
                label="Google Maps URL"
                value={form.googleMapsUrl}
                onChange={(event) => handleFormChange('googleMapsUrl', event.target.value)}
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ justifyContent: 'flex-end', pt: 1 }}>
              <Button
                variant="outlined"
                onClick={loadConfig}
                disabled={saving}
                sx={{
                  borderColor: COLOR_GOLD,
                  color: COLOR_GOLD,
                  '&:hover': { borderColor: COLOR_GOLD, backgroundColor: 'rgba(212,175,55,0.08)' },
                }}
              >
                Recargar
              </Button>
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
                onClick={handleSave}
                disabled={saving}
                sx={{ backgroundColor: COLOR_MAROON, '&:hover': { backgroundColor: '#a42535' } }}
              >
                {saving ? 'Guardando...' : 'Guardar configuración'}
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}
    </Box>
  )
}
