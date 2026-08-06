import api from './api'
import type {
  CreateReservacionDto,
  Reservacion,
  ReservacionListQuery,
  ReservasMesasEstadoQuery,
  ReservaMesaEstado,
  UpdateReservacionDto,
} from '@/types/reservacion.types'

export const reservacionesService = {
  getMesasEstado: (query?: ReservasMesasEstadoQuery) =>
    api.get<ReservaMesaEstado[]>('/reservas/mesas/estado', {
      params: {
        at: query?.at,
        includeInactive: typeof query?.includeInactive === 'boolean' ? query.includeInactive : undefined,
      },
    }),
  getAll: (query?: ReservacionListQuery) => api.get<Reservacion[]>('/reservas', { params: query }),
  getById: (id: number) => api.get<Reservacion>(`/reservas/${id}`),
  create: (data: CreateReservacionDto) => api.post<Reservacion>('/reservas', data),
  update: (id: number, data: UpdateReservacionDto) => api.put<Reservacion>(`/reservas/${id}`, data),
  updateEstado: (id: number, estado: string) =>
    api.patch<Reservacion>(`/reservas/${id}/estado`, { estado }),
}
