import api from './api'
import type { Plato, CreatePlatoDto, Categoria } from '@/types/menu.types'

export const menuService = {
  getAllPlatos: () => api.get<Plato[]>('/menu/platos'),
  getPlatoById: (id: number) => api.get<Plato>(`/menu/platos/${id}`),
  createPlato: (data: CreatePlatoDto) => api.post<Plato>('/menu/platos', data),
  updatePlato: (id: number, data: Partial<CreatePlatoDto>) =>
    api.put<Plato>(`/menu/platos/${id}`, data),
  deletePlato: (id: number) => api.delete(`/menu/platos/${id}`),
  getCategorias: () => api.get<Categoria[]>('/menu/categorias'),
  createCategoria: (data: Omit<Categoria, 'id'>) => api.post<Categoria>('/menu/categorias', data),
  deleteCategoria: (id: number) => api.delete(`/menu/categorias/${id}`),
}
