import { z } from 'zod'

export const pedidoSchema = z.object({
  mesa: z.coerce.number().min(1, 'Número de mesa requerido'),
  notas: z.string().optional(),
  detalles: z
    .array(
      z.object({
        platoId: z.coerce.number().min(1),
        cantidad: z.coerce.number().min(1, 'Cantidad mínima es 1'),
      }),
    )
    .min(1, 'Agrega al menos un plato'),
})

export type PedidoFormData = z.infer<typeof pedidoSchema>
