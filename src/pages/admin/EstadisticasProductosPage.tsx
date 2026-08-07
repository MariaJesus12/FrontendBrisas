import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControlLabel,
  Paper,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import PointOfSaleIcon from '@mui/icons-material/PointOfSale'
import EventIcon from '@mui/icons-material/Event'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { estadisticasService } from '@/services/estadisticas.service'
import type {
  DailySalesPoint,
  ProductSalesRankItem,
  ProductSalesStatsResponse,
  ProductSalesSummary,
} from '@/types/estadisticas.types'

const COLOR_GOLD = '#D4AF37'
const COLOR_TEXT = '#F3E9D2'
const COLOR_MUTED = 'rgba(243,233,210,0.72)'
const COLOR_PANEL = 'rgba(10,10,10,0.72)'
const COLOR_PANEL_BORDER = 'rgba(212,175,55,0.28)'
const COLOR_MAROON = '#8F1D2E'

type FilterMode = 'month' | 'date' | 'range'

interface FilterState {
  mode: FilterMode
  month: string
  date: string
  fechaDesde: string
  fechaHasta: string
  availableOnly: boolean
}

const initialFilters: FilterState = {
  mode: 'month',
  month: new Date().toISOString().slice(0, 7),
  date: new Date().toISOString().slice(0, 10),
  fechaDesde: '',
  fechaHasta: '',
  availableOnly: true,
}

function extractBackendMessage(payload: unknown): string {
  if (typeof payload === 'string') {
    return payload
  }

  if (typeof payload !== 'object' || payload === null) {
    return ''
  }

  const record = payload as { message?: unknown; error?: unknown; errors?: unknown }

  if (typeof record.message === 'string') {
    return record.message
  }

  if (Array.isArray(record.message)) {
    return record.message.map((item) => String(item)).join(' | ')
  }

  if (typeof record.error === 'string') {
    return record.error
  }

  if (Array.isArray(record.errors)) {
    return record.errors.map((item) => String(item)).join(' | ')
  }

  return ''
}

function formatCRC(value: number | undefined | null): string {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0))
}

function safeNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeRankItem(item: unknown): ProductSalesRankItem | null {
  if (typeof item !== 'object' || item === null) {
    return null
  }

  const record = item as Record<string, unknown>
  const productId = safeNumber(
    record.productId ??
      record.product_id ??
      record.productoId ??
      record.producto_id ??
      record.id ??
      record.platoId ??
      record.plato_id ??
      record.menuItemId ??
      record.menu_item_id,
  )

  const name =
    typeof record.productName === 'string'
      ? record.productName
      : typeof record.product_name === 'string'
        ? record.product_name
        : typeof record.productoNombre === 'string'
          ? record.productoNombre
          : typeof record.producto_nombre === 'string'
            ? record.producto_nombre
        : typeof record.nombre === 'string'
          ? record.nombre
          : typeof record.name === 'string'
            ? record.name
            : ''

    const fallbackName =
      name ||
      (typeof record.productCode === 'string' ? record.productCode : typeof record.codigo === 'string' ? record.codigo : '') ||
      (productId ? `Producto #${productId}` : '')

    if (!fallbackName) {
    return null
  }

  return {
      productId: productId || 0,
      productName: fallbackName,
    productCode:
      typeof record.productCode === 'string'
        ? record.productCode
        : typeof record.productoCodigo === 'string'
          ? record.productoCodigo
          : typeof record.codigo === 'string'
            ? record.codigo
            : undefined,
      unitsSold: safeNumber(
        record.unitsSold ??
          record.units_sold ??
          record.unidadesVendidas ??
          record.unidades_vendidas ??
          record.cantidad ??
          record.qty ??
          record.quantitySold ??
          record.quantity_sold,
      ),
      revenue: safeNumber(
        record.revenue ??
          record.ingresos ??
          record.total ??
          record.monto ??
          record.totalVendido ??
          record.total_vendido ??
          record.totalRevenue ??
          record.total_revenue,
      ),
      orders: safeNumber(
        record.orders ??
          record.pedidos ??
          record.cantidadPedidos ??
          record.pedidosCount ??
          record.pedidos_count ??
          record.totalOrders ??
          record.total_orders,
      ) || undefined,
    available: typeof record.available === 'boolean' ? record.available : typeof record.disponible === 'boolean' ? record.disponible : undefined,
    categoryName:
      typeof record.categoryName === 'string'
        ? record.categoryName
        : typeof record.categoriaNombre === 'string'
          ? record.categoriaNombre
        : typeof record.categoria === 'string'
          ? record.categoria
          : undefined,
  }
}

