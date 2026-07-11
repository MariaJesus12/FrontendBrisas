import axios from 'axios'
import { env } from '@/config/env'

const PUBLIC_401_SAFE_ENDPOINTS = ['/products', '/categories', '/dish-of-month', '/announcements']

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
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
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
