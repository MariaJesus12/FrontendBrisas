export interface RestaurantConfig {
  id?: number
  nombre: string
  telefono: string
  whatsapp: string
  instagramUrl?: string
  facebookUrl?: string
  tripadvisorUrl?: string
  googleMapsUrl?: string
  direccion: string
  horario: string
  createdAt?: string
  updatedAt?: string
}

export interface UpsertRestaurantConfigDto {
  nombre: string
  telefono: string
  whatsapp: string
  instagramUrl?: string
  facebookUrl?: string
  tripadvisorUrl?: string
  googleMapsUrl?: string
  direccion: string
  horario: string
}
