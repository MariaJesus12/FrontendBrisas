import { Box } from '@mui/material'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Navbar from './Navbar'

export default function MainLayout() {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Navbar />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 3,
            overflowY: 'auto',
            background:
              'radial-gradient(circle at 15% 20%, rgba(212,175,55,0.08) 0%, transparent 30%), linear-gradient(160deg, #050505 0%, #130a07 100%)',
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}
