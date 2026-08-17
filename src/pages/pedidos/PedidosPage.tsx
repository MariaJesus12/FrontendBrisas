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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TableContainer,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import VisibilityIcon from '@mui/icons-material/Visibility'
import PrintIcon from '@mui/icons-material/Print'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import ReceiptIcon from '@mui/icons-material/Receipt'
import { toast } from 'react-toastify'
import { useLocation } from 'react-router-dom'
import FacturacionModal from '@/components/facturacion/FacturacionModal'
import { pedidoSchema } from '@/schemas/pedido.schema'
import { clientesService } from '@/services/clientes.service'
import { mesasService } from '@/services/mesas.service'
import { menuService } from '@/services/menu.service'
import { pedidosService } from '@/services/pedidos.service'
import { reservacionesService } from '@/services/reservaciones.service'
import { usuariosService } from '@/services/usuarios.service'
import { useAuth } from '@/hooks/useAuth'
import type { Mesa } from '@/types/mesa.types'
import type { Cliente } from '@/types/cliente.types'
import type { Product } from '@/types/menu.types'
import type { CreatedUser } from '@/types/usuario.types'
import type {
  CreatePedidoDto,
  CierreDiario,
  EstadoPedido,
  MetodoPago,
  Pedido,
  PedidoDetalle,
  PedidoListQuery,
  PagoPedido,
  TipoPedido,
} from '@/types/pedido.types'
import { openKitchenPrintPreview } from '@/utils/kitchenPrint'
import { normalizeRole } from '@/utils/roles'

const COLOR_GOLD = '#D4AF37'
const COLOR_TEXT = '#F3E9D2'
const COLOR_MAROON = '#8F1D2E'
const COLOR_MUTED = 'rgba(243,233,210,0.7)'

const FALLBACK_PAYMENT_METHODS: MetodoPago[] = [
  { id: 1, nombre: 'EFECTIVO' },
  { id: 2, nombre: 'TARJETA' },
  { id: 3, nombre: 'SINPE' },
]

const ORDER_STATES: EstadoPedido[] = ['BORRADOR', 'EN_PREPARACION', 'LISTO', 'FACTURADO', 'CANCELADO']
const ORDER_TYPES: TipoPedido[] = ['MESA', 'LLEVAR']

function getCostaRicaDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Costa_Rica',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

interface PedidoFilterState {
  estado: string
  tipo: string
  clienteId: string
  mesaId: string
  usuarioId: string
  fechaDesde: string
  fechaHasta: string
}

interface PedidoLineFormState {
  codigoProducto: string
  productoId: string
  productoNombre: string
  cantidad: string
  precioUnitario: string
  observacion: string
}

interface PedidoFormState {
  codigo: string
  clienteId: string
  clienteNombre: string
  clienteTelefono: string
  mesaId: string
  usuarioId: string
  tipo: TipoPedido
  estado: EstadoPedido
  impuesto: string
  detalles: PedidoLineFormState[]
}

interface PaymentFormState {
  metodoPagoId: string
  monto: string
  referencia: string
}

const initialFilterState: PedidoFilterState = {
  estado: '',
  tipo: '',
  clienteId: '',
  mesaId: '',
  usuarioId: '',
  fechaDesde: '',
  fechaHasta: '',
}

const initialPedidoForm: PedidoFormState = {
  codigo: '',
  clienteId: '',
  clienteNombre: '',
  clienteTelefono: '',
  mesaId: '',
  usuarioId: '',
  tipo: 'MESA',
  estado: 'BORRADOR',
  impuesto: '0',
  detalles: [{ codigoProducto: '', productoId: '', productoNombre: '', cantidad: '1', precioUnitario: '', observacion: '' }],
}

const initialPaymentForm: PaymentFormState = {
  metodoPagoId: '',
  monto: '',
  referencia: '',
}

function toPositiveNumber(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function normalizeClientName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, '')
}

function normalizePedidoRecord(item: unknown): Pedido | null {
  if (typeof item !== 'object' || item === null) {
    return null
  }

  const record = item as Record<string, unknown>
  const id = toPositiveNumber(record.id ?? record.pedidoId ?? record.pedido_id)
  if (!id) {
    return null
  }

  const tipoRaw = record.tipo ?? record.type
  const estadoRaw = record.estado ?? record.status

  return {
    id,
    codigo: typeof record.codigo === 'string' ? record.codigo : typeof record.code === 'string' ? record.code : undefined,
    clienteId: toPositiveNumber(record.clienteId ?? record.cliente_id) ?? undefined,
    clienteNombre:
      typeof record.clienteNombre === 'string'
        ? record.clienteNombre
        : typeof record.cliente_nombre === 'string'
          ? record.cliente_nombre
          : typeof record.nombreCliente === 'string'
            ? record.nombreCliente
            : undefined,
    clienteTelefono:
      typeof record.clienteTelefono === 'string'
        ? record.clienteTelefono
        : typeof record.cliente_telefono === 'string'
          ? record.cliente_telefono
          : typeof record.telefonoCliente === 'string'
            ? record.telefonoCliente
            : undefined,
    mesaId: toPositiveNumber(record.mesaId ?? record.mesa_id) ?? undefined,
    mesa:
      typeof record.mesa === 'object' && record.mesa !== null
        ? (record.mesa as Pedido['mesa'])
        : undefined,
    usuarioId: toPositiveNumber(record.usuarioId ?? record.usuario_id) ?? undefined,
    usuario:
      typeof record.usuario === 'object' && record.usuario !== null
        ? (record.usuario as Pedido['usuario'])
        : undefined,
    tipo: typeof tipoRaw === 'string' ? tipoRaw : 'MESA',
    estado: typeof estadoRaw === 'string' ? estadoRaw : 'BORRADOR',
    impuesto: Number(record.impuesto ?? 0) || undefined,
    total: Number(record.total ?? 0) || undefined,
    totalPagado: Number(record.totalPagado ?? record.total_pagado ?? 0) || undefined,
    saldoPendiente: Number(record.saldoPendiente ?? record.saldo_pendiente ?? 0) || undefined,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : undefined,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
  }
}

function normalizePedidoDetailRecord(item: unknown): PedidoDetalle | null {
  if (typeof item !== 'object' || item === null) {
    return null
  }

  const record = item as Record<string, unknown>
  const id = toPositiveNumber(record.id ?? record.detalleId ?? record.detalle_id)
  const productoId = toPositiveNumber(record.productoId ?? record.product_id ?? record.producto_id)
  const cantidad = Number(record.cantidad ?? record.qty ?? record.quantity ?? 0)
  const precioUnitario = Number(record.precioUnitario ?? record.precio_unitario ?? record.price ?? 0)
  const productoRecord =
    typeof record.producto === 'object' && record.producto !== null
      ? (record.producto as Record<string, unknown>)
      : null

  const productoNombre =
    typeof record.productoNombre === 'string'
      ? record.productoNombre
      : typeof record.nombreProducto === 'string'
        ? record.nombreProducto
        : typeof record.product_name === 'string'
          ? record.product_name
          : typeof record.productName === 'string'
            ? record.productName
            : typeof productoRecord?.nombre === 'string'
              ? productoRecord.nombre
              : undefined

  if (!id || !productoId) {
    return null
  }

  return {
    id,
    productoId,
    productoNombre,
    producto: productoRecord
      ? ({ ...(productoRecord as PedidoDetalle['producto']), nombre: productoNombre ?? String(productoRecord.nombre ?? '') } as PedidoDetalle['producto'])
      : productoNombre
        ? { nombre: productoNombre }
        : undefined,
    cantidad: Number.isFinite(cantidad) ? cantidad : 0,
    cantidadEnviadaCocina: Number(record.cantidadEnviadaCocina ?? record.cantidad_enviada_cocina ?? 0) || 0,
    precioUnitario: Number.isFinite(precioUnitario) ? precioUnitario : 0,
    observacion: typeof record.observacion === 'string' ? record.observacion : undefined,
    subtotal:
      Number.isFinite(Number(record.subtotal)) && Number(record.subtotal) > 0
        ? Number(record.subtotal)
        : Number.isFinite(cantidad) && Number.isFinite(precioUnitario)
          ? cantidad * precioUnitario
          : 0,
  }
}

function normalizePagoRecord(item: unknown): PagoPedido | null {
  if (typeof item !== 'object' || item === null) {
    return null
  }

  const record = item as Record<string, unknown>
  const id = toPositiveNumber(record.id)
  const metodoPagoId = toPositiveNumber(record.metodoPagoId ?? record.metodo_pago_id)
  const monto = Number(record.monto ?? 0)

  if (!id || !metodoPagoId) {
    return null
  }

  return {
    id,
    metodoPagoId,
    metodoPago:
      typeof record.metodoPago === 'object' && record.metodoPago !== null
        ? (record.metodoPago as PagoPedido['metodoPago'])
        : undefined,
    monto: Number.isFinite(monto) ? monto : 0,
    montoMoneda: Number(record.montoMoneda ?? record.monto_moneda ?? record.montoDolares ?? record.monto_dolares) || undefined,
    moneda:
      typeof record.moneda === 'string'
        ? record.moneda
        : typeof record.monedaCodigo === 'string'
          ? record.monedaCodigo
          : typeof record.moneda_codigo === 'string'
            ? record.moneda_codigo
            : typeof record.currency === 'string'
              ? record.currency
              : undefined,
    monedaId: toPositiveNumber(record.monedaId ?? record.moneda_id) ?? undefined,
    montoColones: Number(record.montoColones ?? record.monto_colones ?? record.montoCRC ?? record.monto_crc) || undefined,
    vuelto: Number(record.vuelto) || undefined,
    vueltoColones: Number(record.vueltoColones ?? record.vuelto_colones ?? record.vueltoCRC ?? record.vuelto_crc) || undefined,
    referencia: typeof record.referencia === 'string' ? record.referencia : undefined,
  }
}

function unwrapLooseArray(payload: unknown, keys: string[]): unknown[] {
  if (Array.isArray(payload)) {
    return payload
  }

  if (typeof payload !== 'object' || payload === null) {
    return []
  }

  const record = payload as Record<string, unknown>
  for (const key of keys) {
    const value = record[key]
    if (Array.isArray(value)) {
      return value
    }

    if (typeof value === 'object' && value !== null) {
      const nested = value as Record<string, unknown>
      for (const nestedKey of keys) {
        const nestedValue = nested[nestedKey]
        if (Array.isArray(nestedValue)) {
          return nestedValue
        }
      }
    }
  }

  return []
}

function unwrapPedidoDetailsPayload(payload: unknown): PedidoDetalle[] {
  const details = unwrapLooseArray(payload, [
    'data',
    'items',
    'results',
    'details',
    'detalles',
    'pedidoDetalles',
    'pedido_detalles',
    'lineas',
    'rows',
    'list',
  ])

  return details
    .map((item) => normalizePedidoDetailRecord(item))
    .filter((item): item is PedidoDetalle => item !== null)
}

function unwrapPagosPayload(payload: unknown): PagoPedido[] {
  const payments = unwrapLooseArray(payload, ['data', 'items', 'results', 'payments', 'pagos', 'rows', 'list'])

  return payments
    .map((item) => normalizePagoRecord(item))
    .filter((item): item is PagoPedido => item !== null)
}

function formatCurrency(value: number | null | undefined): string {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safeValue)
}

function formatUSD(value: number | null | undefined): string {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeValue)
}

function normalizeCurrencyCode(value: unknown): string {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (!normalized) {
    return ''
  }

  if (normalized === 'USD' || normalized.includes('DOLAR') || normalized === '$') {
    return 'USD'
  }

  if (normalized === 'CRC' || normalized.includes('COLON') || normalized.includes('COLONES') || normalized === '₡') {
    return 'CRC'
  }

  return normalized
}

function resolvePaymentCurrency(payment: PagoPedido): 'CRC' | 'USD' {
  return normalizeCurrencyCode(payment.moneda) === 'USD' ? 'USD' : 'CRC'
}

function resolvePaymentAmountInCurrency(payment: PagoPedido, currency: 'CRC' | 'USD'): number {
  if (currency === 'USD') {
    if (resolvePaymentCurrency(payment) !== 'USD') {
      return 0
    }

    const amountUSD = Number(payment.montoMoneda ?? payment.monto ?? 0)
    return Number.isFinite(amountUSD) && amountUSD > 0 ? amountUSD : 0
  }

  const amountCRC = Number(payment.montoColones ?? payment.monto ?? 0)
  return Number.isFinite(amountCRC) && amountCRC > 0 ? amountCRC : 0
}

function resolvePaymentChangeInCurrency(payment: PagoPedido, currency: 'CRC' | 'USD'): number {
  if (currency === 'USD') {
    if (resolvePaymentCurrency(payment) !== 'USD') {
      return 0
    }

    const changeUSD = Number(payment.vuelto ?? 0)
    return Number.isFinite(changeUSD) && changeUSD > 0 ? changeUSD : 0
  }

  const changeCRC = Number(payment.vueltoColones ?? payment.vuelto ?? 0)
  return Number.isFinite(changeCRC) && changeCRC > 0 ? changeCRC : 0
}

function resolvePaymentChangeCRC(payment: PagoPedido): number {
  const paymentCurrency = resolvePaymentCurrency(payment)
  const changeCRC = Number(payment.vueltoColones ?? 0)
  if (Number.isFinite(changeCRC) && changeCRC > 0) {
    return changeCRC
  }

  const changeRaw = Number(payment.vuelto ?? 0)
  if (!Number.isFinite(changeRaw) || changeRaw <= 0) {
    return 0
  }

  if (paymentCurrency === 'USD') {
    const amountCRC = Number(payment.montoColones ?? 0)
    const amountUSD = Number(payment.montoMoneda ?? payment.monto ?? 0)
    if (!Number.isFinite(amountCRC) || amountCRC <= 0 || !Number.isFinite(amountUSD) || amountUSD <= 0) {
      return 0
    }

    const inferredRate = amountCRC / amountUSD
    return Number.isFinite(inferredRate) && inferredRate > 0 ? changeRaw * inferredRate : 0
  }

  return changeRaw
}

