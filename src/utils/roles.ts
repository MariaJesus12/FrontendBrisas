export type AppRole = 'ADMIN' | 'MESERO' | 'CAJERO' | 'UNKNOWN'

export function normalizeRole(rawRole: unknown): AppRole {
  const raw = String(rawRole ?? '').trim().toUpperCase()

  if (raw === '1' || raw === 'ADMIN' || raw === 'ADMINISTRADOR') {
    return 'ADMIN'
  }

  if (raw === '2' || raw === 'MESERO' || raw === 'MOZO' || raw === 'WAITER') {
    return 'MESERO'
  }

  if (raw === '3' || raw === 'CAJERO' || raw === 'CAJA' || raw === 'CASHIER') {
    return 'CAJERO'
  }

  return 'UNKNOWN'
}

export function hasRequiredRole(userRole: unknown, allowedRoles: AppRole[]): boolean {
  const normalized = normalizeRole(userRole)
  return allowedRoles.includes(normalized)
}

export function getDefaultRouteByRole(userRole: unknown): string {
  const normalized = normalizeRole(userRole)

  if (normalized === 'MESERO' || normalized === 'CAJERO') {
    return '/mesas'
  }

  return '/dashboard'
}
