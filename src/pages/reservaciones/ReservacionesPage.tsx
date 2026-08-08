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
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import EventSeatIcon from '@mui/icons-material/EventSeat'
import EditIcon from '@mui/icons-material/Edit'
import RefreshIcon from '@mui/icons-material/Refresh'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import { toast } from 'react-toastify'
import { reservacionSchema } from '@/schemas/reservacion.schema'
import { clientesService } from '@/services/clientes.service'
import { reservacionesService } from '@/services/reservaciones.service'
import type { Cliente } from '@/types/cliente.types'
import type { CreateReservacionDto, Reservacion, ReservaMesaEstado } from '@/types/reservacion.types'

const COLOR_GOLD = '#D4AF37'
const COLOR_TEXT = '#F3E9D2'
const COLOR_MAROON = '#8F1D2E'
const COLOR_MUTED = 'rgba(243,233,210,0.78)'

interface ReservacionFormState {
  clienteId: string
  mesaId: string
  clienteNombre: string
  clienteTelefono: string
  fecha: string
  hora: string
  cantidadPersonas: string
  observaciones: string
  estado: string
}

const DEFAULT_ESTADOS = ['pendiente', 'confirmada', 'atendida', 'cancelada']

const RESERVA_ESTADOS_OCUPADA = new Set(['PENDIENTE', 'CONFIRMADA', 'CONFIRMADO'])
const RESERVA_ESTADOS_LIBRE = new Set(['ATENDIDA', 'CANCELADA'])
const DATE_TIME_PARTS_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/

function toPositiveNumber(value: unknown): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }
  return parsed
}

function normalizeClientName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, '')
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatTimeInput(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

function formatDateTimeInput(date: Date): string {
  return `${formatDateInput(date)}T${formatTimeInput(date)}`
}

function extractDateTimeParts(value?: string): {
  year: number
  month: number
  day: number
  hours: number
  minutes: number
  seconds: number
} | null {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) {
    return null
  }

  const match = DATE_TIME_PARTS_PATTERN.exec(trimmed)
  if (!match) {
    return null
  }

  const [, yearRaw, monthRaw, dayRaw, hoursRaw = '00', minutesRaw = '00', secondsRaw = '00'] = match

  return {
    year: Number(yearRaw),
    month: Number(monthRaw),
    day: Number(dayRaw),
    hours: Number(hoursRaw),
    minutes: Number(minutesRaw),
    seconds: Number(secondsRaw),
  }
}

function buildDateFromParts(parts: NonNullable<ReturnType<typeof extractDateTimeParts>>): Date {
  return new Date(parts.year, parts.month - 1, parts.day, parts.hours, parts.minutes, parts.seconds)
}

function buildAtParam(value: string): string | undefined {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) {
    return undefined
  }

  const parts = extractDateTimeParts(trimmed)
  if (!parts) {
    return trimmed
  }

  const hours = String(parts.hours).padStart(2, '0')
  const minutes = String(parts.minutes).padStart(2, '0')
  const seconds = String(parts.seconds).padStart(2, '0')

  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}T${hours}:${minutes}:${seconds}`
}

function splitFechaHora(value?: string): { fecha: string; hora: string } {
  if (!value) {
    return { fecha: formatDateInput(new Date()), hora: formatTimeInput(new Date()) }
  }

  const parts = extractDateTimeParts(value)
  if (parts) {
    return {
      fecha: `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`,
      hora: `${String(parts.hours).padStart(2, '0')}:${String(parts.minutes).padStart(2, '0')}`,
    }
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return { fecha: formatDateInput(new Date()), hora: formatTimeInput(new Date()) }
  }

  return {
    fecha: formatDateInput(parsed),
    hora: formatTimeInput(parsed),
  }
}

function formatDateTime(value?: string): string {
  if (!value) {
    return 'Sin fecha'
  }

  const parts = extractDateTimeParts(value)
  if (parts) {
    return buildDateFromParts(parts).toLocaleString('es-CR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
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

function formatEstadoLabel(value: string): string {
  const normalized = String(value ?? '').trim()
  if (!normalized) {
    return 'SIN ESTADO'
  }

  const plain = normalized.replaceAll('_', ' ').toLowerCase()
  return plain.charAt(0).toUpperCase() + plain.slice(1)
}

function normalizeReservaEstado(value: unknown): string {
  return String(value ?? '').trim().toUpperCase()
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

function unwrapArrayPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload
  }

  if (typeof payload !== 'object' || payload === null) {
    return []
  }

  const record = payload as Record<string, unknown>
  const keys = [
    'data',
    'items',
    'results',
    'clientes',
    'customers',
    'reservas',
    'reservaciones',
    'mesas',
    'mesasEstado',
    'estadoMesas',
    'tables',
    'content',
    'rows',
    'list',
  ]

  for (const key of keys) {
    const value = record[key]
    if (Array.isArray(value)) {
      return value
    }

    if (typeof value === 'object' && value !== null) {
      const nested = value as Record<string, unknown>
      for (const nestedKey of keys) {
        const nestedValue = nested[nestedKey]
        if (Array.isArray(nestedValue)) {
          return nestedValue
        }
      }
    }
  }

  return []
}

function normalizeClienteRecord(item: unknown): Cliente | null {
  if (typeof item !== 'object' || item === null) {
    return null
  }

  const record = item as Record<string, unknown>
  const id = toPositiveNumber(record.id ?? record.clienteId ?? record.cliente_id)
  if (!id) {
    return null
  }

  const nombreRaw = record.nombre ?? record.name
  const telefonoRaw = record.telefono ?? record.phone

  return {
    id,
    nombre: typeof nombreRaw === 'string' ? nombreRaw : String(nombreRaw ?? `Cliente #${id}`),
    telefono: typeof telefonoRaw === 'string' ? telefonoRaw : String(telefonoRaw ?? ''),
    activo:
      typeof record.activo === 'boolean'
        ? record.activo
        : typeof record.active === 'boolean'
          ? record.active
          : undefined,
  }
}