function formatDateTime(value?: string): string {
  if (!value) {
    return 'Sin fecha'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString('es-CR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;')
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

function unwrapArrayPayload<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[]
  }

  if (typeof payload === 'object' && payload !== null) {
    const record = payload as Record<string, unknown>
    const keys = [
      'data',
      'items',
      'results',
      'pedidos',
      'details',
      'payments',
      'methods',
      'metodos',
      'clientes',
      'customers',
      'content',
      'rows',
      'list',
    ]

    for (const key of keys) {
      const value = record[key]
      if (Array.isArray(value)) {
        return value as T[]
      }

      if (typeof value === 'object' && value !== null) {
        const nested = value as Record<string, unknown>
        for (const nestedKey of keys) {
          const nestedValue = nested[nestedKey]
          if (Array.isArray(nestedValue)) {
            return nestedValue as T[]
          }
        }
      }
    }
  }

  return []
}

function normalizeClienteRecord(item: unknown): Cliente | null {
  if (typeof item !== 'object' || item === null) {
    return null
  }

  const record = item as Record<string, unknown>
  const id = toPositiveNumber(record.id ?? record.clienteId ?? record.cliente_id)
  if (!id) {
    return null
  }

  const nombreRaw = record.nombre ?? record.name
  const telefonoRaw = record.telefono ?? record.phone

  return {
    id,
    nombre: typeof nombreRaw === 'string' ? nombreRaw : String(nombreRaw ?? `Cliente #${id}`),
    telefono: typeof telefonoRaw === 'string' ? telefonoRaw : String(telefonoRaw ?? ''),
    activo:
      typeof record.activo === 'boolean'
        ? record.activo
        : typeof record.active === 'boolean'
          ? record.active
          : undefined,
  }
}

function unwrapClientesPayload(payload: unknown): Cliente[] {
  return unwrapArrayPayload(payload)
    .map((item) => normalizeClienteRecord(item))
    .filter((item): item is Cliente => item !== null)
}

const RESERVA_ESTADOS_OCUPADA = new Set(['PENDIENTE', 'CONFIRMADA', 'CONFIRMADO'])
const RESERVA_ESTADOS_LIBRE = new Set(['ATENDIDA', 'CANCELADA'])

function normalizeReservaEstado(value: unknown): string {
  return String(value ?? '').trim().toUpperCase()
}

function normalizeReservaBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value
  }

  const normalized = String(value ?? '').trim().toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'si' || normalized === 'yes'
}

function resolveMesaReservadaByEstado(estado: unknown): boolean | null {
  const normalized = normalizeReservaEstado(estado)
  if (!normalized) {
    return null
  }

  if (RESERVA_ESTADOS_OCUPADA.has(normalized)) {
    return true
  }

  if (RESERVA_ESTADOS_LIBRE.has(normalized)) {
    return false
  }

  return null
}

function unwrapReservaArrayPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload
  }

  if (typeof payload !== 'object' || payload === null) {
    return []
  }

  const record = payload as Record<string, unknown>
  const keys = ['data', 'items', 'results', 'mesas', 'mesasEstado', 'estadoMesas', 'tables', 'content']

  for (const key of keys) {
    const value = record[key]
    if (Array.isArray(value)) {
      return value
    }
  }

  return []
}

function extractReservadaMesaMap(payload: unknown): Record<number, boolean> {
  const result: Record<number, boolean> = {}

  for (const item of unwrapReservaArrayPayload(payload)) {
    if (typeof item !== 'object' || item === null) {
      continue
    }

    const record = item as Record<string, unknown>
    const mesaRaw =
      typeof record.mesa === 'object' && record.mesa !== null ? (record.mesa as Record<string, unknown>) : null

    const mesaId = Number(
      record.mesaId ?? record.mesa_id ?? record.idMesa ?? record.id ?? record.tableId ?? mesaRaw?.id ?? 0,
    )
    if (!Number.isFinite(mesaId) || mesaId <= 0) {
      continue
    }

    const estadoValue =
      record.reservaEstado ??
      record.estadoReserva ??
      record.estado ??
      record.status

    const reservadaByEstado = resolveMesaReservadaByEstado(estadoValue)
    const reservadaByFlag =
      normalizeReservaBoolean(
        record.reservada ?? record.reserved ?? record.ocupada ?? record.estaReservada ?? record.disponible === false,
      ) || Number(record.reservaId ?? record.reserva_id ?? 0) > 0

    result[mesaId] = reservadaByEstado ?? reservadaByFlag
  }

  return result
}

function resolvePedidoMesaId(pedido: Pedido): number | null {
  const mesaId = Number(pedido.mesaId ?? pedido.mesa?.id ?? 0)
  return Number.isFinite(mesaId) && mesaId > 0 ? mesaId : null
}

function normalizeProductRecord(item: unknown): Product | null {
  if (typeof item !== 'object' || item === null) {
    return null
  }

  const record = item as Record<string, unknown>
  const id = Number(record.id ?? record.productId ?? record.product_id ?? 0)
  if (!Number.isFinite(id) || id <= 0) {
    return null
  }

  const precio = Number(record.precio ?? record.price ?? 0)
  const codigoValue = record.codigo ?? record.code ?? record.sku

  return {
    id,
    codigo: typeof codigoValue === 'string' ? codigoValue : codigoValue != null ? String(codigoValue) : undefined,
    nombre:
      typeof record.nombre === 'string'
        ? record.nombre
        : typeof record.name === 'string'
          ? record.name
          : `Producto ${id}`,
    descripcion:
      typeof record.descripcion === 'string'
        ? record.descripcion
        : typeof record.description === 'string'
          ? record.description
          : '',
    precio: Number.isFinite(precio) ? precio : 0,
    imagen:
      typeof record.imagen === 'string'
        ? record.imagen
        : typeof record.image === 'string'
          ? record.image
          : undefined,
    categoryId: Number(record.categoryId ?? record.category_id ?? record.categoriaId ?? record.categoria_id ?? 0),
    category: undefined,
    disponible:
      typeof record.disponible === 'boolean'
        ? record.disponible
        : typeof record.available === 'boolean'
          ? record.available
          : true,
  }
}

function unwrapProductsPayload(payload: unknown): Product[] {
  if (Array.isArray(payload)) {
    return payload.map((item) => normalizeProductRecord(item)).filter((item): item is Product => item !== null)
  }

  if (typeof payload === 'object' && payload !== null) {
    const record = payload as Record<string, unknown>
    const keys = ['data', 'items', 'products', 'platos', 'results']

    for (const key of keys) {
      const value = record[key]
      if (Array.isArray(value)) {
        return value.map((item) => normalizeProductRecord(item)).filter((item): item is Product => item !== null)
      }
    }
  }

  return []
}

function getUserDisplayName(user: CreatedUser): string {
  const record = user as unknown as Record<string, unknown>
  const directName = record.nombre ?? record.name ?? ''
  const identifier = record.usuario ?? record.email ?? record.username ?? ''
  const name = typeof directName === 'string' ? directName : String(directName)
  const idPart = typeof identifier === 'string' ? identifier : String(identifier)

  if (name && idPart) {
    return `${name} • ${idPart}`
  }

  return name || idPart || `Usuario #${user.id}`
}

function getMesaDisplayName(mesa: Mesa): string {
  const details = mesa.observacion ? ` • ${mesa.observacion}` : ''
  return `Mesa #${mesa.numero} (${mesa.capacidad})${details}`
}

function getProductDisplayName(product: Product): string {
  const code = product.codigo ? `${product.codigo} • ` : ''
  return `${code}${product.nombre}`
}

function findProductByQuery(products: Product[], rawQuery: string): Product | null {
  const normalized = rawQuery.trim().toUpperCase()
  if (!normalized) {
    return null
  }

  const exact = products.find((product) => String(product.codigo ?? '').trim().toUpperCase() === normalized)
  if (exact) {
    return exact
  }

  const idMatch = products.find((product) => String(product.id) === normalized)
  if (idMatch) {
    return idMatch
  }

  const exactNameMatch = products.find((product) => product.nombre.trim().toUpperCase() === normalized)
  if (exactNameMatch) {
    return exactNameMatch
  }

  return (
    products.find((product) => {
      const code = String(product.codigo ?? '').trim().toUpperCase()
      return code.includes(normalized) || product.nombre.trim().toUpperCase().includes(normalized)
    }) ?? null
  )
}

function getPedidoMesaLabel(pedido: Pedido): string {
  if (String(pedido.tipo).toUpperCase() === 'LLEVAR') {
    return 'Llevar'
  }

  if (pedido.mesa?.numero) {
    return `Mesa #${pedido.mesa.numero}`
  }

  if (pedido.mesaId) {
    return `Mesa #${pedido.mesaId}`
  }

  return 'Sin mesa'
}

function getPedidoMesaListLabel(pedido: Pedido): string {
  return String(pedido.tipo).toUpperCase() === 'LLEVAR' ? 'Llevar' : 'Mesa'
}

function extractPedidoClienteNombre(pedido: Pedido): string {
  const rawRecord = pedido as unknown as Record<string, unknown>
  const clienteRecord =
    typeof rawRecord.cliente === 'object' && rawRecord.cliente !== null
      ? (rawRecord.cliente as Record<string, unknown>)
      : null

  const nombre =
    rawRecord.clienteNombre ??
    rawRecord.cliente_nombre ??
    rawRecord.nombreCliente ??
    rawRecord.nombre_cliente ??
    clienteRecord?.nombre

  return typeof nombre === 'string' ? nombre.trim() : ''
}

function extractPedidoClienteTelefono(pedido: Pedido): string {
  const rawRecord = pedido as unknown as Record<string, unknown>
  const clienteRecord =
    typeof rawRecord.cliente === 'object' && rawRecord.cliente !== null
      ? (rawRecord.cliente as Record<string, unknown>)
      : null

  const telefono =
    rawRecord.clienteTelefono ??
    rawRecord.cliente_telefono ??
    rawRecord.telefonoCliente ??
    rawRecord.telefono_cliente ??
    rawRecord.telefono ??
    clienteRecord?.telefono

  return typeof telefono === 'string' ? telefono.trim() : ''
}

function getPedidoClienteNombre(pedido: Pedido): string {
  const nombre = extractPedidoClienteNombre(pedido)
  if (nombre) {
    return nombre
  }

  return 'Sin cliente'
}

function getPedidoClienteTelefono(pedido: Pedido): string {
  const telefono = extractPedidoClienteTelefono(pedido)
  if (telefono) {
    return telefono
  }

  return 'Sin teléfono'
}

function getPedidoUserLabel(pedido: Pedido, users: CreatedUser[]): string {
  if (pedido.usuario?.nombre) {
    return pedido.usuario.nombre
  }

  if (pedido.usuarioId) {
    const matched = users.find((user) => user.id === pedido.usuarioId)
    if (matched) {
      return getUserDisplayName(matched)
    }

    return `Usuario #${pedido.usuarioId}`
  }

  return 'Sin usuario'
}

function getStatusTone(status: string): 'default' | 'warning' | 'success' | 'error' | 'info' {
  const normalized = status.trim().toUpperCase()

  if (normalized === 'BORRADOR') return 'default'
  if (normalized === 'EN_PREPARACION') return 'warning'
  if (normalized === 'LISTO') return 'info'
  if (normalized === 'FACTURADO') return 'success'
  if (normalized === 'CANCELADO') return 'error'

  return 'default'
}

function getStatusChipSx(status: string) {
  const normalized = status.trim().toUpperCase()

  if (normalized === 'BORRADOR') {
    return {
      fontWeight: 700,
      color: '#f7d98a',
      bgcolor: 'rgba(212,175,55,0.16)',
      border: '1px solid rgba(212,175,55,0.32)',
    }
  }

  return { fontWeight: 700 }
}

function canDeletePedido(estado: string): boolean {
  const normalized = estado.trim().toUpperCase()
  return normalized === 'BORRADOR' || normalized === 'CANCELADO'
}

function canMutatePedido(estado: string): boolean {
  const normalized = estado.trim().toUpperCase()
  return normalized === 'BORRADOR' || normalized === 'EN_PREPARACION' || normalized === 'LISTO' || normalized === 'COCINA'
}

function getActionButtonSx(color: string) {
  return {
    color,
    border: '1px solid rgba(212,175,55,0.4)',
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderRadius: 2,
    '&:hover': {
      backgroundColor: 'rgba(212,175,55,0.16)',
    },
    '&.Mui-disabled': {
      color: 'rgba(243,233,210,0.55)',
      borderColor: 'rgba(243,233,210,0.25)',
      backgroundColor: 'rgba(243,233,210,0.07)',
    },
  }
}

interface PedidosPageProps {
  fixedType?: TipoPedido
}

