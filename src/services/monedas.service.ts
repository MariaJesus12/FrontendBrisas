import axios from 'axios'
import api from './api'

const MONEDAS_ENDPOINTS = ['/monedas', '/moneda', '/tipos-moneda', '/tipo-moneda'] as const
const MONEDAS_ENDPOINT_STORAGE_KEY = 'resolvedMonedasEndpoint'

function readStoredEndpoint(): string | null {
  try {
    const stored = localStorage.getItem(MONEDAS_ENDPOINT_STORAGE_KEY)
    return stored && MONEDAS_ENDPOINTS.includes(stored as (typeof MONEDAS_ENDPOINTS)[number]) ? stored : null
  } catch {
    return null
  }
}

function storeResolvedEndpoint(endpoint: string) {
  try {
    localStorage.setItem(MONEDAS_ENDPOINT_STORAGE_KEY, endpoint)
  } catch {
    // Ignore storage errors and continue with in-memory fallback.
  }
}

let resolvedMonedasEndpoint: string | null = readStoredEndpoint()

export interface Moneda {
  id: number
  nombre?: string
  codigo?: string
  simbolo?: string
  activo?: boolean
  createdAt?: string
  updatedAt?: string
}

function endpointCandidates(): readonly string[] {
  if (resolvedMonedasEndpoint) {
    return [resolvedMonedasEndpoint, ...MONEDAS_ENDPOINTS.filter((path) => path !== resolvedMonedasEndpoint)]
  }

  return MONEDAS_ENDPOINTS
}

function isNotFoundError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404
}

async function getAllWithFallback() {
  let lastError: unknown

  for (const endpoint of endpointCandidates()) {
    try {
      const response = await api.get<Moneda[]>(endpoint)
      resolvedMonedasEndpoint = endpoint
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
      const response = await api.get<Moneda>(`${endpoint}/${id}`)
      resolvedMonedasEndpoint = endpoint
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

export const monedasService = {
  getAll: () => getAllWithFallback(),
  getById: (id: number) => getByIdWithFallback(id),
}
