import { z } from 'zod'

export const loginSchema = z.object({
  email: z
    .string()
    .min(3, 'Usuario o correo inválido')
    .max(120, 'Usuario o correo inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

export type LoginFormData = z.infer<typeof loginSchema>