function unwrapClientesPayload(payload: unknown): Cliente[] {
  return unwrapArrayPayload(payload)
    .map((item) => normalizeClienteRecord(item))
    .filter((item): item is Cliente => item !== null)
}

function unwrapSingleRecord(payload: unknown): unknown {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return payload
  }

  const record = payload as Record<string, unknown>
  const keys = ['data', 'item', 'reserva', 'reservacion']
  for (const key of keys) {
    const value = record[key]
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value
    }
  }

  return payload
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value
  }

  const normalized = String(value ?? '').trim().toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'activo' || normalized === 'activa'
}

function normalizeMesaEstadoRecord(item: unknown): ReservaMesaEstado | null {
  if (typeof item !== 'object' || item === null) {
    return null
  }

  const record = item as Record<string, unknown>
  const mesaRaw =
    typeof record.mesa === 'object' && record.mesa !== null ? (record.mesa as Record<string, unknown>) : null

  const mesaId =
    toPositiveNumber(
      record.mesaId ??
        record.mesa_id ??
        record.idMesa ??
        record.id ??
        record.tableId ??
        record.table_id ??
        mesaRaw?.id ??
        mesaRaw?.mesaId,
    ) ?? null
  if (!mesaId) {
    return null
  }

  const numero = Number(
    record.numero ?? record.numeroMesa ?? record.mesaNumero ?? record.number ?? mesaRaw?.numero ?? mesaId,
  )
  const capacidad = Number(
    record.capacidad ??
      record.mesaCapacidad ??
      record.capacity ??
      record.asientos ??
      mesaRaw?.capacidad ??
      0,
  )

  const reservada =
    normalizeBoolean(
      record.reservada ??
        record.reserved ??
        record.ocupada ??
        record.isReserved ??
        record.estaReservada ??
        record.disponible === false,
    ) ||
    toPositiveNumber(record.reservaId ?? record.reserva_id) !== null

  const reservaEstadoValue =
    typeof record.reservaEstado === 'string'
      ? record.reservaEstado
      : typeof record.estadoReserva === 'string'
        ? record.estadoReserva
        : typeof record.estado === 'string'
          ? record.estado
          : undefined

  const reservadaByEstado = resolveMesaReservadaByEstado(reservaEstadoValue)

  return {
    mesaId,
    numero: Number.isFinite(numero) ? numero : mesaId,
    capacidad: Number.isFinite(capacidad) ? capacidad : 0,
    activa: normalizeBoolean(record.activa ?? record.active ?? mesaRaw?.activa ?? mesaRaw?.active ?? true),
    reservada: reservadaByEstado ?? reservada,
    reservaId: toPositiveNumber(record.reservaId ?? record.reserva_id) ?? undefined,
    reservaEstado:
      typeof reservaEstadoValue === 'string' ? reservaEstadoValue : undefined,
    cliente:
      typeof record.cliente === 'string'
        ? record.cliente
        : typeof record.nombreCliente === 'string'
          ? record.nombreCliente
          : undefined,
    at: typeof record.at === 'string' ? record.at : undefined,
    bloqueDesde:
      typeof record.bloqueDesde === 'string'
        ? record.bloqueDesde
        : typeof record.blockFrom === 'string'
          ? record.blockFrom
          : undefined,
    bloqueHasta:
      typeof record.bloqueHasta === 'string'
        ? record.bloqueHasta
        : typeof record.blockTo === 'string'
          ? record.blockTo
          : undefined,
  }
}

