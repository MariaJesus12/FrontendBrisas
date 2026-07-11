export interface Category {
  id: number
  nombre: string
  descripcion?: string
}

export type Categoria = Category

export interface CreateCategoryDto {
  nombre: string
  descripcion?: string
}

export interface Product {
  id: number
  codigo?: string
  nombre: string
  descripcion: string
  precio: number
  imagen?: string
  categoryId: number
  category?: Category
  disponible: boolean
}

export type Plato = Product

export interface CreateProductDto {
  codigo: string
  nombre: string
  descripcion: string
  precio: number
  imagen?: string
  categoryId: number
  disponible?: boolean
}

export type CreatePlatoDto = CreateProductDto

export interface DishOfMonth {
  id: number
  productId: number
  productoId?: number
  product?: Product
  descripcionEspecial?: string
  activo?: boolean
  fechaInicio?: string
  fechaFin?: string
  mes?: number
  anio?: number
  createdAt?: string
  updatedAt?: string
}

export type PlatoDelMes = DishOfMonth

export interface CreateDishOfMonthDto {
  productId: number
  productoId?: number
  fechaInicio: string
  fechaFin: string
  descripcionEspecial?: string
  activo?: boolean
  mes?: number
  anio?: number
}

export type CreatePlatoDelMesDto = CreateDishOfMonthDto
