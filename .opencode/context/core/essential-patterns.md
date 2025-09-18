# Essential Patterns - Core Knowledge Base

## Error Handling Pattern

**ALWAYS** handle errors gracefully:

```typescript
try {
  const result = await riskyOperation();
  return { success: true, data: result };
} catch (error) {
  console.error('Operation failed:', error);
  return { success: false, error: error.message };
}
```

## Validation Pattern

**ALWAYS** validate input data:

```typescript
function validateInput(input: any): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  if (!input) errors.push('Input is required');
  if (typeof input !== 'string') errors.push('Input must be a string');
  if (input.length < 3) errors.push('Input must be at least 3 characters');

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}
```

## Logging Pattern

**USE** consistent logging levels:

```typescript
// Debug information (development only)
console.debug('Processing request:', requestId);

// Info for important events
console.info('User authenticated:', userId);

// Warning for potential issues
console.warn('Rate limit approaching for user:', userId);

// Error for failures
console.error('Database connection failed:', error);
```

## Security Pattern

**NEVER** expose sensitive information:

```typescript
// ❌ BAD: Exposing internal errors
return { error: 'Internal server error: ' + error.message };

// ✅ GOOD: Generic error message
return { error: 'An unexpected error occurred. Please try again.' };
```

## File System Safety Pattern

**ALWAYS** validate file paths:

```typescript
import path from 'path';

function safeReadFile(userPath: string): string | null {
  const resolvedPath = path.resolve(userPath);
  const allowedDir = path.resolve('./allowed-directory');

  // Ensure path is within allowed directory
  if (!resolvedPath.startsWith(allowedDir)) {
    throw new Error('Access denied: Invalid path');
  }

  return fs.readFileSync(resolvedPath, 'utf8');
}
```

## Type Safety Pattern

**ALWAYS** use strict TypeScript types:

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Use generics for type-safe responses
function createUser(userData: Omit<User, 'id' | 'createdAt'>): ApiResponse<User> {
  // Implementation
}
```

## Async/Await Pattern

**ALWAYS** handle promises properly:

```typescript
// ❌ BAD: Nested promises
fetchUser().then(user => {
  return fetchPosts(user.id).then(posts => {
    return { user, posts };
  });
});

// ✅ GOOD: Async/await with error handling
async function getUserWithPosts(userId: string) {
  try {
    const user = await fetchUser(userId);
    const posts = await fetchPosts(user.id);
    return { user, posts };
  } catch (error) {
    console.error('Failed to fetch user data:', error);
    throw error;
  }
}
```

## Configuration Pattern

**ALWAYS** use environment variables for configuration:

```typescript
// config.ts
export const config = {
  port: parseInt(process.env.PORT || '3000'),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  nodeEnv: process.env.NODE_ENV || 'development',
};

// Validate required config
if (!config.databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}
```

## Testing Pattern

**ALWAYS** write testable code:

```typescript
// ❌ BAD: Hard to test
export function processPayment(amount: number) {
  const apiKey = process.env.STRIPE_KEY;
  // Direct API call
}

// ✅ GOOD: Dependency injection
export interface PaymentService {
  processPayment(amount: number): Promise<boolean>;
}

export function createPaymentProcessor(service: PaymentService) {
  return {
    async process(amount: number) {
      return service.processPayment(amount);
    }
  };
}
```

## Documentation Pattern

**ALWAYS** document complex logic:

```typescript
/**
 * Calculates the total price including tax and discounts
 * @param basePrice - The original price before modifications
 * @param taxRate - Tax rate as decimal (e.g., 0.08 for 8%)
 * @param discountPercent - Discount percentage (0-100)
 * @returns The final price after tax and discount
 */
function calculateTotalPrice(
  basePrice: number,
  taxRate: number = 0.08,
  discountPercent: number = 0
): number {
  const discountAmount = basePrice * (discountPercent / 100);
  const discountedPrice = basePrice - discountAmount;
  const taxAmount = discountedPrice * taxRate;
  return discountedPrice + taxAmount;
}
```

## Performance Pattern

**AVOID** unnecessary operations in loops:

```typescript
// ❌ BAD: Repeated calculations
const results = [];
for (let i = 0; i < items.length; i++) {
  results.push(items[i] * calculateTax(items[i])); // calculateTax called repeatedly
}

// ✅ GOOD: Pre-calculate or cache
const results = [];
const taxRate = getCurrentTaxRate(); // Calculate once
for (let i = 0; i < items.length; i++) {
  results.push(items[i] * taxRate);
}
```

## Code Organization Pattern

**KEEP** functions focused and small:

```typescript
// ❌ BAD: One function doing too much
function processOrder(orderData) {
  // Validate input
  // Calculate pricing
  // Save to database
  // Send email
  // Log analytics
}

// ✅ GOOD: Separated concerns
function validateOrder(orderData) { /* validation logic */ }
function calculatePricing(orderData) { /* pricing logic */ }
function saveOrder(orderData) { /* database logic */ }
function sendConfirmation(orderData) { /* email logic */ }
function logAnalytics(orderData) { /* analytics logic */ }

async function processOrder(orderData) {
  validateOrder(orderData);
  const pricing = calculatePricing(orderData);
  await saveOrder({ ...orderData, pricing });
  await sendConfirmation(orderData);
  logAnalytics(orderData);
}
```