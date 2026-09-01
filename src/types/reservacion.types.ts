export type EstadoReservacion = string

export interface ReservaMesaEstado {
  mesaId: number
  numero: number
  capacidad: number
  activa: boolean
  reservada: boolean
  reservaId?: number
  reservaEstado?: string
  cliente?: string
  at?: string
  bloqueDesde?: string
  bloqueHasta?: string
}

export interface Reservacion {
  id: number
  clienteId?: number
  usuarioId?: number
  nombreCliente?: string
  telefono?: string
  clienteNombre?: string
  clienteTelefono?: string
  fechaHora: string
  cantidadPersonas: number
  estado: EstadoReservacion
  observaciones?: string
  notas?: string
  createdAt?: string
  updatedAt?: string
  usuario?: {
    id?: number
    nombre?: string
    usuario?: string
  }
}

export interface ReservacionListQuery {
  fecha?: string
  estado?: string
  clienteId?: number
  usuarioId?: number
  fechaDesde?: string
  fechaHasta?: string
}

export interface ReservasMesasEstadoQuery {
  at?: string
  includeInactive?: boolean
}

export interface CreateReservacionDto {
  nombreCliente: string
  telefono: string
  fechaHora: string
  cantidadPersonas: number
  observaciones?: string
  notas?: string
  clienteId?: number | null
  estado?: string
}

export type UpdateReservacionDto = Partial<CreateReservacionDto>
