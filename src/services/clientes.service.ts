import api from './api'
import axios from 'axios'
import type { Cliente, ClienteListQuery, CreateClienteDto, UpdateClienteDto } from '@/types/cliente.types'

const CLIENT_LIST_ROUTES = ['/clientes', '/cliente', '/customers', '/customer']
const CLIENT_DETAIL_ROUTES = ['/clientes', '/cliente', '/customers', '/customer']

async function getWithFallback<T>(routes: string[], query?: Record<string, unknown>) {
  let lastError: unknown

  for (const route of routes) {
    try {
      const response = await api.get<T>(route, {
        params: query,
        // Browser cache revalidation can return 304, which axios treats as non-success by default.
        validateStatus: (status) => (status >= 200 && status < 300) || status === 304,
      })

      if (response.status === 304) {
        return await api.get<T>(route, {
          params: { ...(query ?? {}), _ts: Date.now() },
          headers: {
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
          },
        })
      }

      return response
    } catch (error) {
      lastError = error

      if (!axios.isAxiosError(error)) {
        throw error
      }

      // Continue probing only when the route does not exist.
      if (error.response?.status !== 404) {
        throw error
      }
    }
  }

  throw lastError
}

async function getByIdWithFallback<T>(id: number) {
  let lastError: unknown

  for (const baseRoute of CLIENT_DETAIL_ROUTES) {
    try {
      const response = await api.get<T>(`${baseRoute}/${id}`, {
        validateStatus: (status) => (status >= 200 && status < 300) || status === 304,
      })

      if (response.status === 304) {
        return await api.get<T>(`${baseRoute}/${id}`, {
          params: { _ts: Date.now() },
          headers: {
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
          },
        })
      }

      return response
    } catch (error) {
      lastError = error

      if (!axios.isAxiosError(error)) {
        throw error
      }

      if (error.response?.status !== 404) {
        throw error
      }
    }
  }

  throw lastError
}

async function createWithFallback<T>(data: CreateClienteDto) {
  const payloadVariants = [
    {
      nombre: data.nombre,
      telefono: data.telefono,
    },
    {
      nombre_cliente: data.nombre,
      telefono: data.telefono,
    },
    {
      nombre: data.nombre,
      phone: data.telefono,
    },
    {
      name: data.nombre,
      phone: data.telefono,
    },
  ]

  let lastError: unknown

  for (const route of CLIENT_LIST_ROUTES) {
    for (const payload of payloadVariants) {
      try {
        return await api.post<T>(route, payload)
      } catch (error) {
        lastError = error

        if (!axios.isAxiosError(error)) {
          throw error
        }

        const status = error.response?.status

        if (status === 404) {
          // Try same payload on next route.
          break
        }

        // Try next payload for validation mismatch.
        if (status === 400 || status === 422) {
          continue
        }

        throw error
      }
    }
  }

  throw lastError
}

async function updateWithFallback<T>(id: number, data: UpdateClienteDto) {
  const payloadVariants = [
    {
      nombre: data.nombre,
      telefono: data.telefono,
    },
    {
      nombre_cliente: data.nombre,
      telefono: data.telefono,
    },
    {
      nombre: data.nombre,
      phone: data.telefono,
    },
    {
      name: data.nombre,
      phone: data.telefono,
    },
  ]

  let lastError: unknown

  for (const baseRoute of CLIENT_DETAIL_ROUTES) {
    const route = `${baseRoute}/${id}`

    for (const payload of payloadVariants) {
      try {
        return await api.put<T>(route, payload)
      } catch (error) {
        lastError = error

        if (!axios.isAxiosError(error)) {
          throw error
        }

        const status = error.response?.status

        if (status === 404) {
          break
        }

        if (status === 400 || status === 422) {
          continue
        }

        throw error
      }
    }
  }

  throw lastError
}

async function deleteWithFallback(id: number) {
  let lastError: unknown

  for (const baseRoute of CLIENT_DETAIL_ROUTES) {
    const route = `${baseRoute}/${id}`

    try {
      return await api.delete(route)
    } catch (error) {
      lastError = error

      if (!axios.isAxiosError(error)) {
        throw error
      }

      if (error.response?.status !== 404) {
        throw error
      }
    }
  }

  throw lastError
}

export const clientesService = {
  getAll: (query?: ClienteListQuery) =>
    getWithFallback<Cliente[]>(CLIENT_LIST_ROUTES, {
      active: typeof query?.active === 'boolean' ? query.active : undefined,
      q: query?.q,
      telefono: query?.telefono,
    }),
  getById: (id: number) => getByIdWithFallback<Cliente>(id),
  create: (data: CreateClienteDto) => createWithFallback<Cliente>(data),
  update: (id: number, data: UpdateClienteDto) => updateWithFallback<Cliente>(id, data),
  delete: (id: number) => deleteWithFallback(id),
}
