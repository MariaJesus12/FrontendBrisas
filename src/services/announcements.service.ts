import api from './api'
import axios from 'axios'
import type { Announcement, AnnouncementType, CreateAnnouncementDto } from '@/types/announcement.types'

function normalizeAnnouncementType(value: string | undefined): AnnouncementType | undefined {
  if (!value) {
    return undefined
  }

  const normalized = value.trim().toUpperCase()
  if (normalized === 'INFO' || normalized === 'AVISO') {
    return 'INFORMATIVO'
  }

  if (
    normalized === 'PROMOCION' ||
    normalized === 'EVENTO' ||
    normalized === 'INFORMATIVO' ||
    normalized === 'PLATO_DEL_DIA'
  ) {
    return normalized
  }

  return undefined
}

function buildAnnouncementPayloadVariants(
  data: CreateAnnouncementDto | Partial<CreateAnnouncementDto>,
) {
  const titleVariants =
    typeof data.titulo === 'string'
      ? [{ titulo: data.titulo }, { title: data.titulo }]
      : [{}]

  const descriptionVariants =
    typeof data.descripcion === 'string'
      ? [{ descripcion: data.descripcion }, { description: data.descripcion }]
      : [{}]

  const imageVariants =
    typeof data.imagen === 'string'
      ? [{ imagen: data.imagen }, { image: data.imagen }]
      : [{}]

  const startDateVariants =
    typeof data.fechaInicio === 'string'
      ? [{ fechaInicio: data.fechaInicio }, { fecha_inicio: data.fechaInicio }, { startDate: data.fechaInicio }]
      : [{}]

  const endDateVariants =
    typeof data.fechaFin === 'string'
      ? [{ fechaFin: data.fechaFin }, { fecha_fin: data.fechaFin }, { endDate: data.fechaFin }]
      : [{}]

  const startTimeVariants =
    typeof data.horaInicio === 'string'
      ? [{ horaInicio: data.horaInicio }, { hora_inicio: data.horaInicio }, { startTime: data.horaInicio }]
      : [{}]

  const endTimeVariants =
    typeof data.horaFin === 'string'
      ? [{ horaFin: data.horaFin }, { hora_fin: data.horaFin }, { endTime: data.horaFin }]
      : [{}]

  const priorityVariants =
    typeof data.prioridad === 'number'
      ? [{ prioridad: data.prioridad }, { priority: data.prioridad }]
      : [{}]

  const activeVariants =
    typeof data.activo === 'number' || typeof data.activo === 'boolean'
      ? [
          { activo: data.activo },
          { active: data.activo },
          { isActive: data.activo },
          { is_active: data.activo },
          {
            activo: typeof data.activo === 'number' ? data.activo === 1 : data.activo,
          },
          {
            active: typeof data.activo === 'number' ? data.activo === 1 : data.activo,
          },
        ]
      : [{}]

  const normalizedType = normalizeAnnouncementType(data.tipo)
  const typeVariants =
    typeof normalizedType === 'string'
      ? [{ tipo: normalizedType }, { tipoenum: normalizedType }, { type: normalizedType }]
      : [{}]

  const variants: Array<Record<string, unknown>> = []

  titleVariants.forEach((titleField) => {
    descriptionVariants.forEach((descriptionField) => {
      imageVariants.forEach((imageField) => {
        startDateVariants.forEach((startDateField) => {
          endDateVariants.forEach((endDateField) => {
            startTimeVariants.forEach((startTimeField) => {
              endTimeVariants.forEach((endTimeField) => {
                priorityVariants.forEach((priorityField) => {
                  activeVariants.forEach((activeField) => {
                    typeVariants.forEach((typeField) => {
                      variants.push({
                        ...titleField,
                        ...descriptionField,
                        ...imageField,
                        ...startDateField,
                        ...endDateField,
                        ...startTimeField,
                        ...endTimeField,
                        ...priorityField,
                        ...activeField,
                        ...typeField,
                      })
                    })
                  })
                })
              })
            })
          })
        })
      })
    })
  })

  return variants
}

async function postAnnouncementWithFallback(data: CreateAnnouncementDto) {
  const variants = buildAnnouncementPayloadVariants(data)
  let lastError: unknown

  for (const payload of variants) {
    try {
      return await api.post<Announcement>('/announcements', payload)
    } catch (error) {
      lastError = error
      if (!axios.isAxiosError(error)) {
        throw error
      }

      if (!error.response || ![400, 422].includes(error.response.status)) {
        throw error
      }
    }
  }

  throw lastError
}

async function putAnnouncementWithFallback(id: number, data: Partial<CreateAnnouncementDto>) {
  const variants = buildAnnouncementPayloadVariants(data)
  let lastError: unknown

  for (const payload of variants) {
    try {
      return await api.put<Announcement>(`/announcements/${id}`, payload)
    } catch (error) {
      lastError = error
      if (!axios.isAxiosError(error)) {
        throw error
      }

      if (!error.response || ![400, 422].includes(error.response.status)) {
        throw error
      }
    }
  }

  throw lastError
}

export const announcementsService = {
  getCurrent: () => api.get<Announcement[]>('/announcements'),
  getHistory: () => api.get<Announcement[]>('/announcements/history'),
  create: (data: CreateAnnouncementDto) => postAnnouncementWithFallback(data),
  update: (id: number, data: Partial<CreateAnnouncementDto>) =>
    putAnnouncementWithFallback(id, data),
  delete: (id: number) => api.delete(`/announcements/${id}`),
}
