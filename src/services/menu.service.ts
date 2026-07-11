import api from './api'
import axios from 'axios'
import type {
  Category,
  CreateCategoryDto,
  CreateProductDto,
  Product,
  Categoria,
  Plato,
  CreatePlatoDto,
} from '@/types/menu.types'

function buildProductPayloadVariants(data: CreateProductDto | Partial<CreateProductDto>) {
  const {
    categoryId: rawCategoryId,
    disponible: rawDisponible,
    imagen: rawImagen,
    codigo: rawCodigo,
    ...baseFields
  } = data

  const categoryId =
    typeof rawCategoryId === 'number' && Number.isFinite(rawCategoryId) ? rawCategoryId : undefined

  const categoryVariants =
    typeof categoryId === 'number'
      ? [
          { categoriaId: categoryId },
          { category_id: categoryId },
          { categoria_id: categoryId },
          { categoryId },
        ]
      : [{}]

  const codeVariants =
    typeof rawCodigo === 'string' && rawCodigo.trim()
      ? [{ codigo: rawCodigo.trim() }, { code: rawCodigo.trim() }, { sku: rawCodigo.trim() }]
      : [{}]

  const availableVariants =
    typeof rawDisponible === 'boolean'
      ? [{ disponible: rawDisponible }, { available: rawDisponible }, { activo: rawDisponible }]
      : [{}]

  const imageVariants =
    typeof rawImagen === 'string' && rawImagen.trim()
      ? [{ imagen: rawImagen }, { image: rawImagen }]
      : [{}]

  const variants: Array<Record<string, unknown>> = []

  categoryVariants.forEach((categoryField) => {
    codeVariants.forEach((codeField) => {
      availableVariants.forEach((availableField) => {
        imageVariants.forEach((imageField) => {
          variants.push({
            ...baseFields,
            ...categoryField,
            ...codeField,
            ...availableField,
            ...imageField,
          })
        })
      })
    })
  })

  return variants
}

async function postProductWithFallback(data: CreateProductDto) {
  const variants = buildProductPayloadVariants(data)
  let lastError: unknown

  for (const payload of variants) {
    try {
      return await api.post<Product>('/products', payload)
    } catch (error) {
      lastError = error
      if (!axios.isAxiosError(error)) {
        throw error
      }

      if (!error.response || error.response.status !== 400) {
        throw error
      }
    }
  }

  throw lastError
}

async function putProductWithFallback(id: number, data: Partial<CreateProductDto>) {
  const variants = buildProductPayloadVariants(data)
  let lastError: unknown

  for (const payload of variants) {
    try {
      return await api.put<Product>(`/products/${id}`, payload)
    } catch (error) {
      lastError = error
      if (!axios.isAxiosError(error)) {
        throw error
      }

      if (!error.response || error.response.status !== 400) {
        throw error
      }
    }
  }

  throw lastError
}

export const menuService = {
  getCategories: () => api.get<Category[]>('/categories'),
  getProductsByCategory: (id: number) => api.get<Product[]>(`/categories/${id}/products`),
  createCategory: (data: CreateCategoryDto) => api.post<Category>('/categories', data),
  updateCategory: (id: number, data: Partial<CreateCategoryDto>) =>
    api.put<Category>(`/categories/${id}`, data),
  deleteCategory: (id: number) => api.delete(`/categories/${id}`),

  getProducts: () => api.get<Product[]>('/products'),
  getProductById: (id: number) => api.get<Product>(`/products/${id}`),
  createProduct: (data: CreateProductDto) => postProductWithFallback(data),
  updateProduct: (id: number, data: Partial<CreateProductDto>) => putProductWithFallback(id, data),
  deleteProduct: (id: number) => api.delete(`/products/${id}`),

  // Backward-compatible aliases for old naming in the app.
  getCategorias: () => api.get<Categoria[]>('/categories'),
  createCategoria: (data: Omit<Categoria, 'id'>) => api.post<Categoria>('/categories', data),
  updateCategoria: (id: number, data: Partial<Omit<Categoria, 'id'>>) =>
    api.put<Categoria>(`/categories/${id}`, data),
  deleteCategoria: (id: number) => api.delete(`/categories/${id}`),

  getAllPlatos: () => api.get<Plato[]>('/products'),
  getPlatoById: (id: number) => api.get<Plato>(`/products/${id}`),
  createPlato: (data: CreatePlatoDto) => postProductWithFallback(data),
  updatePlato: (id: number, data: Partial<CreatePlatoDto>) => putProductWithFallback(id, data),
  deletePlato: (id: number) => api.delete(`/products/${id}`),
}
