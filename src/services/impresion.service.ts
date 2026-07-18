import api from './api'

export interface Impresora {
  id: number
  nombre: string
  tipo: string
  activa?: boolean
}

export interface TrabajoImpresion {
  id: number
  tipo: string
  estado: string
  payload?: Record<string, unknown>
  mensajeError?: string
  createdAt?: string
  updatedAt?: string
}

export interface UpdateTrabajoImpresionDto {
  estado: 'IMPRESO' | 'ERROR'
  mensajeError?: string
}

export const impresionService = {
  getPrinters: () => api.get<Impresora[]>('/impresion/impresoras'),
  getQueue: () => api.get<TrabajoImpresion[]>('/impresion/cola'),
  getQueueJobById: (id: number) => api.get<TrabajoImpresion>(`/impresion/cola/${id}`),
  claimNextQueueJob: () => api.post<TrabajoImpresion>('/impresion/cola/next'),
  updateQueueJobStatus: (id: number, data: UpdateTrabajoImpresionDto) =>
    api.put<TrabajoImpresion>(`/impresion/cola/${id}/status`, data),
}
