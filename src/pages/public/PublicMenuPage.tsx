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
  Container,
  Divider,
  Stack,
  Typography,
} from '@mui/material'
import RestaurantIcon from '@mui/icons-material/Restaurant'
import EmojiFoodBeverageIcon from '@mui/icons-material/EmojiFoodBeverage'
import StarIcon from '@mui/icons-material/Star'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk'
import RateReviewIcon from '@mui/icons-material/RateReview'
import CampaignIcon from '@mui/icons-material/Campaign'
import InstagramIcon from '@mui/icons-material/Instagram'
import FacebookIcon from '@mui/icons-material/Facebook'
import FmdGoodIcon from '@mui/icons-material/FmdGood'
import PlaceIcon from '@mui/icons-material/Place'
import { Link as RouterLink } from 'react-router-dom'
import { menuService } from '@/services/menu.service'
import { platoDelMesService } from '@/services/plato-del-mes.service'
import { announcementsService } from '@/services/announcements.service'
import {
  normalizeRestaurantConfigListPayload,
  normalizeRestaurantConfigPayload,
  restaurantConfigService,
} from '@/services/configuracion-restaurante.service'
import type { Category, Product, DishOfMonth } from '@/types/menu.types'
import type { Announcement, AnnouncementType } from '@/types/announcement.types'
import type { RestaurantConfig } from '@/types/configuracion-restaurante.types'
import logoImage from '@/assets/logo.png'

const COLOR_GOLD = '#D4AF37'
const COLOR_BLACK = '#070707'
const COLOR_TEXT = '#f3efe6'
const COLOR_TEXT_SOFT = '#fff8e8'
const COLOR_TEXT_MUTED = '#e8dcc0'

const crcFormatter = new Intl.NumberFormat('es-CR', {
  style: 'currency',
  currency: 'CRC',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const LOGO_URL = logoImage

const DEFAULT_RESTAURANT_CONFIG: RestaurantConfig = {
  nombre: '',
  telefono: '',
  whatsapp: '',
  direccion: '',
  horario: '',
}

function normalizeExternalUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) {
    return undefined
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  return `https://${trimmed}`
}

function buildWhatsappUrl(value: string | undefined): string | undefined {
  const digits = (value ?? '').replace(/\D/g, '')
  if (!digits) {
    return undefined
  }

  return `https://wa.me/${digits}`
}

function buildPhoneHref(value: string | undefined): string | undefined {
  const raw = (value ?? '').trim()
  if (!raw) {
    return undefined
  }

  const sanitized = raw.replace(/[^\d+]/g, '')
  if (!sanitized) {
    return undefined
  }

  return `tel:${sanitized}`
}

function buildScheduleRows(horario: string | undefined): Array<{ day: string; hours: string }> {
  const trimmed = horario?.trim()
  if (!trimmed) {
    return []
  }

  const normalized = trimmed.replace(/\s*,\s*/g, '\n')
  const parts = normalized.split(/\s*(?:\||;|\n)\s*/).filter(Boolean)

  return parts.map((rawEntry) => {
    const entry = rawEntry.trim()

    const closedMatch = entry.match(/^(.*?)(cerrado|closed)$/i)
    if (closedMatch) {
      return {
        day: closedMatch[1].trim().replace(/[,:-]+$/, '') || 'Horario',
        hours: closedMatch[2].toUpperCase(),
      }
    }

    const firstDigitIndex = entry.search(/\d/)
    if (firstDigitIndex > 0) {
      const day = entry.slice(0, firstDigitIndex).trim().replace(/[,:-]+$/, '')
      const hours = entry.slice(firstDigitIndex).trim()

      return {
        day: day || 'Horario',
        hours,
      }
    }

    return {
      day: 'Horario',
      hours: entry,
    }
  })
}

function formatCRC(value: number): string {
  if (!Number.isFinite(value)) {
    return '₡0'
  }

  return crcFormatter.format(value)
}

function toPositiveNumber(value: unknown): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }
  return parsed
}

function normalizeAnnouncementType(value: unknown): AnnouncementType | undefined {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : ''

  if (raw === 'INFO' || raw === 'AVISO') {
    return 'INFORMATIVO'
  }

  if (raw === 'PROMOCION' || raw === 'EVENTO' || raw === 'INFORMATIVO' || raw === 'PLATO_DEL_DIA') {
    return raw
  }

  return undefined
}

function isAnnouncementActive(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true
  }

  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return value === 1
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === '1' || normalized === 'true' || normalized === 'activo' || normalized === 'active'
  }

  return false
}

function toActiveFlag(value: unknown): number {
  if (typeof value === 'boolean') {
    return value ? 1 : 0
  }

  if (typeof value === 'number') {
    return value === 1 ? 1 : 0
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (
      normalized === '1' ||
      normalized === 'true' ||
      normalized === 'activo' ||
      normalized === 'activa' ||
      normalized === 'active' ||
      normalized === 'publicado' ||
      normalized === 'published'
    ) {
      return 1
    }
    return 0
  }

  return 0
}

function extractBackendMessage(payload: unknown): string {
  if (typeof payload === 'string') {
    return payload
  }

  if (typeof payload !== 'object' || payload === null) {
    return ''
  }

  const data = payload as {
    message?: unknown
    error?: unknown
    errors?: unknown
  }

  if (typeof data.message === 'string') {
    return data.message
  }

  if (Array.isArray(data.message)) {
    return data.message.map((item) => String(item)).join(' | ')
  }

  if (typeof data.error === 'string') {
    return data.error
  }

  if (Array.isArray(data.errors)) {
    return data.errors.map((item) => String(item)).join(' | ')
  }

  return ''
}

function normalizeCategoriesPayload(payload: unknown): Category[] {
  if (Array.isArray(payload)) {
    const normalized: Category[] = []

    payload.forEach((item) => {
      if (typeof item !== 'object' || item === null) {
        return
      }

      const record = item as Record<string, unknown>
      const id = toPositiveNumber(record.id ?? record.categoryId ?? record.category_id)
      if (id === null) {
        return
      }

      const nombreValue = record.nombre ?? record.name ?? ''

      normalized.push({
        id,
        nombre: typeof nombreValue === 'string' ? nombreValue : String(nombreValue),
        descripcion:
          typeof record.descripcion === 'string'
            ? record.descripcion
            : typeof record.description === 'string'
              ? record.description
              : undefined,
      })
    })

    return normalized
  }

  if (typeof payload === 'object' && payload !== null) {
    const container = payload as {
      data?: unknown
      items?: unknown
      categories?: unknown
      categorias?: unknown
    }

    if (container.data) {
      return normalizeCategoriesPayload(container.data)
    }

    if (container.items) {
      return normalizeCategoriesPayload(container.items)
    }

    if (container.categories) {
      return normalizeCategoriesPayload(container.categories)
    }

    if (container.categorias) {
      return normalizeCategoriesPayload(container.categorias)
    }
  }

  return []
}

