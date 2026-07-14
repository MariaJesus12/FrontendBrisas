export interface RoleOption {
  id: number
  nombre: string
}

export interface CreateUserRequest {
  nombre: string
  usuario: string
  password: string
  rol_id: number
}

export interface UpdateUserRequest {
  nombre: string
  usuario: string
  rol_id: number
  password?: string
}

export interface CreatedUser {
  id: number
  nombre: string
  usuario?: string
  email?: string
  username?: string
  rol?: string | number
  rol_id?: number
  rolId?: number
  role?: string | number | { id?: number; nombre?: string; name?: string }
  role_id?: number
  roleId?: number
  rol_nombre?: string
  rolNombre?: string
  role_name?: string
  roleName?: string
}
