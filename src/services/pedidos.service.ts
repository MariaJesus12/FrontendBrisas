import axios from 'axios'
import api from './api'
import type {
  CreatePagoPedidoDto,
  CreatePedidoDetalleDto,
  CreatePedidoDto,
  MetodoPago,
  Pedido,
  PedidoDetalle,
  PedidoListQuery,
  PagoPedido,
  UpdatePedidoDto,
} from '@/types/pedido.types'

export const pedidosService = {
  getAll: (params?: PedidoListQuery) => api.get<Pedido[]>('/pedidos', { params }),
  getById: (id: number) => api.get<Pedido>(`/pedidos/${id}`),
  create: (data: CreatePedidoDto) => api.post<Pedido>('/pedidos', data),
  update: (id: number, data: UpdatePedidoDto) => api.put<Pedido>(`/pedidos/${id}`, data),
  sendToKitchen: (id: number) => api.post<Pedido>(`/pedidos/${id}/enviar-cocina`),
  bill: (id: number) => api.post<Pedido>(`/pedidos/${id}/facturar`),
  delete: (id: number) => api.delete(`/pedidos/${id}`),
  getDetails: async (id: number) => {
    try {
      return await api.get<PedidoDetalle[]>(`/pedidos/${id}/details`)
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return api.get<PedidoDetalle[]>(`/pedidos/${id}/detalles`)
      }

      throw error
    }
  },
  createDetail: async (id: number, data: CreatePedidoDetalleDto) => {
    try {
      return await api.post<PedidoDetalle>(`/pedidos/${id}/details`, data)
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return api.post<PedidoDetalle>(`/pedidos/${id}/detalles`, data)
      }

      throw error
    }
  },
  updateDetail: async (id: number, detailId: number, data: Partial<CreatePedidoDetalleDto>) => {
    try {
      return await api.put<PedidoDetalle>(`/pedidos/${id}/details/${detailId}`, data)
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return api.put<PedidoDetalle>(`/pedidos/${id}/detalles/${detailId}`, data)
      }

      throw error
    }
  },
  deleteDetail: async (id: number, detailId: number) => {
    try {
      return await api.delete(`/pedidos/${id}/details/${detailId}`)
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return api.delete(`/pedidos/${id}/detalles/${detailId}`)
      }

      throw error
    }
  },
  getPayments: (id: number) => api.get<PagoPedido[]>(`/pedidos/${id}/payments`),
  createPayment: (id: number, data: CreatePagoPedidoDto) =>
    api.post<PagoPedido>(`/pedidos/${id}/payments`, data),
  updatePayment: (id: number, paymentId: number, data: Partial<CreatePagoPedidoDto>) =>
    api.put<PagoPedido>(`/pedidos/${id}/payments/${paymentId}`, data),
  deletePayment: (id: number, paymentId: number) =>
    api.delete(`/pedidos/${id}/payments/${paymentId}`),
  getPaymentMethods: () => api.get<MetodoPago[]>('/pedidos/payment-methods'),
}