function normalizeProductsPayload(payload: unknown): Product[] {
  if (Array.isArray(payload)) {
    const normalized: Product[] = []

    payload.forEach((item) => {
      if (typeof item !== 'object' || item === null) {
        return
      }

      const record = item as Record<string, unknown>
      const id = toPositiveNumber(record.id ?? record.productId ?? record.product_id)
      if (id === null) {
        return
      }

      const nestedCategoryRecord =
        typeof record.category === 'object' && record.category !== null
          ? (record.category as Record<string, unknown>)
          : typeof record.categoria === 'object' && record.categoria !== null
            ? (record.categoria as Record<string, unknown>)
            : null

      const categoryId =
        toPositiveNumber(
          record.categoryId ??
            record.category_id ??
            record.categoriaId ??
            record.categoria_id ??
            nestedCategoryRecord?.id,
        ) ?? 0

      const nombreValue = record.nombre ?? record.name ?? 'Producto'
      const descripcionValue = record.descripcion ?? record.description ?? ''
      const precioValue = Number(record.precio ?? record.price ?? 0)

      normalized.push({
        id,
        nombre: typeof nombreValue === 'string' ? nombreValue : String(nombreValue),
        descripcion:
          typeof descripcionValue === 'string' ? descripcionValue : String(descripcionValue),
        precio: Number.isFinite(precioValue) ? precioValue : 0,
        imagen:
          typeof record.imagen === 'string'
            ? record.imagen
            : typeof record.image === 'string'
              ? record.image
              : undefined,
        categoryId,
        category: nestedCategoryRecord
          ? {
              id: toPositiveNumber(nestedCategoryRecord.id) ?? categoryId,
              nombre:
                typeof nestedCategoryRecord.nombre === 'string'
                  ? nestedCategoryRecord.nombre
                  : typeof nestedCategoryRecord.name === 'string'
                    ? nestedCategoryRecord.name
                    : 'Categoría',
              descripcion:
                typeof nestedCategoryRecord.descripcion === 'string'
                  ? nestedCategoryRecord.descripcion
                  : typeof nestedCategoryRecord.description === 'string'
                    ? nestedCategoryRecord.description
                    : undefined,
            }
          : undefined,
        disponible:
          typeof record.disponible === 'boolean'
            ? record.disponible
            : typeof record.available === 'boolean'
              ? record.available
              : typeof record.activo === 'boolean'
                ? record.activo
                : true,
      })
    })

    return normalized
  }

  if (typeof payload === 'object' && payload !== null) {
    const container = payload as {
      data?: unknown
      items?: unknown
      products?: unknown
      productos?: unknown
    }

    if (container.data) {
      return normalizeProductsPayload(container.data)
    }

    if (container.items) {
      return normalizeProductsPayload(container.items)
    }

    if (container.products) {
      return normalizeProductsPayload(container.products)
    }

    if (container.productos) {
      return normalizeProductsPayload(container.productos)
    }
  }

  return []
}

function normalizeDish(item: unknown): DishOfMonth | null {
  if (typeof item !== 'object' || item === null) {
    return null
  }

  const record = item as Record<string, unknown>
  const id = toPositiveNumber(record.id ?? record.dishOfMonthId ?? record.dish_of_month_id)
  const productId =
    toPositiveNumber(
      record.productoId ??
        record.producto_id ??
        record.productId ??
        record.product_id ??
        record.platoId ??
        record.plato_id,
    ) ??
    0

  if (id === null) {
    return null
  }

  const productRecord =
    typeof record.product === 'object' && record.product !== null
      ? (record.product as Record<string, unknown>)
      : typeof record.plato === 'object' && record.plato !== null
        ? (record.plato as Record<string, unknown>)
        : null

  return {
    id,
    productId,
    productoId:
      toPositiveNumber(record.productoId ?? record.producto_id ?? record.productId ?? record.product_id) ??
      undefined,
    product: productRecord
      ? {
          id: toPositiveNumber(productRecord.id) ?? productId,
          codigo:
            typeof productRecord.codigo === 'string'
              ? productRecord.codigo
              : typeof productRecord.code === 'string'
                ? productRecord.code
                : undefined,
          nombre:
            typeof productRecord.nombre === 'string'
              ? productRecord.nombre
              : typeof productRecord.name === 'string'
                ? productRecord.name
                : 'Plato especial',
          descripcion:
            typeof productRecord.descripcion === 'string'
              ? productRecord.descripcion
              : typeof productRecord.description === 'string'
                ? productRecord.description
                : '',
          precio: Number(productRecord.precio ?? productRecord.price ?? 0) || 0,
          imagen:
            typeof productRecord.imagen === 'string'
              ? productRecord.imagen
              : typeof productRecord.image === 'string'
                ? productRecord.image
                : undefined,
          categoryId:
            toPositiveNumber(
              productRecord.categoryId ??
                productRecord.category_id ??
                productRecord.categoriaId ??
                productRecord.categoria_id,
            ) ?? 0,
          disponible:
            typeof productRecord.disponible === 'boolean'
              ? productRecord.disponible
              : typeof productRecord.available === 'boolean'
                ? productRecord.available
                : true,
        }
      : undefined,
    descripcionEspecial:
      typeof record.descripcionEspecial === 'string'
        ? record.descripcionEspecial
        : typeof record.descripcion === 'string'
          ? record.descripcion
          : typeof record.description === 'string'
            ? record.description
            : undefined,
    activo:
      typeof record.activo === 'boolean'
        ? record.activo
        : typeof record.active === 'boolean'
          ? record.active
          : undefined,
    fechaInicio:
      typeof record.fechaInicio === 'string'
        ? record.fechaInicio
        : typeof record.fecha_inicio === 'string'
          ? record.fecha_inicio
          : typeof record.startDate === 'string'
            ? record.startDate
            : undefined,
    fechaFin:
      typeof record.fechaFin === 'string'
        ? record.fechaFin
        : typeof record.fecha_fin === 'string'
          ? record.fecha_fin
          : typeof record.endDate === 'string'
            ? record.endDate
            : undefined,
    mes: toPositiveNumber(record.mes ?? record.month) ?? undefined,
    anio: toPositiveNumber(record.anio ?? record.year) ?? undefined,
  }
}

