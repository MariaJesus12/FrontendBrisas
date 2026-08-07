import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import PrivateRoute from './PrivateRoute'
import MainLayout from '@/components/layout/MainLayout'
import LoginPage from '@/pages/auth/LoginPage'
import PublicMenuPage from '@/pages/public/PublicMenuPage'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import FacturacionPage from '@/pages/facturacion/FacturacionPage'
import MesasPage from '@/pages/mesas/MesasPage'
import ReservacionesPage from '@/pages/reservaciones/ReservacionesPage'
import MenuPage from '@/pages/menu/MenuPage'
import PlatoDelMesPage from '@/pages/plato-del-mes/PlatoDelMesPage'
import PedidosPage from '@/pages/pedidos/PedidosPage'
import UsuariosPage from '@/pages/usuarios/UsuariosPage'
import AnunciosPage from '@/pages/anuncios/AnunciosPage'
import EstadisticasProductosPage from '@/pages/admin/EstadisticasProductosPage'
import ConfiguracionRestaurantePage from '@/pages/configuracion-restaurante/ConfiguracionRestaurantePage'

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicMenuPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route element={<PrivateRoute />}>
          <Route element={<PrivateRoute allowedRoles={['ADMIN', 'MESERO', 'CAJERO']} />}>
            <Route path="/facturacion/:pedidoId" element={<FacturacionPage />} />
          </Route>

          <Route element={<MainLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />

            <Route element={<PrivateRoute allowedRoles={['ADMIN', 'MESERO', 'CAJERO']} />}>
              <Route path="/mesas" element={<MesasPage />} />
              <Route path="/pedidos-llevar" element={<PedidosPage fixedType="LLEVAR" />} />
              <Route path="/reservaciones" element={<ReservacionesPage />} />
              <Route path="/pedidos" element={<PedidosPage />} />
            </Route>

            <Route element={<PrivateRoute allowedRoles={['ADMIN']} />}>
              <Route path="/admin/estadisticas-productos" element={<EstadisticasProductosPage />} />
              <Route path="/admin/configuracion-restaurante" element={<ConfiguracionRestaurantePage />} />
              <Route path="/menu" element={<MenuPage />} />
              <Route path="/plato-del-mes" element={<PlatoDelMesPage />} />
              <Route path="/anuncios" element={<AnunciosPage />} />
              <Route path="/usuarios" element={<UsuariosPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
