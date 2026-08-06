export type TipoPedido = 'MESA' | 'LLEVAR' | string

export type EstadoPedido = 'BORRADOR' | 'EN_PREPARACION' | 'LISTO' | 'FACTURADO' | 'CANCELADO' | string

export interface PedidoDetalle {
  id: number
  productoId: number
  productoNombre?: string
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
  moneda?: string
  monedaId?: number
  montoColones?: number
  montoRecibido?: number
  montoRecibidoColones?: number
  vuelto?: number
  vueltoColones?: number
  tipoCambioId?: number
  accountId?: number
  referencia?: string
  createdAt?: string
  updatedAt?: string
}

export interface PedidoAccountDetail {
  id: number
  detailId?: number
  pedidoDetalleId?: number
  productoId?: number
  productoNombre?: string
  cantidad?: number
  precioUnitario?: number
  subtotal?: number
}

export interface PedidoAccount {
  id: number
  numeroCuenta?: number
  nombre?: string
  numero?: string
  activo?: boolean
  estado?: string
  detalles?: PedidoAccountDetail[]
  subtotal?: number
  servicio?: number
  total?: number
  totalPagado?: number
  saldoPendiente?: number
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
  montoMoneda?: number
  moneda?: 'CRC' | 'USD' | string
  monedaId?: number
  montoColones?: number
  montoRecibido?: number
  montoRecibidoMoneda?: number
  montoRecibidoColones?: number
  vuelto?: number
  vueltoColones?: number
  tipoCambioId?: number
  cuentaPedidoId?: number
  cuentaId?: number
  accountId?: number
  aplicarServicio?: boolean
  exonerarServicio?: boolean
  referencia?: string
}

export interface CreatePedidoAccountDto {
  numeroCuenta?: number
  nombre?: string
  numero?: string
  activo?: boolean
  items?: PedidoAccountSplitItemDto[]
  detailIds?: number[]
  detalleIds?: number[]
  detalles?: PedidoAccountSplitItemAltDto[]
}

export interface PedidoAccountSplitItemDto {
  detailId?: number
  productoId?: number
  cantidad?: number
}

export interface PedidoAccountSplitItemAltDto {
  detailId?: number
  detalleId?: number
  productoId?: number
  producto_id?: number
  cantidad?: number
  quantity?: number
  qty?: number
}

export interface AddPedidoAccountDetailDto {
  items?: PedidoAccountSplitItemDto[]
  detailIds?: number[]
  detalleIds?: number[]
  detalles?: PedidoAccountSplitItemAltDto[]
  detailId?: number
  pedidoDetalleId?: number
  productoId?: number
  cantidad?: number
}

export interface MovePedidoAccountDetailDto {
  cantidad?: number
  quantity?: number
  qty?: number
  cuentaDestinoId?: number
  cuenta_destino_id?: number
  targetAccountId?: number
  target_account_id?: number
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
