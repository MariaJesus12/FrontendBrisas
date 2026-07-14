import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { getDefaultRouteByRole, hasRequiredRole, type AppRole } from '@/utils/roles'

interface PrivateRouteProps {
  allowedRoles?: AppRole[]
}

export default function PrivateRoute({ allowedRoles }: PrivateRouteProps) {
  const { isAuthenticated, user } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !hasRequiredRole(user?.rol, allowedRoles)) {
    return <Navigate to={getDefaultRouteByRole(user?.rol)} replace />
  }

  return <Outlet />
}
