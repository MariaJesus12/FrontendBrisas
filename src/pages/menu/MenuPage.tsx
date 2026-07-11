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
  TextField,
  Typography,
} from '@mui/material'
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import CategoryIcon from '@mui/icons-material/Category'
import LocalDiningIcon from '@mui/icons-material/LocalDining'
import type { Category, CreateCategoryDto, CreateProductDto, Product } from '@/types/menu.types'
import { menuService } from '@/services/menu.service'

const COLOR_GOLD = '#D4AF37'
const COLOR_MAROON = '#8F1D2E'
const COLOR_TEXT = '#F3E9D2'

const crcFormatter = new Intl.NumberFormat('es-CR', {
  style: 'currency',
  currency: 'CRC',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

interface CategoryFormState {
  nombre: string
  descripcion: string
}

interface ProductFormState {
  codigo: string
  nombre: string
  descripcion: string
  precio: string
  imagen: string
  categoryId: string
  disponible: string
}

const initialCategoryForm: CategoryFormState = {
  nombre: '',
  descripcion: '',
}

const initialProductForm: ProductFormState = {
  codigo: '',
  nombre: '',
  descripcion: '',
  precio: '',
  imagen: '',
  categoryId: '',
  disponible: 'true',
}

function toPositiveNumber(value: unknown): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }
  return parsed
}