function normalizeDailyPoint(item: unknown): DailySalesPoint | null {
  if (typeof item !== 'object' || item === null) {
    return null
  }

  const record = item as Record<string, unknown>
  const date =
    typeof record.date === 'string'
      ? record.date
      : typeof record.fecha === 'string'
        ? record.fecha
        : typeof record.day === 'string'
          ? record.day
          : ''

  if (!date) {
    return null
  }

  return {
    date,
    unitsSold: safeNumber(record.unitsSold ?? record.units_sold ?? record.unidadesVendidas ?? record.cantidad ?? record.qty ?? record.unidades),
    revenue: safeNumber(record.revenue ?? record.ingresos ?? record.total ?? record.totalVendido ?? record.monto ?? record.ventas),
    orders: safeNumber(record.orders ?? record.pedidos ?? record.pedidosCount ?? record.totalOrders ?? record.total_orders) || undefined,
  }
}

function normalizeChartSeries(
  value: unknown,
  valueAliases: string[],
): Array<{ name: string; value: number; unitsSold?: number; revenue?: number }> {
  if (Array.isArray(value)) {
    const result: Array<{ name: string; value: number; unitsSold?: number; revenue?: number }> = []

    for (const item of value) {
      const record = asRecord(item) ?? {}
      const name =
        typeof record.name === 'string'
          ? record.name
          : typeof record.productName === 'string'
            ? record.productName
            : typeof record.productoNombre === 'string'
              ? record.productoNombre
              : typeof record.nombre === 'string'
                ? record.nombre
                : ''

      if (!name) {
        continue
      }

      const normalized: { name: string; value: number; unitsSold?: number; revenue?: number } = {
        name,
        value: safeNumber(
          valueAliases
            .map((alias) => record[alias])
            .find((candidate) => candidate !== undefined),
        ),
      }

      const unitsRaw = record.unitsSold ?? record.unidadesVendidas ?? record.cantidad
      const revenueRaw = record.revenue ?? record.totalVendido ?? record.ingresos ?? record.total

      if (unitsRaw !== undefined) {
        normalized.unitsSold = safeNumber(unitsRaw)
      }

      if (revenueRaw !== undefined) {
        normalized.revenue = safeNumber(revenueRaw)
      }

      result.push(normalized)
    }

    return result
  }

  const chartObject = asRecord(value)
  if (!chartObject || !Array.isArray(chartObject.labels) || !Array.isArray(chartObject.datasets)) {
    return []
  }

  const labels = chartObject.labels.map((label) => String(label))
  const datasets = chartObject.datasets
    .map((dataset) => asRecord(dataset))
    .filter((dataset): dataset is Record<string, unknown> => dataset !== null)
  const primaryDataset = datasets[0]
  if (!primaryDataset || !Array.isArray(primaryDataset.data)) {
    return []
  }

  const values = primaryDataset.data
  return labels.map((name, index) => ({ name, value: safeNumber(values[index]) }))
}

function normalizeDailyChartSeries(value: unknown): Array<{ date: string; unitsSold: number; revenue: number }> {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeDailyPoint(item))
      .filter((item): item is DailySalesPoint => item !== null)
      .map((item) => ({ date: item.date, unitsSold: item.unitsSold, revenue: item.revenue }))
  }

  const chartObject = asRecord(value)
  if (!chartObject || !Array.isArray(chartObject.labels) || !Array.isArray(chartObject.datasets)) {
    return []
  }

  const labels = chartObject.labels.map((label) => String(label))
  const datasets = chartObject.datasets
    .map((dataset) => asRecord(dataset))
    .filter((dataset): dataset is Record<string, unknown> => dataset !== null)

  const unitsDataset = datasets.find((dataset) => {
    const label = String(dataset.label ?? '').toLowerCase()
    return label.includes('unidad') || label.includes('units')
  })
  const revenueDataset = datasets.find((dataset) => {
    const label = String(dataset.label ?? '').toLowerCase()
    return label.includes('monto') || label.includes('vendido') || label.includes('ingreso') || label.includes('revenue')
  })

  const unitsData = Array.isArray(unitsDataset?.data) ? unitsDataset.data : []
  const revenueData = Array.isArray(revenueDataset?.data) ? revenueDataset.data : []

  return labels.map((date, index) => ({
    date,
    unitsSold: safeNumber(unitsData[index]),
    revenue: safeNumber(revenueData[index]),
  }))
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

