import { Box, Button, Card, CardContent, Chip, Container, Divider, Stack, Typography } from '@mui/material'
import RestaurantIcon from '@mui/icons-material/Restaurant'
import LocalBarIcon from '@mui/icons-material/LocalBar'
import LunchDiningIcon from '@mui/icons-material/LunchDining'
import EmojiFoodBeverageIcon from '@mui/icons-material/EmojiFoodBeverage'
import StarIcon from '@mui/icons-material/Star'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk'
import RateReviewIcon from '@mui/icons-material/RateReview'
import CampaignIcon from '@mui/icons-material/Campaign'
import { Link as RouterLink } from 'react-router-dom'

const COLOR_GOLD = '#D4AF37'
const COLOR_BLACK = '#070707'
const COLOR_TEXT = '#f3efe6'
const COLOR_TEXT_SOFT = '#fff8e8'
const COLOR_TEXT_MUTED = '#e8dcc0'

const LOGO_URL = new URL('@/assets/logobrisassinfondo.jpeg', import.meta.url).href

const WHATSAPP_URL = 'https://wa.me/51999999999'
const PHONE_NUMBER = '+51 999 999 999'
const PHONE_HREF = 'tel:+51999999999'
const TRIPADVISOR_URL = 'https://www.tripadvisor.com/'

const featuredDishes = [
  {
    name: 'Ribeye a la Brasa',
    description: 'Corte premium sellado al fuego, mantequilla de ajo asado y papas rústicas.',
    price: '$24.90',
    badge: 'Chef Selection',
  },
  {
    name: 'Risotto del Lago',
    description: 'Arroz cremoso con hongos, queso curado y aceite de trufa.',
    price: '$19.50',
    badge: 'Favorito',
  },
  {
    name: 'Salmón Mediterráneo',
    description: 'Salmón al horno con costra de hierbas, vegetales grillados y limón confitado.',
    price: '$22.00',
    badge: 'Especial',
  },
]

const categories = [
  {
    title: 'Entradas',
    icon: <LunchDiningIcon sx={{ color: COLOR_GOLD }} />,
    items: ['Carpaccio de res', 'Bruschettas artesanales', 'Crema de zapallo y parmesano'],
  },
  {
    title: 'Platos Fuertes',
    icon: <RestaurantIcon sx={{ color: COLOR_GOLD }} />,
    items: ['Lomo fino en salsa de vino', 'Pasta trufada con pollo', 'Pesca del día al grill'],
  },
  {
    title: 'Bebidas y Postres',
    icon: <LocalBarIcon sx={{ color: COLOR_GOLD }} />,
    items: ['Cocteles de autor', 'Selección de vinos', 'Tiramisu clásico'],
  },
]

const openingHours = [
  { day: 'Lunes a Jueves', hours: '12:00 pm - 10:00 pm' },
  { day: 'Viernes y Sabado', hours: '12:00 pm - 11:30 pm' },
  { day: 'Domingo', hours: '12:00 pm - 9:30 pm' },
]

const announcements = [
  {
    title: 'Semana del Mar',
    detail: 'Del 10 al 17 de julio: menu especial de mariscos con maridaje sugerido.',
  },
  {
    title: 'Noche de Jazz & Cena',
    detail: 'Todos los viernes desde las 8:00 pm. Reserva con anticipacion.',
  },
  {
    title: 'Celebraciones Privadas',
    detail: 'Espacios para cumpleaños, aniversarios y eventos corporativos.',
  },
]

const dishOfTheMonth = {
  name: 'Pulpo Brasa del Mes',
  description:
    'Pulpo crocante sobre crema de papa ahumada, emulsión cítrica y aceite de pimentón.',
  price: '$23.90',
}