function formatCRC(value: number): string {
  if (!Number.isFinite(value)) {
    return '₡0'
  }

  return crcFormatter.format(value)
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
        codigo:
          typeof record.codigo === 'string'
            ? record.codigo
            : typeof record.code === 'string'
              ? record.code
              : typeof record.sku === 'string'
                ? record.sku
                : undefined,
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

export default function MenuPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [submittingCategory, setSubmittingCategory] = useState<boolean>(false)
  const [submittingProduct, setSubmittingProduct] = useState<boolean>(false)

  const [message, setMessage] = useState<string>('')
  const [messageSeverity, setMessageSeverity] = useState<'info' | 'success' | 'error'>('info')

  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState<boolean>(false)
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(initialCategoryForm)

  const [isProductDialogOpen, setIsProductDialogOpen] = useState<boolean>(false)
  const [editingProductId, setEditingProductId] = useState<number | null>(null)
  const [productForm, setProductForm] = useState<ProductFormState>(initialProductForm)

  const categoryById = useMemo(() => {
    const map = new Map<number, Category>()
    categories.forEach((category) => {
      map.set(category.id, category)
    })
    return map
  }, [categories])

  const groupedProducts = useMemo(
    () =>
      categories.map((category) => ({
        category,
        items: products.filter((product) => product.categoryId === category.id),
      })),
    [categories, products],
  )

  const orphanProducts = useMemo(
    () => products.filter((product) => !categoryById.has(product.categoryId)),
    [products, categoryById],
  )

  const loadCategories = async () => {
    const response = await menuService.getCategories()
    const normalized = normalizeCategoriesPayload(response.data)
    setCategories(normalized)
  }

  const loadProducts = async () => {
    const response = await menuService.getProducts()
    const normalized = normalizeProductsPayload(response.data)
    setProducts(normalized)
  }

  const loadData = async () => {
    setLoading(true)
    try {
      await Promise.all([loadCategories(), loadProducts()])
      setMessage('')
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const backendMessage = extractBackendMessage(error.response?.data)
        setMessage(
          backendMessage ||
            `No se pudo cargar la información del menú (HTTP ${error.response?.status ?? 'sin código'}).`,
        )
      } else {
        setMessage('No se pudo cargar la información del menú.')
      }
      setMessageSeverity('error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const openCreateCategoryDialog = () => {
    setEditingCategoryId(null)
    setCategoryForm(initialCategoryForm)
    setIsCategoryDialogOpen(true)
  }

  const openEditCategoryDialog = (category: Category) => {
    setEditingCategoryId(category.id)
    setCategoryForm({
      nombre: category.nombre,
      descripcion: category.descripcion ?? '',
    })
    setIsCategoryDialogOpen(true)
  }

  const openCreateProductDialog = () => {
    setEditingProductId(null)
    setProductForm({
      ...initialProductForm,
      categoryId: String(categories[0]?.id ?? ''),
    })
    setIsProductDialogOpen(true)
  }

  const openEditProductDialog = (product: Product) => {
    setEditingProductId(product.id)
    setProductForm({
      nombre: product.nombre,
      codigo: product.codigo ?? '',
      descripcion: product.descripcion,
      precio: String(product.precio),
      imagen: product.imagen ?? '',
      categoryId: String(product.categoryId),
      disponible: String(product.disponible),
    })
    setIsProductDialogOpen(true)
  }

  const closeCategoryDialog = () => {
    if (submittingCategory) {
      return
    }
    setIsCategoryDialogOpen(false)
  }

  const closeProductDialog = () => {
    if (submittingProduct) {
      return
    }
    setIsProductDialogOpen(false)
  }

  const handleSaveCategory = async () => {
    const payload: CreateCategoryDto = {
      nombre: categoryForm.nombre.trim(),
      descripcion: categoryForm.descripcion.trim() || undefined,
    }

    if (!payload.nombre) {
      setMessage('El nombre de la categoría es obligatorio.')
      setMessageSeverity('error')
      return
    }

    setSubmittingCategory(true)
    try {
      if (editingCategoryId === null) {
        await menuService.createCategory(payload)
      } else {
        await menuService.updateCategory(editingCategoryId, payload)
      }

      await loadCategories()
      setIsCategoryDialogOpen(false)
      setMessage(
        editingCategoryId === null
          ? 'Categoría creada correctamente.'
          : 'Categoría actualizada correctamente.',
      )
      setMessageSeverity('success')
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const backendMessage = extractBackendMessage(error.response?.data)
        setMessage(backendMessage || 'No se pudo guardar la categoría.')
      } else {
        setMessage('No se pudo guardar la categoría.')
      }
      setMessageSeverity('error')
    } finally {
      setSubmittingCategory(false)
    }
  }

  const handleDeleteCategory = async (category: Category) => {
    const relatedProducts = products.filter((product) => product.categoryId === category.id)

    if (relatedProducts.length > 0) {
      setMessage('No puedes eliminar una categoría que tiene productos asociados.')
      setMessageSeverity('error')
      return
    }

    if (!window.confirm(`¿Eliminar la categoría "${category.nombre}"?`)) {
      return
    }

    try {
      await menuService.deleteCategory(category.id)
      await loadCategories()
      setMessage('Categoría eliminada correctamente.')
      setMessageSeverity('success')
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const backendMessage = extractBackendMessage(error.response?.data)
        setMessage(backendMessage || 'No se pudo eliminar la categoría.')
      } else {
        setMessage('No se pudo eliminar la categoría.')
      }
      setMessageSeverity('error')
    }
  }

  const handleSaveProduct = async () => {
    const parsedCategoryId = Number(productForm.categoryId)
    const parsedPrice = Number(productForm.precio)

    if (!productForm.codigo.trim() || !productForm.nombre.trim() || !productForm.descripcion.trim()) {
      setMessage('El producto requiere código, nombre y descripción.')
      setMessageSeverity('error')
      return
    }

    if (!Number.isFinite(parsedCategoryId) || parsedCategoryId <= 0) {
      setMessage('Selecciona una categoría válida para el producto.')
      setMessageSeverity('error')
      return
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setMessage('El precio debe ser un número mayor que 0.')
      setMessageSeverity('error')
      return
    }

    if (!Number.isInteger(parsedPrice)) {
      setMessage('El precio debe estar en colones enteros, sin decimales.')
      setMessageSeverity('error')
      return
    }

    const payload: CreateProductDto = {
      codigo: productForm.codigo.trim(),
      nombre: productForm.nombre.trim(),
      descripcion: productForm.descripcion.trim(),
      precio: parsedPrice,
      imagen: productForm.imagen.trim() || undefined,
      categoryId: parsedCategoryId,
      disponible: productForm.disponible === 'true',
    }

    setSubmittingProduct(true)
    try {
      let response
      if (editingProductId === null) {
        response = await menuService.createProduct(payload)
      } else {
        response = await menuService.updateProduct(editingProductId, payload)
      }

      await loadProducts()
      setIsProductDialogOpen(false)

      const backendPrice = Number((response.data as Product).precio)
      if (Number.isFinite(backendPrice) && backendPrice !== parsedPrice) {
        setMessage(
          `Producto guardado, pero el backend devolvió ${formatCRC(backendPrice)} en lugar de ${formatCRC(parsedPrice)}.`,
        )
        setMessageSeverity('info')
      } else {
        setMessage(editingProductId === null ? 'Producto creado correctamente.' : 'Producto actualizado correctamente.')
        setMessageSeverity('success')
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const backendMessage = extractBackendMessage(error.response?.data)
        setMessage(backendMessage || 'No se pudo guardar el producto.')
      } else {
        setMessage('No se pudo guardar el producto.')
      }
      setMessageSeverity('error')
    } finally {
      setSubmittingProduct(false)
    }
  }

  const handleDeleteProduct = async (product: Product) => {
    if (!window.confirm(`¿Eliminar el producto "${product.nombre}"?`)) {
      return
    }

    try {
      await menuService.deleteProduct(product.id)
      await loadProducts()
      setMessage('Producto eliminado correctamente.')
      setMessageSeverity('success')
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const backendMessage = extractBackendMessage(error.response?.data)
        setMessage(backendMessage || 'No se pudo eliminar el producto.')
      } else {
        setMessage('No se pudo eliminar el producto.')
      }
      setMessageSeverity('error')
    }
  }

  return (
    <Box sx={{ color: COLOR_TEXT }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <RestaurantMenuIcon sx={{ color: COLOR_GOLD }} />
        <Typography
          variant="h4"
          sx={{ fontWeight: 'bold', color: COLOR_GOLD, fontFamily: '"Playfair Display", serif' }}
        >
          Menú Admin
        </Typography>
      </Box>

      <Typography sx={{ mb: 3, color: 'rgba(243,233,210,0.82)' }}>
        Administra categorías y productos con una vista inspirada en el menú público.
      </Typography>

      <Paper
        sx={{
          p: 3,
          borderRadius: 2,
          backgroundColor: 'rgba(10,10,10,0.72)',
          border: '1px solid rgba(212,175,55,0.45)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
          mb: 3,
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', md: 'center' } }}
        >
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
            <Chip label={`${categories.length} categorías`} icon={<CategoryIcon />} variant="outlined" />
            <Chip label={`${products.length} productos`} icon={<LocalDiningIcon />} variant="outlined" />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2}>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={openCreateCategoryDialog}
              sx={{
                borderColor: COLOR_GOLD,
                color: COLOR_GOLD,
                '&:hover': { borderColor: COLOR_GOLD, backgroundColor: 'rgba(212,175,55,0.08)' },
              }}
            >
              Nueva Categoría
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openCreateProductDialog}
              disabled={categories.length === 0}
              sx={{
                backgroundColor: COLOR_MAROON,
                '&:hover': { backgroundColor: '#781826' },
              }}
            >
              Nuevo Producto
            </Button>
          </Stack>
        </Stack>

        {categories.length === 0 ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Crea al menos una categoría para comenzar a registrar productos.
          </Alert>
        ) : null}
      </Paper>

      {message ? (
        <Alert severity={messageSeverity} sx={{ mb: 2 }}>
          {message}
        </Alert>
      ) : null}

      {loading ? (
        <Box
          sx={{
            py: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 2,
            backgroundColor: 'rgba(10,10,10,0.72)',
            border: '1px solid rgba(212,175,55,0.45)',
          }}
        >
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={2.5}>
          <Paper
            sx={{
              p: 2,
              borderRadius: 2,
              backgroundColor: 'rgba(10,10,10,0.72)',
              border: '1px solid rgba(212,175,55,0.45)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
            }}
          >
            <Typography
              variant="h6"
              sx={{ color: COLOR_GOLD, mb: 1.2, fontFamily: '"Playfair Display", serif' }}
            >
              Categorías
            </Typography>
            <Stack spacing={1}>
              {categories.length === 0 ? (
                <Typography sx={{ color: 'rgba(243,233,210,0.75)' }}>
                  No hay categorías registradas.
                </Typography>
              ) : null}
              {categories.map((category) => (
                <Box
                  key={category.id}
                  sx={{
                    px: 1.5,
                    py: 1,
                    borderRadius: 1.5,
                    border: '1px solid rgba(212,175,55,0.35)',
                    backgroundColor: 'rgba(212,175,55,0.04)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                  }}
                >
                  <Box>
                    <Typography sx={{ color: COLOR_GOLD, fontWeight: 600 }}>{category.nombre}</Typography>
                    {category.descripcion ? (
                      <Typography sx={{ color: 'rgba(243,233,210,0.75)', fontSize: '0.9rem' }}>
                        {category.descripcion}
                      </Typography>
                    ) : null}
                  </Box>

                  <Box>
                    <IconButton onClick={() => openEditCategoryDialog(category)}>
                      <EditIcon sx={{ color: COLOR_GOLD }} fontSize="small" />
                    </IconButton>
                    <IconButton onClick={() => handleDeleteCategory(category)}>
                      <DeleteIcon sx={{ color: '#ff8484' }} fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              ))}
            </Stack>
          </Paper>

          <Paper
            sx={{
              p: 2.4,
              borderRadius: 2,
              backgroundColor: 'rgba(10,10,10,0.72)',
              border: '1px solid rgba(212,175,55,0.45)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
            }}
          >
            <Typography
              variant="h6"
              sx={{ color: COLOR_GOLD, mb: 1.5, fontFamily: '"Playfair Display", serif' }}
            >
              Vista del Menú (Preview)
            </Typography>

            <Stack spacing={2}>
              {groupedProducts.map((group) => (
                <Box key={group.category.id}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, mb: 1 }}
                  >
                    <Typography sx={{ color: COLOR_GOLD, fontWeight: 700, fontFamily: '"Playfair Display", serif' }}>
                      {group.category.nombre}
                    </Typography>
                    <Chip
                      label={`${group.items.length} productos`}
                      size="small"
                      sx={{ color: COLOR_TEXT, border: '1px solid rgba(212,175,55,0.5)' }}
                      variant="outlined"
                    />
                  </Stack>

                  {group.items.length === 0 ? (
                    <Typography sx={{ color: 'rgba(243,233,210,0.7)', mb: 1.5 }}>
                      Sin productos en esta categoría.
                    </Typography>
                  ) : (
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
                      {group.items.map((product) => (
                        <Card
                          key={product.id}
                          sx={{
                            width: { xs: '100%', md: 'calc(50% - 6px)' },
                            border: '1px solid rgba(212,175,55,0.4)',
                            borderRadius: 2,
                            background: 'rgba(16, 16, 16, 0.6)',
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                          }}
                        >
                          <CardContent sx={{ p: 1.8 }}>
                            <Stack spacing={1}>
                              <Stack
                                direction="row"
                                sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
                              >
                                <Box>
                                  <Typography sx={{ fontFamily: '"Playfair Display", serif', fontSize: '1.15rem' }}>
                                    {product.nombre}
                                  </Typography>
                                  {product.codigo ? (
                                    <Typography sx={{ color: 'rgba(243,233,210,0.74)', fontSize: '0.86rem' }}>
                                      Código: {product.codigo}
                                    </Typography>
                                  ) : null}
                                  <Typography sx={{ color: COLOR_GOLD, fontWeight: 700 }}>
                                    {formatCRC(product.precio)}
                                  </Typography>
                                </Box>

                                <Stack direction="row" spacing={0.4}>
                                  <IconButton size="small" onClick={() => openEditProductDialog(product)}>
                                    <EditIcon sx={{ color: COLOR_GOLD }} fontSize="small" />
                                  </IconButton>
                                  <IconButton size="small" onClick={() => handleDeleteProduct(product)}>
                                    <DeleteIcon sx={{ color: '#ff8484' }} fontSize="small" />
                                  </IconButton>
                                </Stack>
                              </Stack>

                              <Typography sx={{ color: 'rgba(243,233,210,0.82)' }}>
                                {product.descripcion}
                              </Typography>

                              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                                <Chip
                                  size="small"
                                  label={product.disponible ? 'Disponible' : 'No disponible'}
                                  sx={{
                                    color: product.disponible ? '#93ffb0' : '#ffd0d0',
                                    border: `1px solid ${product.disponible ? 'rgba(147,255,176,0.45)' : 'rgba(255,132,132,0.45)'}`,
                                  }}
                                  variant="outlined"
                                />
                                {product.imagen ? (
                                  <Chip
                                    size="small"
                                    label="Con imagen"
                                    sx={{ color: COLOR_TEXT, border: '1px solid rgba(212,175,55,0.42)' }}
                                    variant="outlined"
                                  />
                                ) : null}
                              </Stack>
                            </Stack>
                          </CardContent>
                        </Card>
                      ))}
                    </Stack>
                  )}

                  <Divider sx={{ my: 2, borderColor: 'rgba(212,175,55,0.22)' }} />
                </Box>
              ))}

              {orphanProducts.length > 0 ? (
                <Box>
                  <Typography
                    sx={{
                      color: '#ff9e9e',
                      mb: 1,
                      fontWeight: 700,
                      fontFamily: '"Playfair Display", serif',
                    }}
                  >
                    Productos sin categoría
                  </Typography>
                  <Stack spacing={1}>
                    {orphanProducts.map((product) => (
                      <Box key={product.id} sx={{ color: 'rgba(243,233,210,0.8)' }}>
                        • {product.nombre} (ID {product.id})
                      </Box>
                    ))}
                  </Stack>
                </Box>
              ) : null}
            </Stack>
          </Paper>
        </Stack>
      )}

      <Dialog open={isCategoryDialogOpen} onClose={closeCategoryDialog} fullWidth maxWidth="sm">
        <DialogTitle>{editingCategoryId === null ? 'Nueva Categoría' : 'Editar Categoría'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Nombre"
              value={categoryForm.nombre}
              onChange={(event) => setCategoryForm((prev) => ({ ...prev, nombre: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Descripción"
              value={categoryForm.descripcion}
              onChange={(event) => setCategoryForm((prev) => ({ ...prev, descripcion: event.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeCategoryDialog} disabled={submittingCategory}>
            Cancelar
          </Button>
          <Button onClick={handleSaveCategory} variant="contained" disabled={submittingCategory}>
            {submittingCategory ? <CircularProgress size={18} color="inherit" /> : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isProductDialogOpen} onClose={closeProductDialog} fullWidth maxWidth="sm">
        <DialogTitle>{editingProductId === null ? 'Nuevo Producto' : 'Editar Producto'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Código"
              value={productForm.codigo}
              onChange={(event) => setProductForm((prev) => ({ ...prev, codigo: event.target.value }))}
              fullWidth
              helperText="Identificador único del producto (requerido por backend)."
            />
            <TextField
              label="Nombre"
              value={productForm.nombre}
              onChange={(event) => setProductForm((prev) => ({ ...prev, nombre: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Descripción"
              value={productForm.descripcion}
              onChange={(event) => setProductForm((prev) => ({ ...prev, descripcion: event.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              label="Precio"
              type="number"
              value={productForm.precio}
              onChange={(event) => setProductForm((prev) => ({ ...prev, precio: event.target.value }))}
              fullWidth
              helperText="Monto en colones. Solo números enteros."
              slotProps={{
                htmlInput: {
                  min: 1,
                  step: 1,
                },
              }}
            />
            <TextField
              label="Imagen (URL)"
              value={productForm.imagen}
              onChange={(event) => setProductForm((prev) => ({ ...prev, imagen: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Categoría"
              select
              value={productForm.categoryId}
              onChange={(event) => setProductForm((prev) => ({ ...prev, categoryId: event.target.value }))}
              fullWidth
            >
              {categories.map((category) => (
                <MenuItem key={category.id} value={String(category.id)}>
                  {category.nombre}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Estado"
              select
              value={productForm.disponible}
              onChange={(event) => setProductForm((prev) => ({ ...prev, disponible: event.target.value }))}
              fullWidth
            >
              <MenuItem value="true">Disponible</MenuItem>
              <MenuItem value="false">No disponible</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeProductDialog} disabled={submittingProduct}>
            Cancelar
          </Button>
          <Button onClick={handleSaveProduct} variant="contained" disabled={submittingProduct}>
            {submittingProduct ? <CircularProgress size={18} color="inherit" /> : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