export default function PedidosPage({ fixedType }: PedidosPageProps = {}) {
  const { user } = useAuth()
  const location = useLocation()
  const currentRole = normalizeRole(user)
  const isTakeoutMode = String(fixedType ?? '').trim().toUpperCase() === 'LLEVAR'
  const pageTitle = isTakeoutMode ? 'Pedidos para llevar' : 'Pedidos'
  const pageDescription = isTakeoutMode
    ? 'Gestiona pedidos para llevar en un flujo simple: crear, editar lineas y controlar estado.'
    : 'Gestiona pedidos por mesa o para llevar, controla detalles, pagos y estado operativo en un solo lugar.'
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [users, setUsers] = useState<CreatedUser[]>(
    user
      ? [
          {
            id: user.id,
            nombre: user.nombre,
            email: user.email,
            rol: user.rol,
          },
        ]
      : [],
  )
  const [paymentMethods, setPaymentMethods] = useState<MetodoPago[]>(FALLBACK_PAYMENT_METHODS)
  const [reservadaByMesa, setReservadaByMesa] = useState<Record<number, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [cierreFecha, setCierreFecha] = useState(getCostaRicaDate)
  const [cierreDiario, setCierreDiario] = useState<CierreDiario | null>(null)
  const [loadingCierreDiario, setLoadingCierreDiario] = useState(false)
  const [cierreDiarioError, setCierreDiarioError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterForm, setFilterForm] = useState<PedidoFilterState>(initialFilterState)
  const [pedidoForm, setPedidoForm] = useState<PedidoFormState>(initialPedidoForm)
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(initialPaymentForm)
  const [pedidoDialogMode, setPedidoDialogMode] = useState<'create' | 'edit' | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null)
  const [currentDetails, setCurrentDetails] = useState<PedidoDetalle[]>([])
  const [currentPayments, setCurrentPayments] = useState<PagoPedido[]>([])
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [editingDetailId, setEditingDetailId] = useState<number | null>(null)
  const [detailForm, setDetailForm] = useState({
    codigoProducto: '',
    productoId: '',
    cantidad: '1',
    precioUnitario: '',
    observacion: '',
  })
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [editingPaymentId, setEditingPaymentId] = useState<number | null>(null)
  const [invoicePreviewOpen, setInvoicePreviewOpen] = useState(false)
  const [invoicePreviewPedido, setInvoicePreviewPedido] = useState<Pedido | null>(null)
  const [invoicePreviewDetails, setInvoicePreviewDetails] = useState<PedidoDetalle[]>([])

  const mesaSelection = useMemo(() => {
    const state = location.state as { mesaId?: number; mesaNumero?: number } | null
    return state?.mesaId ? { mesaId: state.mesaId, mesaNumero: state.mesaNumero } : null
  }, [location.state])

  useEffect(() => {
    if (!isTakeoutMode) {
      return
    }

    setFilterForm((current) => ({
      ...current,
      tipo: 'LLEVAR',
      clienteId: '',
      mesaId: '',
    }))

    setPedidoForm((current) => ({
      ...current,
      tipo: 'LLEVAR',
      clienteId: '',
      clienteNombre: '',
      clienteTelefono: '',
      mesaId: '',
    }))
  }, [isTakeoutMode])

  useEffect(() => {
    if (user?.id) {
      setPedidoForm((current) =>
        current.usuarioId ? current : { ...current, usuarioId: String(user.id) },
      )
    }
  }, [user])

  useEffect(() => {
    void loadInitialData()
  }, [])

  useEffect(() => {
    if (!isTakeoutMode) {
      // La API resuelve el día actual cuando no se envía el parámetro fecha.
      // Así evitamos depender de la validación de fecha para la carga inicial.
      void loadCierreDiario()
    }
  }, [isTakeoutMode])

  useEffect(() => {
    if (isTakeoutMode) {
      return
    }

    if (!mesaSelection) {
      return
    }

    setPedidoDialogMode('create')
    setPedidoForm((current) => ({
      ...initialPedidoForm,
      usuarioId: current.usuarioId || (user ? String(user.id) : ''),
      mesaId: String(mesaSelection.mesaId),
      tipo: 'MESA',
    }))
  }, [isTakeoutMode, mesaSelection, user])

  async function loadInitialData() {
    setLoading(true)
    setError(null)

    try {
      const requestList = [
        pedidosService.getAll(isTakeoutMode ? { tipo: 'LLEVAR' } : undefined),
        mesasService.getAll(),
        menuService.getProducts(),
        pedidosService.getPaymentMethods(),
        reservacionesService
          .getMesasEstado({ includeInactive: true })
          .catch(() => ({ data: [] as unknown[] })),
      ]

      if (currentRole === 'ADMIN') {
        requestList.splice(3, 0, usuariosService.listUsers())
      }

      const responses = await Promise.all(requestList)
      const [pedidosResponse, mesasResponse, productsResponse] = responses
      const usersResponse = currentRole === 'ADMIN' ? responses[3] : null
      const paymentMethodsResponse = currentRole === 'ADMIN' ? responses[4] : responses[3]
      const reservasMesasResponse = currentRole === 'ADMIN' ? responses[5] : responses[4]

      setPedidos(unwrapArrayPayload<Pedido>(pedidosResponse.data))
      setMesas(unwrapArrayPayload<Mesa>(mesasResponse.data))
      setProducts(unwrapProductsPayload(productsResponse.data))
      const clientesResponse = await clientesService.getAll({ active: true }).catch(() => ({ data: [] as unknown[] }))
      setClientes(unwrapClientesPayload(clientesResponse.data))
      if (usersResponse) {
        const normalizedUsers = unwrapArrayPayload<CreatedUser>(usersResponse.data)
        if (normalizedUsers.length > 0) {
          setUsers(normalizedUsers)
        } else if (user) {
          setUsers([
            {
              id: user.id,
              nombre: user.nombre,
              email: user.email,
              rol: user.rol,
            },
          ])
        }
      } else if (user) {
        setUsers([
          {
            id: user.id,
            nombre: user.nombre,
            email: user.email,
            rol: user.rol,
          },
        ])
      }

      const methods = unwrapArrayPayload<MetodoPago>(paymentMethodsResponse.data)
      setPaymentMethods(methods.length > 0 ? methods : FALLBACK_PAYMENT_METHODS)
      const fromMesasEstado = extractReservadaMesaMap((reservasMesasResponse as { data: unknown }).data)
      setReservadaByMesa(fromMesasEstado)
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      const fallbackMessage = backendMessage || 'No fue posible cargar los pedidos.'
      setError(fallbackMessage)
      toast.error(fallbackMessage)
    } finally {
      setLoading(false)
    }
  }

  async function loadPedidos(filters?: PedidoFilterState) {
    setLoading(true)
    setError(null)

    try {
      const activeFilters = filters ?? filterForm
      const query: PedidoListQuery = {}

      if (activeFilters.estado) query.estado = activeFilters.estado
      if (activeFilters.clienteId) query.clienteId = Number(activeFilters.clienteId)
      if (isTakeoutMode) {
        query.tipo = 'LLEVAR'
      } else {
        if (activeFilters.tipo) query.tipo = activeFilters.tipo
        if (activeFilters.mesaId) query.mesaId = Number(activeFilters.mesaId)
      }
      if (activeFilters.usuarioId) query.usuarioId = Number(activeFilters.usuarioId)
      if (activeFilters.fechaDesde) query.fechaDesde = activeFilters.fechaDesde
      if (activeFilters.fechaHasta) query.fechaHasta = activeFilters.fechaHasta

      const response = await pedidosService.getAll(query)
      setPedidos(unwrapArrayPayload<Pedido>(response.data))
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      const fallbackMessage = backendMessage || 'No fue posible cargar los pedidos.'
      setError(fallbackMessage)
      toast.error(fallbackMessage)
    } finally {
      setLoading(false)
    }
  }

  async function loadCierreDiario(fecha?: string) {
    setLoadingCierreDiario(true)
    setCierreDiarioError(null)
    try {
      const selectedDate = fecha?.trim()
      const response = await pedidosService.getCierreDiario(
        selectedDate && selectedDate !== getCostaRicaDate() ? selectedDate : undefined,
      )
      setCierreDiario(response.data)
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      setCierreDiario(null)
      setCierreDiarioError(backendMessage || 'No fue posible cargar el cierre diario.')
    } finally {
      setLoadingCierreDiario(false)
    }
  }

  const activeMesas = useMemo(() => mesas.filter((mesa) => mesa.activa), [mesas])

  const summary = useMemo(() => {
    const totalPedidos = pedidos.length
    const borradores = pedidos.filter((pedido) => String(pedido.estado).toUpperCase() === 'BORRADOR').length
    const facturados = pedidos.filter((pedido) => String(pedido.estado).toUpperCase() === 'FACTURADO').length
    const conMesa = pedidos.filter((pedido) => String(pedido.tipo).toUpperCase() === 'MESA').length
    const paraLlevar = pedidos.filter((pedido) => String(pedido.tipo).toUpperCase() === 'LLEVAR').length

    return { totalPedidos, borradores, facturados, conMesa, paraLlevar }
  }, [pedidos])

  const canManageSelectedPedido = useMemo(() => {
    if (!selectedPedido) {
      return false
    }

    return canMutatePedido(String(selectedPedido.estado))
  }, [selectedPedido])

  const sortedPedidos = useMemo(() => {
    return [...pedidos].sort((left, right) => {
      const rightDate = right.createdAt ? new Date(right.createdAt).getTime() : 0
      const leftDate = left.createdAt ? new Date(left.createdAt).getTime() : 0
      return rightDate - leftDate
    })
  }, [pedidos])

  function linkClientToPedidoForm(cliente: Cliente) {
    setPedidoForm((current) => ({
      ...current,
      clienteId: String(cliente.id),
      clienteNombre: cliente.nombre,
      clienteTelefono: cliente.telefono,
    }))
  }

  function tryResolveLocalClientByName(rawName: string): Cliente | null {
    const normalized = normalizeClientName(rawName)
    if (!normalized) {
      return null
    }

    return (
      clientes.find(
        (cliente) => cliente.activo !== false && normalizeClientName(cliente.nombre) === normalized,
      ) ?? null
    )
  }

  function tryResolveLocalClient(nombre: string, telefono: string): Cliente | null {
    const normalizedName = normalizeClientName(nombre)
    const normalizedPhone = normalizePhone(telefono)

    return (
      clientes.find((cliente) => {
        if (cliente.activo === false) {
          return false
        }

        const sameName = normalizedName ? normalizeClientName(cliente.nombre) === normalizedName : false
        const samePhone = normalizedPhone ? normalizePhone(cliente.telefono) === normalizedPhone : false
        return samePhone || sameName
      }) ?? null
    )
  }

  async function searchClientByName(name: string): Promise<Cliente | null> {
    const normalized = name.trim()
    const normalizedName = normalizeClientName(name)
    if (!normalized) {
      return null
    }

    try {
      const response = await clientesService.getAll({ active: true, q: normalized })
      const matches = unwrapClientesPayload(response.data)
      if (matches.length === 0) {
        return null
      }

      setClientes((current) => {
        const merged = new Map<number, Cliente>(current.map((item) => [item.id, item]))
        matches.forEach((item) => merged.set(item.id, item))
        return Array.from(merged.values())
      })

      return (
        matches.find((item) => normalizeClientName(item.nombre) === normalizedName) ??
        matches.find((item) => normalizeClientName(item.nombre).includes(normalizedName)) ??
        matches[0] ??
        null
      )
    } catch {
      return null
    }
  }

  async function searchClientByPhone(telefono: string): Promise<Cliente | null> {
    const normalized = telefono.trim()
    const normalizedPhone = normalizePhone(telefono)
    if (!normalized) {
      return null
    }

    try {
      const response = await clientesService.getAll({ active: true, telefono: normalized })
      const matches = unwrapClientesPayload(response.data)
      if (matches.length === 0) {
        return null
      }

      setClientes((current) => {
        const merged = new Map<number, Cliente>(current.map((item) => [item.id, item]))
        matches.forEach((item) => merged.set(item.id, item))
        return Array.from(merged.values())
      })

      return (
        matches.find((item) => normalizePhone(item.telefono) === normalizedPhone) ??
        matches[0] ??
        null
      )
    } catch {
      return null
    }
  }

  async function searchClientInsensitive(nombre: string, telefono: string): Promise<Cliente | null> {
    const normalizedName = normalizeClientName(nombre)
    const normalizedPhone = normalizePhone(telefono)

    if (!normalizedName && !normalizedPhone) {
      return null
    }

    try {
      const response = await clientesService.getAll({ active: true })
      const matches = unwrapClientesPayload(response.data)
      if (matches.length === 0) {
        return null
      }

      setClientes((current) => {
        const merged = new Map<number, Cliente>(current.map((item) => [item.id, item]))
        matches.forEach((item) => merged.set(item.id, item))
        return Array.from(merged.values())
      })

      const byPhone = normalizedPhone
        ? matches.find((item) => normalizePhone(item.telefono) === normalizedPhone) ?? null
        : null

      if (byPhone) {
        return byPhone
      }

      return normalizedName
        ? matches.find((item) => normalizeClientName(item.nombre) === normalizedName) ?? null
        : null
    } catch {
      return null
    }
  }

  async function findClientAfterCreate(nombre: string, telefono: string): Promise<Cliente | null> {
    const byPhone = await searchClientByPhone(telefono)
    if (byPhone) {
      return byPhone
    }

    const byName = await searchClientByName(nombre)
    if (byName) {
      return byName
    }

    return null
  }

  async function resolveClienteIdForPedido(input: {
    clienteIdRaw: string
    clienteNombre: string
    clienteTelefono: string
  }): Promise<number> {
    const directClienteId = toPositiveNumber(input.clienteIdRaw)
    if (directClienteId) {
      return directClienteId
    }

    const nombre = input.clienteNombre.trim()
    const telefono = input.clienteTelefono.trim()

    const localMatch = tryResolveLocalClient(nombre, telefono)
    if (localMatch) {
      if (!input.clienteTelefono.trim()) {
        setPedidoForm((current) => ({ ...current, clienteTelefono: localMatch.telefono }))
      }
      return localMatch.id
    }

    const remoteMatch = await searchClientByName(nombre)
    if (remoteMatch) {
      if (!input.clienteTelefono.trim()) {
        setPedidoForm((current) => ({ ...current, clienteTelefono: remoteMatch.telefono }))
      }
      return remoteMatch.id
    }

    const remotePhoneMatch = await searchClientByPhone(telefono)
    if (remotePhoneMatch) {
      if (!input.clienteTelefono.trim()) {
        setPedidoForm((current) => ({ ...current, clienteTelefono: remotePhoneMatch.telefono }))
      }
      return remotePhoneMatch.id
    }

    const insensitiveMatch = await searchClientInsensitive(nombre, telefono)
    if (insensitiveMatch) {
      linkClientToPedidoForm(insensitiveMatch)
      return insensitiveMatch.id
    }

    const createdResponse = await clientesService.create({ nombre, telefono })
    const created = normalizeClienteRecord(createdResponse.data)
    if (!created) {
      const recoveredClient = await findClientAfterCreate(nombre, telefono)
      if (recoveredClient) {
        linkClientToPedidoForm(recoveredClient)
        return recoveredClient.id
      }

      throw new Error('El cliente se creo, pero no se pudo recuperar su id para el pedido.')
    }

    setClientes((current) => {
      const exists = current.some((item) => item.id === created.id)
      return exists ? current : [created, ...current]
    })
    linkClientToPedidoForm(created)
    return created.id
  }

  function openCreateDialog() {
    setPedidoDialogMode('create')
    setSelectedPedido(null)
    setPedidoForm((current) => ({
      ...initialPedidoForm,
      usuarioId: current.usuarioId || (user ? String(user.id) : ''),
      tipo: isTakeoutMode ? 'LLEVAR' : initialPedidoForm.tipo,
      clienteId: '',
      clienteNombre: '',
      clienteTelefono: '',
      mesaId: isTakeoutMode ? '' : initialPedidoForm.mesaId,
    }))
  }

  function openEditDialog(pedido: Pedido) {
    const resolvedUserId = pedido.usuarioId ? String(pedido.usuarioId) : user ? String(user.id) : ''
    const rawClienteNombre = extractPedidoClienteNombre(pedido)
    const rawClienteTelefono = extractPedidoClienteTelefono(pedido)

    setPedidoDialogMode('edit')
    setSelectedPedido(pedido)
    setPedidoForm({
      codigo: pedido.codigo ?? '',
      clienteId: pedido.clienteId ? String(pedido.clienteId) : '',
      clienteNombre: rawClienteNombre,
      clienteTelefono: rawClienteTelefono,
      mesaId: pedido.mesaId ? String(pedido.mesaId) : '',
      usuarioId: resolvedUserId,
      tipo: isTakeoutMode ? 'LLEVAR' : String(pedido.tipo).toUpperCase() === 'LLEVAR' ? 'LLEVAR' : 'MESA',
      estado: normalizeOrderState(String(pedido.estado)),
      impuesto: String(pedido.impuesto ?? 0),
      detalles: initialPedidoForm.detalles,
    })
  }

  function closePedidoDialog() {
    setPedidoDialogMode(null)
  }

  function normalizeOrderState(value: string): EstadoPedido {
    const upper = value.trim().toUpperCase()
    return ORDER_STATES.includes(upper as EstadoPedido) ? (upper as EstadoPedido) : 'BORRADOR'
  }

  function normalizeOrderType(value: string): TipoPedido {
    const upper = value.trim().toUpperCase()
    return ORDER_TYPES.includes(upper as TipoPedido) ? (upper as TipoPedido) : 'MESA'
  }

  function addPedidoLine() {
    setPedidoForm((current) => ({
      ...current,
      detalles: [
        ...current.detalles,
        { codigoProducto: '', productoId: '', productoNombre: '', cantidad: '1', precioUnitario: '', observacion: '' },
      ],
    }))
  }

  function applyProductCodeToLine(index: number, rawCode: string) {
    const product = findProductByQuery(products, rawCode)
    updatePedidoLine(index, {
      codigoProducto: rawCode,
      productoId: product ? String(product.id) : '',
      productoNombre: product?.nombre ?? '',
      precioUnitario: product ? String(product.precio) : '',
    })
  }

  function applyProductSelectionToLine(index: number, rawProductId: string) {
    const product = products.find((item) => String(item.id) === rawProductId)
    updatePedidoLine(index, {
      productoId: rawProductId,
      codigoProducto: product?.codigo ?? rawProductId,
      productoNombre: product?.nombre ?? '',
      precioUnitario: product ? String(product.precio) : '',
    })
  }

  function updatePedidoLine(index: number, nextValue: Partial<PedidoLineFormState>) {
    setPedidoForm((current) => ({
      ...current,
      detalles: current.detalles.map((line, lineIndex) => (lineIndex === index ? { ...line, ...nextValue } : line)),
    }))
  }

  function removePedidoLine(index: number) {
    setPedidoForm((current) => ({
      ...current,
      detalles: current.detalles.filter((_, lineIndex) => lineIndex !== index),
    }))
  }

  async function handleSavePedido() {
    let resolvedClienteId: number | undefined

    if (pedidoForm.tipo === 'LLEVAR') {
      if (!pedidoForm.clienteNombre.trim()) {
        toast.error('Ingresa el nombre del cliente para el pedido para llevar.')
        return
      }

      if (!pedidoForm.clienteTelefono.trim()) {
        toast.error('Ingresa el teléfono del cliente para el pedido para llevar.')
        return
      }

      try {
        resolvedClienteId = await resolveClienteIdForPedido({
          clienteIdRaw: pedidoForm.clienteId,
          clienteNombre: pedidoForm.clienteNombre,
          clienteTelefono: pedidoForm.clienteTelefono,
        })
      } catch (clientError) {
        const message =
          clientError instanceof Error && clientError.message
            ? clientError.message
            : 'No fue posible resolver el cliente para el pedido.'
        toast.error(message)
        return
      }
    } else {
      resolvedClienteId = toPositiveNumber(pedidoForm.clienteId) ?? undefined
    }

    const validation = pedidoSchema.safeParse({
      codigo: isTakeoutMode ? undefined : pedidoForm.codigo.trim() || undefined,
      clienteId: resolvedClienteId,
      mesaId: pedidoForm.tipo === 'MESA' ? pedidoForm.mesaId : undefined,
      usuarioId:
        isTakeoutMode && currentRole !== 'ADMIN'
          ? String(user?.id ?? pedidoForm.usuarioId)
          : pedidoForm.usuarioId || String(user?.id ?? ''),
      tipo: pedidoForm.tipo,
      estado: pedidoForm.estado,
      impuesto: isTakeoutMode ? '0' : pedidoForm.impuesto,
      detalles: pedidoForm.detalles.map((line) => ({
        productoId: line.productoId,
        cantidad: line.cantidad,
        precioUnitario: line.precioUnitario,
        observacion: line.observacion.trim() || undefined,
      })),
    })

    if (!validation.success) {
      const firstIssue = validation.error.issues[0]
      toast.error(firstIssue?.message ?? 'Revisa los datos del pedido.')
      return
    }

    const payload: CreatePedidoDto = {
      codigo: validation.data.codigo,
      clienteId: validation.data.clienteId,
      mesaId: validation.data.mesaId,
      usuarioId: validation.data.usuarioId,
      tipo: validation.data.tipo,
      estado: validation.data.estado,
      impuesto: validation.data.impuesto,
      detalles: validation.data.detalles,
    }

    setSaving(true)

    try {
      if (pedidoDialogMode === 'edit' && selectedPedido) {
        await pedidosService.update(selectedPedido.id, payload)
        toast.success('Pedido actualizado.')
      } else {
        await pedidosService.create(payload)
        toast.success('Pedido creado.')
      }

      closePedidoDialog()
      await loadPedidos()
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      toast.error(backendMessage || 'No fue posible guardar el pedido.')
    } finally {
      setSaving(false)
    }
  }

  async function openDetailsDialog(pedido: Pedido) {
    setSelectedPedido(pedido)
    setDetailsOpen(true)
    setLoadingDetails(true)

    try {
      const [pedidoResponse, detailsResponse, paymentsResponse] = await Promise.all([
        pedidosService.getById(pedido.id),
        pedidosService.getDetails(pedido.id),
        pedidosService.getPayments(pedido.id),
      ])

      const normalizedPedidoById =
        normalizePedidoRecord(pedidoResponse.data) ?? normalizePedidoRecord(pedido) ?? pedido
      setSelectedPedido(normalizedPedidoById)

      const detailsFromEndpoint = unwrapPedidoDetailsPayload(detailsResponse.data)
      const detailsFromPedidoById = unwrapPedidoDetailsPayload(pedidoResponse.data)
      const detailsFromRow = unwrapPedidoDetailsPayload((pedido as unknown as Record<string, unknown>).detalles)
      const mergedDetails =
        detailsFromEndpoint.length > 0
          ? detailsFromEndpoint
          : detailsFromPedidoById.length > 0
            ? detailsFromPedidoById
            : detailsFromRow

      setCurrentDetails(mergedDetails)
      setCurrentPayments(unwrapPagosPayload(paymentsResponse.data))
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      toast.error(backendMessage || 'No fue posible cargar el detalle del pedido.')
    } finally {
      setLoadingDetails(false)
    }
  }

  function closeDetailsDialog() {
    setDetailsOpen(false)
    setSelectedPedido(null)
    setCurrentDetails([])
    setCurrentPayments([])
  }

  function openCreateDetailDialog() {
    if (!canManageSelectedPedido) {
      toast.info('Solo puedes editar líneas en pedidos abiertos.')
      return
    }

    setEditingDetailId(null)
    setDetailForm({ codigoProducto: '', productoId: '', cantidad: '1', precioUnitario: '', observacion: '' })
    setDetailDialogOpen(true)
  }

  function openEditDetailDialog(detail: PedidoDetalle) {
    if (!canManageSelectedPedido) {
      toast.info('Solo puedes editar líneas en pedidos abiertos.')
      return
    }

    setEditingDetailId(detail.id)
    const matchedProduct = products.find((product) => product.id === detail.productoId)
    setDetailForm({
      codigoProducto: matchedProduct?.codigo ?? '',
      productoId: String(detail.productoId),
      cantidad: String(detail.cantidad),
      precioUnitario: String(detail.precioUnitario),
      observacion: detail.observacion ?? '',
    })
    setDetailDialogOpen(true)
  }

  async function handleSaveDetail() {
    if (!selectedPedido) {
      return
    }

    if (!canManageSelectedPedido) {
      toast.info('El pedido ya no admite cambios en sus líneas.')
      return
    }

    const productoId = toPositiveNumber(detailForm.productoId)
    const cantidad = Number(detailForm.cantidad)
    const precioUnitario = Number(detailForm.precioUnitario)

    if (!productoId || !Number.isFinite(cantidad) || cantidad <= 0 || !Number.isFinite(precioUnitario) || precioUnitario < 0) {
      toast.error('Completa una línea válida antes de guardar.')
      return
    }

    setSaving(true)

    try {
      const payload = {
        productoId,
        cantidad,
        precioUnitario,
        observacion: detailForm.observacion.trim() || undefined,
      }

      if (editingDetailId !== null) {
        await pedidosService.updateDetail(selectedPedido.id, editingDetailId, payload)
        toast.success('Línea actualizada.')
      } else {
        await pedidosService.createDetail(selectedPedido.id, payload)
        toast.success('Línea agregada.')
      }

      setDetailDialogOpen(false)
      await openDetailsDialog(selectedPedido)
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      toast.error(backendMessage || 'No fue posible guardar la línea.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteDetail(detail: PedidoDetalle) {
    if (!selectedPedido) {
      return
    }

    if (!canManageSelectedPedido) {
      toast.info('El pedido ya no admite cambios en sus líneas.')
      return
    }

    setSaving(true)
    try {
      await pedidosService.deleteDetail(selectedPedido.id, detail.id)
      toast.success('Línea eliminada.')
      await openDetailsDialog(selectedPedido)
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      toast.error(backendMessage || 'No fue posible eliminar la línea.')
    } finally {
      setSaving(false)
    }
  }

  function openCreatePaymentDialog() {
    if (!canManageSelectedPedido) {
      toast.info('Solo puedes registrar pagos en pedidos abiertos.')
      return
    }

    setEditingPaymentId(null)
    setPaymentForm(initialPaymentForm)
    setPaymentDialogOpen(true)
  }

  function openEditPaymentDialog(payment: PagoPedido) {
    if (!canManageSelectedPedido) {
      toast.info('Solo puedes editar pagos en pedidos abiertos.')
      return
    }

    setEditingPaymentId(payment.id)
    setPaymentForm({
      metodoPagoId: String(payment.metodoPagoId),
      monto: String(payment.monto),
      referencia: payment.referencia ?? '',
    })
    setPaymentDialogOpen(true)
  }

  async function handleSavePayment() {
    if (!selectedPedido) {
      return
    }

    if (!canManageSelectedPedido) {
      toast.info('El pedido ya no admite cambios de pagos.')
      return
    }

    const metodoPagoId = toPositiveNumber(paymentForm.metodoPagoId)
    const monto = Number(paymentForm.monto)

    if (!metodoPagoId || !Number.isFinite(monto) || monto <= 0) {
      toast.error('Completa un método de pago y un monto válido.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        metodoPagoId,
        monto,
        referencia: paymentForm.referencia.trim() || undefined,
      }

      if (editingPaymentId !== null) {
        await pedidosService.updatePayment(selectedPedido.id, editingPaymentId, payload)
        toast.success('Pago actualizado.')
      } else {
        await pedidosService.createPayment(selectedPedido.id, payload)
        toast.success('Pago registrado.')
      }

      setPaymentDialogOpen(false)
      await openDetailsDialog(selectedPedido)
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      toast.error(backendMessage || 'No fue posible guardar el pago.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeletePayment(payment: PagoPedido) {
    if (!selectedPedido) {
      return
    }

    if (!canManageSelectedPedido) {
      toast.info('El pedido ya no admite cambios de pagos.')
      return
    }

    setSaving(true)
    try {
      await pedidosService.deletePayment(selectedPedido.id, payment.id)
      toast.success('Pago eliminado.')
      await openDetailsDialog(selectedPedido)
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      toast.error(backendMessage || 'No fue posible eliminar el pago.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeletePedido(pedido: Pedido) {
    setSaving(true)
    try {
      await pedidosService.delete(pedido.id)
      toast.success(`Pedido ${pedido.codigo ?? `#${pedido.id}`} eliminado.`)
      await loadPedidos()
      if (selectedPedido?.id === pedido.id) {
        closeDetailsDialog()
      }
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      toast.error(backendMessage || 'No fue posible eliminar el pedido.')
    } finally {
      setSaving(false)
    }
  }

  async function handleReprintPedido(pedido: Pedido) {
    const pedidoId = toPositiveNumber(pedido.id)
    if (!pedidoId) {
      toast.error('No se encontro un id de pedido valido para reimprimir.')
      return
    }

    setSaving(true)
    try {
      const [pedidoResponse, detailsResponse, paymentsResponse, methodsResponse] = await Promise.all([
        pedidosService.getById(pedidoId),
        pedidosService.getDetails(pedidoId),
        pedidosService.getPayments(pedidoId),
        pedidosService.getPaymentMethods(),
      ])

      const printablePedido = normalizePedidoRecord(pedidoResponse.data) ?? pedido
      const printableDetails = unwrapPedidoDetailsPayload(detailsResponse.data)
      const printablePayments = unwrapPagosPayload(paymentsResponse.data)
      const paymentMethods = unwrapArrayPayload<MetodoPago>(methodsResponse.data)
      const now = new Date()

      const rowsHtml =
        printableDetails.length > 0
          ? printableDetails
              .map((detail) => {
                const productLabel =
                  detail.producto?.nombre ??
                  detail.productoNombre ??
                  products.find((product) => product.id === detail.productoId)?.nombre ??
                  'Producto'
                const quantity = Number(detail.cantidad ?? 0)
                const unitPrice = Number(detail.precioUnitario ?? 0)
                const subtotal = Number(detail.subtotal ?? unitPrice * quantity)
                const note = detail.observacion?.trim() ? `<div class="item-note">Obs: ${escapeHtml(detail.observacion.trim())}</div>` : ''

                return `<div class="item-row"><div class="item-name">${escapeHtml(productLabel)}</div>${note}<div class="item-meta"><span>Cant: ${quantity > 0 ? quantity : '-'}</span><span>PU: ${formatCurrency(Number.isFinite(unitPrice) ? unitPrice : 0)}</span><span>Subt: ${formatCurrency(Number.isFinite(subtotal) ? subtotal : 0)}</span></div></div>`
              })
              .join('')
          : '<div class="empty-row">Sin productos</div>'

      const subtotal = printableDetails.reduce((sum, detail) => {
        const amount = Number(detail.subtotal ?? Number(detail.precioUnitario ?? 0) * Number(detail.cantidad ?? 0))
        return sum + (Number.isFinite(amount) ? amount : 0)
      }, 0)

      const serviceRaw = Number(printablePedido.impuesto ?? 0)
      const serviceAmount = Number.isFinite(serviceRaw) && serviceRaw > 0 ? serviceRaw : 0
      const totalComputed = subtotal + serviceAmount
      const total = Number.isFinite(Number(printablePedido.total)) && Number(printablePedido.total) > 0
        ? Number(printablePedido.total)
        : totalComputed

      const paymentsHtml =
        printablePayments.length > 0
          ? printablePayments
              .map((payment) => {
                const methodName =
                  payment.metodoPago?.nombre ??
                  paymentMethods.find((method) => method.id === payment.metodoPagoId)?.nombre ??
                  `Método #${payment.metodoPagoId}`

                return `<div class="payment-row"><span>${escapeHtml(methodName)}</span><span>${formatCurrency(Number(payment.montoColones ?? payment.monto ?? 0))}</span></div>`
              })
              .join('')
          : '<div class="empty-row">Sin pagos registrados</div>'

      const totalPagado = printablePayments.reduce((sum, payment) => {
        const monto = Number(payment.montoColones ?? payment.monto ?? 0)
        return sum + (Number.isFinite(monto) ? monto : 0)
      }, 0)

      const totalVuelto = printablePayments.reduce((sum, payment) => sum + resolvePaymentChangeCRC(payment), 0)

      const hasUsdPayments = printablePayments.some((payment) => resolvePaymentCurrency(payment) === 'USD')
      const hasCrcPayments = printablePayments.some((payment) => resolvePaymentCurrency(payment) === 'CRC')
      const totalPagadoUSD = printablePayments.reduce((sum, payment) => sum + resolvePaymentAmountInCurrency(payment, 'USD'), 0)
      const totalVueltoUSD = printablePayments.reduce((sum, payment) => sum + resolvePaymentChangeInCurrency(payment, 'USD'), 0)

      const paymentTotalsHtml = hasUsdPayments
        ? [
            hasCrcPayments && totalPagado > 0
              ? `<div><span>Total pagado CRC</span><span>${formatCurrency(totalPagado)}</span></div>`
              : '',
            `<div><span>Total pagado USD</span><span>${formatUSD(totalPagadoUSD)}</span></div>`,
            totalVuelto > 0 ? `<div><span>Vuelto CRC</span><span>${formatCurrency(totalVuelto)}</span></div>` : '',
            totalVueltoUSD > 0 ? `<div><span>Vuelto USD</span><span>${formatUSD(totalVueltoUSD)}</span></div>` : '',
          ]
            .filter(Boolean)
            .join('')
        : [
            `<div><span>Total pagado</span><span>${formatCurrency(totalPagado)}</span></div>`,
            totalVuelto > 0 ? `<div><span>Vuelto</span><span>${formatCurrency(totalVuelto)}</span></div>` : '',
          ]
            .filter(Boolean)
            .join('')

      const printedDate = now.toLocaleDateString('es-CR')
      const printedTime = now.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })

      const popup = window.open('', '_blank', 'width=420,height=700')
      if (!popup) {
        toast.error('No se pudo abrir la ventana de impresión. Revisa el bloqueador de popups.')
        return
      }

      const html = `
        <html>
          <head>
            <title>Reimpresión - Pedido #${printablePedido.id}</title>
            <style>
              @page { margin: 1.5mm; size: 58mm auto; }
              html, body {
                margin: 0 auto;
                padding: 0;
                width: 52mm;
                background: #fff;
                color: #111827;
                font-family: Verdana, Geneva, sans-serif;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              body { padding: 1mm 0; }
              .ticket { padding: 0; }
              .header { text-align: center; margin-bottom: 7px; }
              .restaurant { font-size: 19px; font-weight: 500; letter-spacing: 0.1px; }
              .subtitle { font-size: 12px; font-weight: 400; color: #374151; margin-top: 2px; }
              .meta-grid {
                display: grid;
                grid-template-columns: 1fr;
                gap: 4px;
                margin: 7px 0;
                padding: 5px 0;
                border-top: 1px dashed #94a3b8;
                border-bottom: 1px dashed #94a3b8;
                font-size: 12px;
              }
              .meta-item b { display: block; color: #374151; font-weight: 800; margin-bottom: 1px; }
              .items { margin-bottom: 8px; }
              .item-row { border-bottom: 1px dashed #cbd5e1; padding: 5px 0; }
              .item-name { font-weight: 500; color: #111827; word-break: break-word; }
              .item-note { font-size: 11px; font-weight: 400; color: #4b5563; margin-top: 2px; white-space: pre-wrap; word-break: break-word; }
              .item-meta {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 4px;
                margin-top: 4px;
                font-size: 10px;
                font-weight: 700;
                color: #1f2937;
              }
              .item-meta span:nth-child(2), .item-meta span:nth-child(3) { text-align: right; }
              .section-title { font-size: 12px; font-weight: 900; color: #111827; margin: 8px 0 3px; text-transform: uppercase; }
              .payments { margin-bottom: 8px; }
              .payment-row {
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                column-gap: 6px;
                border-bottom: 1px dashed #cbd5e1;
                padding: 4px 0;
                font-size: 11px;
                font-weight: 700;
              }
              .payment-row span:first-child { min-width: 0; word-break: break-word; }
              .payment-row span:last-child { text-align: right; white-space: nowrap; }
              .empty-row { border-bottom: 1px dashed #cbd5e1; padding: 5px 0; text-align: center; color: #6b7280; font-size: 11px; }
              .totals { border-top: 1px dashed #94a3b8; padding-top: 4px; margin-top: 2px; }
              .totals div {
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                align-items: start;
                column-gap: 6px;
                margin: 4px 0;
                font-size: 12px;
                font-weight: 700;
                line-height: 1.25;
              }
              .totals div span:first-child {
                min-width: 0;
                word-break: break-word;
              }
              .totals div span:last-child {
                text-align: right;
                white-space: nowrap;
              }
              .total { font-weight: 500; font-size: 14px; color: #111827; }
            </style>
          </head>
          <body>
            <div class="ticket">
              <div class="header">
                <div class="restaurant">Brisas del Lago</div>
                <div class="subtitle">Factura de pedido</div>
              </div>

              <div class="meta-grid">
                <div class="meta-item"><b>Fecha</b>${printedDate}</div>
                <div class="meta-item"><b>Hora</b>${printedTime}</div>
                <div class="meta-item"><b>Número de pedido</b>#${printablePedido.id}</div>
                <div class="meta-item"><b>Código</b>${escapeHtml(printablePedido.codigo ?? '-')}</div>
              </div>

              <div class="items">${rowsHtml}</div>

              <div class="totals">
                <div><span>Subtotal</span><span>${formatCurrency(subtotal)}</span></div>
                ${serviceAmount > 0 ? `<div><span>Impuesto por servicio</span><span>${formatCurrency(serviceAmount)}</span></div>` : ''}
                <div class="total"><span>Total</span><span>${formatCurrency(total)}</span></div>
              </div>

              <div class="section-title">Pagos</div>
              <div class="payments">${paymentsHtml}</div>

              <div class="totals">
                ${paymentTotalsHtml}
              </div>
            </div>
          </body>
        </html>
      `

      popup.document.open()
      popup.document.write(html)
      popup.document.close()
      popup.focus()
      popup.print()

      toast.success('Reimpresión preparada correctamente.')
    } catch (requestError) {
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      toast.error(backendMessage || 'No fue posible reimprimir el pedido.')
    } finally {
      setSaving(false)
    }
  }

  function resolveSelectedPedidoId(): number | null {
    return selectedPedido ? toPositiveNumber(selectedPedido.id) : null
  }

  async function handleSendToKitchenFromDetails() {
    const pedidoId = resolveSelectedPedidoId()
    if (!pedidoId) {
      toast.error('No se encontro un id de pedido valido para enviar a cocina.')
      return
    }

    const pendingKitchenDetails = currentDetails
      .map((detail) => {
        const cantidadPendiente = Number(detail.cantidad) - Number(detail.cantidadEnviadaCocina ?? 0)
        return cantidadPendiente > 0 ? { ...detail, cantidad: cantidadPendiente } : null
      })
      .filter((detail): detail is PedidoDetalle => detail !== null)

    if (pendingKitchenDetails.length === 0) {
      toast.info('No hay productos nuevos pendientes de enviar a cocina.')
      return
    }

    const printWindow = window.open('', '_blank', 'width=420,height=720')
    if (!printWindow) {
      toast.error('No se pudo abrir la ventana de impresión. Revisa el bloqueador de popups.')
      return
    }
    setSaving(true)
    try {
      const kitchenLines = pendingKitchenDetails.map((detail) => ({
          producto:
            detail.producto?.nombre ??
            detail.productoNombre ??
            products.find((product) => product.id === detail.productoId)?.nombre ??
            `Producto #${detail.productoId}`,
          cantidad: Number(detail.cantidad ?? 0) > 0 ? Number(detail.cantidad) : 1,
          observacion: detail.observacion?.trim() || undefined,
        }))

      openKitchenPrintPreview(printWindow, {
        pedidoId,
        codigo: selectedPedido?.codigo,
        locationLabel:
          Number(selectedPedido?.mesa?.numero ?? selectedPedido?.mesaId ?? 0) > 0
            ? `Mesa #${Number(selectedPedido?.mesa?.numero ?? selectedPedido?.mesaId)}`
            : selectedPedido?.tipo === 'LLEVAR'
              ? 'Pedido para llevar'
              : undefined,
        esComandaAdicional: currentDetails.some((detail) => Number(detail.cantidadEnviadaCocina ?? 0) > 0),
        productos: kitchenLines,
      }, async () => {
        setSaving(true)
        try {
          const response = await pedidosService.sendToKitchen(pedidoId)
          const enviados = response.data.detallesEnviados.length
          toast.success(enviados === 1 ? 'Producto enviado a cocina.' : `${enviados} productos enviados a cocina.`)
          await loadPedidos()
          if (selectedPedido) {
            await openDetailsDialog({ ...selectedPedido, id: pedidoId })
          }
          return { ok: true }
        } catch (requestError) {
          const backendMessage =
            axios.isAxiosError(requestError) && requestError.response
              ? extractBackendMessage(requestError.response.data)
              : ''
          const message = backendMessage || 'No fue posible enviar la comanda a cocina.'
          toast.error(message)
          return { ok: false, message }
        } finally {
          setSaving(false)
        }
      })
    } catch (requestError) {
      printWindow.close()
      const backendMessage =
        axios.isAxiosError(requestError) && requestError.response
          ? extractBackendMessage(requestError.response.data)
          : ''
      toast.error(backendMessage || 'No fue posible enviar la comanda a cocina.')
    } finally {
      setSaving(false)
    }
  }

  function openInvoicePreview() {
    const pedidoId = resolveSelectedPedidoId()
    if (!pedidoId || !selectedPedido) {
      toast.error('No se encontro un pedido valido para facturar.')
      return
    }

    setInvoicePreviewPedido(selectedPedido)
    setInvoicePreviewDetails(currentDetails)
    setInvoicePreviewOpen(true)
  }

  const detailBalance = useMemo(() => {
    const total = selectedPedido?.total ?? 0
    const paid = selectedPedido?.totalPagado ?? currentPayments.reduce((sum, payment) => sum + payment.monto, 0)
    return Math.max(total - paid, 0)
  }, [selectedPedido, currentPayments])

  return (
    <Box sx={{ color: COLOR_TEXT }}>
      <Paper
        sx={{
          p: { xs: 2.5, md: 3.5 },
          mb: 3,
          borderRadius: 3,
          background:
            'linear-gradient(135deg, rgba(20,12,10,0.95) 0%, rgba(36,18,11,0.9) 100%), radial-gradient(circle at top right, rgba(212,175,55,0.2) 0%, transparent 32%)',
          border: '1px solid rgba(212,175,55,0.4)',
          boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}
        >
          <Box>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1 }}>
              <ReceiptIcon sx={{ color: COLOR_GOLD }} />
              <Typography
                variant="h4"
                sx={{ fontWeight: 800, color: COLOR_GOLD, fontFamily: '"Cormorant Garamond", serif' }}
              >
                {pageTitle}
              </Typography>
            </Stack>
            <Typography sx={{ color: COLOR_MUTED, maxWidth: 760 }}>
              {pageDescription}
            </Typography>
          </Box>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreateDialog}
            sx={{
              alignSelf: { xs: 'stretch', md: 'center' },
              background: `linear-gradient(135deg, ${COLOR_GOLD} 0%, #f2d36f 100%)`,
              color: '#1a1208',
              fontWeight: 700,
              '&:hover': { background: `linear-gradient(135deg, #e5c253 0%, #f7df8d 100%)` },
            }}
          >
            {isTakeoutMode ? 'Nuevo pedido para llevar' : 'Nuevo pedido'}
          </Button>
        </Stack>
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
          gap: 2,
          mb: 3,
        }}
      >
        {[
          { label: 'Pedidos', value: summary.totalPedidos },
          { label: 'Borradores', value: summary.borradores },
          { label: 'Facturados', value: summary.facturados },
          isTakeoutMode
            ? { label: 'Para llevar', value: summary.paraLlevar }
            : { label: 'Pedidos por mesa', value: summary.conMesa },
        ].map((item) => (
          <Card
            key={item.label}
            sx={{
              backgroundColor: 'rgba(10,10,10,0.72)',
              border: '1px solid rgba(212,175,55,0.28)',
              color: COLOR_TEXT,
              boxShadow: '0 10px 28px rgba(0,0,0,0.3)',
            }}
          >
            <CardContent>
              <Typography sx={{ color: COLOR_MUTED, fontSize: '0.9rem' }}>{item.label}</Typography>
              <Typography variant="h5" sx={{ color: COLOR_GOLD, fontWeight: 800, mt: 0.5 }}>
                {item.value}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      {!isTakeoutMode ? (
        <Paper
          sx={{
            p: 2.5,
            mb: 3,
            borderRadius: 3,
            backgroundColor: 'rgba(10,10,10,0.72)',
            border: '1px solid rgba(212,175,55,0.28)',
            boxShadow: '0 12px 30px rgba(0,0,0,0.32)',
          }}
        >
          <Stack spacing={2.5}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}
            >
              <Box>
                <Typography variant="h6" sx={{ color: COLOR_GOLD, fontWeight: 800 }}>
                  Cierre diario
                </Typography>
                <Typography variant="body2" sx={{ color: COLOR_MUTED, mt: 0.5 }}>
                  Resumen de ventas y pagos registrados para la fecha seleccionada.
                </Typography>
              </Box>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                <TextField
                  label="Fecha del cierre"
                  type="date"
                  value={cierreFecha}
                  onChange={(event) => setCierreFecha(event.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{
                    minWidth: { sm: 190 },
                    '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                    '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                  }}
                />
                <Button
                  variant="contained"
                  disabled={!cierreFecha || loadingCierreDiario}
                  onClick={() => void loadCierreDiario(cierreFecha)}
                  sx={{ backgroundColor: COLOR_MAROON, '&:hover': { backgroundColor: '#a42535' } }}
                >
                  {loadingCierreDiario ? 'Consultando...' : 'Buscar cierre'}
                </Button>
              </Stack>
            </Stack>

            {cierreDiarioError ? <Alert severity="warning">{cierreDiarioError}</Alert> : null}

            {loadingCierreDiario && !cierreDiario ? (
              <Box sx={{ py: 3, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress size={28} sx={{ color: COLOR_GOLD }} />
              </Box>
            ) : cierreDiario ? (
              <>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                    gap: 1.5,
                  }}
                >
                  {[
                    { label: 'Total general', value: formatCurrency(cierreDiario.resumen.totalVendido) },
                    { label: 'Pagos registrados', value: cierreDiario.resumen.pagosCount },
                    { label: 'Pedidos cobrados', value: cierreDiario.resumen.pedidosCount },
                  ].map((item) => (
                    <Box
                      key={item.label}
                      sx={{
                        p: 1.75,
                        borderRadius: 2,
                        backgroundColor: 'rgba(212,175,55,0.08)',
                        border: '1px solid rgba(212,175,55,0.2)',
                      }}
                    >
                      <Typography variant="body2" sx={{ color: COLOR_MUTED }}>
                        {item.label}
                      </Typography>
                      <Typography variant="h6" sx={{ color: COLOR_GOLD, fontWeight: 800, mt: 0.25 }}>
                        {item.value}
                      </Typography>
                    </Box>
                  ))}
                </Box>

                <Box>
                  <Typography sx={{ color: COLOR_TEXT, fontWeight: 700, mb: 1 }}>Por método de pago</Typography>
                  {cierreDiario.porMetodoPago.length === 0 ? (
                    <Typography variant="body2" sx={{ color: COLOR_MUTED }}>
                      No hay pagos registrados para esta fecha.
                    </Typography>
                  ) : (
                    <TableContainer>
                      <Table size="small" sx={{ minWidth: 560 }}>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ color: COLOR_GOLD, fontWeight: 700 }}>Método</TableCell>
                            <TableCell align="right" sx={{ color: COLOR_GOLD, fontWeight: 700 }}>Total</TableCell>
                            <TableCell align="right" sx={{ color: COLOR_GOLD, fontWeight: 700 }}>Pagos</TableCell>
                            <TableCell align="right" sx={{ color: COLOR_GOLD, fontWeight: 700 }}>Pedidos</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {cierreDiario.porMetodoPago.map((metodo) => (
                            <TableRow key={metodo.metodoPagoId}>
                              <TableCell sx={{ color: COLOR_TEXT }}>{metodo.metodoPagoNombre}</TableCell>
                              <TableCell align="right" sx={{ color: COLOR_TEXT }}>{formatCurrency(metodo.total)}</TableCell>
                              <TableCell align="right" sx={{ color: COLOR_TEXT }}>{metodo.pagosCount}</TableCell>
                              <TableCell align="right" sx={{ color: COLOR_TEXT }}>{metodo.pedidosCount}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>
              </>
            ) : null}
          </Stack>
        </Paper>
      ) : null}

      <Paper
        sx={{
          p: 2.5,
          mb: 3,
          borderRadius: 3,
          backgroundColor: 'rgba(10,10,10,0.72)',
          border: '1px solid rgba(212,175,55,0.28)',
        }}
      >
        <Stack spacing={2}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
              gap: 2,
            }}
          >
            <TextField
              select
              fullWidth
              label="Estado"
              value={filterForm.estado}
              onChange={(event) => setFilterForm((current) => ({ ...current, estado: event.target.value }))}
              sx={{
                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
              }}
            >
              <MenuItem value="">Todos</MenuItem>
              {ORDER_STATES.map((state) => (
                <MenuItem key={state} value={state}>
                  {state}
                </MenuItem>
              ))}
            </TextField>

            {isTakeoutMode ? (
              <TextField
                fullWidth
                label="Tipo"
                value="LLEVAR"
                disabled
                sx={{
                  '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                  '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                }}
              />
            ) : (
              <TextField
                select
                fullWidth
                label="Tipo"
                value={filterForm.tipo}
                onChange={(event) => setFilterForm((current) => ({ ...current, tipo: event.target.value }))}
                sx={{
                  '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                  '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                }}
              >
                <MenuItem value="">Todos</MenuItem>
                {ORDER_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </TextField>
            )}

            {isTakeoutMode ? (
              <TextField
                fullWidth
                label="Mesa"
                value="No aplica"
                disabled
                sx={{
                  '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                  '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                }}
              />
            ) : (
              <TextField
                select
                fullWidth
                label="Mesa"
                value={filterForm.mesaId}
                onChange={(event) => setFilterForm((current) => ({ ...current, mesaId: event.target.value }))}
                sx={{
                  '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                  '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                }}
              >
                <MenuItem value="">Todas</MenuItem>
                {mesas.map((mesa) => (
                  <MenuItem key={mesa.id} value={mesa.id}>
                    {getMesaDisplayName(mesa)} {reservadaByMesa[mesa.id] ? '• Reservada' : '• Disponible'}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(4, minmax(0, 1fr))' },
              gap: 2,
            }}
          >
            <TextField
              select
              fullWidth
              label="Cliente"
              value={filterForm.clienteId}
              onChange={(event) => setFilterForm((current) => ({ ...current, clienteId: event.target.value }))}
              slotProps={{
                select: {
                  MenuProps: {
                    slotProps: {
                      paper: {
                        sx: {
                          backgroundColor: '#1b120e',
                          color: COLOR_TEXT,
                          border: '1px solid rgba(212,175,55,0.28)',
                        },
                      },
                    },
                  },
                },
              }}
              sx={{
                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                '& .MuiOutlinedInput-root': { color: COLOR_TEXT, backgroundColor: 'rgba(255,255,255,0.03)' },
              }}
            >
              <MenuItem value="">Todos</MenuItem>
              {clientes
                .filter((cliente) => cliente.activo !== false)
                .map((cliente) => (
                  <MenuItem key={cliente.id} value={cliente.id}>
                    {cliente.nombre} • {cliente.telefono}
                  </MenuItem>
                ))}
            </TextField>

            {isTakeoutMode && currentRole !== 'ADMIN' ? (
              <TextField
                fullWidth
                label="Usuario"
                value={user?.nombre ?? 'Usuario actual'}
                disabled
                sx={{
                  '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                  '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                }}
              />
            ) : (
              <TextField
                select
                fullWidth
                label="Usuario"
                value={filterForm.usuarioId}
                onChange={(event) => setFilterForm((current) => ({ ...current, usuarioId: event.target.value }))}
                slotProps={{
                  select: {
                    MenuProps: {
                      slotProps: {
                        paper: {
                          sx: {
                            backgroundColor: '#1b120e',
                            color: COLOR_TEXT,
                            border: '1px solid rgba(212,175,55,0.28)',
                          },
                        },
                      },
                    },
                  },
                }}
                sx={{
                  '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                  '& .MuiOutlinedInput-root': { color: COLOR_TEXT, backgroundColor: 'rgba(255,255,255,0.03)' },
                }}
              >
                <MenuItem value="">Todos</MenuItem>
                {users.map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    {getUserDisplayName(user)}
                  </MenuItem>
                ))}
              </TextField>
            )}

            <TextField
              label="Desde"
              type="date"
              value={filterForm.fechaDesde}
              onChange={(event) => setFilterForm((current) => ({ ...current, fechaDesde: event.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{
                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
              }}
            />

            <TextField
              label="Hasta"
              type="date"
              value={filterForm.fechaHasta}
              onChange={(event) => setFilterForm((current) => ({ ...current, fechaHasta: event.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{
                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
              }}
            />
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              onClick={() => {
                const resetFilters = isTakeoutMode
                  ? { ...initialFilterState, tipo: 'LLEVAR', mesaId: '' }
                  : initialFilterState
                setFilterForm(resetFilters)
                void loadPedidos(resetFilters)
              }}
              sx={{ color: COLOR_TEXT, borderColor: 'rgba(212,175,55,0.45)' }}
            >
              Limpiar
            </Button>
            <Button
              variant="contained"
              onClick={() => void loadPedidos(filterForm)}
              sx={{ backgroundColor: COLOR_MAROON, '&:hover': { backgroundColor: '#a42535' } }}
            >
              Filtrar
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {error ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      ) : null}

      <Paper
        sx={{
          overflow: 'hidden',
          borderRadius: 3,
          backgroundColor: 'rgba(10,10,10,0.72)',
          border: '1px solid rgba(212,175,55,0.28)',
          boxShadow: '0 12px 30px rgba(0,0,0,0.32)',
        }}
      >
        {loading ? (
          <Box sx={{ py: 10, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress sx={{ color: COLOR_GOLD }} />
          </Box>
        ) : sortedPedidos.length === 0 ? (
          <Box sx={{ py: 8, px: 3, textAlign: 'center' }}>
            <Typography variant="h6" sx={{ color: COLOR_GOLD, fontWeight: 700, mb: 1 }}>
              No hay pedidos para mostrar
            </Typography>
            <Typography sx={{ color: COLOR_MUTED }}>
              Crea un pedido nuevo o ajusta los filtros para revisar otro rango.
            </Typography>
          </Box>
        ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: 1120 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: COLOR_GOLD, fontWeight: 700 }}>Código</TableCell>
                <TableCell sx={{ color: COLOR_GOLD, fontWeight: 700 }}>Mesa</TableCell>
                <TableCell sx={{ color: COLOR_GOLD, fontWeight: 700 }}>Cliente</TableCell>
                {!isTakeoutMode ? <TableCell sx={{ color: COLOR_GOLD, fontWeight: 700 }}>Usuario</TableCell> : null}
                <TableCell sx={{ color: COLOR_GOLD, fontWeight: 700 }}>Tipo</TableCell>
                <TableCell sx={{ color: COLOR_GOLD, fontWeight: 700 }}>Estado</TableCell>
                <TableCell sx={{ color: COLOR_GOLD, fontWeight: 700 }}>Total</TableCell>
                <TableCell sx={{ color: COLOR_GOLD, fontWeight: 700 }}>Saldo</TableCell>
                <TableCell sx={{ color: COLOR_GOLD, fontWeight: 700 }}>Creado</TableCell>
                <TableCell
                  sx={{
                    color: COLOR_GOLD,
                    fontWeight: 700,
                    minWidth: 240,
                    position: 'sticky',
                    right: 0,
                    zIndex: 2,
                    backgroundColor: '#0f0b08',
                    boxShadow: '-8px 0 10px rgba(0,0,0,0.25)',
                  }}
                  align="right"
                >
                  Acciones
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedPedidos.map((pedido) => {
                const total = pedido.total ?? 0
                const saldo = pedido.saldoPendiente ?? Math.max(total - (pedido.totalPagado ?? 0), 0)
                const mesaId = resolvePedidoMesaId(pedido)
                const mesaReservada = mesaId ? Boolean(reservadaByMesa[mesaId]) : false

                return (
                  <TableRow key={pedido.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell sx={{ color: COLOR_TEXT, fontWeight: 700 }}>{pedido.codigo ?? `#${pedido.id}`}</TableCell>
                    <TableCell sx={{ color: COLOR_TEXT, minWidth: 120 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Typography sx={{ color: COLOR_TEXT, fontWeight: 600 }}>{getPedidoMesaListLabel(pedido)}</Typography>
                        {mesaId && !isTakeoutMode ? (
                          <Chip
                            size="small"
                            label={mesaReservada ? 'Reservada' : 'Disponible'}
                            sx={{
                              fontWeight: 700,
                              backgroundColor: mesaReservada ? 'rgba(143,29,46,0.2)' : 'rgba(76,175,80,0.14)',
                              color: mesaReservada ? '#f7b3bd' : '#9ae6a0',
                            }}
                          />
                        ) : null}
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ color: COLOR_TEXT }}>
                      <Typography sx={{ color: COLOR_TEXT, fontWeight: 600 }}>
                        {getPedidoClienteNombre(pedido)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: COLOR_MUTED }}>
                        {getPedidoClienteTelefono(pedido)}
                      </Typography>
                    </TableCell>
                    {!isTakeoutMode ? <TableCell sx={{ color: COLOR_MUTED }}>{getPedidoUserLabel(pedido, users)}</TableCell> : null}
                    <TableCell sx={{ color: COLOR_MUTED }}>{pedido.tipo}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={String(pedido.estado)}
                        color={getStatusTone(String(pedido.estado))}
                        sx={getStatusChipSx(String(pedido.estado))}
                      />
                    </TableCell>
                    <TableCell sx={{ color: COLOR_TEXT }}>{formatCurrency(total)}</TableCell>
                    <TableCell sx={{ color: saldo > 0 ? '#f7b267' : '#9ae6a0' }}>{formatCurrency(saldo)}</TableCell>
                    <TableCell sx={{ color: COLOR_MUTED }}>{formatDateTime(pedido.createdAt)}</TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        minWidth: 240,
                        width: 240,
                        position: 'sticky',
                        right: 0,
                        zIndex: 1,
                        backgroundColor: 'rgba(10,10,10,0.96)',
                        boxShadow: '-8px 0 10px rgba(0,0,0,0.2)',
                      }}
                    >
                      <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                        <Tooltip title="Ver detalle">
                          <IconButton size="small" onClick={() => void openDetailsDialog(pedido)} sx={getActionButtonSx(COLOR_GOLD)}>
                            <VisibilityIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Reimprimir pedido">
                          <IconButton
                            size="small"
                            onClick={() => void handleReprintPedido(pedido)}
                            disabled={saving}
                            sx={getActionButtonSx('#9ec7ff')}
                          >
                            <PrintIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Editar pedido">
                          <IconButton
                            size="small"
                            onClick={() => openEditDialog(pedido)}
                            disabled={saving || !canMutatePedido(String(pedido.estado))}
                            sx={getActionButtonSx(COLOR_GOLD)}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={canDeletePedido(String(pedido.estado)) ? 'Eliminar pedido' : 'Solo BORRADOR o CANCELADO'}>
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => void handleDeletePedido(pedido)}
                              disabled={saving || !canDeletePedido(String(pedido.estado))}
                              sx={getActionButtonSx('#f39ca8')}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={pedidoDialogMode !== null} onClose={closePedidoDialog} fullWidth maxWidth="lg">
        <DialogTitle sx={{ backgroundColor: '#160f0c', color: COLOR_GOLD, fontWeight: 800 }}>
          {pedidoDialogMode === 'edit' ? 'Editar pedido' : 'Nuevo pedido'}
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#160f0c', pt: 3 }}>
          <Stack spacing={3}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                gap: 2,
              }}
            >
              {isTakeoutMode ? null : (
                <TextField
                  label="Código"
                  value={pedidoForm.codigo}
                  onChange={(event) => setPedidoForm((current) => ({ ...current, codigo: event.target.value }))}
                  fullWidth
                  sx={{
                    '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                    '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                  }}
                />
              )}

              {isTakeoutMode ? (
                <TextField
                  label="Tipo"
                  value="LLEVAR"
                  fullWidth
                  disabled
                  sx={{
                    '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                    '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                  }}
                />
              ) : (
                <TextField
                  select
                  label="Tipo"
                  value={pedidoForm.tipo}
                  onChange={(event) =>
                    setPedidoForm((current) => ({
                      ...current,
                      tipo: normalizeOrderType(event.target.value),
                      mesaId: event.target.value === 'LLEVAR' ? '' : current.mesaId,
                    }))
                  }
                  fullWidth
                  sx={{
                    '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                    '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                  }}
                >
                  {ORDER_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </TextField>
              )}

              <TextField
                select
                label="Estado"
                value={pedidoForm.estado}
                onChange={(event) =>
                  setPedidoForm((current) => ({ ...current, estado: normalizeOrderState(event.target.value) }))
                }
                fullWidth
                sx={{
                  '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                  '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                }}
              >
                {ORDER_STATES.map((state) => (
                  <MenuItem key={state} value={state}>
                    {state}
                  </MenuItem>
                ))}
              </TextField>

              {(isTakeoutMode || pedidoForm.tipo === 'LLEVAR') ? (
                <>
                  <TextField
                    label="Nombre del cliente"
                    value={pedidoForm.clienteNombre}
                    onChange={(event) =>
                      setPedidoForm((current) => ({
                        ...current,
                        clienteId: '',
                        clienteNombre: event.target.value,
                      }))
                    }
                    onBlur={() => {
                      const localClient = tryResolveLocalClientByName(pedidoForm.clienteNombre)
                      if (localClient) {
                        linkClientToPedidoForm(localClient)
                      }
                    }}
                    fullWidth
                    sx={{
                      '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                      '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                    }}
                  />

                  <TextField
                    label="Teléfono del cliente"
                    value={pedidoForm.clienteTelefono}
                    onChange={(event) =>
                      setPedidoForm((current) => ({
                        ...current,
                        clienteTelefono: event.target.value,
                      }))
                    }
                    fullWidth
                    sx={{
                      '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                      '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                    }}
                  />

                  <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => {
                        void (async () => {
                          const foundByName = await searchClientByName(pedidoForm.clienteNombre)
                          const found = foundByName ?? (pedidoForm.clienteTelefono.trim()
                            ? await searchClientByPhone(pedidoForm.clienteTelefono)
                            : null)
                          const resolved = found ?? await searchClientInsensitive(pedidoForm.clienteNombre, pedidoForm.clienteTelefono)
                          if (resolved) {
                            linkClientToPedidoForm(resolved)
                            toast.success('Cliente encontrado y cargado.')
                          } else {
                            toast.info('Cliente no encontrado. Se creara al guardar el pedido.')
                          }
                        })()
                      }}
                      sx={{ color: COLOR_GOLD, borderColor: 'rgba(212,175,55,0.45)' }}
                    >
                      Buscar cliente
                    </Button>
                    {pedidoForm.clienteId ? (
                      <Typography variant="caption" sx={{ color: COLOR_MUTED }}>
                        Cliente vinculado #{pedidoForm.clienteId}
                      </Typography>
                    ) : null}
                  </Stack>
                </>
              ) : null}

              {isTakeoutMode && currentRole !== 'ADMIN' ? null : (
                <TextField
                  select
                  label="Usuario"
                  value={pedidoForm.usuarioId}
                  onChange={(event) => setPedidoForm((current) => ({ ...current, usuarioId: event.target.value }))}
                  fullWidth
                  sx={{
                    '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                    '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                  }}
                >
                  <MenuItem value="">Selecciona un usuario</MenuItem>
                  {users.map((user) => (
                    <MenuItem key={user.id} value={user.id}>
                      {getUserDisplayName(user)}
                    </MenuItem>
                  ))}
                </TextField>
              )}

              {pedidoForm.tipo === 'MESA' && !isTakeoutMode ? (
                <TextField
                  select
                  label="Mesa"
                  value={pedidoForm.mesaId}
                  onChange={(event) => setPedidoForm((current) => ({ ...current, mesaId: event.target.value }))}
                  fullWidth
                  sx={{
                    '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                    '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                  }}
                >
                  <MenuItem value="">Selecciona una mesa activa</MenuItem>
                  {activeMesas.map((mesa) => (
                    <MenuItem key={mesa.id} value={mesa.id}>
                      {getMesaDisplayName(mesa)} {reservadaByMesa[mesa.id] ? '• Reservada' : '• Disponible'}
                    </MenuItem>
                  ))}
                </TextField>
              ) : (
                <TextField
                  label="Mesa"
                  value="Llevar"
                  fullWidth
                  disabled
                  sx={{
                    '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                    '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                  }}
                />
              )}

              {isTakeoutMode ? null : (
                <TextField
                  label="Impuesto"
                  value={pedidoForm.impuesto}
                  onChange={(event) => setPedidoForm((current) => ({ ...current, impuesto: event.target.value }))}
                  type="number"
                  fullWidth
                  sx={{
                    '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                    '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                  }}
                />
              )}
            </Box>

            <Divider sx={{ borderColor: 'rgba(212,175,55,0.18)' }} />

            {pedidoDialogMode === 'create' ? (
              <Stack spacing={2}>
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography sx={{ color: COLOR_GOLD, fontWeight: 700 }}>Detalle inicial</Typography>
                    <Typography sx={{ color: COLOR_MUTED, fontSize: '0.92rem' }}>
                      Agrega las líneas base del pedido antes de enviarlo a cocina.
                    </Typography>
                  </Box>
                  <Button
                    startIcon={<AddIcon />}
                    onClick={addPedidoLine}
                    sx={{ color: COLOR_GOLD, borderColor: 'rgba(212,175,55,0.45)' }}
                    variant="outlined"
                  >
                    Agregar línea
                  </Button>
                </Stack>

                <Stack spacing={2}>
                  {pedidoForm.detalles.map((line, index) => {
                    const matchedProduct = products.find((product) => String(product.id) === line.productoId)
                    const matchedProductName = line.productoNombre || matchedProduct?.nombre || (line.productoId ? `#${line.productoId}` : '')

                    return (
                    <Paper
                      key={`line-${index}`}
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(212,175,55,0.16)',
                      }}
                    >
                      <Stack spacing={2}>
                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: {
                              xs: '1fr',
                              md: isTakeoutMode ? 'repeat(5, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
                            },
                            gap: 2,
                          }}
                        >
                          {isTakeoutMode ? (
                            <>
                              <TextField
                                label="Código o nombre"
                                value={line.codigoProducto}
                                onChange={(event) => applyProductCodeToLine(index, event.target.value)}
                                helperText="Escribe código o nombre para autocompletar producto y precio."
                                fullWidth
                                sx={{
                                  '& .MuiFormHelperText-root': { color: COLOR_MUTED },
                                  '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                                  '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                                }}
                              />
                              <TextField
                                label="Producto"
                                value={matchedProductName}
                                fullWidth
                                disabled
                                sx={{
                                  '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                                  '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                                  '& .MuiInputBase-input.Mui-disabled': {
                                    color: COLOR_TEXT,
                                    WebkitTextFillColor: COLOR_TEXT,
                                  },
                                }}
                              />
                            </>
                          ) : products.length > 0 ? (
                            <TextField
                              select
                              label="Producto"
                              value={line.productoId}
                              onChange={(event) => applyProductSelectionToLine(index, event.target.value)}
                              fullWidth
                              slotProps={{
                                select: {
                                  MenuProps: {
                                    slotProps: {
                                      paper: {
                                        sx: {
                                          backgroundColor: '#1b120e',
                                          color: COLOR_TEXT,
                                          border: '1px solid rgba(212,175,55,0.28)',
                                        },
                                      },
                                    },
                                  },
                                },
                              }}
                              sx={{
                                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                                '& .MuiOutlinedInput-root': { color: COLOR_TEXT, backgroundColor: 'rgba(255,255,255,0.03)' },
                              }}
                            >
                              <MenuItem value="">Selecciona un producto</MenuItem>
                              {products.map((product) => (
                                <MenuItem key={product.id} value={product.id}>
                                  {getProductDisplayName(product)}
                                </MenuItem>
                              ))}
                            </TextField>
                          ) : (
                            <TextField
                              label="Producto ID"
                              value={line.productoId}
                              onChange={(event) => updatePedidoLine(index, { productoId: event.target.value })}
                              type="number"
                              sx={{
                                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                                '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                              }}
                            />
                          )}
                          <TextField
                            label="Cantidad"
                            value={line.cantidad}
                            onChange={(event) => updatePedidoLine(index, { cantidad: event.target.value })}
                            type="number"
                            sx={{
                              '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                              '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                            }}
                          />
                          <TextField
                            label="Observación"
                            value={line.observacion}
                            onChange={(event) => updatePedidoLine(index, { observacion: event.target.value })}
                            sx={{
                              '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                              '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                            }}
                          />
                        </Box>
                        <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
                          <Button
                            color="error"
                            onClick={() => removePedidoLine(index)}
                            disabled={pedidoForm.detalles.length === 1}
                          >
                            Quitar línea
                          </Button>
                        </Stack>
                      </Stack>
                    </Paper>
                    )
                  })}
                </Stack>
              </Stack>
            ) : (
              <Alert severity="info">
                En la edición se ajusta la cabecera del pedido. Las líneas se administran desde el panel de detalle.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#160f0c', p: 2.5 }}>
          <Button onClick={closePedidoDialog} sx={{ color: COLOR_TEXT }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleSavePedido()}
            disabled={saving}
            sx={{ backgroundColor: COLOR_MAROON, '&:hover': { backgroundColor: '#a42535' } }}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={detailsOpen} onClose={closeDetailsDialog} fullWidth maxWidth="lg">
        <DialogTitle sx={{ backgroundColor: '#160f0c', color: COLOR_GOLD, fontWeight: 800 }}>
          Detalle del pedido {selectedPedido ? selectedPedido.codigo ?? `#${selectedPedido.id}` : ''}
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#160f0c', pt: 3 }}>
          {loadingDetails ? (
            <Box sx={{ py: 8, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress sx={{ color: COLOR_GOLD }} />
            </Box>
          ) : selectedPedido ? (
            <Stack spacing={3}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
                  gap: 2,
                }}
              >
                {[
                  { label: 'Código', value: selectedPedido.codigo ?? `#${selectedPedido.id}` },
                  { label: 'Mesa', value: getPedidoMesaLabel(selectedPedido) },
                  {
                    label: 'Cliente',
                    value: `${getPedidoClienteNombre(selectedPedido)} • ${getPedidoClienteTelefono(selectedPedido)}`,
                  },
                  { label: 'Total', value: formatCurrency(selectedPedido.total ?? 0) },
                  { label: 'Saldo pendiente', value: formatCurrency(detailBalance) },
                ].map((item) => (
                  <Paper
                    key={item.label}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(212,175,55,0.16)',
                    }}
                  >
                    <Typography sx={{ color: COLOR_MUTED, fontSize: '0.86rem' }}>{item.label}</Typography>
                    <Typography sx={{ color: COLOR_TEXT, fontWeight: 700, mt: 0.4 }}>{item.value}</Typography>
                  </Paper>
                ))}
              </Box>

              <Paper
                sx={{
                  p: 2,
                  borderRadius: 2,
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(212,175,55,0.16)',
                }}
              >
                <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography sx={{ color: COLOR_GOLD, fontWeight: 700 }}>Detalle del pedido</Typography>
                  <Button startIcon={<AddIcon />} variant="outlined" onClick={openCreateDetailDialog} sx={{ color: COLOR_GOLD }}>
                    Agregar línea
                  </Button>
                </Stack>

                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: COLOR_GOLD }}>Producto</TableCell>
                      <TableCell sx={{ color: COLOR_GOLD }}>Cantidad</TableCell>
                      <TableCell sx={{ color: COLOR_GOLD }}>Precio</TableCell>
                      <TableCell sx={{ color: COLOR_GOLD }}>Subtotal</TableCell>
                      <TableCell sx={{ color: COLOR_GOLD }}>Observación</TableCell>
                      <TableCell sx={{ color: COLOR_GOLD }} align="right">
                        Acciones
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {currentDetails.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} sx={{ color: COLOR_MUTED }}>
                          No hay líneas registradas.
                        </TableCell>
                      </TableRow>
                    ) : (
                      currentDetails.map((detail) => {
                        const matchedProduct = products.find((product) => product.id === detail.productoId)
                        const productLabel =
                          detail.producto?.nombre ??
                          detail.productoNombre ??
                          matchedProduct?.nombre ??
                          'Producto'

                        return (
                        <TableRow key={detail.id}>
                          <TableCell sx={{ color: COLOR_TEXT }}>
                            {productLabel}
                          </TableCell>
                          <TableCell sx={{ color: COLOR_TEXT }}>{detail.cantidad}</TableCell>
                          <TableCell sx={{ color: COLOR_TEXT }}>{formatCurrency(detail.precioUnitario)}</TableCell>
                          <TableCell sx={{ color: COLOR_TEXT }}>
                            {formatCurrency(detail.subtotal ?? detail.precioUnitario * detail.cantidad)}
                          </TableCell>
                          <TableCell sx={{ color: COLOR_MUTED }}>{detail.observacion || 'Sin observación'}</TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                              <IconButton onClick={() => openEditDetailDialog(detail)} sx={{ color: COLOR_GOLD }}>
                                <EditIcon />
                              </IconButton>
                              <IconButton onClick={() => void handleDeleteDetail(detail)} sx={{ color: '#f39ca8' }} disabled={!canManageSelectedPedido}>
                                <DeleteIcon />
                              </IconButton>
                            </Stack>
                          </TableCell>
                        </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </Paper>

              <Paper
                sx={{
                  p: 2,
                  borderRadius: 2,
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(212,175,55,0.16)',
                }}
              >
                <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography sx={{ color: COLOR_GOLD, fontWeight: 700 }}>Pagos</Typography>
                  <Button startIcon={<AttachMoneyIcon />} variant="outlined" onClick={openCreatePaymentDialog} sx={{ color: COLOR_GOLD }} disabled={!canManageSelectedPedido}>
                    Registrar pago
                  </Button>
                </Stack>

                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: COLOR_GOLD }}>Método</TableCell>
                      <TableCell sx={{ color: COLOR_GOLD }}>Monto</TableCell>
                      <TableCell sx={{ color: COLOR_GOLD }}>Referencia</TableCell>
                      <TableCell sx={{ color: COLOR_GOLD }} align="right">
                        Acciones
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {currentPayments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} sx={{ color: COLOR_MUTED }}>
                          No hay pagos registrados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      currentPayments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell sx={{ color: COLOR_TEXT }}>
                            {payment.metodoPago?.nombre ?? `Método #${payment.metodoPagoId}`}
                          </TableCell>
                          <TableCell sx={{ color: COLOR_TEXT }}>{formatCurrency(payment.monto)}</TableCell>
                          <TableCell sx={{ color: COLOR_MUTED }}>{payment.referencia || 'Sin referencia'}</TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                              <IconButton onClick={() => openEditPaymentDialog(payment)} sx={{ color: COLOR_GOLD }}>
                                <EditIcon />
                              </IconButton>
                              <IconButton onClick={() => void handleDeletePayment(payment)} sx={{ color: '#f39ca8' }} disabled={!canManageSelectedPedido}>
                                <DeleteIcon />
                              </IconButton>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Paper>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#160f0c', p: 2.5 }}>
          {selectedPedido ? (
            <Button
              variant="outlined"
              onClick={() => void handleSendToKitchenFromDetails()}
              disabled={saving || loadingDetails || currentDetails.length === 0 || !canManageSelectedPedido}
              sx={{ color: COLOR_GOLD, borderColor: 'rgba(212,175,55,0.35)' }}
            >
              Enviar a cocina
            </Button>
          ) : null}
          {selectedPedido ? (
            <Button
              variant="outlined"
              onClick={openInvoicePreview}
              disabled={saving || loadingDetails || currentDetails.length === 0 || !canManageSelectedPedido}
              sx={{ color: COLOR_TEXT, borderColor: 'rgba(243,233,210,0.35)' }}
            >
              Facturar
            </Button>
          ) : null}
          <Button onClick={closeDetailsDialog} sx={{ color: COLOR_TEXT }}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

        <FacturacionModal
          open={invoicePreviewOpen}
          pedidoId={resolveSelectedPedidoId()}
          pedidoFallback={invoicePreviewPedido}
          detailsFallback={invoicePreviewDetails}
          onClose={() => {
            if (!saving) {
              setInvoicePreviewOpen(false)
            }
          }}
          onFacturado={async () => {
            await loadPedidos()

            const pedidoId = toPositiveNumber(invoicePreviewPedido?.id)
            if (pedidoId) {
              const match = pedidos.find((item) => item.id === pedidoId) ?? invoicePreviewPedido
              if (match) {
                await openDetailsDialog(match)
              }
            }

            setInvoicePreviewPedido(null)
            setInvoicePreviewDetails([])
          }}
        />

      <Dialog open={detailDialogOpen} onClose={() => setDetailDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ backgroundColor: '#160f0c', color: COLOR_GOLD, fontWeight: 800 }}>
          {editingDetailId !== null ? 'Editar línea' : 'Nueva línea'}
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#160f0c', pt: 3 }}>
          <Stack spacing={2}>
            {products.length > 0 ? (
              <TextField
                select
                label="Producto"
                value={detailForm.productoId}
                onChange={(event) => {
                  const product = products.find((item) => String(item.id) === event.target.value)
                  setDetailForm((current) => ({
                    ...current,
                    productoId: event.target.value,
                    precioUnitario: product ? String(product.precio) : current.precioUnitario,
                  }))
                }}
                fullWidth
                sx={{
                  '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                  '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                }}
              >
                <MenuItem value="">Selecciona un producto</MenuItem>
                {products.map((product) => (
                  <MenuItem key={product.id} value={product.id}>
                    {getProductDisplayName(product)}
                  </MenuItem>
                ))}
              </TextField>
            ) : (
              <TextField
                label="Producto ID"
                value={detailForm.productoId}
                onChange={(event) => setDetailForm((current) => ({ ...current, productoId: event.target.value }))}
                type="number"
                fullWidth
                sx={{
                  '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                  '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
                }}
              />
            )}
            <TextField
              label="Cantidad"
              value={detailForm.cantidad}
              onChange={(event) => setDetailForm((current) => ({ ...current, cantidad: event.target.value }))}
              type="number"
              fullWidth
              sx={{
                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
              }}
            />
            <TextField
              label="Observación"
              value={detailForm.observacion}
              onChange={(event) => setDetailForm((current) => ({ ...current, observacion: event.target.value }))}
              fullWidth
              multiline
              minRows={3}
              sx={{
                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#160f0c', p: 2.5 }}>
          <Button onClick={() => setDetailDialogOpen(false)} sx={{ color: COLOR_TEXT }}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={() => void handleSaveDetail()} disabled={saving || !canManageSelectedPedido} sx={{ backgroundColor: COLOR_MAROON }}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={paymentDialogOpen} onClose={() => setPaymentDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ backgroundColor: '#160f0c', color: COLOR_GOLD, fontWeight: 800 }}>
          {editingPaymentId !== null ? 'Editar pago' : 'Registrar pago'}
        </DialogTitle>
        <DialogContent sx={{ backgroundColor: '#160f0c', pt: 3 }}>
          <Stack spacing={2}>
            <TextField
              select
              label="Método de pago"
              value={paymentForm.metodoPagoId}
              onChange={(event) => setPaymentForm((current) => ({ ...current, metodoPagoId: event.target.value }))}
              fullWidth
              sx={{
                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
              }}
            >
              <MenuItem value="">Selecciona un método</MenuItem>
              {paymentMethods.map((method) => (
                <MenuItem key={method.id} value={method.id}>
                  {method.nombre}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Monto"
              value={paymentForm.monto}
              onChange={(event) => setPaymentForm((current) => ({ ...current, monto: event.target.value }))}
              type="number"
              fullWidth
              sx={{
                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
              }}
            />
            <TextField
              label="Referencia"
              value={paymentForm.referencia}
              onChange={(event) => setPaymentForm((current) => ({ ...current, referencia: event.target.value }))}
              fullWidth
              sx={{
                '& .MuiInputLabel-root, & .MuiInputBase-input': { color: COLOR_TEXT },
                '& .MuiOutlinedInput-root': { color: COLOR_TEXT },
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: '#160f0c', p: 2.5 }}>
          <Button onClick={() => setPaymentDialogOpen(false)} sx={{ color: COLOR_TEXT }}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={() => void handleSavePayment()} disabled={saving || !canManageSelectedPedido} sx={{ backgroundColor: COLOR_MAROON }}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
