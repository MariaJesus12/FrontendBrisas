import { useState } from 'react'
import axios from 'axios'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Box, Button, TextField, Typography, CircularProgress, InputAdornment, IconButton } from '@mui/material'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { loginSchema, type LoginFormData } from '@/schemas/auth.schema'
import { authService } from '@/services/auth.service'
import { useAuth } from '@/hooks/useAuth'
import { getDefaultRouteByRole } from '@/utils/roles'
import logoImage from '@/assets/logo.png'

// ── Paleta Brisas ───────────────────────────────────────────
const COLOR_RED = '#C41E3A'
const COLOR_GOLD = '#D4AF37'
const COLOR_BLACK = '#000000'
const COLOR_GRAY = '#E8E8E8'

// ── Logo URL ─────────────────────────────────────────────────
const LOGO_URL = logoImage

// ── Decorative Food Elements - Full Background ─────────────────
const FoodDecorations = () => (
  <Box sx={{ position: 'absolute', width: '100%', height: '100%', overflow: 'hidden' }}>
    {/* Row 1 - Top */}
    {/* Apple - Left */}
    <svg style={{ position: 'absolute', left: '2%', top: '5%', width: '65px', height: '65px', opacity: 0.12 }} viewBox="0 0 100 100">
      <circle cx="50" cy="55" r="35" fill="none" stroke={COLOR_GOLD} strokeWidth="2.5" />
      <path d="M50 20v15" stroke={COLOR_GOLD} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M48 22Q45 20 42 22" fill="none" stroke={COLOR_GOLD} strokeWidth="2" />
    </svg>

    {/* Bottle - Center Left */}
    <svg style={{ position: 'absolute', left: '12%', top: '3%', width: '50px', height: '90px', opacity: 0.11 }} viewBox="0 0 50 100">
      <circle cx="25" cy="15" r="8" fill="none" stroke={COLOR_GOLD} strokeWidth="2" />
      <path d="M20 23L22 65Q22 75 30 78Q38 75 38 65L40 23" fill="none" stroke={COLOR_GOLD} strokeWidth="2.5" />
      <ellipse cx="30" cy="80" rx="10" ry="5" fill="none" stroke={COLOR_GOLD} strokeWidth="2" />
    </svg>

    {/* Tomato - Center */}
    <svg style={{ position: 'absolute', left: '24%', top: '8%', width: '60px', height: '60px', opacity: 0.13 }} viewBox="0 0 100 100">
      <circle cx="45" cy="55" r="28" fill="none" stroke={COLOR_GOLD} strokeWidth="2.5" />
      <circle cx="55" cy="50" r="28" fill="none" stroke={COLOR_GOLD} strokeWidth="2.5" />
      <path d="M50 20v20" stroke={COLOR_GOLD} strokeWidth="2" strokeLinecap="round" />
    </svg>

    {/* Carrot - Right */}
    <svg style={{ position: 'absolute', right: '18%', top: '5%', width: '55px', height: '70px', opacity: 0.12, transform: 'rotate(-25deg)' }} viewBox="0 0 50 100">
      <path d="M25 15L12 75L25 85L38 75Z" fill="none" stroke={COLOR_GOLD} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M20 15Q15 12 10 8" fill="none" stroke={COLOR_GOLD} strokeWidth="1.5" />
    </svg>

    {/* Garlic - Right */}
    <svg style={{ position: 'absolute', right: '3%', top: '10%', width: '60px', height: '60px', opacity: 0.11 }} viewBox="0 0 100 100">
      <circle cx="35" cy="40" r="20" fill="none" stroke={COLOR_GOLD} strokeWidth="2.5" />
      <circle cx="50" cy="35" r="20" fill="none" stroke={COLOR_GOLD} strokeWidth="2.5" />
      <circle cx="45" cy="55" r="18" fill="none" stroke={COLOR_GOLD} strokeWidth="2.5" />
    </svg>

    {/* Row 2 - Middle */}
    {/* Plate with Food - Left */}
    <svg style={{ position: 'absolute', left: '5%', top: '35%', width: '80px', height: '80px', opacity: 0.13 }} viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="45" fill="none" stroke={COLOR_GOLD} strokeWidth="2.5" />
      <circle cx="50" cy="50" r="35" fill="none" stroke={COLOR_GOLD} strokeWidth="1.5" />
      <path d="M30 50Q35 35 50 30Q65 35 70 50" fill="none" stroke={COLOR_GOLD} strokeWidth="2" />
      <circle cx="50" cy="65" r="12" fill="none" stroke={COLOR_GOLD} strokeWidth="2" />
    </svg>

    {/* Fork - Center Left */}
    <svg style={{ position: 'absolute', left: '18%', top: '38%', width: '70px', height: '75px', opacity: 0.12 }} viewBox="0 0 100 100">
      <path d="M50 15v45M32 30h36M32 50h36M50 60v30M38 60l-5 25M50 60l0 30M62 60l5 25" stroke={COLOR_GOLD} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>

    {/* Strawberry - Center */}
    <svg style={{ position: 'absolute', left: '45%', top: '40%', width: '60px', height: '65px', opacity: 0.12 }} viewBox="0 0 100 100">
      <path d="M50 25L35 45Q30 55 35 70Q50 80 65 70Q70 55 65 45Z" fill="none" stroke={COLOR_GOLD} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="40" cy="45" r="3" fill={COLOR_GOLD} opacity="0.5" />
      <circle cx="50" cy="50" r="3" fill={COLOR_GOLD} opacity="0.5" />
      <circle cx="60" cy="45" r="3" fill={COLOR_GOLD} opacity="0.5" />
      <path d="M45 22L50 15L55 22" stroke={COLOR_GOLD} strokeWidth="1.5" fill="none" />
    </svg>

    {/* Knife - Right */}
    <svg style={{ position: 'absolute', right: '8%', top: '35%', width: '60px', height: '90px', opacity: 0.13, transform: 'rotate(15deg)' }} viewBox="0 0 50 100">
      <path d="M25 10L22 50L25 88L28 50Z" fill="none" stroke={COLOR_GOLD} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="25" cy="92" r="6" fill="none" stroke={COLOR_GOLD} strokeWidth="2" />
    </svg>

    {/* Grapes - Far Right */}
    <svg style={{ position: 'absolute', right: '2%', top: '40%', width: '65px', height: '75px', opacity: 0.11 }} viewBox="0 0 100 100">
      <path d="M50 20L45 30M50 20L50 30M50 20L55 30" stroke={COLOR_GOLD} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="40" cy="40" r="12" fill="none" stroke={COLOR_GOLD} strokeWidth="2.5" />
      <circle cx="55" cy="40" r="12" fill="none" stroke={COLOR_GOLD} strokeWidth="2.5" />
      <circle cx="50" cy="55" r="12" fill="none" stroke={COLOR_GOLD} strokeWidth="2.5" />
      <circle cx="40" cy="65" r="12" fill="none" stroke={COLOR_GOLD} strokeWidth="2.5" />
      <circle cx="60" cy="65" r="12" fill="none" stroke={COLOR_GOLD} strokeWidth="2.5" />
    </svg>

    {/* Row 3 - Bottom */}
    {/* Lemon - Left */}
    <svg style={{ position: 'absolute', left: '8%', top: '72%', width: '60px', height: '60px', opacity: 0.12 }} viewBox="0 0 100 100">
      <path d="M50 30Q60 40 55 60Q40 70 35 55Q40 40 50 30" fill="none" stroke={COLOR_GOLD} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="50" cy="50" r="15" fill="none" stroke={COLOR_GOLD} strokeWidth="1.5" />
    </svg>

    {/* Spoon - Center Left */}
    <svg style={{ position: 'absolute', left: '22%', top: '75%', width: '65px', height: '80px', opacity: 0.13, transform: 'rotate(-18deg)' }} viewBox="0 0 50 100">
      <ellipse cx="25" cy="25" rx="18" ry="23" fill="none" stroke={COLOR_GOLD} strokeWidth="2.5" />
      <line x1="25" y1="48" x2="25" y2="92" stroke={COLOR_GOLD} strokeWidth="3" strokeLinecap="round" />
    </svg>

    {/* Wine Glass - Center */}
    <svg style={{ position: 'absolute', left: '50%', bottom: '8%', transform: 'translateX(-50%)', width: '50px', height: '80px', opacity: 0.12 }} viewBox="0 0 50 100">
      <path d="M15 15L18 48Q18 60 30 65Q42 60 42 48L45 15" fill="none" stroke={COLOR_GOLD} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="25" y1="65" x2="25" y2="92" stroke={COLOR_GOLD} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="25" cy="97" r="6" fill="none" stroke={COLOR_GOLD} strokeWidth="2" />
    </svg>

    {/* Bread - Center Right */}
    <svg style={{ position: 'absolute', right: '22%', top: '78%', width: '65px', height: '55px', opacity: 0.11 }} viewBox="0 0 100 100">
      <path d="M25 60L30 25Q30 15 50 15Q70 15 70 25L75 60" fill="none" stroke={COLOR_GOLD} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="40" y1="30" x2="40" y2="55" stroke={COLOR_GOLD} strokeWidth="1.5" opacity="0.6" />
      <line x1="60" y1="30" x2="60" y2="55" stroke={COLOR_GOLD} strokeWidth="1.5" opacity="0.6" />
    </svg>

    {/* Cheese - Right */}
    <svg style={{ position: 'absolute', right: '5%', top: '75%', width: '65px', height: '65px', opacity: 0.12 }} viewBox="0 0 100 100">
      <path d="M25 35L25 70L75 70L75 35Q75 25 65 25L35 25Q25 25 25 35" fill="none" stroke={COLOR_GOLD} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="45" cy="55" r="6" fill="none" stroke={COLOR_GOLD} strokeWidth="1.5" opacity="0.6" />
      <circle cx="60" cy="50" r="6" fill="none" stroke={COLOR_GOLD} strokeWidth="1.5" opacity="0.6" />
    </svg>

    {/* Row 4 - Additional scattered elements */}
    {/* Small Bottle Top Right */}
    <svg style={{ position: 'absolute', right: '12%', top: '15%', width: '45px', height: '75px', opacity: 0.1 }} viewBox="0 0 50 100">
      <circle cx="25" cy="12" r="7" fill="none" stroke={COLOR_GOLD} strokeWidth="2" />
      <path d="M20 20L22 60Q22 70 28 73Q34 70 34 60L36 20" fill="none" stroke={COLOR_GOLD} strokeWidth="2" />
    </svg>

    {/* Mushroom - Left Bottom */}
    <svg style={{ position: 'absolute', left: '35%', top: '12%', width: '60px', height: '65px', opacity: 0.11 }} viewBox="0 0 100 100">
      <path d="M35 45Q35 25 50 20Q65 25 65 45" fill="none" stroke={COLOR_GOLD} strokeWidth="2.5" strokeLinecap="round" />
      <rect x="45" y="45" width="10" height="35" fill="none" stroke={COLOR_GOLD} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="40" y1="55" x2="60" y2="55" stroke={COLOR_GOLD} strokeWidth="1" opacity="0.5" />
      <line x1="40" y1="65" x2="60" y2="65" stroke={COLOR_GOLD} strokeWidth="1" opacity="0.5" />
    </svg>

    {/* Orange - Right Top */}
    <svg style={{ position: 'absolute', right: '35%', top: '20%', width: '60px', height: '60px', opacity: 0.12 }} viewBox="0 0 100 100">
      <circle cx="50" cy="55" r="32" fill="none" stroke={COLOR_GOLD} strokeWidth="2.5" />
      <path d="M50 20v15" stroke={COLOR_GOLD} strokeWidth="2" strokeLinecap="round" />
      <circle cx="40" cy="50" r="6" fill="none" stroke={COLOR_GOLD} strokeWidth="1" opacity="0.5" />
      <circle cx="60" cy="50" r="6" fill="none" stroke={COLOR_GOLD} strokeWidth="1" opacity="0.5" />
      <circle cx="50" cy="65" r="6" fill="none" stroke={COLOR_GOLD} strokeWidth="1" opacity="0.5" />
    </svg>

    {/* Chef Hat - Bottom Center Right */}
    <svg style={{ position: 'absolute', right: '10%', bottom: '5%', width: '70px', height: '55px', opacity: 0.1 }} viewBox="0 0 100 80">
      <rect x="12" y="55" width="76" height="10" fill="none" stroke={COLOR_GOLD} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M28 55Q28 18 50 5Q72 18 72 55" fill="none" stroke={COLOR_GOLD} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  </Box>
)


