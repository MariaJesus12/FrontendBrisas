import axios from 'axios'
import api from './api'
import type { RestaurantConfig, UpsertRestaurantConfigDto } from '@/types/configuracion-restaurante.types'

type UnknownRecord = Record<string, unknown>

function toPositiveNumber(value: unknown): number | undefined {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined
  }
  return parsed
}

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value === 'number') {
    const asString = String(value).trim()
    return asString || undefined
  }

  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

function normalizeRestaurantConfig(item: unknown): RestaurantConfig | null {
  if (typeof item !== 'object' || item === null) {
    return null
  }

  const record = item as UnknownRecord

  const nombre = asTrimmedString(record.nombre ?? record.name) ?? ''
  const telefono = asTrimmedString(record.telefono ?? record.phone) ?? ''
  const whatsapp = asTrimmedString(record.whatsapp ?? record.whatsappPhone ?? record.whatsapp_phone) ?? ''
  const direccion = asTrimmedString(record.direccion ?? record.address) ?? ''
  const horario = asTrimmedString(record.horario ?? record.schedule ?? record.horarios) ?? ''

  if (!nombre && !telefono && !whatsapp && !direccion && !horario) {
    return null
  }

  return {
    id: toPositiveNumber(record.id ?? record.configuracionId ?? record.configuracion_id),
    nombre,
    telefono,
    whatsapp,
    instagramUrl: asTrimmedString(record.instagramUrl ?? record.instagram_url),
    facebookUrl: asTrimmedString(record.facebookUrl ?? record.facebook_url),
    tripadvisorUrl: asTrimmedString(record.tripadvisorUrl ?? record.tripadvisor_url),
    googleMapsUrl: asTrimmedString(record.googleMapsUrl ?? record.google_maps_url ?? record.googlemaps_url),
    direccion,
    horario,
    createdAt: asTrimmedString(record.createdAt ?? record.created_at),
    updatedAt: asTrimmedString(record.updatedAt ?? record.updated_at),
  }
}

function normalizeList(payload: unknown): RestaurantConfig[] {
  if (Array.isArray(payload)) {
    return payload
      .map((item) => normalizeRestaurantConfig(item))
      .filter((item): item is RestaurantConfig => item !== null)
  }

  if (typeof payload === 'object' && payload !== null) {
    const single = normalizeRestaurantConfig(payload)
    if (single) {
      return [single]
    }

    const container = payload as {
      data?: unknown
      items?: unknown
      configuraciones?: unknown
      configuracionRestaurante?: unknown
      configuracion_restaurante?: unknown
      restaurantConfig?: unknown
      restaurant_config?: unknown
    }

    if (container.data !== undefined) {
      return normalizeList(container.data)
    }

    if (container.items !== undefined) {
      return normalizeList(container.items)
    }

    if (container.configuraciones !== undefined) {
      return normalizeList(container.configuraciones)
    }

    if (container.configuracionRestaurante !== undefined) {
      return normalizeList(container.configuracionRestaurante)
    }

    if (container.configuracion_restaurante !== undefined) {
      return normalizeList(container.configuracion_restaurante)
    }

    if (container.restaurantConfig !== undefined) {
      return normalizeList(container.restaurantConfig)
    }

    if (container.restaurant_config !== undefined) {
      return normalizeList(container.restaurant_config)
    }
  }

  return []
}

function shouldFallbackAllEndpoint(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false
  }

  const status = error.response?.status
  return status === 403 || status === 404 || status === 405
}

function sortConfigsNewestFirst(configs: RestaurantConfig[]): RestaurantConfig[] {
  return [...configs].sort((a, b) => {
    const aTime = a.createdAt ? Date.parse(a.createdAt) : Number.NaN
    const bTime = b.createdAt ? Date.parse(b.createdAt) : Number.NaN

    if (Number.isFinite(aTime) && Number.isFinite(bTime)) {
      return bTime - aTime
    }

    const aId = a.id ?? 0
    const bId = b.id ?? 0
    return bId - aId
  })
}

export function normalizeRestaurantConfigPayload(payload: unknown): RestaurantConfig | null {
  const single = normalizeRestaurantConfig(payload)
  if (single) {
    return single
  }

  const list = normalizeList(payload)
  if (list.length > 0) {
    return sortConfigsNewestFirst(list)[0]
  }

  return null
}

export function normalizeRestaurantConfigListPayload(payload: unknown): RestaurantConfig[] {
  return sortConfigsNewestFirst(normalizeList(payload))
}

export const restaurantConfigService = {
  getCurrent: () => api.get<RestaurantConfig>('/configuracion-restaurante'),
  getAll: async () => {
    try {
      return await api.get<RestaurantConfig[]>('/configuracion-restaurante/all')
    } catch (error) {
      if (!shouldFallbackAllEndpoint(error)) {
        throw error
      }

      return api.get<RestaurantConfig[]>('/configuracion-restaurante')
    }
  },
  getById: (id: number) => api.get<RestaurantConfig>(`/configuracion-restaurante/${id}`),
  create: (data: UpsertRestaurantConfigDto) => api.post<RestaurantConfig>('/configuracion-restaurante', data),
  update: (id: number, data: UpsertRestaurantConfigDto) =>
    api.put<RestaurantConfig>(`/configuracion-restaurante/${id}`, data),
}
