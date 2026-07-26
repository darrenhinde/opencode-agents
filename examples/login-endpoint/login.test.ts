// Test examples for login endpoint
// Following test-coverage standards: unit tests for pure functions

import { describe, it, expect } from 'vitest'
import { verifyCredentials, generateTokenPayload, encodeToken } from './auth-service.js'
import { validateLoginRequest } from './validation.js'
import type { User } from './types.js'

const mockUsers: User[] = [
  {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: 'hashed-password-123',
    isActive: true,
  },
  {
    id: 'user-2',
    email: 'disabled@example.com',
    passwordHash: 'hashed-password-456',
    isActive: false,
  },
]

describe('validateLoginRequest', () => {
  it('validates correct input', () => {
    const result = validateLoginRequest({
      email: 'test@example.com',
      password: 'password123',
    })
    expect(result.isValid).toBe(true)
    expect(result.data).toEqual({
      email: 'test@example.com',
      password: 'password123',
    })
  })

  it('rejects invalid email', () => {
    const result = validateLoginRequest({
      email: 'not-an-email',
      password: 'password123',
    })
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('Invalid email format')
  })

  it('rejects short password', () => {
    const result = validateLoginRequest({
      email: 'test@example.com',
      password: '123',
    })
    expect(result.isValid).toBe(false)
    expect(result.errors?.[0]).toContain('at least 8 characters')
  })
})

describe('verifyCredentials', () => {
  it('authenticates valid credentials', () => {
    const result = verifyCredentials('test@example.com', 'password-123', mockUsers)
    expect(result.success).toBe(true)
    expect(result.user?.email).toBe('test@example.com')
  })

  it('rejects wrong password', () => {
    const result = verifyCredentials('test@example.com', 'wrong', mockUsers)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Invalid credentials')
  })

  it('rejects non-existent user', () => {
    const result = verifyCredentials('unknown@example.com', 'password', mockUsers)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Invalid credentials')
  })

  it('rejects disabled account', () => {
    const result = verifyCredentials('disabled@example.com', 'password-456', mockUsers)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Account disabled')
  })
})

describe('generateTokenPayload', () => {
  it('creates valid token payload', () => {
    const user: User = {
      id: 'user-1',
      email: 'test@example.com',
      passwordHash: 'hash',
      isActive: true,
    }
    const payload = generateTokenPayload(user)
    
    expect(payload.userId).toBe('user-1')
    expect(payload.email).toBe('test@example.com')
    expect(payload.issuedAt).toBeLessThan(payload.expiresAt)
  })
})

describe('encodeToken', () => {
  it('encodes payload to base64', () => {
    const payload = {
      userId: 'user-1',
      email: 'test@example.com',
      issuedAt: 1000,
      expiresAt: 2000,
    }
    const token = encodeToken(payload)
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString())
    
    expect(decoded).toEqual(payload)
  })
})
