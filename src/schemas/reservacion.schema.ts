import { z } from 'zod'

export const reservacionSchema = z.object({
  clienteNombre: z.string().trim().min(2, 'El nombre del cliente es requerido'),
  clienteTelefono: z.string().trim().min(7, 'Teléfono inválido'),
  fecha: z.string().min(1, 'La fecha es requerida'),
  hora: z.string().min(1, 'La hora es requerida'),
  cantidadPersonas: z.coerce.number().min(1, 'Mínimo 1 persona').max(30, 'Máximo 30 personas'),
  observaciones: z.string().optional(),
  estado: z.string().trim().optional(),
})

export type ReservacionFormData = z.infer<typeof reservacionSchema>