export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true)
    try {
      const response = await authService.login(data)
      login(response.data.token, response.data.user)
      toast.success(`¡Bienvenido, ${response.data.user.nombre}!`)
      navigate(getDefaultRouteByRole(response.data.user))
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          toast.error('No se pudo conectar con el backend local. Verifica que este encendido.')
        } else if (error.response.status === 401) {
          toast.error('Credenciales incorrectas')
        } else {
          toast.error('Error de servidor. Intenta nuevamente en unos segundos.')
        }
      } else {
        toast.error('Ocurrio un error inesperado. Intenta nuevamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: COLOR_BLACK,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background Decorations */}
      <FoodDecorations />

      {/* Main Container */}
      <Box
        sx={{
          width: '100%',
          maxWidth: 420,
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Logo Section */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            mb: 5,
          }}
        >
          <Box
            component="img"
            src={LOGO_URL}
            alt="Brisas del Lago"
            onError={() => {
              console.warn('Logo not found at src/assets/logo.png')
            }}
            sx={{
              maxWidth: '100%',
              height: 'auto',
              maxHeight: 160,
            }}
          />
        </Box>

        {/* Form Card - Glass Effect */}
        <Box
          sx={{
            border: `1.5px solid ${COLOR_GOLD}`,
            borderRadius: '16px',
            p: 4.5,
            background: 'rgba(10, 10, 10, 0.35)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            boxShadow: `
              0 8px 48px rgba(196,30,58,0.25),
              inset 0 1px 20px rgba(212,175,55,0.15),
              0 0 2px rgba(212,175,55,0.5)
            `,
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: '0',
              left: '-100%',
              width: '200%',
              height: '100%',
              background: `linear-gradient(90deg, transparent, rgba(212,175,55,0.1), transparent)`,
              animation: 'shimmer 4s infinite',
            },
            '@keyframes shimmer': {
              '0%': { left: '-100%' },
              '100%': { left: '100%' },
            },
          }}
        >
          {/* Form Header */}
          <Box sx={{ mb: 3.5 }}>  
            <Typography
              variant="h6"
              sx={{
                color: COLOR_GOLD,
                fontWeight: 700,
                fontSize: '2rem',
                letterSpacing: '2px',
                fontFamily: '"Playfair Display", serif',
                background: `linear-gradient(135deg, ${COLOR_GOLD} 0%, #f5d547 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Iniciar Sesión
            </Typography>
          </Box>

          {/* Form */}
          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            {/* Email Field */}
            <Box sx={{ mb: 2.5 }}>
              <TextField
                fullWidth
                placeholder="usuario o correo"
                type="text"
                {...register('email')}
                error={!!errors.email}
                helperText={errors.email?.message}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailOutlinedIcon sx={{ color: COLOR_GOLD, mr: 1.5, fontSize: '1.3rem' }} />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: COLOR_GRAY,
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: `1.5px solid ${COLOR_GOLD}`,
                    borderRadius: '8px',
                    transition: 'all 0.3s ease',
                    fontFamily: '"Cormorant Garamond", serif',
                    '&:hover': {
                      borderColor: COLOR_GOLD,
                      boxShadow: `0 0 16px rgba(212,175,55,0.3), inset 0 0 8px rgba(212,175,55,0.05)`,
                    },
                    '&.Mui-focused': {
                      borderColor: COLOR_GOLD,
                      boxShadow: `0 0 24px rgba(212,175,55,0.4), inset 0 0 12px rgba(212,175,55,0.1)`,
                      '& fieldset': { borderColor: COLOR_GOLD },
                    },
                    '& fieldset': { borderColor: COLOR_GOLD },
                  },
                  '& .MuiInputBase-input': {
                    fontSize: '1rem',
                    fontFamily: '"Cormorant Garamond", serif',
                    fontWeight: 500,
                    '&::placeholder': { color: 'rgba(212,175,55,0.6)', opacity: 1 },
                  },
                  '& .MuiFormHelperText-root': { color: '#ff6b9d', fontSize: '0.8rem', fontFamily: '"Cormorant Garamond", serif' },
                }}
              />
            </Box>

            {/* Password Field */}
            <Box sx={{ mb: 3.5 }}>
              <TextField
                fullWidth
                placeholder="Contraseña"
                type={showPassword ? 'text' : 'password'}
                {...register('password')}
                error={!!errors.password}
                helperText={errors.password?.message}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlinedIcon sx={{ color: COLOR_GOLD, mr: 1.5, fontSize: '1.3rem' }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          size="small"
                          sx={{
                            color: COLOR_GOLD,
                            '&:hover': {
                              color: '#fff',
                            },
                          }}
                        >
                          {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: COLOR_GRAY,
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: `1.5px solid ${COLOR_GOLD}`,
                    borderRadius: '8px',
                    transition: 'all 0.3s ease',
                    fontFamily: '"Cormorant Garamond", serif',
                    '&:hover': {
                      borderColor: COLOR_GOLD,
                      boxShadow: `0 0 16px rgba(212,175,55,0.3), inset 0 0 8px rgba(212,175,55,0.05)`,
                    },
                    '&.Mui-focused': {
                      borderColor: COLOR_GOLD,
                      boxShadow: `0 0 24px rgba(212,175,55,0.4), inset 0 0 12px rgba(212,175,55,0.1)`,
                      '& fieldset': { borderColor: COLOR_GOLD },
                    },
                    '& fieldset': { borderColor: COLOR_GOLD },
                  },
                  '& .MuiInputBase-input': {
                    fontSize: '1rem',
                    fontFamily: '"Cormorant Garamond", serif',
                    fontWeight: 500,
                    '&::placeholder': { color: 'rgba(212,175,55,0.6)', opacity: 1 },
                  },
                  '& .MuiFormHelperText-root': { color: '#ff6b9d', fontSize: '0.8rem', fontFamily: '"Cormorant Garamond", serif' },
                }}
              />
            </Box>

            {/* Submit Button */}
            <Button
              type="submit"
              fullWidth
              disabled={loading}
              sx={{
                py: 1.4,
                fontSize: '1rem',
                fontWeight: 700,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                backgroundColor: COLOR_RED,
                color: '#fff',
                border: `2px solid ${COLOR_RED}`,
                borderRadius: '8px',
                fontFamily: '"Cormorant Garamond", serif',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                mt: 3,
                opacity: loading ? 0.7 : 1,
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: '-100%',
                  width: '100%',
                  height: '100%',
                  background: 'rgba(255,255,255,0.2)',
                  transition: 'left 0.3s ease',
                },
                '&:hover:not(:disabled)': {
                  backgroundColor: '#8b1729',
                  boxShadow: `0 0 30px rgba(196,30,58,0.5), inset 0 0 15px rgba(212,175,55,0.2)`,
                  transform: 'translateY(-2px)',
                  borderColor: COLOR_GOLD,
                  '&::before': {
                    left: '100%',
                  },
                },
              }}
            >
              {loading ? (
                <CircularProgress size={20} sx={{ color: COLOR_GOLD }} />
              ) : (
                'Ingresar'
              )}
            </Button>
          </Box>
        </Box>

        {/* Footer */}
        <Typography
          align="center"
          sx={{
            color: COLOR_GOLD,
            fontSize: '0.8rem',
            letterSpacing: '1px',
            mt: 4,
            opacity: 0.7,
            fontFamily: '"Cormorant Garamond", serif',
            fontWeight: 500,
          }}
        >
          © {new Date().getFullYear()} Brisas del Lago
        </Typography>
      </Box>
    </Box>
  )
}

