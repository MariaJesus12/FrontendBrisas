import { Box, Typography } from '@mui/material'
import ReceiptIcon from '@mui/icons-material/Receipt'

const COLOR_GOLD = '#D4AF37'
const COLOR_TEXT = '#F3E9D2'

export default function PedidosPage() {
  return (
    <Box sx={{ color: COLOR_TEXT }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <ReceiptIcon sx={{ color: COLOR_GOLD }} />
        <Typography
          variant="h4"
          sx={{ fontWeight: 'bold', color: COLOR_GOLD, fontFamily: '"Playfair Display", serif' }}
        >
          Pedidos
        </Typography>
      </Box>

      <Box
        sx={{
          p: 3,
          borderRadius: 2,
          backgroundColor: 'rgba(10,10,10,0.72)',
          border: '1px solid rgba(212,175,55,0.45)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
        }}
      >
        <Typography sx={{ color: 'rgba(243,233,210,0.82)' }}>
        Gestión de pedidos por mesa.
        </Typography>
      </Box>
    </Box>
  )
}