function normalizeReservacionRecord(item: unknown): Reservacion | null {
  if (typeof item !== 'object' || item === null) {
    return null
  }

  const record = item as Record<string, unknown>
  const mesaRaw =
    typeof record.mesa === 'object' && record.mesa !== null ? (record.mesa as Record<string, unknown>) : null
  const usuarioRaw =
    typeof record.usuario === 'object' && record.usuario !== null
      ? (record.usuario as Record<string, unknown>)
      : null

  const id =
    toPositiveNumber(record.id ?? record.reservaId ?? record.reserva_id ?? record.reservacionId ?? record.reservacion_id) ??
    null
  if (!id) {
    return null
  }

  const mesaId =
    toPositiveNumber(record.mesaId ?? record.mesa_id ?? record.idMesa ?? mesaRaw?.id ?? mesaRaw?.mesaId) ?? 0
  const fechaHoraRaw =
    record.fechaHora ?? record.fecha_hora ?? record.fechaReserva ?? record.fecha_reserva ?? record.fecha
  const horaRaw = record.hora
  const fechaHora =
    typeof fechaHoraRaw === 'string'
      ? fechaHoraRaw
      : typeof fechaHoraRaw === 'number'
        ? new Date(fechaHoraRaw).toISOString()
        : typeof horaRaw === 'string' && typeof record.fecha === 'string'
          ? `${record.fecha}T${horaRaw}`
          : ''

  return {
    id,
    mesaId,
    clienteId: toPositiveNumber(record.clienteId ?? record.cliente_id ?? record.idCliente) ?? 0,
    usuarioId: toPositiveNumber(record.usuarioId ?? record.usuario_id ?? record.idUsuario) ?? undefined,
    nombreCliente:
      typeof record.nombreCliente === 'string'
        ? record.nombreCliente
        : typeof record.cliente === 'string'
          ? record.cliente
          : typeof record.nombre === 'string'
            ? record.nombre
            : 'Cliente',
    telefono:
      typeof record.telefono === 'string'
        ? record.telefono
        : typeof record.telephone === 'string'
          ? record.telephone
          : '',
    clienteNombre:
      typeof record.clienteNombre === 'string'
        ? record.clienteNombre
        : typeof record.nombre_cliente === 'string'
          ? record.nombre_cliente
          : typeof record.nombreCliente === 'string'
            ? record.nombreCliente
            : typeof record.cliente === 'string'
              ? record.cliente
              : undefined,
    clienteTelefono:
      typeof record.clienteTelefono === 'string'
        ? record.clienteTelefono
        : typeof record.telefono_cliente === 'string'
          ? record.telefono_cliente
          : typeof record.telefono === 'string'
            ? record.telefono
            : undefined,
    fechaHora,
    cantidadPersonas:
      Number(record.cantidadPersonas ?? record.cantidad_personas ?? record.numeroPersonas ?? record.personas ?? 1) || 1,
    estado:
      typeof record.estado === 'string'
        ? record.estado
        : typeof record.status === 'string'
          ? record.status
          : 'pendiente',
    observaciones:
      typeof record.observaciones === 'string'
        ? record.observaciones
        : typeof record.observacion === 'string'
          ? record.observacion
          : typeof record.notas === 'string'
            ? record.notas
            : undefined,
    notas:
      typeof record.notas === 'string'
        ? record.notas
        : typeof record.observaciones === 'string'
          ? record.observaciones
          : typeof record.observacion === 'string'
            ? record.observacion
            : undefined,
    bloqueDesde:
      typeof record.bloqueDesde === 'string'
        ? record.bloqueDesde
        : typeof record.blockFrom === 'string'
          ? record.blockFrom
          : undefined,
    bloqueHasta:
      typeof record.bloqueHasta === 'string'
        ? record.bloqueHasta
        : typeof record.blockTo === 'string'
          ? record.blockTo
          : undefined,
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
    mesa: mesaRaw
      ? {
          id: toPositiveNumber(mesaRaw.id ?? mesaRaw.mesaId ?? mesaRaw.mesa_id) ?? undefined,
          numero: Number(mesaRaw.numero ?? 0) || undefined,
          capacidad: Number(mesaRaw.capacidad ?? 0) || undefined,
        }
      : undefined,
    usuario: usuarioRaw
      ? {
          id: toPositiveNumber(usuarioRaw.id ?? usuarioRaw.usuarioId ?? usuarioRaw.usuario_id) ?? undefined,
          nombre: typeof usuarioRaw.nombre === 'string' ? usuarioRaw.nombre : undefined,
          usuario:
            typeof usuarioRaw.usuario === 'string'
              ? usuarioRaw.usuario
              : typeof usuarioRaw.username === 'string'
                ? usuarioRaw.username
                : undefined,
        }
      : undefined,
  }
}

function buildInitialForm(nextMesaId?: number): ReservacionFormState {
  const now = new Date()
  return {
    clienteId: '',
    mesaId: nextMesaId ? String(nextMesaId) : '',
    clienteNombre: '',
    clienteTelefono: '',
    fecha: formatDateInput(now),
    hora: formatTimeInput(now),
    cantidadPersonas: '2',
    observaciones: '',
    estado: 'pendiente',
  }
}

