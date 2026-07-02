import axios from 'axios'
import { env } from '@/config/env'

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
      (error as { response?: { status?: number } }).response?.status === 401
    ) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export default api
