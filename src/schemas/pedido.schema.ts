import { z } from 'zod'

export const pedidoDetalleSchema = z.object({
  productoId: z.coerce.number().int().min(1, 'Producto requerido'),
  cantidad: z.coerce.number().int().min(1, 'Cantidad mínima es 1'),
  precioUnitario: z.coerce.number().min(0, 'Precio unitario inválido'),
  observacion: z.string().trim().optional(),
})

export const pedidoSchema = z
  .object({
    codigo: z.string().trim().optional(),
    mesaId: z.coerce.number().int().positive('Mesa requerida').optional(),
    usuarioId: z.coerce.number().int().positive('Usuario requerido'),
    tipo: z.enum(['MESA', 'LLEVAR']),
    estado: z.enum(['BORRADOR', 'EN_PREPARACION', 'LISTO', 'FACTURADO', 'CANCELADO']),
    impuesto: z.coerce.number().min(0, 'Impuesto inválido').default(0),
    detalles: z.array(pedidoDetalleSchema).min(1, 'Agrega al menos un producto'),
  })
  .superRefine((value, context) => {
    if (value.tipo === 'MESA' && !value.mesaId) {
      context.addIssue({
        code: 'custom',
        path: ['mesaId'],
        message: 'Selecciona una mesa para pedidos de mesa',
      })
    }
  })

export type PedidoFormData = z.infer<typeof pedidoSchema>
