export interface Announcement {
  id: number
  titulo: string
  descripcion?: string
  imagen?: string
  fechaInicio?: string
  fechaFin?: string
  horaInicio?: string
  horaFin?: string
  prioridad?: number
  activo?: number | boolean
  tipo?: string
  createdAt?: string
  updatedAt?: string
}

export interface CreateAnnouncementDto {
  titulo: string
  descripcion?: string
  imagen?: string
  fechaInicio: string
  fechaFin: string
  horaInicio?: string
  horaFin?: string
  prioridad?: number
  activo?: number
  tipo?: string
}
