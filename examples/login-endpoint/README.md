# Login Endpoint Example

This example demonstrates how the OAC workflow handles a "login endpoint" request, following project standards.

## Files Created

1. **types.ts** - Explicit TypeScript interfaces (no `any`)
2. **validation.ts** - Input validation with Zod at boundaries
3. **auth-service.ts** - Pure functions for authentication logic
4. **login-handler.ts** - HTTP handler with secure error handling

## OAC Standards Applied

### ✅ Code Quality (code-quality.md)
- **Pure functions**: `verifyCredentials`, `generateTokenPayload`, `encodeToken`
- **Immutability**: No mutation of existing data
- **Small functions**: All functions < 50 lines
- **Dependency injection**: `createAuthService(users)` accepts user list

### ✅ TypeScript Standards (typescript.md)
- **Explicit types**: All parameters and return types defined
- **No `any`**: Strict type safety throughout
- **Single-word function names**: `authenticate`, `createToken`

### ✅ Security Patterns (security-patterns.md)
- **Validate at boundaries**: Zod schema validates input before processing
- **Don't expose internals**: Generic "Invalid credentials" error
- **No hardcoded secrets**: Password comparison is mock (real app uses bcrypt)
- **Environment variables**: Would be used for JWT_SECRET in production

## Usage Example

```typescript
import { handleLogin } from './login-handler.js'

// Valid login
const result = await handleLogin({
  email: 'test@example.com',
  password: 'password-123'
})
// { success: true, token: 'eyJ1c2VySWQiOi...' }

// Invalid login
const result = await handleLogin({
  email: 'wrong@example.com',
  password: 'wrong'
})
// { success: false, error: 'Invalid credentials' }

// Invalid input
const result = await handleLogin({
  email: 'not-an-email',
  password: '123'
})
// { success: false, error: 'Invalid request: Invalid email format, Password must be at least 8 characters' }
```

## Framework Integration

The handler is framework-agnostic. Wrap it with Express, Hono, Fastify, etc.:

```typescript
// Express
app.post('/api/login', async (req, res) => {
  const result = await handleLogin(req.body)
  res.status(result.success ? 200 : 401).json(result)
})
```

## Testing

All functions are pure and testable:

```typescript
import { verifyCredentials } from './auth-service.js'

test('valid credentials', () => {
  const result = verifyCredentials('test@example.com', 'password-123', mockUsers)
  expect(result.success).toBe(true)
})

test('invalid password', () => {
  const result = verifyCredentials('test@example.com', 'wrong', mockUsers)
  expect(result.success).toBe(false)
})
```

## OAC Workflow Demonstrated

1. **Stage 1: Analyze** - ContextScout discovered project is TypeScript monorepo
2. **Stage 2: Plan** - Proposed 4-file structure following standards
3. **Stage 3: LoadContext** - Loaded code-quality.md, typescript.md, security-patterns.md
4. **Stage 4: Execute** - Created files following loaded standards
5. **Stage 5: Validate** - All functions pure, types explicit, validation present
6. **Stage 6: Complete** - Documentation created

## Next Steps

To make this production-ready:
- Replace mock password comparison with bcrypt
- Add JWT signing with jsonwebtoken
- Add rate limiting
- Add database integration
- Add comprehensive tests
