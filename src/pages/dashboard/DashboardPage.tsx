import { Box, Grid, Paper, Typography } from '@mui/material'
import EventSeatIcon from '@mui/icons-material/EventSeat'
import ReceiptIcon from '@mui/icons-material/Receipt'
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu'
import StarIcon from '@mui/icons-material/Star'
import PeopleAltIcon from '@mui/icons-material/PeopleAlt'
import CampaignIcon from '@mui/icons-material/Campaign'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { normalizeRole } from '@/utils/roles'

const COLOR_GOLD = '#D4AF37'
const COLOR_TEXT = '#F3E9D2'

const adminCards = [
  { label: 'Mesas', icon: EventSeatIcon, path: '/mesas' },
  { label: 'Reservaciones', icon: EventSeatIcon, path: '/reservaciones' },
  { label: 'Pedidos', icon: ReceiptIcon, path: '/pedidos' },
  { label: 'Platos en Menú', icon: RestaurantMenuIcon, path: '/menu' },
  { label: 'Plato del Mes', icon: StarIcon, path: '/plato-del-mes' },
  { label: 'Anuncios', icon: CampaignIcon, path: '/anuncios' },
  { label: 'Usuarios', icon: PeopleAltIcon, path: '/usuarios' },
]

const staffCards = [
  { label: 'Mesas', icon: EventSeatIcon, path: '/mesas' },
  { label: 'Reservaciones', icon: EventSeatIcon, path: '/reservaciones' },
  { label: 'Pedidos', icon: ReceiptIcon, path: '/pedidos' },
]

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const role = normalizeRole(user)
  const cards = role === 'ADMIN' ? adminCards : staffCards

  return (
    <Box sx={{ color: COLOR_TEXT }}>
      <Typography
        variant="h4"
        sx={{ fontWeight: 'bold', color: COLOR_GOLD, fontFamily: '"Playfair Display", serif' }}
        gutterBottom
      >
        Dashboard
      </Typography>
      <Typography variant="body1" sx={{ mb: 3, color: 'rgba(243,233,210,0.8)' }}>
        {role === 'ADMIN'
          ? 'Bienvenido al panel de gestión de Brisas'
          : 'Panel operativo para mesas, reservaciones y pedidos'}
      </Typography>
      <Grid container spacing={3}>
        {cards.map(({ label, icon: Icon, path }) => (
          <Grid key={label} size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper
              component="button"
              type="button"
              onClick={() => navigate(path)}
              sx={{
                width: '100%',
                p: 3,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1,
                backgroundColor: 'rgba(10,10,10,0.72)',
                border: '1px solid rgba(212,175,55,0.45)',
                color: COLOR_TEXT,
                boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease',
                '&:hover': {
                  transform: 'translateY(-3px)',
                  borderColor: 'rgba(212,175,55,0.68)',
                  boxShadow: '0 14px 36px rgba(0,0,0,0.45)',
                },
                '&:focus-visible': {
                  outline: '2px solid rgba(212,175,55,0.95)',
                  outlineOffset: 2,
                },
              }}
            >
              <Box
                sx={{
                  color: COLOR_GOLD,
                  border: '1px solid rgba(212,175,55,0.55)',
                  backgroundColor: 'rgba(212,175,55,0.08)',
                  borderRadius: '50%',
                  p: 1.5,
                  display: 'flex',
                }}
              >
                <Icon />
              </Box>
              <Typography
                variant="h6"
                sx={{ fontWeight: 500, fontFamily: '"Cormorant Garamond", serif' }}
                align="center"
              >
                {label}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}
