import { useEffect, useState } from 'react'
import axios from 'axios'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import PeopleAltIcon from '@mui/icons-material/PeopleAlt'
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import type { User } from '@/types/auth.types'
import { usuariosService } from '@/services/usuarios.service'
import type { CreatedUser, RoleOption, UpdateUserRequest } from '@/types/usuario.types'

interface NewUserForm {
  nombre: string
  usuario: string
  rol_id: string
  password: string
}

interface EditUserForm {
  nombre: string
  usuario: string
  rol_id: string
  password: string
}

const initialUsers: User[] = []

const initialForm: NewUserForm = {
  nombre: '',
  usuario: '',
  rol_id: '',
  password: '',
}

const initialEditForm: EditUserForm = {
  nombre: '',
  usuario: '',
  rol_id: '',
  password: '',
}

const fallbackRoles: RoleOption[] = [
  { id: 1, nombre: 'ADMIN' },
  { id: 2, nombre: 'MESERO' },
  { id: 3, nombre: 'CAJERO' },
]

const COLOR_GOLD = '#D4AF37'
const COLOR_TEXT = '#F3E9D2'

function toPositiveNumber(value: unknown): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }
  return parsed
}

function extractUserIdentifier(record: Record<string, unknown>): string {
  const value = record.usuario ?? record.email ?? record.username ?? ''
  return typeof value === 'string' ? value : String(value ?? '')
}

function extractRoleValue(record: Record<string, unknown>): string {
  const directRoleName =
    record.rolNombre ??
    record.rolnombre ??
    record.rol_nombre ??
    record.roleName ??
    record.role_name

  if (typeof directRoleName === 'string' && directRoleName.trim()) {
    return directRoleName.trim()
  }

  const roleObject =
    typeof record.rol === 'object' && record.rol !== null
      ? (record.rol as Record<string, unknown>)
      : typeof record.role === 'object' && record.role !== null
        ? (record.role as Record<string, unknown>)
        : null

  const directName =
    roleObject?.nombre ??
    roleObject?.name

  if (typeof directName === 'string' && directName.trim()) {
    return directName.trim()
  }

  const directId =
    record.rol_id ??
    record.rolId ??
    record.role_id ??
    record.roleId ??
    (typeof record.rol === 'number' || typeof record.rol === 'string' ? record.rol : null) ??
    (typeof record.role === 'number' || typeof record.role === 'string' ? record.role : null) ??
    roleObject?.id

  const roleId = toPositiveNumber(directId)
  if (roleId !== null) {
    return String(roleId)
  }

  return ''
}

function normalizeRoles(input: RoleOption[] | string[]): RoleOption[] {
  if (!Array.isArray(input)) {
    return fallbackRoles
  }

  if (input.length === 0) {
    return fallbackRoles
  }

  if (typeof input[0] === 'string') {
    return (input as string[]).map((item, index) => ({ id: index + 1, nombre: item }))
  }

  return (input as Array<RoleOption & { rol_id?: number; name?: string }>).map((item, index) => ({
    id: toPositiveNumber(item.id ?? item.rol_id) ?? index + 1,
    nombre: item.nombre ?? item.name ?? `ROL ${index + 1}`,
  }))
}

function mapCreatedUserToUser(createdUser: CreatedUser): User {
  const record = createdUser as unknown as Record<string, unknown>
  return {
    id: createdUser.id,
    nombre: createdUser.nombre,
    email: extractUserIdentifier(record),
    rol: extractRoleValue(record),
  }
}

function mapListedUserToUser(item: CreatedUser | User): User {
  const record = item as unknown as Record<string, unknown>
  const fallbackUser = item as User
  return {
    id: fallbackUser.id,
    nombre: fallbackUser.nombre,
    email: extractUserIdentifier(record) || fallbackUser.email || '',
    rol: extractRoleValue(record) || fallbackUser.rol || '',
  }
}

