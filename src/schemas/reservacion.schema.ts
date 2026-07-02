import { z } from 'zod'

export const reservacionSchema = z.object({
  nombreCliente: z.string().min(2, 'El nombre es requerido'),
  email: z.string().email('Email inválido'),
  telefono: z.string().min(7, 'Teléfono inválido'),
  fecha: z.string().min(1, 'La fecha es requerida'),
  hora: z.string().min(1, 'La hora es requerida'),
  numeroPersonas: z.coerce.number().min(1, 'Mínimo 1 persona').max(20, 'Máximo 20 personas'),
  notas: z.string().optional(),
})

export type ReservacionFormData = z.infer<typeof reservacionSchema>
