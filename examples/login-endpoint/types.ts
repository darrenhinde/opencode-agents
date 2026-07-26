// Type definitions for login endpoint
// Following TypeScript standards: explicit types, no `any`

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  success: boolean
  token?: string
  error?: string
}

export interface User {
  id: string
  email: string
  passwordHash: string
  isActive: boolean
}

export interface AuthResult {
  success: boolean
  user?: User
  error?: string
}

export interface TokenPayload {
  userId: string
  email: string
  issuedAt: number
  expiresAt: number
}