function findArrayByKeys(root: unknown, keys: string[]): unknown[] {
  if (Array.isArray(root)) {
    return root
  }

  const queue: unknown[] = [root]
  const visited = new Set<unknown>()

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || visited.has(current)) {
      continue
    }
    visited.add(current)

    const record = asRecord(current)
    if (!record) {
      continue
    }

    for (const key of keys) {
      const value = record[key]
      if (Array.isArray(value)) {
        return value
      }
    }

    for (const value of Object.values(record)) {
      if (asRecord(value)) {
        queue.push(value)
      }
    }
  }

  return []
}

function findObjectByKeys(root: unknown, keys: string[]): Record<string, unknown> | null {
  const queue: unknown[] = [root]
  const visited = new Set<unknown>()

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || visited.has(current)) {
      continue
    }
    visited.add(current)

    const record = asRecord(current)
    if (!record) {
      continue
    }

    for (const key of keys) {
      const candidate = asRecord(record[key])
      if (candidate) {
        return candidate
      }
    }

    for (const value of Object.values(record)) {
      if (asRecord(value)) {
        queue.push(value)
      }
    }
  }

  return null
}

function unwrapArray<T>(payload: unknown, normalizer: (item: unknown) => T | null, keys: string[]): T[] {
  const items = findArrayByKeys(payload, keys)
  return items.map((item) => normalizer(item)).filter((item): item is T => item !== null)
}

