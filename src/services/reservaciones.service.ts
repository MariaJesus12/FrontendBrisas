import api from './api'
import type { Reservacion, CreateReservacionDto } from '@/types/reservacion.types'

export const reservacionesService = {
  getAll: () => api.get<Reservacion[]>('/reservaciones'),
  getById: (id: number) => api.get<Reservacion>(`/reservaciones/${id}`),
  create: (data: CreateReservacionDto) => api.post<Reservacion>('/reservaciones', data),
  update: (id: number, data: Partial<CreateReservacionDto>) =>
    api.put<Reservacion>(`/reservaciones/${id}`, data),
  updateEstado: (id: number, estado: string) =>
    api.patch<Reservacion>(`/reservaciones/${id}/estado`, { estado }),
  delete: (id: number) => api.delete(`/reservaciones/${id}`),
}
