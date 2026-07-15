import { z } from 'zod'

export const mesaSchema = z.object({
  numero: z.coerce.number().int().min(1, 'Número de mesa requerido'),
  capacidad: z.coerce.number().int().min(1, 'Capacidad requerida'),
  observacion: z.string().trim().optional(),
  activa: z.coerce.boolean(),
})

export type MesaFormData = z.infer<typeof mesaSchema>