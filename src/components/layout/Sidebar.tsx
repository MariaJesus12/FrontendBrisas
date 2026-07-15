import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Divider,
} from '@mui/material'
import { useNavigate, useLocation } from 'react-router-dom'
import DashboardIcon from '@mui/icons-material/Dashboard'
import EventSeatIcon from '@mui/icons-material/EventSeat'
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu'
import StarIcon from '@mui/icons-material/Star'
import ReceiptIcon from '@mui/icons-material/Receipt'
import PeopleAltIcon from '@mui/icons-material/PeopleAlt'
import CampaignIcon from '@mui/icons-material/Campaign'
import { useAuth } from '@/hooks/useAuth'
import { normalizeRole } from '@/utils/roles'

const DRAWER_WIDTH = 240
const COLOR_GOLD = '#D4AF37'
const COLOR_TEXT = '#F3E9D2'

const adminNavItems = [
  { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
  { label: 'Mesas', path: '/mesas', icon: <EventSeatIcon /> },
  { label: 'Reservaciones', path: '/reservaciones', icon: <EventSeatIcon /> },
  { label: 'Menú', path: '/menu', icon: <RestaurantMenuIcon /> },
  { label: 'Plato del Mes', path: '/plato-del-mes', icon: <StarIcon /> },
  { label: 'Anuncios', path: '/anuncios', icon: <CampaignIcon /> },
  { label: 'Pedidos', path: '/pedidos', icon: <ReceiptIcon /> },
  { label: 'Usuarios', path: '/usuarios', icon: <PeopleAltIcon /> },
]

const staffNavItems = [
  { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
  { label: 'Mesas', path: '/mesas', icon: <EventSeatIcon /> },
  { label: 'Reservaciones', path: '/reservaciones', icon: <EventSeatIcon /> },
  { label: 'Pedidos', path: '/pedidos', icon: <ReceiptIcon /> },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const role = normalizeRole(user)
  const navItems = role === 'ADMIN' ? adminNavItems : staffNavItems

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          background:
            'linear-gradient(180deg, rgba(10,10,10,0.98) 0%, rgba(18,10,8,0.98) 100%), radial-gradient(circle at 10% 10%, rgba(212,175,55,0.12) 0%, transparent 32%)',
          color: COLOR_TEXT,
          borderRight: '1px solid rgba(212,175,55,0.42)',
          boxShadow: '8px 0 24px rgba(0,0,0,0.35)',
        },
      }}
    >
      <Toolbar>
        <Typography
          variant="h6"
          sx={{ fontWeight: 'bold', color: COLOR_GOLD, fontFamily: '"Playfair Display", serif' }}
        >
          Brisas
        </Typography>
      </Toolbar>
      <Divider sx={{ borderColor: 'rgba(212,175,55,0.3)' }} />
      <List>
        {navItems.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => navigate(item.path)}
              sx={{
                mx: 1,
                my: 0.35,
                borderRadius: 1.5,
                color: 'rgba(243,233,210,0.86)',
                '& .MuiListItemIcon-root': {
                  color: 'rgba(212,175,55,0.85)',
                  minWidth: 40,
                },
                '&:hover': {
                  backgroundColor: 'rgba(212,175,55,0.1)',
                  color: COLOR_TEXT,
                },
                '&.Mui-selected': {
                  backgroundColor: 'rgba(212,175,55,0.16)',
                  border: '1px solid rgba(212,175,55,0.45)',
                  color: COLOR_TEXT,
                  '& .MuiListItemIcon-root': {
                    color: COLOR_GOLD,
                  },
                },
                '&.Mui-selected:hover': {
                  backgroundColor: 'rgba(212,175,55,0.2)',
                },
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText
                primary={
                  <Typography sx={{ fontWeight: 500, fontSize: '0.96rem', color: 'inherit' }}>
                    {item.label}
                  </Typography>
                }
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Drawer>
  )
}
