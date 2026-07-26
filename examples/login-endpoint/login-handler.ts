// Login endpoint handler
// Following security patterns: validate at boundaries, don't expose internal details

import { validateLoginRequest } from './validation.js'
import { createAuthService } from './auth-service.js'
import type { LoginResponse } from './types.js'

// Create auth service (could be injected in real app)
const authService = createAuthService()

// Login handler - framework agnostic
export async function handleLogin(requestBody: unknown): Promise<LoginResponse> {
  // Step 1: Validate input at boundary
  const validation = validateLoginRequest(requestBody)

  if (!validation.isValid) {
    return {
      success: false,
      error: 'Invalid request: ' + validation.errors?.join(', '),
    }
  }

  const { email, password } = validation.data!

  // Step 2: Authenticate user
  const authResult = authService.authenticate(email, password)

  if (!authResult.success) {
    // Security: don't expose whether email or password was wrong
    return {
      success: false,
      error: 'Invalid credentials',
    }
  }

  // Step 3: Generate token
  const token = authService.createToken(authResult.user!)

  // Step 4: Return success
  return {
    success: true,
    token,
  }
}

// Example usage (framework-specific adapter would wrap this)
/*
// Express example:
app.post('/api/login', async (req, res) => {
  const result = await handleLogin(req.body)
  const status = result.success ? 200 : 401
  res.status(status).json(result)
})

// Hono example:
app.post('/api/login', async (c) => {
  const body = await c.req.json()
  const result = await handleLogin(body)
  const status = result.success ? 200 : 401
  return c.json(result, status)
})
*/
