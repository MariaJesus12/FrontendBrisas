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
  tipo?: AnnouncementType
  createdAt?: string
  updatedAt?: string
}

export type AnnouncementType = 'PROMOCION' | 'EVENTO' | 'INFORMATIVO' | 'PLATO_DEL_DIA'

export interface CreateAnnouncementDto {
  titulo: string
  descripcion?: string
  imagen?: string
  fechaInicio: string
  fechaFin: string
  horaInicio?: string
  horaFin?: string
  prioridad?: number
  activo?: number | boolean
  tipo: AnnouncementType
}
