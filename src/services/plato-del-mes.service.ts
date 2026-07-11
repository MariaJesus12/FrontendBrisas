import api from './api'
import axios from 'axios'
import type {
  DishOfMonth,
  CreateDishOfMonthDto,
  PlatoDelMes,
  CreatePlatoDelMesDto,
} from '@/types/menu.types'

function buildDishOfMonthPayloadVariants(
  data: CreateDishOfMonthDto | Partial<CreateDishOfMonthDto>,
) {
  const {
    productId: rawProductId,
    productoId: rawProductoId,
    descripcionEspecial: rawDescription,
    fechaInicio: rawStartDate,
    fechaFin: rawEndDate,
    ...otherFields
  } = data

  const productId =
    typeof rawProductId === 'number' && Number.isFinite(rawProductId)
      ? rawProductId
      : typeof rawProductoId === 'number' && Number.isFinite(rawProductoId)
        ? rawProductoId
        : undefined

  const productIdVariants =
    typeof productId === 'number'
      ? [
          { productoId: productId },
          { producto_id: productId },
          { productId },
          { product_id: productId },
          { platoId: productId },
          { plato_id: productId },
        ]
      : [{}]

  const startDateVariants =
    typeof rawStartDate === 'string' && rawStartDate.trim()
      ? [{ fechaInicio: rawStartDate }, { fecha_inicio: rawStartDate }]
      : [{}]

  const endDateVariants =
    typeof rawEndDate === 'string' && rawEndDate.trim()
      ? [{ fechaFin: rawEndDate }, { fecha_fin: rawEndDate }]
      : [{}]

  const descriptionVariants =
    typeof rawDescription === 'string'
      ? [
          { descripcionEspecial: rawDescription },
          { descripcion: rawDescription },
          { description: rawDescription },
          { specialDescription: rawDescription },
        ]
      : [{}]

  const variants: Array<Record<string, unknown>> = []

  productIdVariants.forEach((productField) => {
    startDateVariants.forEach((startDateField) => {
      endDateVariants.forEach((endDateField) => {
        descriptionVariants.forEach((descriptionField) => {
          variants.push({
            ...otherFields,
            ...productField,
            ...startDateField,
            ...endDateField,
            ...descriptionField,
          })
        })
      })
    })
  })

  return variants
}

async function postDishOfMonthWithFallback(data: CreateDishOfMonthDto) {
  const variants = buildDishOfMonthPayloadVariants(data)
  let lastError: unknown

  for (const payload of variants) {
    try {
      return await api.post<DishOfMonth>('/dish-of-month', payload)
    } catch (error) {
      lastError = error
      if (!axios.isAxiosError(error)) {
        throw error
      }

      if (!error.response || ![400, 422].includes(error.response.status)) {
        throw error
      }
    }
  }

  throw lastError
}

async function putDishOfMonthWithFallback(id: number, data: Partial<CreateDishOfMonthDto>) {
  const variants = buildDishOfMonthPayloadVariants(data)
  let lastError: unknown

  for (const payload of variants) {
    try {
      return await api.put<DishOfMonth>(`/dish-of-month/${id}`, payload)
    } catch (error) {
      lastError = error
      if (!axios.isAxiosError(error)) {
        throw error
      }

      if (!error.response || ![400, 422].includes(error.response.status)) {
        throw error
      }
    }
  }

  throw lastError
}

export const platoDelMesService = {
  getCurrent: () => api.get<DishOfMonth>('/dish-of-month'),
  getHistory: () => api.get<DishOfMonth[]>('/dish-of-month/history'),
  create: (data: CreateDishOfMonthDto) => postDishOfMonthWithFallback(data),
  update: (id: number, data: Partial<CreateDishOfMonthDto>) => putDishOfMonthWithFallback(id, data),
  delete: (id: number) => api.delete(`/dish-of-month/${id}`),

  // Backward-compatible aliases for old naming in the app.
  getActual: () => api.get<PlatoDelMes>('/dish-of-month'),
  getAll: () => api.get<PlatoDelMes[]>('/dish-of-month/history'),
  createPlatoDelMes: (data: CreatePlatoDelMesDto) => postDishOfMonthWithFallback(data),
  updatePlatoDelMes: (id: number, data: Partial<CreatePlatoDelMesDto>) =>
    putDishOfMonthWithFallback(id, data),
}
