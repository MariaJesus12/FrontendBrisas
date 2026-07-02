import api from './api'
import type { PlatoDelMes, CreatePlatoDelMesDto } from '@/types/menu.types'

export const platoDelMesService = {
  getActual: () => api.get<PlatoDelMes>('/plato-del-mes/actual'),
  getAll: () => api.get<PlatoDelMes[]>('/plato-del-mes'),
  create: (data: CreatePlatoDelMesDto) => api.post<PlatoDelMes>('/plato-del-mes', data),
  update: (id: number, data: Partial<CreatePlatoDelMesDto>) =>
    api.put<PlatoDelMes>(`/plato-del-mes/${id}`, data),
  delete: (id: number) => api.delete(`/plato-del-mes/${id}`),
}