function normalizeDishPayload(payload: unknown): DishOfMonth | null {
  const single = normalizeDish(payload)
  if (single) {
    return single
  }

  if (typeof payload === 'object' && payload !== null) {
    const container = payload as {
      data?: unknown
      item?: unknown
      current?: unknown
      dishOfMonth?: unknown
      dish_of_month?: unknown
    }

    if (container.data) return normalizeDishPayload(container.data)
    if (container.item) return normalizeDishPayload(container.item)
    if (container.current) return normalizeDishPayload(container.current)
    if (container.dishOfMonth) return normalizeDishPayload(container.dishOfMonth)
    if (container.dish_of_month) return normalizeDishPayload(container.dish_of_month)
  }

  return null
}

function normalizeAnnouncement(item: unknown): Announcement | null {
  if (typeof item !== 'object' || item === null) {
    return null
  }

  const record = item as Record<string, unknown>
  const id = toPositiveNumber(record.id ?? record.announcementId ?? record.announcement_id)
  if (id === null) {
    return null
  }

  const prioridad = Number(record.prioridad ?? record.priority ?? 0)
  const activoValue =
    record.activo ??
    record.active ??
    record.isActive ??
    record.is_active ??
    record.visible ??
    record.publicado ??
    record.published ??
    0

  return {
    id,
    titulo:
      typeof record.titulo === 'string'
        ? record.titulo
        : typeof record.title === 'string'
          ? record.title
          : `Anuncio #${id}`,
    descripcion:
      typeof record.descripcion === 'string'
        ? record.descripcion
        : typeof record.description === 'string'
          ? record.description
          : undefined,
    imagen:
      typeof record.imagen === 'string'
        ? record.imagen
        : typeof record.image === 'string'
          ? record.image
          : undefined,
    fechaInicio:
      typeof record.fechaInicio === 'string'
        ? record.fechaInicio
        : typeof record.fecha_inicio === 'string'
          ? record.fecha_inicio
          : typeof record.startDate === 'string'
            ? record.startDate
            : undefined,
    fechaFin:
      typeof record.fechaFin === 'string'
        ? record.fechaFin
        : typeof record.fecha_fin === 'string'
          ? record.fecha_fin
          : typeof record.endDate === 'string'
            ? record.endDate
            : undefined,
    horaInicio:
      typeof record.horaInicio === 'string'
        ? record.horaInicio
        : typeof record.hora_inicio === 'string'
          ? record.hora_inicio
          : typeof record.startTime === 'string'
            ? record.startTime
            : undefined,
    horaFin:
      typeof record.horaFin === 'string'
        ? record.horaFin
        : typeof record.hora_fin === 'string'
          ? record.hora_fin
          : typeof record.endTime === 'string'
            ? record.endTime
            : undefined,
    prioridad: Number.isFinite(prioridad) ? prioridad : 0,
    activo: toActiveFlag(activoValue),
    tipo:
      typeof record.tipo === 'string'
        ? normalizeAnnouncementType(record.tipo)
        : typeof record.tipoenum === 'string'
          ? normalizeAnnouncementType(record.tipoenum)
        : typeof record.type === 'string'
          ? normalizeAnnouncementType(record.type)
          : undefined,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : undefined,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
  }
}

function normalizeAnnouncementsPayload(payload: unknown): Announcement[] {
  if (Array.isArray(payload)) {
    return payload
      .map((item) => normalizeAnnouncement(item))
      .filter((item): item is Announcement => item !== null)
  }

  if (typeof payload === 'object' && payload !== null) {
    const container = payload as {
      data?: unknown
      items?: unknown
      announcements?: unknown
      anuncios?: unknown
    }

    if (container.data) return normalizeAnnouncementsPayload(container.data)
    if (container.items) return normalizeAnnouncementsPayload(container.items)
    if (container.announcements) return normalizeAnnouncementsPayload(container.announcements)
    if (container.anuncios) return normalizeAnnouncementsPayload(container.anuncios)
  }

  return []
}

function formatAnnouncementDate(value: string | undefined): string {
  if (!value) {
    return '-'
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) {
    return value
  }

  return `${match[3]}/${match[2]}/${match[1]}`
}

function formatAnnouncementTime(value: string | undefined): string {
  if (!value) {
    return '-'
  }

  const match = value.match(/^(\d{2}):(\d{2})(?::\d{2})?$/)
  if (!match) {
    return value
  }

  return `${match[1]}:${match[2]}`
}

function formatAnnouncementDateRange(start: string | undefined, end: string | undefined): string {
  const from = formatAnnouncementDate(start)
  const to = formatAnnouncementDate(end)

  if (from === '-' && to === '-') {
    return 'Sin rango de fechas'
  }

  if (from !== '-' && to !== '-') {
    return `Del ${from} al ${to}`
  }

  if (from !== '-') {
    return `Desde ${from}`
  }

  return `Hasta ${to}`
}

function formatAnnouncementTimeRange(start: string | undefined, end: string | undefined): string {
  const from = formatAnnouncementTime(start)
  const to = formatAnnouncementTime(end)

  if (from === '-' && to === '-') {
    return 'Sin rango de horas'
  }

  if (from !== '-' && to !== '-') {
    return `De ${from} a ${to}`
  }

  if (from !== '-') {
    return `Desde ${from}`
  }

  return `Hasta ${to}`
}

function getAnnouncementTypeBadge(type: AnnouncementType | undefined): {
  label: string
  border: string
  background: string
  color: string
} {
  if (type === 'EVENTO') {
    return {
      label: 'Evento',
      border: 'rgba(72, 191, 255, 0.65)',
      background: 'rgba(72, 191, 255, 0.16)',
      color: '#bde8ff',
    }
  }

  if (type === 'INFORMATIVO') {
    return {
      label: 'Informativo',
      border: 'rgba(126, 226, 170, 0.65)',
      background: 'rgba(126, 226, 170, 0.16)',
      color: '#d6ffe9',
    }
  }

  if (type === 'PLATO_DEL_DIA') {
    return {
      label: 'Plato del Dia',
      border: 'rgba(255, 158, 102, 0.75)',
      background: 'rgba(255, 158, 102, 0.17)',
      color: '#ffe1cc',
    }
  }

  return {
    label: 'Promocion',
    border: 'rgba(212,175,55,0.8)',
    background: 'rgba(212,175,55,0.15)',
    color: '#f7e4a6',
  }
}