function normalizeStats(payload: unknown): ProductSalesStatsResponse {
  const record = asRecord(payload) ?? {}
  const summaryRecord =
    findObjectByKeys(payload, ['resumenRapido']) ?? findObjectByKeys(payload, ['summary', 'resumen'])
  const topProductRaw =
    record.topProduct ??
    record.top_product ??
    record.productoMasVendido ??
    record.mostSold ??
    record.producto_mas_vendido
  const bottomProductRaw =
    record.bottomProduct ??
    record.bottom_product ??
    record.productoMenosVendido ??
    record.leastSold ??
    record.producto_menos_vendido
  const bottomProductWithSalesRaw = record.productoMenosVendidoConVentas ?? record.bottomProductWithSales

  const topProduct = normalizeRankItem(topProductRaw)
  const bottomProduct = normalizeRankItem(bottomProductRaw)
  const bottomProductWithSales = normalizeRankItem(bottomProductWithSalesRaw)

  const chartsRecord = findObjectByKeys(payload, ['graficas']) ?? findObjectByKeys(payload, ['charts'])

  const chartUnitsRaw = (chartsRecord as Record<string, unknown> | null)?.productsByUnits
    ?? (chartsRecord as Record<string, unknown> | null)?.topProductsByUnits
    ?? (chartsRecord as Record<string, unknown> | null)?.topProductosPorUnidades
    ?? record.topProductsByUnits
    ?? record.topProductosPorUnidades
    ?? findArrayByKeys(chartsRecord ?? payload, [
    'productsByUnits',
    'topProductsByUnits',
    'topProductosPorUnidades',
    'products_by_units',
    'topByUnits',
    'top_by_units',
    'porUnidades',
  ])

  const chartRevenueRaw = (chartsRecord as Record<string, unknown> | null)?.productsByRevenue
    ?? (chartsRecord as Record<string, unknown> | null)?.topProductsByRevenue
    ?? (chartsRecord as Record<string, unknown> | null)?.topProductosPorIngresos
    ?? record.topProductsByRevenue
    ?? record.topProductosPorIngresos
    ?? findArrayByKeys(chartsRecord ?? payload, [
    'productsByRevenue',
    'topProductsByRevenue',
    'topProductosPorIngresos',
    'products_by_revenue',
    'topByRevenue',
    'top_by_revenue',
    'porIngresos',
  ])

  const chartDailyRaw = (chartsRecord as Record<string, unknown> | null)?.dailySales
    ?? record.dailySeries
    ?? record.ventasDiarias
    ?? findArrayByKeys(chartsRecord ?? payload, [
    'dailySales',
    'daily_sales',
    'salesByDay',
    'sales_by_day',
    'ventasDiarias',
  ])

  const normalizedUnitsChart = normalizeChartSeries(chartUnitsRaw, ['value', 'unitsSold', 'unidadesVendidas', 'cantidad'])
  const normalizedRevenueChart = normalizeChartSeries(chartRevenueRaw, ['value', 'revenue', 'totalVendido', 'ingresos', 'total'])
  const normalizedDailyChart = normalizeDailyChartSeries(chartDailyRaw)

  return {
    period: {
      mode: typeof asRecord(record.period)?.mode === 'string' ? String(asRecord(record.period)?.mode) : undefined,
      label: typeof asRecord(record.period)?.label === 'string' ? String(asRecord(record.period)?.label) : undefined,
      fechaDesde:
        typeof asRecord(record.period)?.fechaDesde === 'string' ? String(asRecord(record.period)?.fechaDesde) : undefined,
      fechaHasta:
        typeof asRecord(record.period)?.fechaHasta === 'string' ? String(asRecord(record.period)?.fechaHasta) : undefined,
    },
    summary: {
      totalUnits: safeNumber(
        summaryRecord?.totalUnits ??
          summaryRecord?.unitsSold ??
          summaryRecord?.unidadesVendidas ??
          summaryRecord?.total_unidades ??
          record.totalUnits ??
          record.unitsSold,
      ),
      totalRevenue: safeNumber(
        summaryRecord?.totalRevenue ??
          summaryRecord?.revenue ??
          summaryRecord?.totalVendido ??
          summaryRecord?.ingresosTotales ??
          summaryRecord?.total_ingresos ??
          record.totalRevenue ??
          record.revenue,
      ),
      totalOrders: safeNumber(
        summaryRecord?.totalOrders ??
          summaryRecord?.facturedOrders ??
          summaryRecord?.pedidosFacturados ??
          summaryRecord?.total_pedidos ??
          record.pedidosFacturados ??
          record.totalOrders,
      ) || undefined,
      facturedOrders: safeNumber(summaryRecord?.pedidosFacturados ?? record.pedidosFacturados) || undefined,
      closedOrders: safeNumber(summaryRecord?.pedidosCerrados ?? record.pedidosCerrados) || undefined,
      totalSalesOrders: safeNumber(summaryRecord?.pedidosTotalVentas ?? record.pedidosTotalVentas) || undefined,
      totalProducts: safeNumber(summaryRecord?.totalProducts ?? summaryRecord?.productos ?? record.totalProducts) || undefined,
      soldProducts: safeNumber(summaryRecord?.soldProducts ?? summaryRecord?.productosVendidos) || undefined,
      unsoldProducts: safeNumber(summaryRecord?.unsoldProducts ?? summaryRecord?.productosSinVentas) || undefined,
      averageTicket: safeNumber(
        summaryRecord?.averageTicket ??
          summaryRecord?.ticketPromedio ??
          summaryRecord?.promedioTicket ??
          record.averageTicket,
      ) || undefined,
      availableProducts: safeNumber(
        summaryRecord?.availableProducts ?? summaryRecord?.productosDisponibles ?? record.availableProducts,
      ) || undefined,
    },
    topProduct: topProduct ?? null,
    bottomProduct: bottomProduct ?? null,
    bottomProductWithSales: bottomProductWithSales ?? null,
    ranking: unwrapArray(payload, normalizeRankItem, [
      'ranking',
      'rankingProductos',
      'rankings',
      'data',
      'items',
      'results',
      'products',
      'platos',
      'productos',
      'list',
      'rows',
    ]),
    dailySeries: unwrapArray(payload, normalizeDailyPoint, [
      'dailySeries',
      'ventasDiarias',
      'daily_series',
      'series',
      'daily',
      'dailySales',
      'ventasDiarias',
      'data',
      'items',
      'results',
    ]),
    charts: {
      productsByUnits: normalizedUnitsChart.length > 0
        ? normalizedUnitsChart.map((item) => ({ name: item.name, value: item.value, revenue: item.revenue }))
        : undefined,
      productsByRevenue: normalizedRevenueChart.length > 0
        ? normalizedRevenueChart.map((item) => ({ name: item.name, value: item.value, unitsSold: item.unitsSold }))
        : undefined,
      dailySales: normalizedDailyChart.length > 0 ? normalizedDailyChart : undefined,
    },
  }
}