export default function ReservacionesPage() {
  const [mesasEstado, setMesasEstado] = useState<ReservaMesaEstado[]>([])
  const [agendaReservas, setAgendaReservas] = useState<Reservacion[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [viewAt, setViewAt] = useState<string>(formatDateTimeInput(new Date()))
  const [includeInactive, setIncludeInactive] = useState<boolean>(false)
  const [agendaDate, setAgendaDate] = useState<string>('')
  const [agendaEstado, setAgendaEstado] = useState<string>('')
  const [agendaMesaId, setAgendaMesaId] = useState<string>('')
  const [selectedMesa, setSelectedMesa] = useState<ReservaMesaEstado | null>(null)
  const [editingReservaId, setEditingReservaId] = useState<number | null>(null)
  const [form, setForm] = useState<ReservacionFormState>(buildInitialForm())
  const [dialogOpen, setDialogOpen] = useState<boolean>(false)
  const [estadoDialogOpen, setEstadoDialogOpen] = useState<boolean>(false)
  const [estadoTargetReserva, setEstadoTargetReserva] = useState<Reservacion | null>(null)
  const [estadoValue, setEstadoValue] = useState<string>('pendiente')
  const [loadingMesas, setLoadingMesas] = useState<boolean>(false)
  const [loadingAgenda, setLoadingAgenda] = useState<boolean>(false)
  const [saving, setSaving] = useState<boolean>(false)
  const [mesasError, setMesasError] = useState<string>('')
  const [agendaError, setAgendaError] = useState<string>('')

  const estadoOptions = useMemo(() => {
    const normalized = new Set(DEFAULT_ESTADOS)
    agendaReservas.forEach((reserva) => {
      if (reserva.estado?.trim()) {
        normalized.add(reserva.estado.trim().toLowerCase())
      }
    })
    return Array.from(normalized)
  }, [agendaReservas])

  const mesaOptions = useMemo(
    () => [...mesasEstado].sort((left, right) => left.numero - right.numero),
    [mesasEstado],
  )

  const clientesActivos = useMemo(
    () => clientes.filter((cliente) => cliente.activo !== false),
    [clientes],
  )

  async function loadClientesBase() {
    try {
      const response = await clientesService.getAll({ active: true })
      setClientes(unwrapClientesPayload(response.data))
    } catch {
      // Keep reservation flow working even when client preload fails.
    }
  }

  async function loadMesasEstado() {
    setLoadingMesas(true)
    setMesasError('')
    try {
        const primaryResponse = await reservacionesService.getMesasEstado({
          at: buildAtParam(viewAt),
          includeInactive,
        })

        let normalized = unwrapArrayPayload(primaryResponse.data)
          .map((item) => normalizeMesaEstadoRecord(item))
          .filter((item): item is ReservaMesaEstado => item !== null)

        if (normalized.length === 0) {
          const fallbackResponse = await reservacionesService.getMesasEstado({
            includeInactive,
          })

          normalized = unwrapArrayPayload(fallbackResponse.data)
            .map((item) => normalizeMesaEstadoRecord(item))
            .filter((item): item is ReservaMesaEstado => item !== null)
        }

        setMesasEstado(normalized)
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      setMesasError(backendMessage || 'No fue posible cargar el estado de mesas.')
    } finally {
      setLoadingMesas(false)
    }
  }

  async function loadAgenda() {
    setLoadingAgenda(true)
    setAgendaError('')
    try {
      const response = await reservacionesService.getAll({
        fecha: agendaDate || undefined,
        estado: agendaEstado || undefined,
        mesaId: toPositiveNumber(agendaMesaId) ?? undefined,
      })

      const normalized = unwrapArrayPayload(response.data)
        .map((item) => normalizeReservacionRecord(item))
        .filter((item): item is Reservacion => item !== null)

      setAgendaReservas(normalized)
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      setAgendaError(backendMessage || 'No fue posible cargar la agenda de reservas.')
    } finally {
      setLoadingAgenda(false)
    }
  }

  useEffect(() => {
    void loadMesasEstado()
  }, [viewAt, includeInactive])

  useEffect(() => {
    void loadAgenda()
  }, [agendaDate, agendaEstado, agendaMesaId])

  useEffect(() => {
    void loadClientesBase()
  }, [])

  function linkClientToForm(cliente: Cliente) {
    setForm((current) => ({
      ...current,
      clienteId: String(cliente.id),
      clienteNombre: cliente.nombre,
      clienteTelefono: cliente.telefono,
    }))
  }

  function tryResolveLocalClientByName(rawName: string): Cliente | null {
    const normalized = normalizeClientName(rawName)
    if (!normalized) {
      return null
    }

    return clientesActivos.find((cliente) => normalizeClientName(cliente.nombre) === normalized) ?? null
  }

  function tryResolveLocalClient(nombre: string, telefono: string): Cliente | null {
    const normalizedName = normalizeClientName(nombre)
    const normalizedPhone = normalizePhone(telefono)

    return (
      clientesActivos.find((cliente) => {
        const sameName = normalizedName ? normalizeClientName(cliente.nombre) === normalizedName : false
        const samePhone = normalizedPhone ? normalizePhone(cliente.telefono) === normalizedPhone : false
        return samePhone || sameName
      }) ?? null
    )
  }

  async function searchClientByName(name: string): Promise<Cliente | null> {
    const normalized = name.trim()
    const normalizedName = normalizeClientName(name)
    if (!normalized) {
      return null
    }

    try {
      const response = await clientesService.getAll({ active: true, q: normalized })
      const matches = unwrapClientesPayload(response.data)
      if (matches.length === 0) {
        return null
      }

      setClientes((current) => {
        const merged = new Map<number, Cliente>(current.map((item) => [item.id, item]))
        matches.forEach((item) => merged.set(item.id, item))
        return Array.from(merged.values())
      })

      return (
        matches.find((item) => normalizeClientName(item.nombre) === normalizedName) ??
        matches.find((item) => normalizeClientName(item.nombre).includes(normalizedName)) ??
        matches[0] ??
        null
      )
    } catch {
      return null
    }
  }

  async function searchClientByPhone(telefono: string): Promise<Cliente | null> {
    const normalized = telefono.trim()
    const normalizedPhone = normalizePhone(telefono)
    if (!normalized) {
      return null
    }

    try {
      const response = await clientesService.getAll({ active: true, telefono: normalized })
      const matches = unwrapClientesPayload(response.data)
      if (matches.length === 0) {
        return null
      }

      setClientes((current) => {
        const merged = new Map<number, Cliente>(current.map((item) => [item.id, item]))
        matches.forEach((item) => merged.set(item.id, item))
        return Array.from(merged.values())
      })

      return (
        matches.find((item) => normalizePhone(item.telefono) === normalizedPhone) ??
        matches[0] ??
        null
      )
    } catch {
      return null
    }
  }

  async function searchClientInsensitive(nombre: string, telefono: string): Promise<Cliente | null> {
    const normalizedName = normalizeClientName(nombre)
    const normalizedPhone = normalizePhone(telefono)

    if (!normalizedName && !normalizedPhone) {
      return null
    }

    try {
      const response = await clientesService.getAll({ active: true })
      const matches = unwrapClientesPayload(response.data)
      if (matches.length === 0) {
        return null
      }

      setClientes((current) => {
        const merged = new Map<number, Cliente>(current.map((item) => [item.id, item]))
        matches.forEach((item) => merged.set(item.id, item))
        return Array.from(merged.values())
      })

      const byPhone = normalizedPhone
        ? matches.find((item) => normalizePhone(item.telefono) === normalizedPhone) ?? null
        : null

      if (byPhone) {
        return byPhone
      }

      return normalizedName
        ? matches.find((item) => normalizeClientName(item.nombre) === normalizedName) ?? null
        : null
    } catch {
      return null
    }
  }

  async function findClientAfterCreate(nombre: string, telefono: string): Promise<Cliente | null> {
    const byPhone = await searchClientByPhone(telefono)
    if (byPhone) {
      return byPhone
    }

    const byName = await searchClientByName(nombre)
    if (byName) {
      return byName
    }

    return null
  }

  async function resolveClienteIdForReserva(input: {
    clienteIdRaw: string
    clienteNombre: string
    clienteTelefono: string
  }): Promise<number> {
    const directClienteId = toPositiveNumber(input.clienteIdRaw)
    if (directClienteId) {
      return directClienteId
    }

    const nombre = input.clienteNombre.trim()
    const telefono = input.clienteTelefono.trim()

    const localMatch = tryResolveLocalClient(nombre, telefono)
    if (localMatch) {
      if (!input.clienteTelefono.trim()) {
        setForm((current) => ({ ...current, clienteTelefono: localMatch.telefono }))
      }
      return localMatch.id
    }

    const remoteMatch = await searchClientByName(nombre)
    if (remoteMatch) {
      if (!input.clienteTelefono.trim()) {
        setForm((current) => ({ ...current, clienteTelefono: remoteMatch.telefono }))
      }
      return remoteMatch.id
    }

    const remotePhoneMatch = await searchClientByPhone(telefono)
    if (remotePhoneMatch) {
      if (!input.clienteTelefono.trim()) {
        setForm((current) => ({ ...current, clienteTelefono: remotePhoneMatch.telefono }))
      }
      return remotePhoneMatch.id
    }

    const insensitiveMatch = await searchClientInsensitive(nombre, telefono)
    if (insensitiveMatch) {
      linkClientToForm(insensitiveMatch)
      return insensitiveMatch.id
    }

    const createResponse = await clientesService.create({ nombre, telefono })
    const createdCliente = normalizeClienteRecord(createResponse.data)
    if (!createdCliente) {
      const recoveredCliente = await findClientAfterCreate(nombre, telefono)
      if (recoveredCliente) {
        linkClientToForm(recoveredCliente)
        return recoveredCliente.id
      }

      throw new Error('El cliente se creo, pero no se pudo recuperar su id para la reserva.')
    }

    setClientes((current) => {
      const exists = current.some((item) => item.id === createdCliente.id)
      return exists ? current : [createdCliente, ...current]
    })
    linkClientToForm(createdCliente)
    return createdCliente.id
  }

  function openCreateDialogForMesa(mesa: ReservaMesaEstado) {
    setSelectedMesa(mesa)
    setEditingReservaId(null)
    setForm(buildInitialForm(mesa.mesaId))
    setDialogOpen(true)
  }

  async function openEditDialog(reservaId: number) {
    setSaving(true)
    try {
      const response = await reservacionesService.getById(reservaId)
      const normalized = normalizeReservacionRecord(unwrapSingleRecord(response.data))

      if (!normalized) {
        toast.error('No se encontro el detalle de la reserva seleccionada.')
        return
      }

      const fechaHora = splitFechaHora(normalized.fechaHora)
      const matchedMesa = mesasEstado.find((mesa) => mesa.mesaId === normalized.mesaId) ?? null

      setSelectedMesa(matchedMesa)
      setEditingReservaId(normalized.id)
      setForm({
        clienteId: normalized.clienteId ? String(normalized.clienteId) : '',
        mesaId: String(normalized.mesaId),
        clienteNombre: normalized.clienteNombre ?? normalized.nombreCliente ?? '',
        clienteTelefono: normalized.clienteTelefono ?? normalized.telefono ?? '',
        fecha: fechaHora.fecha,
        hora: fechaHora.hora,
        cantidadPersonas: String(normalized.cantidadPersonas),
        observaciones: normalized.observaciones ?? normalized.notas ?? '',
        estado: normalized.estado || 'pendiente',
      })
      setDialogOpen(true)
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      toast.error(backendMessage || 'No fue posible cargar la reserva seleccionada.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveReserva() {
    const validation = reservacionSchema.safeParse({
      clienteNombre: form.clienteNombre,
      clienteTelefono: form.clienteTelefono,
      mesaId: form.mesaId,
      fecha: form.fecha,
      hora: form.hora,
      cantidadPersonas: form.cantidadPersonas,
      observaciones: form.observaciones.trim() || undefined,
      estado: form.estado.trim() || undefined,
    })

    if (!validation.success) {
      const firstIssue = validation.error.issues[0]
      toast.error(firstIssue?.message ?? 'Revisa los datos de la reserva.')
      return
    }

    setSaving(true)
    try {
      const clienteId = await resolveClienteIdForReserva({
        clienteIdRaw: form.clienteId,
        clienteNombre: validation.data.clienteNombre,
        clienteTelefono: validation.data.clienteTelefono,
      })

      const payload: CreateReservacionDto = {
        mesaId: validation.data.mesaId,
        clienteId,
        fechaHora: `${validation.data.fecha}T${validation.data.hora}:00`,
        cantidadPersonas: validation.data.cantidadPersonas,
        observaciones: validation.data.observaciones,
        estado: validation.data.estado?.toLowerCase(),
      }

      if (editingReservaId) {
        await reservacionesService.update(editingReservaId, payload)
        toast.success('Reserva actualizada correctamente.')
      } else {
        await reservacionesService.create(payload)
        toast.success('Reserva creada correctamente.')
      }

      setDialogOpen(false)
      await Promise.all([loadAgenda(), loadMesasEstado()])
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''

      if (axios.isAxiosError(requestError) && requestError.response?.status === 409) {
        toast.warning(backendMessage || 'Conflicto de horario: la mesa ya esta reservada en esa ventana.')
      } else {
        toast.error(backendMessage || 'No fue posible guardar la reserva.')
      }
    } finally {
      setSaving(false)
    }
  }

  function openEstadoDialog(reserva: Reservacion) {
    setEstadoTargetReserva(reserva)
    setEstadoValue(reserva.estado?.trim().toLowerCase() || 'pendiente')
    setEstadoDialogOpen(true)
  }

  async function handleSaveEstado() {
    if (!estadoTargetReserva) {
      return
    }

    setSaving(true)
    try {
      await reservacionesService.updateEstado(estadoTargetReserva.id, estadoValue.toLowerCase())
      toast.success('Estado de reserva actualizado.')
      setEstadoDialogOpen(false)
      setEstadoTargetReserva(null)
      await Promise.all([loadAgenda(), loadMesasEstado()])
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''

      if (axios.isAxiosError(requestError) && requestError.response?.status === 409) {
        toast.warning(backendMessage || 'No se pudo activar la reserva por conflicto de horario.')
      } else {
        toast.error(backendMessage || 'No fue posible actualizar el estado.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function refreshAll() {
    await Promise.all([loadMesasEstado(), loadAgenda()])
  }

  return (
    <Box sx={{ color: COLOR_TEXT }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <EventSeatIcon sx={{ color: COLOR_GOLD }} />
        <Typography
          variant="h4"
          sx={{ fontWeight: 'bold', color: COLOR_GOLD, fontFamily: '"Playfair Display", serif' }}
        >
          Reservaciones
        </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => {
            void refreshAll()
          }}
          sx={{
            borderColor: 'rgba(212,175,55,0.5)',
            color: COLOR_GOLD,
            '&:hover': { borderColor: COLOR_GOLD, backgroundColor: 'rgba(212,175,55,0.08)' },
          }}
        >
          Actualizar
        </Button>
      </Box>

      <Paper
        sx={{
          p: 2.5,
          mb: 3,
          borderRadius: 2,
          backgroundColor: 'rgba(10,10,10,0.72)',
          border: '1px solid rgba(212,175,55,0.45)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
        }}
      >
        <Typography sx={{ color: 'rgba(243,233,210,0.88)', mb: 2 }}>
          Módulo de reservas independiente: estado de mesas en tiempo real y agenda diaria.
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 0.8fr)' },
            alignItems: 'center',
          }}
        >
          <Box>
            <TextField
              label="Referencia para estado de mesas"
              type="datetime-local"
              value={viewAt}
              onChange={(event) => setViewAt(event.target.value)}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{
                '& .MuiOutlinedInput-root': { color: COLOR_TEXT, '& fieldset': { borderColor: 'rgba(212,175,55,0.35)' } },
                '& .MuiInputLabel-root': { color: 'rgba(243,233,210,0.78)' },
              }}
            />
          </Box>
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={includeInactive}
                  onChange={(event) => setIncludeInactive(event.target.checked)}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: COLOR_GOLD },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: COLOR_GOLD },
                  }}
                />
              }
              label="Incluir mesas inactivas"
            />
          </Box>
          <Box>
            <Button
              fullWidth
              variant="contained"
              startIcon={<AutorenewIcon />}
              onClick={() => {
                void loadMesasEstado()
              }}
              sx={{ backgroundColor: COLOR_GOLD, color: '#120b05', fontWeight: 700, '&:hover': { backgroundColor: '#e3c45f' } }}
            >
              Refrescar mesas
            </Button>
          </Box>
        </Box>
      </Paper>

      {mesasError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {mesasError}
        </Alert>
      ) : null}

      <Paper
        sx={{
          p: 2.5,
          mb: 3,
          borderRadius: 2,
          backgroundColor: 'rgba(10,10,10,0.72)',
          border: '1px solid rgba(212,175,55,0.32)',
        }}
      >
        <Typography variant="h6" sx={{ color: COLOR_GOLD, mb: 2, fontWeight: 700 }}>
          Estado de mesas
        </Typography>

        {loadingMesas ? (
          <Stack direction="row" sx={{ justifyContent: 'center', py: 4 }}>
            <CircularProgress sx={{ color: COLOR_GOLD }} />
          </Stack>
        ) : mesasEstado.length === 0 ? (
          <Alert severity="info">No hay mesas para mostrar en este momento.</Alert>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(3, minmax(0, 1fr))',
                lg: 'repeat(4, minmax(0, 1fr))',
              },
            }}
          >
            {mesaOptions.map((mesa) => (
              <Box key={mesa.mesaId}>
                <Card
                  sx={{
                    height: '100%',
                    borderRadius: 2,
                    border: mesa.reservada
                      ? '1px solid rgba(143,29,46,0.8)'
                      : '1px solid rgba(52,211,153,0.45)',
                    backgroundColor: mesa.reservada ? 'rgba(143,29,46,0.17)' : 'rgba(16,90,57,0.14)',
                  }}
                >
                  <CardContent>
                    <Stack
                      direction="row"
                      sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}
                    >
                      <Typography variant="h6" sx={{ color: COLOR_TEXT, fontWeight: 700 }}>
                        Mesa #{mesa.numero}
                      </Typography>
                      <Chip
                        size="small"
                        label={mesa.reservada ? 'Reservada' : 'Disponible'}
                        sx={{
                          bgcolor: mesa.reservada ? COLOR_MAROON : 'rgba(16,185,129,0.85)',
                          color: '#fff',
                          fontWeight: 700,
                        }}
                      />
                    </Stack>

                    <Typography sx={{ color: 'rgba(243,233,210,0.88)' }}>
                      Capacidad: {mesa.capacidad} persona(s)
                    </Typography>
                    <Typography sx={{ color: 'rgba(243,233,210,0.8)' }}>
                      Estado mesa: {mesa.activa ? 'Activa' : 'Inactiva'}
                    </Typography>
                    {mesa.cliente ? (
                      <Typography sx={{ color: 'rgba(243,233,210,0.8)' }}>
                        Cliente: {mesa.cliente}
                      </Typography>
                    ) : null}
                    {mesa.bloqueDesde || mesa.bloqueHasta ? (
                      <Typography sx={{ color: 'rgba(243,233,210,0.8)', fontSize: '0.86rem' }}>
                        Bloqueo: {formatDateTime(mesa.bloqueDesde)} - {formatDateTime(mesa.bloqueHasta)}
                      </Typography>
                    ) : null}

                    <Button
                      variant="outlined"
                      size="small"
                      disabled={!mesa.activa}
                      onClick={() => openCreateDialogForMesa(mesa)}
                      sx={{
                        mt: 1.5,
                        borderColor: 'rgba(212,175,55,0.45)',
                        color: COLOR_GOLD,
                        '&:hover': { borderColor: COLOR_GOLD, backgroundColor: 'rgba(212,175,55,0.1)' },
                      }}
                    >
                      Nueva reserva
                    </Button>
                  </CardContent>
                </Card>
              </Box>
            ))}
          </Box>
        )}
      </Paper>

      <Paper
        sx={{
          p: 2.5,
          borderRadius: 2,
          backgroundColor: 'rgba(10,10,10,0.72)',
          border: '1px solid rgba(212,175,55,0.32)',
        }}
      >
        <Typography variant="h6" sx={{ color: COLOR_GOLD, mb: 2, fontWeight: 700 }}>
          Agenda del día
        </Typography>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
          <TextField
            label="Fecha (opcional)"
            type="date"
            value={agendaDate}
            onChange={(event) => setAgendaDate(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{
              minWidth: 180,
              '& .MuiOutlinedInput-root': { color: COLOR_TEXT, '& fieldset': { borderColor: 'rgba(212,175,55,0.35)' } },
              '& .MuiInputLabel-root': { color: 'rgba(243,233,210,0.78)' },
            }}
          />
          <TextField
            label="Estado"
            select
            value={agendaEstado}
            onChange={(event) => setAgendaEstado(event.target.value)}
            sx={{
              minWidth: 210,
              '& .MuiOutlinedInput-root': { color: COLOR_TEXT, '& fieldset': { borderColor: 'rgba(212,175,55,0.35)' } },
              '& .MuiInputLabel-root': { color: 'rgba(243,233,210,0.78)' },
            }}
          >
            <MenuItem value="">Todos</MenuItem>
            {estadoOptions.map((estado) => (
              <MenuItem key={estado} value={estado}>
                {formatEstadoLabel(estado)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Mesa"
            select
            value={agendaMesaId}
            onChange={(event) => setAgendaMesaId(event.target.value)}
            sx={{
              minWidth: 200,
              '& .MuiOutlinedInput-root': { color: COLOR_TEXT, '& fieldset': { borderColor: 'rgba(212,175,55,0.35)' } },
              '& .MuiInputLabel-root': { color: 'rgba(243,233,210,0.78)' },
            }}
          >
            <MenuItem value="">Todas</MenuItem>
            {mesaOptions.map((mesa) => (
              <MenuItem key={mesa.mesaId} value={String(mesa.mesaId)}>
                Mesa #{mesa.numero}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => {
              void loadAgenda()
            }}
            sx={{
              alignSelf: { xs: 'stretch', md: 'center' },
              borderColor: 'rgba(212,175,55,0.5)',
              color: COLOR_GOLD,
            }}
          >
            Recargar agenda
          </Button>
        </Stack>

        {agendaError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {agendaError}
          </Alert>
        ) : null}

        {loadingAgenda ? (
          <Stack direction="row" sx={{ justifyContent: 'center', py: 3 }}>
            <CircularProgress sx={{ color: COLOR_GOLD }} />
          </Stack>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: COLOR_GOLD, fontWeight: 700 }}>Cliente</TableCell>
                  <TableCell sx={{ color: COLOR_GOLD, fontWeight: 700 }}>Mesa</TableCell>
                  <TableCell sx={{ color: COLOR_GOLD, fontWeight: 700 }}>Fecha/Hora</TableCell>
                  <TableCell sx={{ color: COLOR_GOLD, fontWeight: 700 }}>Personas</TableCell>
                  <TableCell sx={{ color: COLOR_GOLD, fontWeight: 700 }}>Estado</TableCell>
                  <TableCell align="right" sx={{ color: COLOR_GOLD, fontWeight: 700 }}>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {agendaReservas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ color: 'rgba(243,233,210,0.75)' }}>
                      No hay reservas para los filtros seleccionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  agendaReservas.map((reserva) => (
                    <TableRow key={reserva.id} hover>
                      <TableCell sx={{ color: COLOR_TEXT }}>
                        <Typography sx={{ fontWeight: 600 }}>
                          {reserva.clienteNombre ?? reserva.nombreCliente ?? 'Cliente'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(243,233,210,0.75)' }}>
                          {reserva.clienteTelefono ?? reserva.telefono ?? 'Sin teléfono'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ color: COLOR_TEXT }}>
                        Mesa #{reserva.mesa?.numero ?? reserva.mesaId}
                      </TableCell>
                      <TableCell sx={{ color: COLOR_TEXT }}>{formatDateTime(reserva.fechaHora)}</TableCell>
                      <TableCell sx={{ color: COLOR_TEXT }}>{reserva.cantidadPersonas}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={formatEstadoLabel(reserva.estado)}
                          sx={{
                            bgcolor:
                              normalizeReservaEstado(reserva.estado) === 'CONFIRMADA'
                                ? 'rgba(16,185,129,0.9)'
                                : normalizeReservaEstado(reserva.estado) === 'CANCELADA'
                                  ? 'rgba(143,29,46,0.9)'
                                  : 'rgba(212,175,55,0.85)',
                            color: '#111',
                            fontWeight: 700,
                          }}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        <IconButton
                          onClick={() => {
                            void openEditDialog(reserva.id)
                          }}
                          sx={{ color: 'rgba(243,233,210,0.9)' }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => openEstadoDialog(reserva)}
                          sx={{ borderColor: 'rgba(212,175,55,0.45)', color: COLOR_GOLD }}
                        >
                          Estado
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ backgroundColor: '#160f0c', color: COLOR_GOLD, fontWeight: 800 }}>
          {editingReservaId ? 'Editar reserva' : `Nueva reserva${selectedMesa ? ` - Mesa #${selectedMesa.numero}` : ''}`}
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#160f0c', pt: 3 }}>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <TextField
              label="Mesa"
              select
              value={form.mesaId}
              onChange={(event) => setForm((current) => ({ ...current, mesaId: event.target.value }))}
              fullWidth
              sx={{
                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
              }}
            >
              {mesaOptions.map((mesa) => (
                <MenuItem key={mesa.mesaId} value={String(mesa.mesaId)}>
                  Mesa #{mesa.numero} {mesa.activa ? '' : '(Inactiva)'}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Nombre del cliente"
              value={form.clienteNombre}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  clienteId: '',
                  clienteNombre: event.target.value,
                }))
              }
              onBlur={() => {
                const localClient = tryResolveLocalClientByName(form.clienteNombre)
                if (localClient) {
                  linkClientToForm(localClient)
                }
              }}
              fullWidth
              sx={{
                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
              }}
            />
            <TextField
              label="Teléfono"
              value={form.clienteTelefono}
              onChange={(event) => setForm((current) => ({ ...current, clienteTelefono: event.target.value }))}
              fullWidth
              sx={{
                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
              }}
            />
            <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  void (async () => {
                    const foundByName = await searchClientByName(form.clienteNombre)
                    const found = foundByName ?? (form.clienteTelefono.trim()
                      ? await searchClientByPhone(form.clienteTelefono)
                      : null)
                    const resolved = found ?? await searchClientInsensitive(form.clienteNombre, form.clienteTelefono)
                    if (resolved) {
                      linkClientToForm(resolved)
                      toast.success('Cliente encontrado y cargado.')
                    } else {
                      toast.info('Cliente no encontrado. Se creara al guardar la reserva.')
                    }
                  })()
                }}
                sx={{ borderColor: 'rgba(212,175,55,0.45)', color: COLOR_GOLD }}
              >
                Buscar cliente
              </Button>
              {form.clienteId ? (
                <Typography variant="caption" sx={{ color: COLOR_MUTED }}>
                  Cliente vinculado #{form.clienteId}
                </Typography>
              ) : null}
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                label="Fecha"
                type="date"
                value={form.fecha}
                onChange={(event) => setForm((current) => ({ ...current, fecha: event.target.value }))}
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{
                  '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                  '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                }}
              />
              <TextField
                label="Hora"
                type="time"
                value={form.hora}
                onChange={(event) => setForm((current) => ({ ...current, hora: event.target.value }))}
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{
                  '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                  '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                }}
              />
            </Stack>
            <TextField
              label="Cantidad de personas"
              type="number"
              value={form.cantidadPersonas}
              onChange={(event) => setForm((current) => ({ ...current, cantidadPersonas: event.target.value }))}
              fullWidth
              sx={{
                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
              }}
            />
            <TextField
              label="Estado"
              select
              value={form.estado}
              onChange={(event) => setForm((current) => ({ ...current, estado: event.target.value }))}
              fullWidth
              sx={{
                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
              }}
            >
              {estadoOptions.map((estado) => (
                <MenuItem key={estado} value={estado}>
                  {formatEstadoLabel(estado)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Observaciones"
              value={form.observaciones}
              onChange={(event) => setForm((current) => ({ ...current, observaciones: event.target.value }))}
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
          <Button onClick={() => setDialogOpen(false)} sx={{ color: COLOR_TEXT }}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={saving}
            onClick={() => {
              void handleSaveReserva()
            }}
            sx={{ backgroundColor: COLOR_GOLD, color: '#120b05', fontWeight: 700, '&:hover': { backgroundColor: '#e3c45f' } }}
          >
            {editingReservaId ? 'Guardar cambios' : 'Crear reserva'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={estadoDialogOpen} onClose={() => setEstadoDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ backgroundColor: '#160f0c', color: COLOR_GOLD, fontWeight: 800 }}>Cambiar estado de reserva</DialogTitle>
        <DialogContent sx={{ backgroundColor: '#160f0c', pt: 3 }}>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <Typography variant="body2" sx={{ color: COLOR_MUTED }}>
              {estadoTargetReserva
                ? `${estadoTargetReserva.clienteNombre ?? estadoTargetReserva.nombreCliente ?? 'Cliente'} - Mesa #${estadoTargetReserva.mesa?.numero ?? estadoTargetReserva.mesaId}`
                : ''}
            </Typography>
            <TextField
              label="Estado"
              select
              value={estadoValue}
              onChange={(event) => setEstadoValue(event.target.value)}
              fullWidth
              sx={{
                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
              }}
            >
              {estadoOptions.map((estado) => (
                <MenuItem key={estado} value={estado}>
                  {formatEstadoLabel(estado)}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#160f0c', p: 2.5 }}>
          <Button onClick={() => setEstadoDialogOpen(false)} sx={{ color: COLOR_TEXT }}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={saving || !estadoTargetReserva}
            onClick={() => {
              void handleSaveEstado()
            }}
            sx={{ backgroundColor: COLOR_MAROON, '&:hover': { backgroundColor: '#a42535' } }}
          >
            Actualizar estado
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