export default function PublicMenuPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [dishOfMonth, setDishOfMonth] = useState<DishOfMonth | null>(null)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [restaurantConfig, setRestaurantConfig] = useState<RestaurantConfig | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [errorMessage, setErrorMessage] = useState<string>('')

  useEffect(() => {
    const loadPublicMenu = async () => {
      setLoading(true)

      try {
        const categoriesResponse = await menuService.getCategories()
        const normalizedCategories = normalizeCategoriesPayload(categoriesResponse.data)

        const [categoryProductsResponses, dishOfMonthResponse, announcementsResponse, restaurantConfigResponse] = await Promise.all([
          Promise.all(
            normalizedCategories.map((category) => menuService.getProductsByCategory(category.id)),
          ),
          platoDelMesService.getCurrent().catch((error) => {
            if (axios.isAxiosError(error) && error.response?.status === 404) {
              return { data: null }
            }

            throw error
          }),
          announcementsService.getCurrent().catch((error) => {
            if (axios.isAxiosError(error) && error.response?.status === 404) {
              return { data: [] }
            }

            throw error
          }),
          restaurantConfigService.getCurrent().catch((error) => {
            if (axios.isAxiosError(error) && error.response?.status === 404) {
              return { data: null }
            }

            throw error
          }),
        ])

        const mergedProducts = categoryProductsResponses.flatMap((response, index) =>
          normalizeProductsPayload(response.data).map((product) => ({
            ...product,
            categoryId: toPositiveNumber(product.categoryId) ?? normalizedCategories[index].id,
          })),
        )

        let normalizedRestaurantConfig = normalizeRestaurantConfigPayload(restaurantConfigResponse.data)
        if (!normalizedRestaurantConfig) {
          const allConfigResponse = await restaurantConfigService.getAll().catch((error) => {
            if (axios.isAxiosError(error) && error.response?.status === 404) {
              return { data: [] }
            }

            throw error
          })

          const allConfigs = normalizeRestaurantConfigListPayload(allConfigResponse.data)
          normalizedRestaurantConfig = allConfigs[0] ?? null
        }

        setCategories(normalizedCategories)
        setProducts(mergedProducts)
        setDishOfMonth(normalizeDishPayload(dishOfMonthResponse.data))
        setAnnouncements(
          normalizeAnnouncementsPayload(announcementsResponse.data)
            .filter((announcement) => isAnnouncementActive(announcement.activo))
            .sort((a, b) => (b.prioridad ?? 0) - (a.prioridad ?? 0)),
        )
        setRestaurantConfig(normalizedRestaurantConfig)
        setErrorMessage('')
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const backendMessage = extractBackendMessage(error.response?.data)
          setErrorMessage(
            backendMessage ||
              `No se pudo cargar el menú en este momento (HTTP ${error.response?.status ?? 'sin código'}).`,
          )
        } else {
          setErrorMessage('No se pudo cargar el menú en este momento.')
        }
      } finally {
        setLoading(false)
      }
    }

    loadPublicMenu()
  }, [])

  const availableProducts = useMemo(
    () => products.filter((product) => product.disponible),
    [products],
  )

  const categoryById = useMemo(() => {
    const map = new Map<number, Category>()
    categories.forEach((category) => {
      map.set(category.id, category)
    })
    return map
  }, [categories])

  const groupedProducts = useMemo(
    () =>
      categories
        .map((category) => ({
          category,
          products: availableProducts
            .filter((product) => product.categoryId === category.id)
            .sort((a, b) => a.nombre.localeCompare(b.nombre)),
        }))
        .filter((group) => group.products.length > 0),
    [categories, availableProducts],
  )

  const uncategorizedProducts = useMemo(
    () =>
      availableProducts
        .filter((product) => !categoryById.has(product.categoryId))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [availableProducts, categoryById],
  )

  const featuredDishes = useMemo(() => {
    return [...availableProducts]
      .sort((a, b) => b.precio - a.precio)
      .slice(0, 3)
      .map((product, index) => ({
        id: product.id,
        name: product.nombre,
        description: product.descripcion,
        price: formatCRC(product.precio),
        badge: index === 0 ? 'Chef Selection' : index === 1 ? 'Favorito' : 'Especial',
      }))
  }, [availableProducts])

  const totalVisibleProducts = groupedProducts.reduce((sum, group) => sum + group.products.length, 0) + uncategorizedProducts.length

  const dishProduct =
    dishOfMonth?.product ??
    (dishOfMonth ? products.find((product) => product.id === dishOfMonth.productId) : undefined)

  const effectiveConfig = restaurantConfig ?? DEFAULT_RESTAURANT_CONFIG
  const restaurantName = effectiveConfig.nombre || 'Restaurante'
  const scheduleRows = buildScheduleRows(effectiveConfig.horario)
  const openingHoursChipLabel = scheduleRows.length > 0
    ? `${scheduleRows[0].day} ${scheduleRows[0].hours}`
    : (effectiveConfig.horario || 'Horario no configurado')
  const whatsappUrl = buildWhatsappUrl(effectiveConfig.whatsapp)
  const phoneHref = buildPhoneHref(effectiveConfig.telefono)
  const instagramUrl = normalizeExternalUrl(effectiveConfig.instagramUrl)
  const facebookUrl = normalizeExternalUrl(effectiveConfig.facebookUrl)
  const tripadvisorUrl = normalizeExternalUrl(effectiveConfig.tripadvisorUrl)
  const googleMapsUrl = normalizeExternalUrl(effectiveConfig.googleMapsUrl)

  return (
    <Box
      sx={{
        minHeight: '100vh',
        color: COLOR_TEXT,
        backgroundColor: COLOR_BLACK,
        backgroundImage: `
          radial-gradient(circle at 10% 10%, rgba(212, 175, 55, 0.12) 0%, transparent 28%),
          radial-gradient(circle at 90% 15%, rgba(107, 20, 37, 0.25) 0%, transparent 30%),
          radial-gradient(circle at 20% 85%, rgba(107, 20, 37, 0.2) 0%, transparent 34%),
          linear-gradient(180deg, #050505 0%, #0a0a0a 100%)
        `,
        position: 'relative',
        overflow: 'hidden',
        '& .MuiTypography-root': {
          color: COLOR_TEXT_SOFT,
        },
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          opacity: 0.16,
          pointerEvents: 'none',
          backgroundImage: `
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'%3E%3Cg fill='none' stroke='%23D4AF37' stroke-width='1.4' opacity='0.55'%3E%3Ccircle cx='35' cy='42' r='14'/%3E%3Cpath d='M70 38q10-8 20 0q-10 8-20 0z'/%3E%3Crect x='112' y='30' width='26' height='18' rx='4'/%3E%3Cpath d='M25 118q15-16 30 0'/%3E%3Cpath d='M80 115l8-20l8 20z'/%3E%3Ccircle cx='130' cy='118' r='10'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '180px 180px',
        }}
      />

      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1, py: { xs: 4, md: 6 } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{
            mb: 5,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Stack direction="row" spacing={1.2} sx={{ alignItems: 'center' }}>
            <EmojiFoodBeverageIcon sx={{ color: COLOR_GOLD }} />
            <Typography
              sx={{
                fontFamily: '"Playfair Display", serif',
                letterSpacing: '1px',
                fontSize: { xs: '1.2rem', md: '1.4rem' },
                color: COLOR_TEXT_SOFT,
              }}
            >
              {restaurantName}
            </Typography>
          </Stack>

          <Button
            component={RouterLink}
            to="/login"
            variant="outlined"
            sx={{
              borderColor: COLOR_GOLD,
              color: COLOR_GOLD,
              fontFamily: '"Cormorant Garamond", serif',
              letterSpacing: '0.8px',
              px: 2.5,
              '&:hover': {
                borderColor: COLOR_GOLD,
                backgroundColor: 'rgba(212,175,55,0.08)',
              },
            }}
          >
            Acceso Staff
          </Button>
        </Stack>

        <Card
          sx={{
            border: `1.5px solid ${COLOR_GOLD}`,
            borderRadius: 4,
            background: 'rgba(12, 12, 12, 0.44)',
            backdropFilter: 'blur(22px)',
            WebkitBackdropFilter: 'blur(22px)',
            boxShadow: '0 18px 46px rgba(0,0,0,0.45), inset 0 0 20px rgba(212,175,55,0.08)',
            mb: 5,
          }}
        >
          <CardContent sx={{ p: { xs: 3, md: 5 } }}>
            <Stack spacing={2.2} sx={{ alignItems: 'center', textAlign: 'center' }}>
              <Box
                component="img"
                src={LOGO_URL}
                alt={restaurantName}
                sx={{ width: { xs: 200, md: 280 }, maxWidth: '100%', height: 'auto' }}
              />

              <Typography
                sx={{
                  fontFamily: '"Playfair Display", serif',
                  fontSize: { xs: '2rem', md: '3rem' },
                  lineHeight: 1.1,
                  background: `linear-gradient(180deg, #f6df95 0%, ${COLOR_GOLD} 70%)`,
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Menu Signature
              </Typography>

              <Typography
                sx={{
                  fontFamily: '"Cormorant Garamond", serif',
                  fontSize: { xs: '1.05rem', md: '1.2rem' },
                  maxWidth: 680,
                  opacity: 1,
                  color: COLOR_TEXT_MUTED,
                }}
              >
                Cocina contemporanea con alma tradicional. Ingredientes frescos, tecnica precisa y una experiencia pensada para disfrutar cada detalle.
              </Typography>

              <Stack direction="row" spacing={1.2} useFlexGap sx={{ flexWrap: 'wrap', justifyContent: 'center' }}>
                <Chip
                  icon={<StarIcon />}
                  label="Cocina de autor"
                  sx={{
                    color: COLOR_TEXT_SOFT,
                    borderColor: COLOR_GOLD,
                    '& .MuiChip-label': { color: COLOR_TEXT_SOFT },
                    '& .MuiChip-icon': { color: COLOR_GOLD },
                  }}
                  variant="outlined"
                />
                <Chip
                  icon={<AccessTimeIcon />}
                  label={openingHoursChipLabel}
                  sx={{
                    color: COLOR_TEXT_SOFT,
                    borderColor: COLOR_GOLD,
                    '& .MuiChip-label': { color: COLOR_TEXT_SOFT },
                    '& .MuiChip-icon': { color: COLOR_GOLD },
                  }}
                  variant="outlined"
                />
                <Chip
                  icon={<RestaurantIcon />}
                  label={
                    loading
                      ? 'Actualizando carta...'
                      : `${categories.length} categorías · ${totalVisibleProducts} platos`
                  }
                  sx={{
                    color: COLOR_TEXT_SOFT,
                    borderColor: COLOR_GOLD,
                    '& .MuiChip-label': { color: COLOR_TEXT_SOFT },
                    '& .MuiChip-icon': { color: COLOR_GOLD },
                  }}
                  variant="outlined"
                />
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {errorMessage ? (
          <Alert severity="error" sx={{ mb: 3 }}>
            {errorMessage}
          </Alert>
        ) : null}

        <Stack spacing={2.2} sx={{ mb: 4 }}>
          <Typography
            sx={{
              fontFamily: '"Playfair Display", serif',
              fontSize: { xs: '1.7rem', md: '2.2rem' },
              color: COLOR_GOLD,
              textAlign: 'center',
            }}
          >
            Destacados de la Casa
          </Typography>

          {loading ? (
            <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress />
            </Box>
          ) : featuredDishes.length === 0 ? (
            <Typography sx={{ textAlign: 'center', color: COLOR_TEXT_MUTED }}>
              Aun no hay platos disponibles para mostrar.
            </Typography>
          ) : (
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              {featuredDishes.map((dish) => (
                <Card
                  key={dish.id}
                  sx={{
                    flex: 1,
                    border: `1px solid rgba(212,175,55,0.45)`,
                    borderRadius: 3,
                    background: 'rgba(16, 16, 16, 0.6)',
                    backdropFilter: 'blur(14px)',
                    WebkitBackdropFilter: 'blur(14px)',
                    transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 12px 34px rgba(212,175,55,0.18)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 2.2 }}>
                    <Stack spacing={1.1}>
                      <Chip
                        label={dish.badge}
                        size="small"
                        sx={{
                          width: 'fit-content',
                          color: COLOR_GOLD,
                          border: `1px solid rgba(212,175,55,0.7)`,
                          backgroundColor: 'rgba(212,175,55,0.08)',
                          fontFamily: '"Cormorant Garamond", serif',
                        }}
                      />
                      <Typography sx={{ fontFamily: '"Playfair Display", serif', fontSize: '1.35rem' }}>
                        {dish.name}
                      </Typography>
                      <Typography sx={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '1.03rem', opacity: 0.86 }}>
                        {dish.description}
                      </Typography>
                      <Typography sx={{ color: COLOR_GOLD, fontFamily: '"Playfair Display", serif', fontSize: '1.4rem' }}>
                        {dish.price}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </Stack>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 4 }}>
          <Card
            sx={{
              flex: 1,
              border: `1px solid rgba(212,175,55,0.45)`,
              borderRadius: 3,
              background: 'rgba(12, 12, 12, 0.58)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" spacing={1} sx={{ mb: 1.5, alignItems: 'center' }}>
                <AccessTimeIcon sx={{ color: COLOR_GOLD }} />
                <Typography sx={{ fontFamily: '"Playfair Display", serif', fontSize: '1.4rem', color: COLOR_GOLD }}>
                  Horarios
                </Typography>
              </Stack>

              <Stack spacing={1}>
                {scheduleRows.map((slot) => (
                  <Box
                    key={`${slot.day}-${slot.hours}`}
                    sx={{
                      px: 1.2,
                      py: 1,
                      borderRadius: 1.5,
                      border: '1px solid rgba(212,175,55,0.22)',
                      backgroundColor: 'rgba(212,175,55,0.04)',
                    }}
                  >
                    {slot.day === 'Horario' ? (
                      <Typography
                        sx={{
                          fontFamily: '"Cormorant Garamond", serif',
                          fontSize: '1.06rem',
                          color: COLOR_TEXT_SOFT,
                          lineHeight: 1.45,
                        }}
                      >
                        {slot.hours}
                      </Typography>
                    ) : (
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={0.8}
                        sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' } }}
                      >
                        <Typography sx={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '1.05rem', opacity: 0.92 }}>
                          {slot.day}
                        </Typography>
                        <Typography
                          sx={{
                            fontFamily: '"Cormorant Garamond", serif',
                            fontSize: '1.05rem',
                            color: /cerrado/i.test(slot.hours) ? '#ffb7b7' : COLOR_GOLD,
                            fontWeight: /cerrado/i.test(slot.hours) ? 700 : 600,
                          }}
                        >
                          {slot.hours}
                        </Typography>
                      </Stack>
                    )}
                  </Box>
                ))}

                {scheduleRows.length === 0 ? (
                  <Typography sx={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '1.05rem', color: COLOR_TEXT_MUTED }}>
                    Horario no configurado.
                  </Typography>
                ) : null}

                {effectiveConfig.direccion ? (
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', mt: 1.2 }}>
                    <PlaceIcon sx={{ color: COLOR_GOLD, mt: '2px' }} />
                    <Typography sx={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '1.05rem', color: COLOR_TEXT_MUTED }}>
                      {effectiveConfig.direccion}
                    </Typography>
                  </Stack>
                ) : null}
              </Stack>
            </CardContent>
          </Card>

          <Card
            sx={{
              flex: 1,
              border: `1px solid rgba(212,175,55,0.45)`,
              borderRadius: 3,
              background: 'rgba(12, 12, 12, 0.58)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Typography sx={{ fontFamily: '"Playfair Display", serif', fontSize: '1.4rem', color: COLOR_GOLD, mb: 1.5 }}>
                Contacto y Resenas
              </Typography>

              <Stack spacing={1.2}>
                {whatsappUrl ? (
                  <Button
                    component="a"
                    href={whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    startIcon={<WhatsAppIcon />}
                    sx={{
                      justifyContent: 'flex-start',
                      border: `1px solid rgba(212,175,55,0.5)`,
                      color: COLOR_TEXT_SOFT,
                      fontFamily: '"Cormorant Garamond", serif',
                      fontWeight: 600,
                      '&:hover': { backgroundColor: 'rgba(212,175,55,0.1)' },
                    }}
                  >
                    WhatsApp
                  </Button>
                ) : null}

                {phoneHref ? (
                  <Button
                    component="a"
                    href={phoneHref}
                    startIcon={<PhoneInTalkIcon />}
                    sx={{
                      justifyContent: 'flex-start',
                      border: `1px solid rgba(212,175,55,0.5)`,
                      color: COLOR_TEXT_SOFT,
                      fontFamily: '"Cormorant Garamond", serif',
                      fontWeight: 600,
                      '&:hover': { backgroundColor: 'rgba(212,175,55,0.1)' },
                    }}
                  >
                    {effectiveConfig.telefono}
                  </Button>
                ) : null}

                {instagramUrl ? (
                  <Button
                    component="a"
                    href={instagramUrl}
                    target="_blank"
                    rel="noreferrer"
                    startIcon={<InstagramIcon />}
                    sx={{
                      justifyContent: 'flex-start',
                      border: `1px solid rgba(212,175,55,0.5)`,
                      color: COLOR_TEXT_SOFT,
                      fontFamily: '"Cormorant Garamond", serif',
                      fontWeight: 600,
                      '&:hover': { backgroundColor: 'rgba(212,175,55,0.1)' },
                    }}
                  >
                    Instagram
                  </Button>
                ) : null}

                {facebookUrl ? (
                  <Button
                    component="a"
                    href={facebookUrl}
                    target="_blank"
                    rel="noreferrer"
                    startIcon={<FacebookIcon />}
                    sx={{
                      justifyContent: 'flex-start',
                      border: `1px solid rgba(212,175,55,0.5)`,
                      color: COLOR_TEXT_SOFT,
                      fontFamily: '"Cormorant Garamond", serif',
                      fontWeight: 600,
                      '&:hover': { backgroundColor: 'rgba(212,175,55,0.1)' },
                    }}
                  >
                    Facebook
                  </Button>
                ) : null}

                {googleMapsUrl ? (
                  <Button
                    component="a"
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    startIcon={<FmdGoodIcon />}
                    sx={{
                      justifyContent: 'flex-start',
                      border: `1px solid rgba(212,175,55,0.5)`,
                      color: COLOR_TEXT_SOFT,
                      fontFamily: '"Cormorant Garamond", serif',
                      fontWeight: 600,
                      '&:hover': { backgroundColor: 'rgba(212,175,55,0.1)' },
                    }}
                  >
                    Ver ubicación en Google Maps
                  </Button>
                ) : null}

                {tripadvisorUrl ? (
                  <Button
                    component="a"
                    href={tripadvisorUrl}
                    target="_blank"
                    rel="noreferrer"
                    startIcon={<RateReviewIcon />}
                    sx={{
                      justifyContent: 'flex-start',
                      border: `1px solid rgba(212,175,55,0.5)`,
                      color: COLOR_TEXT_SOFT,
                      fontFamily: '"Cormorant Garamond", serif',
                      fontWeight: 600,
                      '&:hover': { backgroundColor: 'rgba(212,175,55,0.1)' },
                    }}
                  >
                    Ver reseñas en TripAdvisor
                  </Button>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        </Stack>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 4 }}>
          <Card
            sx={{
              flex: 1,
              border: `1px solid rgba(212,175,55,0.55)`,
              borderRadius: 3,
              background: 'rgba(18, 12, 12, 0.62)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Chip
                label="Plato del Mes"
                size="small"
                sx={{
                  color: COLOR_GOLD,
                  border: `1px solid rgba(212,175,55,0.8)`,
                  backgroundColor: 'rgba(212,175,55,0.1)',
                  fontFamily: '"Cormorant Garamond", serif',
                  '& .MuiChip-label': { color: COLOR_GOLD },
                  mb: 1.2,
                }}
                variant="outlined"
              />
              <Typography sx={{ fontFamily: '"Playfair Display", serif', fontSize: '1.6rem', mb: 0.8 }}>
                {dishProduct?.nombre ?? 'Plato del Mes'}
              </Typography>
              <Typography sx={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '1.05rem', opacity: 1, color: COLOR_TEXT_MUTED, mb: 1.1 }}>
                {dishOfMonth?.descripcionEspecial ?? dishProduct?.descripcion ?? 'Aun no hay plato del mes publicado.'}
              </Typography>
              <Typography sx={{ color: COLOR_GOLD, fontFamily: '"Playfair Display", serif', fontSize: '1.5rem' }}>
                {dishProduct ? formatCRC(dishProduct.precio) : 'Pronto disponible'}
              </Typography>
            </CardContent>
          </Card>

          <Card
            sx={{
              flex: 1,
              border: `1px solid rgba(212,175,55,0.45)`,
              borderRadius: 3,
              background: 'rgba(12, 12, 12, 0.58)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" spacing={1} sx={{ mb: 1.2, alignItems: 'center' }}>
                <CampaignIcon sx={{ color: COLOR_GOLD }} />
                <Typography sx={{ fontFamily: '"Playfair Display", serif', fontSize: '1.45rem', color: COLOR_GOLD }}>
                  Anuncios
                </Typography>
              </Stack>

              <Stack spacing={1.1}>
                {announcements.length === 0 ? (
                  <Typography sx={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '1rem', color: COLOR_TEXT_MUTED }}>
                    No hay anuncios activos por el momento.
                  </Typography>
                ) : null}
                {announcements.map((item) => (
                  (() => {
                    const typeBadge = getAnnouncementTypeBadge(item.tipo)

                    return (
                      <Card
                        key={item.id}
                        sx={{
                          border: '1px solid rgba(212,175,55,0.4)',
                          borderRadius: 2.4,
                          overflow: 'hidden',
                          background:
                            'linear-gradient(145deg, rgba(14,14,14,0.82) 0%, rgba(20,15,10,0.86) 100%)',
                          boxShadow: '0 12px 30px rgba(0,0,0,0.26), inset 0 0 18px rgba(212,175,55,0.06)',
                          transition: 'transform 0.24s ease, box-shadow 0.24s ease, border-color 0.24s ease',
                          '&:hover': {
                            transform: 'translateY(-3px)',
                            borderColor: 'rgba(212,175,55,0.7)',
                            boxShadow: '0 16px 36px rgba(0,0,0,0.34), inset 0 0 24px rgba(212,175,55,0.1)',
                          },
                        }}
                      >
                        {item.imagen ? (
                          <Box sx={{ position: 'relative' }}>
                            <Box
                              component="img"
                              src={item.imagen}
                              alt={item.titulo}
                              sx={{
                                width: '100%',
                                height: { xs: 158, sm: 188 },
                                objectFit: 'cover',
                                display: 'block',
                              }}
                            />
                            <Box
                              sx={{
                                position: 'absolute',
                                inset: 0,
                                background:
                                  'linear-gradient(180deg, rgba(7,7,7,0.05) 0%, rgba(7,7,7,0.8) 100%)',
                              }}
                            />
                            <Chip
                              label={typeBadge.label}
                              size="small"
                              sx={{
                                position: 'absolute',
                                top: 10,
                                left: 10,
                                border: `1px solid ${typeBadge.border}`,
                                color: typeBadge.color,
                                backgroundColor: typeBadge.background,
                                backdropFilter: 'blur(4px)',
                                '& .MuiChip-label': {
                                  fontFamily: '"Cormorant Garamond", serif',
                                  fontWeight: 700,
                                  letterSpacing: '0.4px',
                                },
                              }}
                            />
                          </Box>
                        ) : null}

                        <CardContent sx={{ p: 1.8, '&:last-child': { pb: 1.8 } }}>
                          <Stack spacing={1.1}>
                            {!item.imagen ? (
                              <Chip
                                label={typeBadge.label}
                                size="small"
                                sx={{
                                  width: 'fit-content',
                                  border: `1px solid ${typeBadge.border}`,
                                  color: typeBadge.color,
                                  backgroundColor: typeBadge.background,
                                  '& .MuiChip-label': {
                                    fontFamily: '"Cormorant Garamond", serif',
                                    fontWeight: 700,
                                    letterSpacing: '0.4px',
                                  },
                                }}
                              />
                            ) : null}

                            <Typography
                              sx={{
                                fontFamily: '"Playfair Display", serif',
                                fontSize: { xs: '1.1rem', sm: '1.18rem' },
                                lineHeight: 1.2,
                                color: COLOR_TEXT_SOFT,
                              }}
                            >
                              {item.titulo}
                            </Typography>

                            {item.descripcion ? (
                              <Typography
                                sx={{
                                  fontFamily: '"Cormorant Garamond", serif',
                                  fontSize: '1.03rem',
                                  color: COLOR_TEXT_MUTED,
                                  lineHeight: 1.4,
                                  whiteSpace: 'pre-line',
                                }}
                              >
                                {item.descripcion}
                              </Typography>
                            ) : null}

                            <Box
                              sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
                                gap: 0.8,
                                pt: 0.2,
                              }}
                            >
                              <Chip
                                size="small"
                                label={formatAnnouncementDateRange(item.fechaInicio, item.fechaFin)}
                                variant="outlined"
                                sx={{
                                  justifyContent: 'flex-start',
                                  borderColor: 'rgba(212,175,55,0.4)',
                                  backgroundColor: 'rgba(212,175,55,0.08)',
                                  '& .MuiChip-label': {
                                    color: COLOR_TEXT_SOFT,
                                    width: '100%',
                                    textAlign: 'left',
                                  },
                                }}
                              />
                              <Chip
                                size="small"
                                label={formatAnnouncementTimeRange(item.horaInicio, item.horaFin)}
                                variant="outlined"
                                sx={{
                                  justifyContent: 'flex-start',
                                  borderColor: 'rgba(212,175,55,0.4)',
                                  backgroundColor: 'rgba(212,175,55,0.08)',
                                  '& .MuiChip-label': {
                                    color: COLOR_TEXT_SOFT,
                                    width: '100%',
                                    textAlign: 'left',
                                  },
                                }}
                              />
                            </Box>
                          </Stack>
                        </CardContent>
                      </Card>
                    )
                  })()
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Stack>

        <Card
          sx={{
            border: `1px solid rgba(212,175,55,0.45)`,
            borderRadius: 3,
            background: 'rgba(12, 12, 12, 0.58)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
            <Typography
              sx={{
                fontFamily: '"Playfair Display", serif',
                fontSize: { xs: '1.6rem', md: '1.9rem' },
                color: COLOR_GOLD,
                textAlign: 'center',
                mb: 2,
              }}
            >
              Carta Completa
            </Typography>

            <Divider sx={{ borderColor: 'rgba(212,175,55,0.25)', mb: 2.2 }} />

            {loading ? (
              <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress />
              </Box>
            ) : totalVisibleProducts === 0 ? (
              <Typography sx={{ textAlign: 'center', color: COLOR_TEXT_MUTED }}>
                Aun no hay productos disponibles en la carta.
              </Typography>
            ) : (
              <Stack spacing={3}>
                {groupedProducts.map((group) => (
                  <Box key={group.category.id}>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1}
                      sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', mb: 1.5 }}
                    >
                      <Typography sx={{ fontFamily: '"Playfair Display", serif', fontSize: '1.4rem', color: COLOR_GOLD }}>
                        {group.category.nombre}
                      </Typography>
                      <Chip
                        size="small"
                        label={`${group.products.length} platos`}
                        variant="outlined"
                        sx={{
                          color: COLOR_TEXT_SOFT,
                          borderColor: 'rgba(212,175,55,0.6)',
                          '& .MuiChip-label': { color: COLOR_TEXT_SOFT },
                        }}
                      />
                    </Stack>

                    <Stack spacing={1}>
                      {group.products.map((item) => (
                        <Box
                          key={item.id}
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: 2,
                            p: 1.2,
                            borderRadius: 1.5,
                            border: '1px solid rgba(212,175,55,0.2)',
                            backgroundColor: 'rgba(212,175,55,0.04)',
                          }}
                        >
                          <Box>
                            <Typography sx={{ fontFamily: '"Playfair Display", serif', fontSize: '1.1rem' }}>
                              {item.nombre}
                            </Typography>
                            <Typography
                              sx={{
                                fontFamily: '"Cormorant Garamond", serif',
                                fontSize: '1.03rem',
                                opacity: 1,
                                color: COLOR_TEXT_MUTED,
                                whiteSpace: 'pre-line',
                              }}
                            >
                              {item.descripcion}
                            </Typography>
                          </Box>
                          <Typography
                            sx={{
                              color: COLOR_GOLD,
                              fontFamily: '"Playfair Display", serif',
                              fontSize: '1.2rem',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatCRC(item.precio)}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                ))}

                {uncategorizedProducts.length > 0 ? (
                  <Box>
                    <Typography sx={{ fontFamily: '"Playfair Display", serif', fontSize: '1.3rem', color: COLOR_GOLD, mb: 1 }}>
                      Otras Sugerencias
                    </Typography>
                    <Stack spacing={1}>
                      {uncategorizedProducts.map((item) => (
                        <Box
                          key={item.id}
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: 2,
                            p: 1.2,
                            borderRadius: 1.5,
                            border: '1px solid rgba(212,175,55,0.2)',
                            backgroundColor: 'rgba(212,175,55,0.04)',
                          }}
                        >
                          <Box>
                            <Typography sx={{ fontFamily: '"Playfair Display", serif', fontSize: '1.1rem' }}>
                              {item.nombre}
                            </Typography>
                            <Typography
                              sx={{
                                fontFamily: '"Cormorant Garamond", serif',
                                fontSize: '1.03rem',
                                opacity: 1,
                                color: COLOR_TEXT_MUTED,
                                whiteSpace: 'pre-line',
                              }}
                            >
                              {item.descripcion}
                            </Typography>
                          </Box>
                          <Typography
                            sx={{
                              color: COLOR_GOLD,
                              fontFamily: '"Playfair Display", serif',
                              fontSize: '1.2rem',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatCRC(item.precio)}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                ) : null}
              </Stack>
            )}
          </CardContent>
        </Card>
      </Container>

      <Box
        sx={{
          position: 'absolute',
          bottom: 18,
          width: '100%',
          textAlign: 'center',
          opacity: 0.9,
          color: COLOR_TEXT_MUTED,
          fontFamily: '"Cormorant Garamond", serif',
          letterSpacing: '0.8px',
          fontSize: '0.95rem',
        }}
      >
        {restaurantName} · Experiencia Gastronomica
      </Box>
    </Box>
  )
}
