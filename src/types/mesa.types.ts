export interface Mesa {
  id: number
  numero: number
  capacidad: number
  observacion?: string
  activa: boolean
  createdAt?: string
  updatedAt?: string
}

export interface CreateMesaDto {
  numero: number
  capacidad: number
  observacion?: string
  activa: boolean
}

export type UpdateMesaDto = Partial<CreateMesaDto>