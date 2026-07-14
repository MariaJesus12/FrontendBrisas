import api from './api'
import axios from 'axios'
import type { CreateUserRequest, CreatedUser, RoleOption, UpdateUserRequest } from '@/types/usuario.types'

export const usuariosService = {
  // GET /roles (router mounted under /api)
  getRoles: async () => {
    const routes = ['/roles', '/users/roles', '/usuarios/roles']
    let lastError: unknown

    for (const route of routes) {
      try {
        return await api.get<RoleOption[] | string[]>(route)
      } catch (error) {
        lastError = error
        if (!axios.isAxiosError(error)) {
          throw error
        }

        // If not found, keep trying alternative routes.
        if (error.response?.status !== 404) {
          throw error
        }
      }
    }

    throw lastError
  },

  // GET /users (router mounted under /api)
  listUsers: async () => {
    const routes = ['/users', '/usuarios']
    let lastError: unknown

    for (const route of routes) {
      try {
        return await api.get<CreatedUser[]>(route)
      } catch (error) {
        lastError = error
        if (!axios.isAxiosError(error)) {
          throw error
        }

        // If not found, keep trying alternative routes.
        if (error.response?.status !== 404) {
          throw error
        }
      }
    }

    throw lastError
  },

  // POST /users (router mounted under /api)
  createUser: async (data: CreateUserRequest) => {
    const payloadVariants = [
      {
        nombre: data.nombre,
        usuario: data.usuario,
        password: data.password,
        rol_id: data.rol_id,
      },
      {
        nombre: data.nombre,
        email: data.usuario,
        password: data.password,
        rol_id: data.rol_id,
      },
      {
        nombre: data.nombre,
        usuario: data.usuario,
        password: data.password,
        role_id: data.rol_id,
      },
      {
        nombre: data.nombre,
        email: data.usuario,
        password: data.password,
        role_id: data.rol_id,
      },
    ]

    let lastError: unknown

    for (const payload of payloadVariants) {
      try {
        return await api.post<CreatedUser>('/users', payload)
      } catch (error) {
        lastError = error

        if (!axios.isAxiosError(error)) {
          throw error
        }

        // Retry only for schema/validation style errors.
        if (!error.response || error.response.status !== 400) {
          throw error
        }
      }
    }

    throw lastError
  },

  // PUT /users/:id (router mounted under /api)
  updateUser: async (id: number, data: UpdateUserRequest) => {
    const payloadVariants = [
      {
        nombre: data.nombre,
        usuario: data.usuario,
        rol_id: data.rol_id,
        ...(data.password ? { password: data.password } : {}),
      },
      {
        nombre: data.nombre,
        email: data.usuario,
        rol_id: data.rol_id,
        ...(data.password ? { password: data.password } : {}),
      },
      {
        nombre: data.nombre,
        usuario: data.usuario,
        role_id: data.rol_id,
        ...(data.password ? { password: data.password } : {}),
      },
      {
        nombre: data.nombre,
        email: data.usuario,
        role_id: data.rol_id,
        ...(data.password ? { password: data.password } : {}),
      },
    ]

    const routes = [`/users/${id}`]
    let lastError: unknown

    for (const route of routes) {
      for (const payload of payloadVariants) {
        try {
          return await api.put<CreatedUser | { message?: string }>(route, payload)
        } catch (error) {
          lastError = error

          if (!axios.isAxiosError(error)) {
            throw error
          }

          const status = error.response?.status

          // Try other payloads only on validation errors.
          if (status === 400) {
            continue
          }

          // Try next route on not found.
          if (status === 404) {
            break
          }

          // For auth/permission/network and others, fail fast.
          throw error
        }
      }
    }

    throw lastError
  },

  // DELETE /users/:id (router mounted under /api)
  deleteUser: async (id: number) => {
    const routes = [`/users/${id}`]
    let lastError: unknown

    for (const route of routes) {
      try {
        return await api.delete(route)
      } catch (error) {
        lastError = error

        if (!axios.isAxiosError(error)) {
          throw error
        }

        // If route does not exist, try next one.
        if (error.response?.status === 404) {
          continue
        }

        throw error
      }
    }

    throw lastError
  },
}
