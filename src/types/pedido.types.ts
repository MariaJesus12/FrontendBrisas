export type EstadoPedido = 'pendiente' | 'en_preparacion' | 'listo' | 'entregado' | 'cancelado'

export interface DetallePedido {
  id: number
  platoId: number
  plato?: {
    nombre: string
    precio: number
  }
  cantidad: number
  precioUnitario: number
  subtotal: number
}

export interface Pedido {
  id: number
  mesa: number
  estado: EstadoPedido
  total: number
  detalles: DetallePedido[]
  notas?: string
  createdAt: string
}

export interface CreatePedidoDto {
  mesa: number
  detalles: {
    platoId: number
    cantidad: number
  }[]
  notas?: string
}
