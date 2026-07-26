// Authentication service - pure functions
// Following code-quality standards: pure functions, immutability, dependency injection

import type { User, AuthResult, TokenPayload } from './types.js'

// Mock user database (in real app, this would be injected)
const mockUsers: User[] = [
  {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: 'hashed-password-123', // In real app: bcrypt hash
    isActive: true,
  },
]

// Pure function: verify credentials
export function verifyCredentials(
  email: string,
  password: string,
  users: User[]
): AuthResult {
  const user = users.find((u) => u.email === email)

  if (!user) {
    return { success: false, error: 'Invalid credentials' }
  }

  if (!user.isActive) {
    return { success: false, error: 'Account disabled' }
  }

  // In real app: compare bcrypt hashes
  // For demo: simple string comparison
  if (user.passwordHash !== `hashed-${password}`) {
    return { success: false, error: 'Invalid credentials' }
  }

  return { success: true, user }
}

// Pure function: generate token payload
export function generateTokenPayload(user: User): TokenPayload {
  const now = Date.now()
  const expiresIn = 24 * 60 * 60 * 1000 // 24 hours

  return {
    userId: user.id,
    email: user.email,
    issuedAt: now,
    expiresAt: now + expiresIn,
  }
}

// Pure function: encode token (mock JWT)
export function encodeToken(payload: TokenPayload): string {
  // In real app: use jsonwebtoken library
  // For demo: base64 encode
  return Buffer.from(JSON.stringify(payload)).toString('base64')
}

// Authentication service with dependency injection
export function createAuthService(users: User[] = mockUsers) {
  return {
    authenticate: (email: string, password: string): AuthResult =>
      verifyCredentials(email, password, users),

    createToken: (user: User): string =>
      encodeToken(generateTokenPayload(user)),
  }
}
