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
  getDetails: (id: number) => api.get<PedidoDetalle[]>(`/pedidos/${id}/details`),
  createDetail: (id: number, data: CreatePedidoDetalleDto) =>
    api.post<PedidoDetalle>(`/pedidos/${id}/details`, data),
  updateDetail: (id: number, detailId: number, data: Partial<CreatePedidoDetalleDto>) =>
    api.put<PedidoDetalle>(`/pedidos/${id}/details/${detailId}`, data),
  deleteDetail: (id: number, detailId: number) => api.delete(`/pedidos/${id}/details/${detailId}`),
  getPayments: (id: number) => api.get<PagoPedido[]>(`/pedidos/${id}/payments`),
  createPayment: (id: number, data: CreatePagoPedidoDto) =>
    api.post<PagoPedido>(`/pedidos/${id}/payments`, data),
  updatePayment: (id: number, paymentId: number, data: Partial<CreatePagoPedidoDto>) =>
    api.put<PagoPedido>(`/pedidos/${id}/payments/${paymentId}`, data),
  deletePayment: (id: number, paymentId: number) =>
    api.delete(`/pedidos/${id}/payments/${paymentId}`),
  getPaymentMethods: () => api.get<MetodoPago[]>('/pedidos/payment-methods'),
}
