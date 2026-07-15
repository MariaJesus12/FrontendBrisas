export type AppRole = 'ADMIN' | 'MESERO' | 'CAJERO' | 'UNKNOWN'

function extractRoleCandidate(rawRole: unknown): unknown {
  if (typeof rawRole !== 'object' || rawRole === null) {
    return rawRole
  }

  const record = rawRole as Record<string, unknown>
  return (
    record.rol ??
    record.rolNombre ??
    record.rol_nombre ??
    record.role ??
    record.roleName ??
    record.role_name ??
    record.rol_id ??
    record.role_id ??
    record.rolId ??
    record.roleId ??
    rawRole
  )
}

export function normalizeRole(rawRole: unknown): AppRole {
  const candidate = extractRoleCandidate(rawRole)
  const raw = String(candidate ?? '').trim().toUpperCase()

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
