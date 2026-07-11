import api from './api'
import axios from 'axios'
import type { LoginRequest, LoginResponse } from '@/types/auth.types'

export const authService = {
  login: async (data: LoginRequest) => {
    const payloadVariants = [
      {
        usuario: data.email,
        password: data.password,
      },
      {
        email: data.email,
        password: data.password,
      },
    ]

    let lastError: unknown

    for (const payload of payloadVariants) {
      try {
        return await api.post<LoginResponse>('/auth/login', payload)
      } catch (error) {
        lastError = error

        if (!axios.isAxiosError(error)) {
          throw error
        }

        // Retry only for validation-like errors where field names may differ.
        if (!error.response || ![400, 422].includes(error.response.status)) {
          throw error
        }
      }
    }

    throw lastError
  },
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
}
