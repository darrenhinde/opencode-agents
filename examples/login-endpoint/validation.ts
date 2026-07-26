// Input validation using Zod
// Following security patterns: validate at boundaries

import { z } from 'zod'
import type { LoginRequest } from './types.js'

// Validation schema for login request
const loginSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .min(5, 'Email too short')
    .max(255, 'Email too long'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long'),
})

// Validate login request at boundary
export function validateLoginRequest(input: unknown): {
  isValid: boolean
  data?: LoginRequest
  errors?: string[]
} {
  const result = loginSchema.safeParse(input)

  if (result.success) {
    return { isValid: true, data: result.data }
  }

  return {
    isValid: false,
    errors: result.error.errors.map((e: { message: string }) => e.message),
  }
}