function getRoleDisplayName(roleValue: string, roles: RoleOption[]): string {
  const normalized = String(roleValue).trim()
  if (!normalized || normalized.toLowerCase() === 'undefined' || normalized.toLowerCase() === 'null') {
    return 'Sin rol'
  }
  const numericRoleId = Number(normalized)

  if (Number.isFinite(numericRoleId) && numericRoleId > 0) {
    const matchedRole = roles.find((role) => Number(role.id) === numericRoleId)
    if (matchedRole) {
      return matchedRole.nombre
    }

    return `Rol #${numericRoleId}`
  }

  const matchedByName = roles.find(
    (role) => role.nombre.trim().toLowerCase() === normalized.toLowerCase(),
  )
  if (matchedByName) {
    return matchedByName.nombre
  }

  return normalized
}

function getRoleIdForForm(roleValue: string, roles: RoleOption[]): string {
  const normalized = String(roleValue ?? '').trim()
  if (!normalized) {
    return String(roles[0]?.id ?? '')
  }

  const numericRoleId = Number(normalized)
  if (Number.isFinite(numericRoleId) && numericRoleId > 0) {
    return String(numericRoleId)
  }

  const matchedByName = roles.find(
    (role) => role.nombre.trim().toLowerCase() === normalized.toLowerCase(),
  )
  if (matchedByName) {
    return String(matchedByName.id)
  }

  return String(roles[0]?.id ?? '')
}

function normalizeUsersPayload(payload: unknown): Array<CreatedUser | User> {
  if (Array.isArray(payload)) {
    return payload as Array<CreatedUser | User>
  }

  if (typeof payload === 'object' && payload !== null) {
    const candidate = payload as {
      users?: unknown
      usuarios?: unknown
      data?: unknown
      items?: unknown
    }

    if (Array.isArray(candidate.users)) {
      return candidate.users as Array<CreatedUser | User>
    }

    if (Array.isArray(candidate.usuarios)) {
      return candidate.usuarios as Array<CreatedUser | User>
    }

    if (Array.isArray(candidate.data)) {
      return candidate.data as Array<CreatedUser | User>
    }

    if (Array.isArray(candidate.items)) {
      return candidate.items as Array<CreatedUser | User>
    }
  }

  return []
}

