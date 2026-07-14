import { AppBar, Toolbar, Typography, IconButton, Box, Chip } from '@mui/material'
import LogoutIcon from '@mui/icons-material/Logout'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { normalizeRole } from '@/utils/roles'

const COLOR_GOLD = '#D4AF37'
const COLOR_TEXT = '#F3E9D2'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const role = normalizeRole(user?.rol)

  const handleLogout = () => {
    logout()
    toast.info('Sesión cerrada')
    navigate('/login')
  }

  return (
    <AppBar
      position="static"
      color="transparent"
      elevation={0}
      sx={{
        background:
          'linear-gradient(180deg, rgba(8,8,8,0.94) 0%, rgba(12,8,7,0.92) 100%), radial-gradient(circle at 85% 20%, rgba(212,175,55,0.1) 0%, transparent 38%)',
        borderBottom: '1px solid rgba(212,175,55,0.4)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <Toolbar sx={{ minHeight: 66, backgroundColor: 'transparent' }}>
        <Typography variant="subtitle1" sx={{ flexGrow: 1 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <AccountCircleIcon sx={{ color: COLOR_GOLD }} />
          <Typography variant="body2" sx={{ fontWeight: 500, color: COLOR_TEXT }}>
            {user?.nombre}
          </Typography>
          <Chip
            label={role}
            size="small"
            variant="outlined"
            sx={{
              color: COLOR_GOLD,
              borderColor: 'rgba(212,175,55,0.55)',
              '& .MuiChip-label': { fontWeight: 600 },
            }}
          />
          <IconButton
            onClick={handleLogout}
            title="Cerrar sesión"
            size="small"
            sx={{ color: COLOR_GOLD, '&:hover': { backgroundColor: 'rgba(212,175,55,0.12)' } }}
          >
            <LogoutIcon />
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  )
}
