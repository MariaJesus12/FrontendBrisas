import api from './api'
import type { Pedido, CreatePedidoDto } from '@/types/pedido.types'

export const pedidosService = {
  getAll: () => api.get<Pedido[]>('/pedidos'),
  getById: (id: number) => api.get<Pedido>(`/pedidos/${id}`),
  create: (data: CreatePedidoDto) => api.post<Pedido>('/pedidos', data),
  updateEstado: (id: number, estado: string) =>
    api.patch<Pedido>(`/pedidos/${id}/estado`, { estado }),
  delete: (id: number) => api.delete(`/pedidos/${id}`),
}