function normalizeProductName(raw: string): string {
  return raw.trim() || 'Sin nombre'
}

export default function EstadisticasProductosPage() {
  const [filters, setFilters] = useState<FilterState>(initialFilters)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<ProductSalesStatsResponse>({ ranking: [], dailySeries: [] })

  const summary = useMemo<ProductSalesSummary>(() => ({
    totalUnits: stats.summary?.totalUnits ?? 0,
    totalRevenue: stats.summary?.totalRevenue ?? 0,
    totalOrders: stats.summary?.totalOrders,
    facturedOrders: stats.summary?.facturedOrders,
    closedOrders: stats.summary?.closedOrders,
    totalSalesOrders: stats.summary?.totalSalesOrders,
    totalProducts: stats.summary?.totalProducts,
    soldProducts: stats.summary?.soldProducts,
    unsoldProducts: stats.summary?.unsoldProducts,
    averageTicket: stats.summary?.averageTicket,
    availableProducts: stats.summary?.availableProducts,
  }), [stats.summary])

  const ranking = useMemo(() => stats.ranking ?? [], [stats.ranking])
  const dailySeries = useMemo(() => stats.charts?.dailySales ?? stats.dailySeries ?? [], [stats.charts?.dailySales, stats.dailySeries])
  const productsByUnits = useMemo(
    () => stats.charts?.productsByUnits ?? ranking.slice(0, 8).map((item) => ({ name: normalizeProductName(item.productName), value: item.unitsSold, revenue: item.revenue })),
    [ranking, stats.charts?.productsByUnits],
  )
  const productsByRevenue = useMemo(
    () => stats.charts?.productsByRevenue ?? ranking.slice(0, 8).map((item) => ({ name: normalizeProductName(item.productName), value: item.revenue, unitsSold: item.unitsSold })),
    [ranking, stats.charts?.productsByRevenue],
  )

  async function loadStats(nextFilters = filters) {
    setError(null)
    setRefreshing(true)

    try {
      const query = {
        month: nextFilters.mode === 'month' ? nextFilters.month || undefined : undefined,
        date: nextFilters.mode === 'date' ? nextFilters.date || undefined : undefined,
        fechaDesde: nextFilters.mode === 'range' ? nextFilters.fechaDesde || undefined : undefined,
        fechaHasta: nextFilters.mode === 'range' ? nextFilters.fechaHasta || undefined : undefined,
        available: nextFilters.availableOnly,
      }

      const response = await estadisticasService.getProductSales(query)
      setStats(normalizeStats(response.data))
    } catch (requestError) {
      const backendMessage = axios.isAxiosError(requestError) && requestError.response ? extractBackendMessage(requestError.response.data) : ''
      setError(backendMessage || 'No fue posible cargar las estadísticas de productos.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void loadStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dateLabel = useMemo(() => {
    if (filters.mode === 'month') {
      return filters.month || 'Mes actual'
    }
    if (filters.mode === 'date') {
      return filters.date || 'Fecha específica'
    }
    if (filters.fechaDesde || filters.fechaHasta) {
      return `${filters.fechaDesde || '...'} a ${filters.fechaHasta || '...'}`
    }
    return 'Rango personalizado'
  }, [filters])

  const topProduct = stats.topProduct ?? ranking[0] ?? null
  const bottomProduct = stats.bottomProductWithSales ?? stats.bottomProduct ?? ranking[ranking.length - 1] ?? null

  return (
    <Box sx={{ color: COLOR_TEXT }}>
      <Paper
        sx={{
          p: { xs: 2.5, md: 3.5 },
          mb: 3,
          borderRadius: 3,
          background:
            'linear-gradient(135deg, rgba(20,12,10,0.95) 0%, rgba(36,18,11,0.9) 100%), radial-gradient(circle at top right, rgba(212,175,55,0.18) 0%, transparent 32%)',
          border: '1px solid rgba(212,175,55,0.4)',
          boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}>
          <Box>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1 }}>
              <PointOfSaleIcon sx={{ color: COLOR_GOLD }} />
              <Typography variant="h4" sx={{ fontWeight: 800, color: COLOR_GOLD, fontFamily: '"Cormorant Garamond", serif' }}>
                Estadísticas de productos
              </Typography>
            </Stack>
            <Typography sx={{ color: COLOR_MUTED, maxWidth: 820 }}>
              Consulta los productos más y menos vendidos por mes, fecha o rango. Los datos salen de ventas reales facturadas.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <Chip label={`Periodo: ${dateLabel}`} sx={{ color: COLOR_TEXT }} />
            <Chip label={filters.availableOnly ? 'Solo disponibles' : 'Todos los productos'} sx={{ color: COLOR_TEXT }} />
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2.5, mb: 3, borderRadius: 3, backgroundColor: COLOR_PANEL, border: `1px solid ${COLOR_PANEL_BORDER}` }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ alignItems: { md: 'center' } }}>
            <TextField
              select
              label="Modo"
              value={filters.mode}
              onChange={(event) => setFilters((current) => ({ ...current, mode: event.target.value as FilterMode }))}
              fullWidth
              sx={{
                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
              }}
            >
              <MenuItem value="month">Por mes</MenuItem>
              <MenuItem value="date">Por fecha</MenuItem>
              <MenuItem value="range">Por rango</MenuItem>
            </TextField>

            {filters.mode === 'month' ? (
              <TextField
                label="Mes"
                type="month"
                value={filters.month}
                onChange={(event) => setFilters((current) => ({ ...current, month: event.target.value }))}
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{
                  '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                  '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                }}
              />
            ) : null}

            {filters.mode === 'date' ? (
              <TextField
                label="Fecha específica"
                type="date"
                value={filters.date}
                onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value }))}
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{
                  '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                  '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                }}
              />
            ) : null}

            {filters.mode === 'range' ? (
              <>
                <TextField
                  label="Desde"
                  type="date"
                  value={filters.fechaDesde}
                  onChange={(event) => setFilters((current) => ({ ...current, fechaDesde: event.target.value }))}
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{
                    '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                    '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                  }}
                />
                <TextField
                  label="Hasta"
                  type="date"
                  value={filters.fechaHasta}
                  onChange={(event) => setFilters((current) => ({ ...current, fechaHasta: event.target.value }))}
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{
                    '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                    '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                  }}
                />
              </>
            ) : null}
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}>
            <FormControlLabel
              control={
                <Switch
                  checked={filters.availableOnly}
                  onChange={(event) => setFilters((current) => ({ ...current, availableOnly: event.target.checked }))}
                />
              }
              label="Solo productos disponibles"
              sx={{ color: COLOR_TEXT }}
            />
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                onClick={() => setFilters(initialFilters)}
                sx={{ color: COLOR_TEXT, borderColor: 'rgba(212,175,55,0.35)' }}
              >
                Limpiar
              </Button>
              <Button
                variant="contained"
                disabled={refreshing}
                onClick={() => void loadStats(filters)}
                sx={{ backgroundColor: COLOR_MAROON, '&:hover': { backgroundColor: '#a42535' } }}
              >
                {refreshing ? 'Cargando...' : 'Consultar'}
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Paper>

      {loading ? (
        <Box sx={{ py: 10, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress sx={{ color: COLOR_GOLD }} />
        </Box>
      ) : null}

      {error ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      ) : null}

      {!loading ? (
        <Stack spacing={3}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' }, gap: 2 }}>
            {[
              { label: 'Unidades vendidas', value: summary.totalUnits, icon: <Inventory2Icon /> },
              { label: 'Ingresos', value: formatCRC(summary.totalRevenue), icon: <PointOfSaleIcon /> },
              { label: 'Pedidos facturados', value: summary.totalOrders ?? 0, icon: <EventIcon /> },
              { label: 'Ticket promedio', value: formatCRC(summary.averageTicket ?? 0), icon: <TrendingUpIcon /> },
            ].map((item) => (
              <Card key={item.label} sx={{ backgroundColor: COLOR_PANEL, border: `1px solid ${COLOR_PANEL_BORDER}`, color: COLOR_TEXT }}>
                <CardContent>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography sx={{ color: COLOR_MUTED, fontSize: '0.9rem' }}>{item.label}</Typography>
                      <Typography variant="h5" sx={{ color: COLOR_GOLD, fontWeight: 800, mt: 0.5 }}>
                        {item.value}
                      </Typography>
                    </Box>
                    <Box sx={{ color: COLOR_GOLD }}>{item.icon}</Box>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
            <Paper sx={{ p: 2.5, backgroundColor: COLOR_PANEL, border: `1px solid ${COLOR_PANEL_BORDER}` }}>
              <Stack spacing={1.5}>
                <Typography sx={{ color: COLOR_GOLD, fontWeight: 800 }}>Producto más vendido</Typography>
                {topProduct ? (
                  <>
                    <Typography variant="h5" sx={{ color: COLOR_TEXT, fontWeight: 800 }}>
                      {topProduct.productName}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                      <Chip label={`${topProduct.unitsSold} unidades`} sx={{ color: COLOR_TEXT }} />
                      <Chip label={formatCRC(topProduct.revenue)} sx={{ color: COLOR_TEXT }} />
                      {topProduct.categoryName ? <Chip label={topProduct.categoryName} sx={{ color: COLOR_TEXT }} /> : null}
                    </Stack>
                  </>
                ) : (
                  <Typography sx={{ color: COLOR_MUTED }}>No hay datos para mostrar.</Typography>
                )}
              </Stack>
            </Paper>

            <Paper sx={{ p: 2.5, backgroundColor: COLOR_PANEL, border: `1px solid ${COLOR_PANEL_BORDER}` }}>
              <Stack spacing={1.5}>
                <Typography sx={{ color: COLOR_GOLD, fontWeight: 800 }}>Producto menos vendido</Typography>
                {bottomProduct ? (
                  <>
                    <Typography variant="h5" sx={{ color: COLOR_TEXT, fontWeight: 800 }}>
                      {bottomProduct.productName}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                      <Chip label={`${bottomProduct.unitsSold} unidades`} sx={{ color: COLOR_TEXT }} />
                      <Chip label={formatCRC(bottomProduct.revenue)} sx={{ color: COLOR_TEXT }} />
                      {bottomProduct.categoryName ? <Chip label={bottomProduct.categoryName} sx={{ color: COLOR_TEXT }} /> : null}
                    </Stack>
                  </>
                ) : (
                  <Typography sx={{ color: COLOR_MUTED }}>No hay datos para mostrar.</Typography>
                )}
              </Stack>
            </Paper>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
            <Paper sx={{ p: 2.5, minHeight: 360, backgroundColor: COLOR_PANEL, border: `1px solid ${COLOR_PANEL_BORDER}` }}>
              <Typography sx={{ color: COLOR_GOLD, fontWeight: 800, mb: 2 }}>Top productos por unidades</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={productsByUnits} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(243,233,210,0.12)" />
                  <XAxis dataKey="name" tick={{ fill: COLOR_TEXT, fontSize: 12 }} interval={0} angle={-18} height={64} />
                  <YAxis tick={{ fill: COLOR_TEXT, fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#14100d', border: '1px solid rgba(212,175,55,0.3)', color: COLOR_TEXT }}
                    formatter={(value) => [value, 'Unidades']}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {productsByUnits.map((entry, index) => (
                      <Cell key={`bar-units-${entry.name}-${index}`} fill={index === 0 ? '#e8c55d' : '#b28d2e'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Paper>

            <Paper sx={{ p: 2.5, minHeight: 360, backgroundColor: COLOR_PANEL, border: `1px solid ${COLOR_PANEL_BORDER}` }}>
              <Typography sx={{ color: COLOR_GOLD, fontWeight: 800, mb: 2 }}>Top productos por ingresos</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={productsByRevenue} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(243,233,210,0.12)" />
                  <XAxis dataKey="name" tick={{ fill: COLOR_TEXT, fontSize: 12 }} interval={0} angle={-18} height={64} />
                  <YAxis tick={{ fill: COLOR_TEXT, fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#14100d', border: '1px solid rgba(212,175,55,0.3)', color: COLOR_TEXT }}
                    formatter={(value) => [formatCRC(Number(value)), 'Ingresos']}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#d4af37" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Box>

          <Paper sx={{ p: 2.5, minHeight: 340, backgroundColor: COLOR_PANEL, border: `1px solid ${COLOR_PANEL_BORDER}` }}>
            <Typography sx={{ color: COLOR_GOLD, fontWeight: 800, mb: 2 }}>Ventas diarias</Typography>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={dailySeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(243,233,210,0.12)" />
                <XAxis dataKey="date" tick={{ fill: COLOR_TEXT, fontSize: 12 }} />
                <YAxis tick={{ fill: COLOR_TEXT, fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#14100d', border: '1px solid rgba(212,175,55,0.3)', color: COLOR_TEXT }}
                  formatter={(value, name) => [name === 'revenue' ? formatCRC(Number(value)) : value, name === 'revenue' ? 'Ingresos' : 'Unidades']}
                />
                <Line type="monotone" dataKey="unitsSold" stroke="#f2d36f" strokeWidth={3} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="revenue" stroke="#ff8b5b" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </Paper>

          <Paper sx={{ p: 2.5, backgroundColor: COLOR_PANEL, border: `1px solid ${COLOR_PANEL_BORDER}`, overflowX: 'auto' }}>
            <Typography sx={{ color: COLOR_GOLD, fontWeight: 800, mb: 2 }}>Ranking completo</Typography>
            {ranking.length === 0 ? (
              <Typography sx={{ color: COLOR_MUTED }}>No hay ranking para el periodo seleccionado.</Typography>
            ) : (
              <Box sx={{ minWidth: 860 }}>
                {ranking.map((item, index) => (
                  <Box
                    key={`${item.productId}-${index}`}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '72px 1.6fr 140px 140px 130px',
                      gap: 1.5,
                      alignItems: 'center',
                      py: 1.25,
                      px: 1,
                      borderBottom: '1px solid rgba(243,233,210,0.08)',
                    }}
                  >
                    <Typography sx={{ color: COLOR_MUTED, fontWeight: 700 }}>#{index + 1}</Typography>
                    <Box>
                      <Typography sx={{ color: COLOR_TEXT, fontWeight: 700 }}>{item.productName}</Typography>
                      <Typography sx={{ color: COLOR_MUTED, fontSize: '0.84rem' }}>
                        {item.productCode ? `${item.productCode} • ` : ''}
                        {item.categoryName ?? 'Sin categoría'}
                      </Typography>
                    </Box>
                    <Typography sx={{ color: COLOR_TEXT }}>{item.unitsSold} uds</Typography>
                    <Typography sx={{ color: COLOR_TEXT }}>{formatCRC(item.revenue)}</Typography>
                    <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      {item.available === false ? <Chip label="Inactivo" size="small" sx={{ color: COLOR_TEXT }} /> : <Chip label="Disponible" size="small" sx={{ color: COLOR_TEXT }} />}
                    </Stack>
                  </Box>
                ))}
              </Box>
            )}
          </Paper>

          <Paper sx={{ p: 2.5, backgroundColor: COLOR_PANEL, border: `1px solid ${COLOR_PANEL_BORDER}` }}>
            <Typography sx={{ color: COLOR_GOLD, fontWeight: 800, mb: 2 }}>Resumen rápido</Typography>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ flexWrap: 'wrap' }}>
              <Chip label={`Productos: ${summary.totalProducts ?? ranking.length}`} sx={{ color: COLOR_TEXT }} />
              <Chip label={`Vendidos: ${summary.soldProducts ?? 'N/D'}`} sx={{ color: COLOR_TEXT }} />
              <Chip label={`Sin ventas: ${summary.unsoldProducts ?? 'N/D'}`} sx={{ color: COLOR_TEXT }} />
              <Chip label={`Facturados: ${summary.facturedOrders ?? summary.totalOrders ?? 'N/D'}`} sx={{ color: COLOR_TEXT }} />
              <Chip label={`Cerrados: ${summary.closedOrders ?? 'N/D'}`} sx={{ color: COLOR_TEXT }} />
              <Chip label={`Total ventas: ${summary.totalSalesOrders ?? 'N/D'}`} sx={{ color: COLOR_TEXT }} />
              <Chip label={`Disponibles: ${summary.availableProducts ?? 'N/D'}`} sx={{ color: COLOR_TEXT }} />
              <Chip label={`Top: ${topProduct ? normalizeProductName(topProduct.productName) : 'N/D'}`} sx={{ color: COLOR_TEXT }} />
              <Chip label={`Bottom: ${bottomProduct ? normalizeProductName(bottomProduct.productName) : 'N/D'}`} sx={{ color: COLOR_TEXT }} />
            </Stack>
          </Paper>
        </Stack>
      ) : null}
    </Box>
  )
}
