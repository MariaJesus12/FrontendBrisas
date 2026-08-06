export interface Cliente {
  id: number
  nombre: string
  telefono: string
  activo?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface CreateClienteDto {
  nombre: string
  telefono: string
}

export type UpdateClienteDto = Partial<CreateClienteDto>

export interface ClienteListQuery {
  active?: boolean
  q?: string
  telefono?: string
}
