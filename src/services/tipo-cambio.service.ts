import axios from 'axios'
import api from './api'

const TIPO_CAMBIO_ENDPOINTS = ['/tipo-cambio', '/tipo_cambio', '/tipos-cambio', '/tipos_cambio'] as const
const TIPO_CAMBIO_ENDPOINT_STORAGE_KEY = 'resolvedTipoCambioEndpoint'

function readStoredEndpoint(): string | null {
  try {
    const stored = localStorage.getItem(TIPO_CAMBIO_ENDPOINT_STORAGE_KEY)
    return stored && TIPO_CAMBIO_ENDPOINTS.includes(stored as (typeof TIPO_CAMBIO_ENDPOINTS)[number]) ? stored : null
  } catch {
    return null
  }
}

function storeResolvedEndpoint(endpoint: string) {
  try {
    localStorage.setItem(TIPO_CAMBIO_ENDPOINT_STORAGE_KEY, endpoint)
  } catch {
    // Ignore storage errors and continue with in-memory fallback.
  }
}

let resolvedTipoCambioEndpoint: string | null = readStoredEndpoint()

export interface TipoCambio {
  id: number
  fecha?: string
  compra: number
  venta: number
  activo?: boolean
  usuarioId?: number
  createdAt?: string
  updatedAt?: string
}

export interface CreateTipoCambioDto {
  fecha: string
  compra: number
  venta: number
  activo: boolean
  usuarioId: number
}

function buildPayloadVariants(data: CreateTipoCambioDto) {
  return [
    {
      fecha: data.fecha,
      compra: data.compra,
      venta: data.venta,
      activo: data.activo,
      usuario_id: data.usuarioId,
    },
    {
      fecha: data.fecha,
      compra: data.compra,
      venta: data.venta,
      activo: data.activo,
      usuarioId: data.usuarioId,
    },
    {
      fecha_vigencia: data.fecha,
      compra: data.compra,
      venta: data.venta,
      activo: data.activo,
      usuario_id: data.usuarioId,
    },
  ]
}

function isNotFoundError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404
}

function isValidationError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 400
}

function endpointCandidates(): readonly string[] {
  if (resolvedTipoCambioEndpoint) {
    return [resolvedTipoCambioEndpoint, ...TIPO_CAMBIO_ENDPOINTS.filter((path) => path !== resolvedTipoCambioEndpoint)]
  }

  return TIPO_CAMBIO_ENDPOINTS
}

async function getAllWithFallback() {
  let lastError: unknown

  for (const endpoint of endpointCandidates()) {
    try {
      const response = await api.get<TipoCambio[]>(endpoint)
      resolvedTipoCambioEndpoint = endpoint
      storeResolvedEndpoint(endpoint)
      return response
    } catch (error) {
      lastError = error
      if (!isNotFoundError(error)) {
        throw error
      }
    }
  }

  throw lastError
}

async function getByIdWithFallback(id: number) {
  let lastError: unknown

  for (const endpoint of endpointCandidates()) {
    try {
      const response = await api.get<TipoCambio>(`${endpoint}/${id}`)
      resolvedTipoCambioEndpoint = endpoint
      storeResolvedEndpoint(endpoint)
      return response
    } catch (error) {
      lastError = error
      if (!isNotFoundError(error)) {
        throw error
      }
    }
  }

  throw lastError
}

async function postWithFallback(data: CreateTipoCambioDto) {
  const payloadVariants = buildPayloadVariants(data)
  let lastError: unknown

  for (const endpoint of endpointCandidates()) {
    for (const payload of payloadVariants) {
      try {
        const response = await api.post<TipoCambio>(endpoint, payload)
        resolvedTipoCambioEndpoint = endpoint
        storeResolvedEndpoint(endpoint)
        return response
      } catch (error) {
        lastError = error
        if (isValidationError(error)) {
          continue
        }

        if (isNotFoundError(error)) {
          break
        }

        throw error
      }
    }
  }

  throw lastError
}

async function putWithFallback(id: number, data: CreateTipoCambioDto) {
  const payloadVariants = buildPayloadVariants(data)
  let lastError: unknown

  for (const endpoint of endpointCandidates()) {
    for (const payload of payloadVariants) {
      try {
        const response = await api.put<TipoCambio>(`${endpoint}/${id}`, payload)
        resolvedTipoCambioEndpoint = endpoint
        storeResolvedEndpoint(endpoint)
        return response
      } catch (error) {
        lastError = error
        if (isValidationError(error)) {
          continue
        }

        if (isNotFoundError(error)) {
          break
        }

        throw error
      }
    }
  }

  throw lastError
}

export const tipoCambioService = {
  getAll: () => getAllWithFallback(),
  getById: (id: number) => getByIdWithFallback(id),
  create: (data: CreateTipoCambioDto) => postWithFallback(data),
  update: (id: number, data: CreateTipoCambioDto) => putWithFallback(id, data),
}
