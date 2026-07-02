export interface Categoria {
  id: number
  nombre: string
  descripcion?: string
}

export interface Plato {
  id: number
  nombre: string
  descripcion: string
  precio: number
  imagen?: string
  categoriaId: number
  categoria?: Categoria
  disponible: boolean
}

export interface CreatePlatoDto {
  nombre: string
  descripcion: string
  precio: number
  imagen?: string
  categoriaId: number
  disponible?: boolean
}

export interface PlatoDelMes {
  id: number
  platoId: number
  plato?: Plato
  mes: number
  anio: number
  descripcionEspecial?: string
  activo: boolean
}

export interface CreatePlatoDelMesDto {
  platoId: number
  mes: number
  anio: number
  descripcionEspecial?: string
}
