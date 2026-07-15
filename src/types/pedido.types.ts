export type TipoPedido = 'MESA' | 'LLEVAR' | string

export type EstadoPedido = 'BORRADOR' | 'EN_PREPARACION' | 'LISTO' | 'FACTURADO' | 'CANCELADO' | string

export interface PedidoDetalle {
  id: number
  productoId: number
  producto?: {
    id?: number
    nombre?: string
    precio?: number
  }
  cantidad: number
  precioUnitario: number
  observacion?: string
  subtotal?: number
}

export type DetallePedido = PedidoDetalle

export interface PagoPedido {
  id: number
  metodoPagoId: number
  metodoPago?: {
    id?: number
    nombre?: string
  }
  monto: number
  referencia?: string
  createdAt?: string
  updatedAt?: string
}

export interface MetodoPago {
  id: number
  nombre: string
}

export interface Pedido {
  id: number
  codigo?: string
  mesaId?: number | null
  mesa?: {
    id?: number
    numero?: number
    capacidad?: number
    activa?: boolean
  }
  usuarioId?: number | null
  usuario?: {
    id?: number
    nombre?: string
    usuario?: string
    email?: string
  }
  tipo: TipoPedido
  estado: EstadoPedido
  impuesto?: number
  total?: number
  totalPagado?: number
  saldoPendiente?: number
  detalles?: PedidoDetalle[]
  pagos?: PagoPedido[]
  createdAt?: string
  updatedAt?: string
}

export interface CreatePedidoDetalleDto {
  productoId: number
  cantidad: number
  precioUnitario: number
  observacion?: string
}

export interface CreatePagoPedidoDto {
  metodoPagoId: number
  monto: number
  referencia?: string
}

export interface CreatePedidoDto {
  codigo?: string
  mesaId?: number | null
  usuarioId: number
  tipo: TipoPedido
  estado: EstadoPedido
  impuesto: number
  detalles: CreatePedidoDetalleDto[]
}

export interface UpdatePedidoDto extends Partial<CreatePedidoDto> {}

export interface PedidoListQuery {
  estado?: string
  tipo?: string
  mesaId?: number
  usuarioId?: number
  fechaDesde?: string
  fechaHasta?: string
}