function extractBackendMessage(payload: unknown): string {
  if (typeof payload === 'string') {
    return payload
  }

  if (typeof payload !== 'object' || payload === null) {
    return ''
  }

  const data = payload as {
    message?: unknown
    error?: unknown
    errors?: unknown
  }

  if (typeof data.message === 'string') {
    return data.message
  }

  if (Array.isArray(data.message)) {
    return data.message.map((item) => String(item)).join(' | ')
  }

  if (typeof data.error === 'string') {
    return data.error
  }

  if (Array.isArray(data.errors)) {
    return data.errors.map((item) => String(item)).join(' | ')
  }

  return ''
}

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [form, setForm] = useState<NewUserForm>(initialForm)
  const [message, setMessage] = useState<string>('')
  const [roles, setRoles] = useState<RoleOption[]>(fallbackRoles)
  const [loadingRoles, setLoadingRoles] = useState<boolean>(true)
  const [loadingUsers, setLoadingUsers] = useState<boolean>(true)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [showPassword, setShowPassword] = useState<boolean>(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState<EditUserForm>(initialEditForm)
  const [editingSubmitting, setEditingSubmitting] = useState<boolean>(false)
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null)

  useEffect(() => {
    const loadRoles = async () => {
      setLoadingRoles(true)
      try {
        const response = await usuariosService.getRoles()
        const normalized = normalizeRoles(response.data)
        setRoles(normalized)
        setForm((prev) => ({ ...prev, rol_id: String(normalized[0]?.id ?? '') }))
      } catch {
        setRoles(fallbackRoles)
        setForm((prev) => ({ ...prev, rol_id: String(fallbackRoles[0]?.id ?? '') }))
        setMessage('No se pudieron cargar roles del backend. Se usan roles por defecto.')
      } finally {
        setLoadingRoles(false)
      }
    }

    loadRoles()
  }, [])

  useEffect(() => {
    const loadUsers = async () => {
      setLoadingUsers(true)
      try {
        const response = await usuariosService.listUsers()
        const normalizedUsers = normalizeUsersPayload(response.data).map((item) => mapListedUserToUser(item))
        setUsers(normalizedUsers)
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const backendMessage = extractBackendMessage(error.response?.data)

          if (backendMessage) {
            setMessage(`No se pudo cargar usuarios: ${backendMessage}`)
          } else if (error.response?.status === 401) {
            setMessage('No autorizado para listar usuarios. Inicia sesión con un ADMIN.')
          } else if (error.response?.status === 403) {
            setMessage('Tu usuario no tiene permisos ADMIN para listar usuarios.')
          } else {
            setMessage(`No se pudo cargar el listado de usuarios del backend (HTTP ${error.response?.status ?? 'sin código'}).`)
          }
        } else {
          setMessage('No se pudo cargar el listado de usuarios del backend.')
        }
      } finally {
        setLoadingUsers(false)
      }
    }

    loadUsers()
  }, [])

  const handleChange = (field: keyof NewUserForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!form.nombre.trim() || !form.usuario.trim() || !form.password.trim() || !form.rol_id.trim()) {
      setMessage('Completa nombre, usuario, rol y clave para continuar.')
      return
    }

    const parsedRoleId = Number(form.rol_id)
    if (!Number.isFinite(parsedRoleId) || parsedRoleId <= 0) {
      setMessage('El rol seleccionado no es válido.')
      return
    }

    setSubmitting(true)
    try {
      const response = await usuariosService.createUser({
        nombre: form.nombre.trim(),
        usuario: form.usuario.trim(),
        password: form.password,
        rol_id: parsedRoleId,
      })

      const createdUser = mapCreatedUserToUser(response.data)
      setUsers((prev) => [createdUser, ...prev])
      setForm({ ...initialForm, rol_id: String(roles[0]?.id ?? '') })
      setMessage('Usuario creado correctamente en backend.')
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const backendMessage = extractBackendMessage(error.response?.data)

        if (!error.response) {
          setMessage('No hay conexión con backend para crear usuarios.')
        } else if (backendMessage) {
          setMessage(`No se pudo crear el usuario: ${backendMessage}`)
        } else {
          setMessage('No se pudo crear el usuario. Revisa datos y permisos de ADMIN.')
        }
      } else {
        setMessage('Ocurrió un error inesperado al crear el usuario.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const openEditDialog = (user: User) => {
    setEditingUser(user)
    setEditForm({
      nombre: user.nombre,
      usuario: user.email,
      rol_id: getRoleIdForForm(user.rol, roles),
      password: '',
    })
  }

  const closeEditDialog = () => {
    if (editingSubmitting) {
      return
    }
    setEditingUser(null)
    setEditForm(initialEditForm)
  }

  const handleEditChange = (field: keyof EditUserForm, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleUpdateUser = async () => {
    if (!editingUser) {
      return
    }

    if (!editForm.nombre.trim() || !editForm.usuario.trim() || !editForm.rol_id.trim()) {
      setMessage('Completa nombre, usuario y rol para actualizar.')
      return
    }

    const parsedRoleId = Number(editForm.rol_id)
    if (!Number.isFinite(parsedRoleId) || parsedRoleId <= 0) {
      setMessage('El rol seleccionado no es válido para actualizar.')
      return
    }

    const payload: UpdateUserRequest = {
      nombre: editForm.nombre.trim(),
      usuario: editForm.usuario.trim(),
      rol_id: parsedRoleId,
      ...(editForm.password.trim() ? { password: editForm.password } : {}),
    }

    setEditingSubmitting(true)
    try {
      await usuariosService.updateUser(editingUser.id, payload)
      setUsers((prev) =>
        prev.map((user) =>
          user.id === editingUser.id
            ? {
                ...user,
                nombre: payload.nombre,
                email: payload.usuario,
                rol: String(payload.rol_id),
              }
            : user,
        ),
      )
      setMessage('Usuario actualizado correctamente.')
      closeEditDialog()
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const backendMessage = extractBackendMessage(error.response?.data)
        if (error.response?.status === 404) {
          setMessage(
            backendMessage ||
              'No se encontró el endpoint PUT /api/users/:id en el backend (404).',
          )
        } else {
          setMessage(backendMessage || 'No se pudo actualizar el usuario.')
        }
      } else {
        setMessage('No se pudo actualizar el usuario.')
      }
    } finally {
      setEditingSubmitting(false)
    }
  }

  const handleDeleteUser = async (user: User) => {
    const confirmed = window.confirm(
      `¿Seguro que quieres eliminar al usuario "${user.nombre}" (ID ${user.id})?`,
    )
    if (!confirmed) {
      return
    }

    setDeletingUserId(user.id)
    try {
      await usuariosService.deleteUser(user.id)
      setUsers((prev) => prev.filter((item) => item.id !== user.id))
      setMessage('Usuario eliminado correctamente.')
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const backendMessage = extractBackendMessage(error.response?.data)
        if (error.response?.status === 404) {
          setMessage(
            backendMessage ||
              'No se encontró el endpoint DELETE /api/users/:id en el backend (404).',
          )
        } else {
          setMessage(backendMessage || 'No se pudo eliminar el usuario.')
        }
      } else {
        setMessage('No se pudo eliminar el usuario.')
      }
    } finally {
      setDeletingUserId(null)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100%',
        color: COLOR_TEXT,
        p: { xs: 2, md: 3 },
        borderRadius: 2,
        background: 'linear-gradient(160deg, rgba(5,5,5,0.95) 0%, rgba(20,10,5,0.95) 100%)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <PeopleAltIcon sx={{ color: COLOR_GOLD }} />
        <Typography
          variant="h4"
          sx={{
            fontWeight: 'bold',
            color: COLOR_GOLD,
            fontFamily: '"Playfair Display", serif',
            letterSpacing: '0.6px',
          }}
        >
          Usuarios
        </Typography>
      </Box>

      <Typography sx={{ mb: 3, color: 'rgba(243,233,210,0.8)' }}>
        Administración de usuarios del sistema conectada al backend.
      </Typography>

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3}>
        <Paper
          sx={{
            p: 3,
            flex: 1,
            backgroundColor: 'rgba(10,10,10,0.72)',
            border: `1px solid rgba(212,175,55,0.45)`,
            color: COLOR_TEXT,
            boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <PersonAddAlt1Icon sx={{ color: COLOR_GOLD }} />
            <Typography
              variant="h6"
              sx={{ fontWeight: 600, color: COLOR_GOLD, fontFamily: '"Playfair Display", serif' }}
            >
              Agregar Usuario
            </Typography>
          </Box>

          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={2}>
              <TextField
                label="Nombre"
                value={form.nombre}
                onChange={(e) => handleChange('nombre', e.target.value)}
                fullWidth
                sx={{
                  '& .MuiInputLabel-root': { color: 'rgba(243,233,210,0.75)' },
                  '& .MuiOutlinedInput-root': {
                    color: COLOR_TEXT,
                    '& fieldset': { borderColor: 'rgba(212,175,55,0.45)' },
                    '&:hover fieldset': { borderColor: COLOR_GOLD },
                    '&.Mui-focused fieldset': { borderColor: COLOR_GOLD },
                  },
                }}
              />

              <TextField
                label="Usuario"
                value={form.usuario}
                onChange={(e) => handleChange('usuario', e.target.value)}
                fullWidth
                sx={{
                  '& .MuiInputLabel-root': { color: 'rgba(243,233,210,0.75)' },
                  '& .MuiOutlinedInput-root': {
                    color: COLOR_TEXT,
                    '& fieldset': { borderColor: 'rgba(212,175,55,0.45)' },
                    '&:hover fieldset': { borderColor: COLOR_GOLD },
                    '&.Mui-focused fieldset': { borderColor: COLOR_GOLD },
                  },
                }}
              />

              <TextField
                label="Rol"
                select
                value={form.rol_id}
                onChange={(e) => handleChange('rol_id', e.target.value)}
                fullWidth
                disabled={loadingRoles}
                sx={{
                  '& .MuiInputLabel-root': { color: 'rgba(243,233,210,0.75)' },
                  '& .MuiOutlinedInput-root': {
                    color: COLOR_TEXT,
                    '& fieldset': { borderColor: 'rgba(212,175,55,0.45)' },
                    '&:hover fieldset': { borderColor: COLOR_GOLD },
                    '&.Mui-focused fieldset': { borderColor: COLOR_GOLD },
                  },
                }}
              >
                {roles.map((role) => (
                  <MenuItem key={role.id} value={String(role.id)}>
                    {role.nombre}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Clave"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => handleChange('password', e.target.value)}
                fullWidth
                sx={{
                  '& .MuiInputLabel-root': { color: 'rgba(243,233,210,0.75)' },
                  '& .MuiOutlinedInput-root': {
                    color: COLOR_TEXT,
                    '& fieldset': { borderColor: 'rgba(212,175,55,0.45)' },
                    '&:hover fieldset': { borderColor: COLOR_GOLD },
                    '&.Mui-focused fieldset': { borderColor: COLOR_GOLD },
                  },
                }}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        >
                          {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />

              <Button
                type="submit"
                variant="contained"
                disabled={submitting || loadingRoles}
                sx={{
                  backgroundColor: '#8F1D2E',
                  color: '#fff',
                  border: '1px solid #8F1D2E',
                  '&:hover': {
                    backgroundColor: '#781826',
                    borderColor: '#781826',
                  },
                }}
              >
                {submitting ? <CircularProgress size={20} color="inherit" /> : 'Guardar Usuario'}
              </Button>

              {message ? <Alert severity="info">{message}</Alert> : null}
            </Stack>
          </Box>
        </Paper>

        <Paper
          sx={{
            p: 3,
            flex: 1.2,
            backgroundColor: 'rgba(10,10,10,0.72)',
            border: `1px solid rgba(212,175,55,0.45)`,
            color: COLOR_TEXT,
            boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
          }}
        >
          <Typography
            variant="h6"
            sx={{ fontWeight: 600, mb: 2, color: COLOR_GOLD, fontFamily: '"Playfair Display", serif' }}
          >
            Usuarios Registrados
          </Typography>

          {loadingUsers ? (
            <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={26} />
            </Box>
          ) : null}

          <Table
            size="small"
            sx={{
              display: loadingUsers ? 'none' : 'table',
              '& .MuiTableCell-root': {
                color: COLOR_TEXT,
                borderBottom: '1px solid rgba(212,175,55,0.22)',
              },
              '& .MuiTableHead-root .MuiTableCell-root': {
                color: COLOR_GOLD,
                fontWeight: 700,
                fontFamily: '"Cormorant Garamond", serif',
              },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Nombre</TableCell>
                <TableCell>Usuario</TableCell>
                <TableCell>Rol</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ color: 'rgba(243,233,210,0.75)', textAlign: 'center' }}>
                    No hay usuarios para mostrar.
                  </TableCell>
                </TableRow>
              ) : null}
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.id}</TableCell>
                  <TableCell>{user.nombre}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{getRoleDisplayName(user.rol, roles)}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                      <IconButton
                        size="small"
                        onClick={() => openEditDialog(user)}
                        aria-label={`Editar usuario ${user.nombre}`}
                        sx={{ color: COLOR_GOLD }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteUser(user)}
                        disabled={deletingUserId === user.id}
                        aria-label={`Eliminar usuario ${user.nombre}`}
                        sx={{ color: '#ff9090' }}
                      >
                        {deletingUserId === user.id ? (
                          <CircularProgress size={16} color="inherit" />
                        ) : (
                          <DeleteIcon fontSize="small" />
                        )}
                      </IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      </Stack>

      <Dialog open={Boolean(editingUser)} onClose={closeEditDialog} fullWidth maxWidth="sm">
        <DialogTitle>Editar Usuario</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Nombre"
              value={editForm.nombre}
              onChange={(e) => handleEditChange('nombre', e.target.value)}
              fullWidth
            />

            <TextField
              label="Usuario"
              value={editForm.usuario}
              onChange={(e) => handleEditChange('usuario', e.target.value)}
              fullWidth
            />

            <TextField
              label="Rol"
              select
              value={editForm.rol_id}
              onChange={(e) => handleEditChange('rol_id', e.target.value)}
              fullWidth
              disabled={loadingRoles}
            >
              {roles.map((role) => (
                <MenuItem key={role.id} value={String(role.id)}>
                  {role.nombre}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Nueva clave (opcional)"
              type="password"
              value={editForm.password}
              onChange={(e) => handleEditChange('password', e.target.value)}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEditDialog} disabled={editingSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleUpdateUser} variant="contained" disabled={editingSubmitting}>
            {editingSubmitting ? <CircularProgress size={18} color="inherit" /> : 'Guardar cambios'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
