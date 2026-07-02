import { z } from 'zod'

export const platoSchema = z.object({
  nombre: z.string().min(2, 'El nombre es requerido'),
  descripcion: z.string().min(5, 'La descripción es requerida'),
  precio: z.coerce.number().positive('El precio debe ser positivo'),
  categoriaId: z.coerce.number().min(1, 'Selecciona una categoría'),
  imagen: z.string().url('URL inválida').optional().or(z.literal('')),
  disponible: z.boolean().optional().default(true),
})

export type PlatoFormData = z.infer<typeof platoSchema>

export const categoriaSchema = z.object({
  nombre: z.string().min(2, 'El nombre es requerido'),
  descripcion: z.string().optional(),
})

export type CategoriaFormData = z.infer<typeof categoriaSchema>

export const platoDelMesSchema = z.object({
  platoId: z.coerce.number().min(1, 'Selecciona un plato'),
  mes: z.coerce.number().min(1).max(12),
  anio: z.coerce.number().min(2024),
  descripcionEspecial: z.string().optional(),
})

export type PlatoDelMesFormData = z.infer<typeof platoDelMesSchema>
