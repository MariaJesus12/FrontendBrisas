export type EstadoReservacion = 'pendiente' | 'confirmada' | 'cancelada'

export interface Reservacion {
  id: number
  nombreCliente: string
  email: string
  telefono: string
  fecha: string
  hora: string
  numeroPersonas: number
  estado: EstadoReservacion
  notas?: string
  createdAt: string
}

export interface CreateReservacionDto {
  nombreCliente: string
  email: string
  telefono: string
  fecha: string
  hora: string
  numeroPersonas: number
  notas?: string
}
