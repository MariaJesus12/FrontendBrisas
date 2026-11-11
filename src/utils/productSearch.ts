import type { Product } from '@/types/menu.types'

export function findProductByQuery(products: Product[], rawQuery: string): Product | null {
  const normalized = rawQuery.trim().toUpperCase()
  if (!normalized) return null

  return (
    products.find((product) => String(product.codigo ?? '').trim().toUpperCase() === normalized) ??
    products.find((product) => String(product.id) === normalized) ??
    products.find((product) => product.nombre.trim().toUpperCase() === normalized) ??
    products.find((product) =>
      String(product.codigo ?? '').trim().toUpperCase().includes(normalized) ||
      product.nombre.trim().toUpperCase().includes(normalized),
    ) ??
    null
  )
}

export function productPriceInput(product: Product | null | undefined): string {
  return product && Number.isFinite(product.precio) && product.precio >= 0 ? String(product.precio) : ''
}
