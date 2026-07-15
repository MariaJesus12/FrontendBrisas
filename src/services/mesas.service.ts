import api from './api'
import type { CreateMesaDto, Mesa, UpdateMesaDto } from '@/types/mesa.types'

export const mesasService = {
  getAll: (active?: boolean) =>
    api.get<Mesa[]>('/mesas', {
      params: typeof active === 'boolean' ? { active } : undefined,
    }),
  getById: (id: number) => api.get<Mesa>(`/mesas/${id}`),
  create: (data: CreateMesaDto) => api.post<Mesa>('/mesas', data),
  update: (id: number, data: UpdateMesaDto) => api.put<Mesa>(`/mesas/${id}`, data),
  delete: (id: number) => api.delete(`/mesas/${id}`),
}