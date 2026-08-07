import axios from 'axios'
import { env } from '@/config/env'

const PUBLIC_401_SAFE_ENDPOINTS = [
  '/products',
  '/categories',
  '/dish-of-month',
  '/announcements',
  '/configuracion-restaurante',
]
const CLIENT_ENDPOINTS = ['/clientes', '/cliente', '/customers', '/customer']

function shouldRedirectToLoginOn401(error: {
  response?: { status?: number }
  config?: { url?: string }
}): boolean {
  if (error.response?.status !== 401) {
    return false
  }

  const requestUrl = String(error.config?.url ?? '')
  const isPublicEndpoint = PUBLIC_401_SAFE_ENDPOINTS.some((endpoint) => requestUrl.includes(endpoint))

  if (isPublicEndpoint) {
    return false
  }

  return true
}

function getStoredToken(): string | null {
  const rawToken =
    localStorage.getItem('token') ??
    localStorage.getItem('accessToken') ??
    localStorage.getItem('authToken')

  if (!rawToken) {
    return null
  }

  return rawToken.startsWith('Bearer ') ? rawToken.slice('Bearer '.length) : rawToken
}

function buildNoCacheParams(params: unknown): Record<string, unknown> {
  if (params instanceof URLSearchParams) {
    const next: Record<string, unknown> = {}
    params.forEach((value, key) => {
      next[key] = value
    })
    next._ts = Date.now()
    return next
  }

  if (typeof params === 'object' && params !== null) {
    return { ...(params as Record<string, unknown>), _ts: Date.now() }
  }

  return { _ts: Date.now() }
}

function shouldBypassCache(url: string): boolean {
  return CLIENT_ENDPOINTS.some((endpoint) => url.includes(endpoint))
}

const api = axios.create({
  baseURL: env.apiUrl,
  timeout: env.apiTimeoutMs,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = getStoredToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  const method = String(config.method ?? 'GET').toUpperCase()
  const requestUrl = String(config.url ?? '')
  if (method === 'GET' && shouldBypassCache(requestUrl)) {
    config.params = buildNoCacheParams(config.params)
    const headers = axios.AxiosHeaders.from(config.headers)
    headers.set('Cache-Control', 'no-cache, no-store, max-age=0')
    headers.set('Pragma', 'no-cache')
    headers.set('Expires', '0')
    config.headers = headers
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 304 && error.config?.method?.toUpperCase() === 'GET') {
      const originalConfig = error.config as typeof error.config & { _retried304?: boolean }

      if (!originalConfig._retried304) {
        originalConfig._retried304 = true

        return api.request({
          ...originalConfig,
          params: buildNoCacheParams(originalConfig.params),
          headers: {
            ...(originalConfig.headers ?? {}),
            'Cache-Control': 'no-cache, no-store, max-age=0',
            Pragma: 'no-cache',
            Expires: '0',
          },
        })
      }
    }

    if (
      typeof error === 'object' &&
      error !== null &&
      'response' in error &&
      shouldRedirectToLoginOn401(
        error as {
          response?: { status?: number }
          config?: { url?: string }
        },
      )
    ) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export default api
