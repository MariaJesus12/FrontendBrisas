import api from './api'
import type { ProductSalesStatsQuery, ProductSalesStatsResponse } from '@/types/estadisticas.types'

const PRODUCT_SALES_ROUTES = [
  '/estadisticas/productos/ventas',
  '/estadisticas/productos',
  '/estadisticas/ventas/productos',
  '/estadisticas/productos-ventas',
]

async function getProductSalesWithFallback(query?: ProductSalesStatsQuery) {
  let lastError: unknown

  for (const route of PRODUCT_SALES_ROUTES) {
    try {
      const response = await api.get<ProductSalesStatsResponse>(route, {
        params: {
          month: query?.month,
          mes: query?.month,
          date: query?.date,
          fecha: query?.date,
          fechaDesde: query?.fechaDesde,
          fechaHasta: query?.fechaHasta,
          fecha_desde: query?.fechaDesde,
          fecha_hasta: query?.fechaHasta,
          from: query?.fechaDesde,
          to: query?.fechaHasta,
          desde: query?.fechaDesde,
          hasta: query?.fechaHasta,
          available: typeof query?.available === 'boolean' ? query.available : undefined,
        },
        validateStatus: (status) => (status >= 200 && status < 300) || status === 404,
      })

      if (response.status === 404) {
        continue
      }

      return response
    } catch (error) {
      lastError = error
    }
  }

  throw lastError
}

export const estadisticasService = {
  getProductSales: (query?: ProductSalesStatsQuery) => getProductSalesWithFallback(query),
}