export default function PublicMenuPage() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        color: COLOR_TEXT,
        backgroundColor: COLOR_BLACK,
        backgroundImage: `
          radial-gradient(circle at 10% 10%, rgba(212, 175, 55, 0.12) 0%, transparent 28%),
          radial-gradient(circle at 90% 15%, rgba(107, 20, 37, 0.25) 0%, transparent 30%),
          radial-gradient(circle at 20% 85%, rgba(107, 20, 37, 0.2) 0%, transparent 34%),
          linear-gradient(180deg, #050505 0%, #0a0a0a 100%)
        `,
        position: 'relative',
        overflow: 'hidden',
        '& .MuiTypography-root': {
          color: COLOR_TEXT_SOFT,
        },
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          opacity: 0.16,
          pointerEvents: 'none',
          backgroundImage: `
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'%3E%3Cg fill='none' stroke='%23D4AF37' stroke-width='1.4' opacity='0.55'%3E%3Ccircle cx='35' cy='42' r='14'/%3E%3Cpath d='M70 38q10-8 20 0q-10 8-20 0z'/%3E%3Crect x='112' y='30' width='26' height='18' rx='4'/%3E%3Cpath d='M25 118q15-16 30 0'/%3E%3Cpath d='M80 115l8-20l8 20z'/%3E%3Ccircle cx='130' cy='118' r='10'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '180px 180px',
        }}
      />

      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1, py: { xs: 4, md: 6 } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{
            mb: 5,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Stack direction="row" spacing={1.2} sx={{ alignItems: 'center' }}>
            <EmojiFoodBeverageIcon sx={{ color: COLOR_GOLD }} />
            <Typography
              sx={{
                fontFamily: '"Playfair Display", serif',
                letterSpacing: '1px',
                fontSize: { xs: '1.2rem', md: '1.4rem' },
                color: COLOR_TEXT_SOFT,
              }}
            >
              Brisas del Lago
            </Typography>
          </Stack>

          <Button
            component={RouterLink}
            to="/login"
            variant="outlined"
            sx={{
              borderColor: COLOR_GOLD,
              color: COLOR_GOLD,
              fontFamily: '"Cormorant Garamond", serif',
              letterSpacing: '0.8px',
              px: 2.5,
              '&:hover': {
                borderColor: COLOR_GOLD,
                backgroundColor: 'rgba(212,175,55,0.08)',
              },
            }}
          >
            Acceso Staff
          </Button>
        </Stack>

        <Card
          sx={{
            border: `1.5px solid ${COLOR_GOLD}`,
            borderRadius: 4,
            background: 'rgba(12, 12, 12, 0.44)',
            backdropFilter: 'blur(22px)',
            WebkitBackdropFilter: 'blur(22px)',
            boxShadow: '0 18px 46px rgba(0,0,0,0.45), inset 0 0 20px rgba(212,175,55,0.08)',
            mb: 5,
          }}
        >
          <CardContent sx={{ p: { xs: 3, md: 5 } }}>
            <Stack spacing={2.2} sx={{ alignItems: 'center', textAlign: 'center' }}>
              <Box
                component="img"
                src={LOGO_URL}
                alt="Brisas del Lago"
                sx={{ width: { xs: 200, md: 280 }, maxWidth: '100%', height: 'auto' }}
              />

              <Typography
                sx={{
                  fontFamily: '"Playfair Display", serif',
                  fontSize: { xs: '2rem', md: '3rem' },
                  lineHeight: 1.1,
                  background: `linear-gradient(180deg, #f6df95 0%, ${COLOR_GOLD} 70%)`,
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Menu Signature
              </Typography>

              <Typography
                sx={{
                  fontFamily: '"Cormorant Garamond", serif',
                  fontSize: { xs: '1.05rem', md: '1.2rem' },
                  maxWidth: 680,
                  opacity: 1,
                  color: COLOR_TEXT_MUTED,
                }}
              >
                Cocina contemporanea con alma tradicional. Ingredientes frescos, tecnica precisa y una experiencia pensada para disfrutar cada detalle.
              </Typography>

              <Stack direction="row" spacing={1.2} useFlexGap sx={{ flexWrap: 'wrap', justifyContent: 'center' }}>
                <Chip
                  icon={<StarIcon />}
                  label="Cocina de autor"
                  sx={{
                    color: COLOR_TEXT_SOFT,
                    borderColor: COLOR_GOLD,
                    '& .MuiChip-label': { color: COLOR_TEXT_SOFT },
                    '& .MuiChip-icon': { color: COLOR_GOLD },
                  }}
                  variant="outlined"
                />
                <Chip
                  icon={<AccessTimeIcon />}
                  label="Abierto 12:00 - 23:00"
                  sx={{
                    color: COLOR_TEXT_SOFT,
                    borderColor: COLOR_GOLD,
                    '& .MuiChip-label': { color: COLOR_TEXT_SOFT },
                    '& .MuiChip-icon': { color: COLOR_GOLD },
                  }}
                  variant="outlined"
                />
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Stack spacing={2.2} sx={{ mb: 4 }}>
          <Typography
            sx={{
              fontFamily: '"Playfair Display", serif',
              fontSize: { xs: '1.7rem', md: '2.2rem' },
              color: COLOR_GOLD,
              textAlign: 'center',
            }}
          >
            Destacados de la Casa
          </Typography>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            {featuredDishes.map((dish) => (
              <Card
                key={dish.name}
                sx={{
                  flex: 1,
                  border: `1px solid rgba(212,175,55,0.45)`,
                  borderRadius: 3,
                  background: 'rgba(16, 16, 16, 0.6)',
                  backdropFilter: 'blur(14px)',
                  WebkitBackdropFilter: 'blur(14px)',
                  transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 12px 34px rgba(212,175,55,0.18)',
                  },
                }}
              >
                <CardContent sx={{ p: 2.2 }}>
                  <Stack spacing={1.1}>
                    <Chip
                      label={dish.badge}
                      size="small"
                      sx={{
                        width: 'fit-content',
                        color: COLOR_GOLD,
                        border: `1px solid rgba(212,175,55,0.7)`,
                        backgroundColor: 'rgba(212,175,55,0.08)',
                        fontFamily: '"Cormorant Garamond", serif',
                      }}
                    />
                    <Typography sx={{ fontFamily: '"Playfair Display", serif', fontSize: '1.35rem' }}>{dish.name}</Typography>
                    <Typography sx={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '1.03rem', opacity: 0.86 }}>
                      {dish.description}
                    </Typography>
                    <Typography sx={{ color: COLOR_GOLD, fontFamily: '"Playfair Display", serif', fontSize: '1.4rem' }}>{dish.price}</Typography>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Stack>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 4 }}>
          <Card
            sx={{
              flex: 1,
              border: `1px solid rgba(212,175,55,0.45)`,
              borderRadius: 3,
              background: 'rgba(12, 12, 12, 0.58)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" spacing={1} sx={{ mb: 1.5, alignItems: 'center' }}>
                <AccessTimeIcon sx={{ color: COLOR_GOLD }} />
                <Typography sx={{ fontFamily: '"Playfair Display", serif', fontSize: '1.4rem', color: COLOR_GOLD }}>
                  Horarios
                </Typography>
              </Stack>

              <Stack spacing={1}>
                {openingHours.map((slot) => (
                  <Box key={slot.day} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                    <Typography sx={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '1.05rem', opacity: 0.9 }}>
                      {slot.day}
                    </Typography>
                    <Typography sx={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '1.05rem', color: COLOR_GOLD }}>
                      {slot.hours}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>

          <Card
            sx={{
              flex: 1,
              border: `1px solid rgba(212,175,55,0.45)`,
              borderRadius: 3,
              background: 'rgba(12, 12, 12, 0.58)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Typography sx={{ fontFamily: '"Playfair Display", serif', fontSize: '1.4rem', color: COLOR_GOLD, mb: 1.5 }}>
                Contacto y Resenas
              </Typography>

              <Stack spacing={1.2}>
                <Button
                  component="a"
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noreferrer"
                  startIcon={<WhatsAppIcon />}
                  sx={{
                    justifyContent: 'flex-start',
                    border: `1px solid rgba(212,175,55,0.5)`,
                    color: COLOR_TEXT_SOFT,
                    fontFamily: '"Cormorant Garamond", serif',
                    fontWeight: 600,
                    '&:hover': { backgroundColor: 'rgba(212,175,55,0.1)' },
                  }}
                >
                  WhatsApp
                </Button>

                <Button
                  component="a"
                  href={PHONE_HREF}
                  startIcon={<PhoneInTalkIcon />}
                  sx={{
                    justifyContent: 'flex-start',
                    border: `1px solid rgba(212,175,55,0.5)`,
                    color: COLOR_TEXT_SOFT,
                    fontFamily: '"Cormorant Garamond", serif',
                    fontWeight: 600,
                    '&:hover': { backgroundColor: 'rgba(212,175,55,0.1)' },
                  }}
                >
                  {PHONE_NUMBER}
                </Button>

                <Button
                  component="a"
                  href={TRIPADVISOR_URL}
                  target="_blank"
                  rel="noreferrer"
                  startIcon={<RateReviewIcon />}
                  sx={{
                    justifyContent: 'flex-start',
                    border: `1px solid rgba(212,175,55,0.5)`,
                    color: COLOR_TEXT_SOFT,
                    fontFamily: '"Cormorant Garamond", serif',
                    fontWeight: 600,
                    '&:hover': { backgroundColor: 'rgba(212,175,55,0.1)' },
                  }}
                >
                  Ver reseñas en TripAdvisor
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Stack>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 4 }}>
          <Card
            sx={{
              flex: 1,
              border: `1px solid rgba(212,175,55,0.55)`,
              borderRadius: 3,
              background: 'rgba(18, 12, 12, 0.62)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Chip
                label="Plato del Mes"
                size="small"
                sx={{
                  color: COLOR_GOLD,
                  border: `1px solid rgba(212,175,55,0.8)`,
                  backgroundColor: 'rgba(212,175,55,0.1)',
                  fontFamily: '"Cormorant Garamond", serif',
                  '& .MuiChip-label': { color: COLOR_GOLD },
                  mb: 1.2,
                }}
                variant="outlined"
              />
              <Typography sx={{ fontFamily: '"Playfair Display", serif', fontSize: '1.6rem', mb: 0.8 }}>
                {dishOfTheMonth.name}
              </Typography>
              <Typography sx={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '1.05rem', opacity: 1, color: COLOR_TEXT_MUTED, mb: 1.1 }}>
                {dishOfTheMonth.description}
              </Typography>
              <Typography sx={{ color: COLOR_GOLD, fontFamily: '"Playfair Display", serif', fontSize: '1.5rem' }}>
                {dishOfTheMonth.price}
              </Typography>
            </CardContent>
          </Card>

          <Card
            sx={{
              flex: 1,
              border: `1px solid rgba(212,175,55,0.45)`,
              borderRadius: 3,
              background: 'rgba(12, 12, 12, 0.58)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" spacing={1} sx={{ mb: 1.2, alignItems: 'center' }}>
                <CampaignIcon sx={{ color: COLOR_GOLD }} />
                <Typography sx={{ fontFamily: '"Playfair Display", serif', fontSize: '1.45rem', color: COLOR_GOLD }}>
                  Anuncios
                </Typography>
              </Stack>

              <Stack spacing={1.1}>
                {announcements.map((item) => (
                  <Box key={item.title} sx={{ borderLeft: `2px solid ${COLOR_GOLD}`, pl: 1.2 }}>
                    <Typography sx={{ fontFamily: '"Playfair Display", serif', fontSize: '1.05rem' }}>{item.title}</Typography>
                    <Typography sx={{ fontFamily: '"Cormorant Garamond", serif', fontSize: '1rem', opacity: 1, color: COLOR_TEXT_MUTED }}>
                      {item.detail}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Stack>

        <Card
          sx={{
            border: `1px solid rgba(212,175,55,0.45)`,
            borderRadius: 3,
            background: 'rgba(12, 12, 12, 0.58)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
            <Typography
              sx={{
                fontFamily: '"Playfair Display", serif',
                fontSize: { xs: '1.6rem', md: '1.9rem' },
                color: COLOR_GOLD,
                textAlign: 'center',
                mb: 2,
              }}
            >
              Carta Completa
            </Typography>

            <Divider sx={{ borderColor: 'rgba(212,175,55,0.25)', mb: 2.2 }} />

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              {categories.map((section) => (
                <Box key={section.title} sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: 'center' }}>
                    {section.icon}
                    <Typography sx={{ fontFamily: '"Playfair Display", serif', fontSize: '1.35rem' }}>{section.title}</Typography>
                  </Stack>

                  <Stack spacing={0.7}>
                    {section.items.map((item) => (
                      <Typography
                        key={item}
                        sx={{
                          fontFamily: '"Cormorant Garamond", serif',
                          fontSize: '1.05rem',
                          opacity: 1,
                          color: COLOR_TEXT_MUTED,
                        }}
                      >
                        • {item}
                      </Typography>
                    ))}
                  </Stack>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Container>

      <Box
        sx={{
          position: 'absolute',
          bottom: 18,
          width: '100%',
          textAlign: 'center',
          opacity: 0.9,
          color: COLOR_TEXT_MUTED,
          fontFamily: '"Cormorant Garamond", serif',
          letterSpacing: '0.8px',
          fontSize: '0.95rem',
        }}
      >
        Brisas del Lago · Experiencia Gastronomica
      </Box>
    </Box>
  )
}
