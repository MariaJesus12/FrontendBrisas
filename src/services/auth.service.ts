import api from './api'
import type { LoginRequest, LoginResponse } from '@/types/auth.types'

export const authService = {
  login: (data: LoginRequest) =>
    api.post<LoginResponse>('/auth/login', {
      usuario: data.email,
      password: data.password,
    }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
}
