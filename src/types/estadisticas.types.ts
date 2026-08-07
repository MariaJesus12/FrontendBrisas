export interface ProductSalesSummary {
  totalUnits: number
  totalRevenue: number
  totalOrders?: number
  facturedOrders?: number
  closedOrders?: number
  totalSalesOrders?: number
  totalProducts?: number
  soldProducts?: number
  unsoldProducts?: number
  averageTicket?: number
  availableProducts?: number
}

export interface ProductSalesRankItem {
  productId: number
  productName: string
  productCode?: string
  unitsSold: number
  revenue: number
  orders?: number
  available?: boolean
  categoryName?: string
}

export interface DailySalesPoint {
  date: string
  unitsSold: number
  revenue: number
  orders?: number
}

export interface ProductSalesCharts {
  productsByUnits?: Array<{ name: string; value: number; revenue?: number }>
  productsByRevenue?: Array<{ name: string; value: number; unitsSold?: number }>
  dailySales?: Array<{ date: string; unitsSold: number; revenue: number }>
}

export interface ProductSalesStatsResponse {
  period?: {
    mode?: string
    label?: string
    fechaDesde?: string
    fechaHasta?: string
  }
  summary?: ProductSalesSummary
  topProduct?: ProductSalesRankItem | null
  bottomProduct?: ProductSalesRankItem | null
  bottomProductWithSales?: ProductSalesRankItem | null
  ranking?: ProductSalesRankItem[]
  dailySeries?: DailySalesPoint[]
  charts?: ProductSalesCharts
}

export interface ProductSalesStatsQuery {
  month?: string
  date?: string
  fechaDesde?: string
  fechaHasta?: string
  available?: boolean
}
