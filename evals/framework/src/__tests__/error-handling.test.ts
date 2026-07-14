/**
 * Error Handling Tests
 * 
 * Tests the project's error handling patterns to ensure they follow standards:
 * - Result object pattern (success/failure objects)
 * - Try-catch for external operations
 * - Error collection pattern
 * - Validation at boundaries
 * - Severity levels (error, warning, info)
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// Test Helpers - Example implementations following project patterns
// ============================================================================

/**
 * Result object pattern - returns explicit success/failure
 */
function parseJSON(text: string): { success: boolean; data?: any; error?: string } {
  try {
    return { success: true, data: JSON.parse(text) };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Validation at boundaries pattern
 */
interface UserData {
  email: string;
  age: number;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

function validateUserData(userData: Partial<UserData>): ValidationResult {
  const errors: string[] = [];

  if (!userData.email) {
    errors.push('Email is required');
  } else if (!userData.email.includes('@')) {
    errors.push('Email must be valid');
  }

  if (userData.age !== undefined && userData.age < 0) {
    errors.push('Age must be positive');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

function createUser(userData: Partial<UserData>): { success: boolean; user?: UserData; errors?: string[] } {
  const validation = validateUserData(userData);
  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }
  return { success: true, user: userData as UserData };
}

/**
 * Error collection pattern
 */
function processItems(items: any[]): { success: boolean; errors: string[]; processed: number } {
  const errors: string[] = [];
  let processed = 0;

  for (const item of items) {
    if (!item) {
      errors.push('Item is null or undefined');
      continue;
    }
    if (typeof item !== 'object') {
      errors.push(`Invalid item type: ${typeof item}`);
      continue;
    }
    processed++;
  }

  return {
    success: errors.length === 0,
    errors,
    processed,
  };
}

/**
 * Severity levels pattern
 */
type Severity = 'error' | 'warning' | 'info';

interface Violation {
  type: string;
  severity: Severity;
  message: string;
}

function validateCode(code: string): { passed: boolean; violations: Violation[] } {
  const violations: Violation[] = [];

  // Error-level violations (critical)
  if (code.includes('eval(')) {
    violations.push({
      type: 'dangerous-code',
      severity: 'error',
      message: 'Use of eval() is forbidden',
    });
  }

  // Warning-level violations (should fix)
  if (code.length > 1000) {
    violations.push({
      type: 'code-length',
      severity: 'warning',
      message: 'Code exceeds recommended length',
    });
  }

  // Info-level violations (suggestions)
  if (!code.includes('use strict')) {
    violations.push({
      type: 'missing-strict',
      severity: 'info',
      message: 'Consider using strict mode',
    });
  }

  // Only error-level violations cause failure
  const errorViolations = violations.filter(v => v.severity === 'error');
  return {
    passed: errorViolations.length === 0,
    violations,
  };
}

// ============================================================================
// Tests - Result Object Pattern
// ============================================================================

describe('Result Object Pattern', () => {
  describe('parseJSON', () => {
    it('returns success true with data for valid JSON', () => {
      // Arrange
      const validJSON = '{"name": "John", "age": 30}';

      // Act
      const result = parseJSON(validJSON);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'John', age: 30 });
      expect(result.error).toBeUndefined();
    });

    it('returns success false with error for invalid JSON', () => {
      // Arrange
      const invalidJSON = '{invalid json}';

      // Act
      const result = parseJSON(invalidJSON);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('JSON');
      expect(result.data).toBeUndefined();
    });

    it('handles empty string', () => {
      // Arrange
      const emptyString = '';

      // Act
      const result = parseJSON(emptyString);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('handles null-like strings', () => {
      // Arrange
      const nullString = 'null';

      // Act
      const result = parseJSON(nullString);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBe(null);
    });
  });
});

// ============================================================================
// Tests - Validation at Boundaries
// ============================================================================

describe('Validation at Boundaries', () => {
  describe('validateUserData', () => {
    it('returns valid for correct user data', () => {
      // Arrange
      const userData = { email: 'test@example.com', age: 25 };

      // Act
      const result = validateUserData(userData);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns invalid when email is missing', () => {
      // Arrange
      const userData = { age: 25 };

      // Act
      const result = validateUserData(userData);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email is required');
    });

    it('returns invalid when email format is wrong', () => {
      // Arrange
      const userData = { email: 'invalid-email', age: 25 };

      // Act
      const result = validateUserData(userData);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email must be valid');
    });

    it('returns invalid when age is negative', () => {
      // Arrange
      const userData = { email: 'test@example.com', age: -5 };

      // Act
      const result = validateUserData(userData);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Age must be positive');
    });

    it('collects multiple validation errors', () => {
      // Arrange
      const userData = { email: 'invalid', age: -5 };

      // Act
      const result = validateUserData(userData);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('createUser', () => {
    it('returns success with user for valid data', () => {
      // Arrange
      const userData = { email: 'test@example.com', age: 25 };

      // Act
      const result = createUser(userData);

      // Assert
      expect(result.success).toBe(true);
      expect(result.user).toEqual(userData);
      expect(result.errors).toBeUndefined();
    });

    it('returns failure with errors for invalid data', () => {
      // Arrange
      const userData = { age: 25 };

      // Act
      const result = createUser(userData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
      expect(result.user).toBeUndefined();
    });
  });
});

// ============================================================================
// Tests - Error Collection Pattern
// ============================================================================

describe('Error Collection Pattern', () => {
  describe('processItems', () => {
    it('returns success true when all items are valid', () => {
      // Arrange
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }];

      // Act
      const result = processItems(items);

      // Assert
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.processed).toBe(3);
    });

    it('collects errors for null items', () => {
      // Arrange
      const items = [{ id: 1 }, null, { id: 3 }];

      // Act
      const result = processItems(items);

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('null or undefined');
      expect(result.processed).toBe(2);
    });

    it('collects errors for invalid types', () => {
      // Arrange
      const items = [{ id: 1 }, 'invalid', 123];

      // Act
      const result = processItems(items);

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
      expect(result.processed).toBe(1);
    });

    it('collects multiple errors without stopping', () => {
      // Arrange
      const items = [null, 'string', undefined, 42, { id: 1 }];

      // Act
      const result = processItems(items);

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(4);
      expect(result.processed).toBe(1);
    });

    it('handles empty array', () => {
      // Arrange
      const items: any[] = [];

      // Act
      const result = processItems(items);

      // Assert
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.processed).toBe(0);
    });
  });
});

// ============================================================================
// Tests - Severity Levels
// ============================================================================

describe('Severity Levels', () => {
  describe('validateCode', () => {
    it('passes when code has no violations', () => {
      // Arrange
      const code = '"use strict";\nconst x = 10;';

      // Act
      const result = validateCode(code);

      // Assert
      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('fails on error-level violations', () => {
      // Arrange
      const code = 'eval("dangerous code");';

      // Act
      const result = validateCode(code);

      // Assert
      expect(result.passed).toBe(false);
      expect(result.violations).toHaveLength(2); // error + info
      const errorViolation = result.violations.find(v => v.severity === 'error');
      expect(errorViolation).toBeDefined();
      expect(errorViolation!.type).toBe('dangerous-code');
    });

    it('passes with warning-level violations', () => {
      // Arrange
      const longCode = 'const x = 1;'.repeat(100); // > 1000 chars

      // Act
      const result = validateCode(longCode);

      // Assert
      expect(result.passed).toBe(true); // Warnings don't fail
      expect(result.violations.length).toBeGreaterThan(0);
      const warningViolation = result.violations.find(v => v.severity === 'warning');
      expect(warningViolation).toBeDefined();
      expect(warningViolation!.type).toBe('code-length');
    });

    it('does not report a warning when code length is exactly 1000', () => {
      // Arrange
      const code = 'x'.repeat(1000);

      // Act
      const result = validateCode(code);

      // Assert
      expect(code).toHaveLength(1000);
      expect(result.violations.some(v => v.severity === 'warning')).toBe(false);
    });

    it('reports a warning when code length is exactly 1001', () => {
      // Arrange
      const code = 'x'.repeat(1001);

      // Act
      const result = validateCode(code);

      // Assert
      expect(code).toHaveLength(1001);
      expect(result.violations.some(v => v.severity === 'warning')).toBe(true);
    });

    it('passes with info-level violations', () => {
      // Arrange
      const code = 'const x = 10;'; // No strict mode

      // Act
      const result = validateCode(code);

      // Assert
      expect(result.passed).toBe(true); // Info doesn't fail
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].severity).toBe('info');
      expect(result.violations[0].type).toBe('missing-strict');
    });

    it('reports multiple violations with different severities', () => {
      // Arrange
      const code = 'eval("bad");' + 'x'.repeat(989);

      // Act
      const result = validateCode(code);

      // Assert
      expect(code).toHaveLength(1001);
      expect(result.passed).toBe(false); // Error causes failure
      const severities = result.violations.map(v => v.severity);
      expect(severities).toEqual(['error', 'warning', 'info']);
    });

    it('distinguishes between severity levels correctly', () => {
      // Arrange
      const code = 'eval("x");'.repeat(101); // 1010 chars: crosses the >1000 warning boundary

      // Act
      const result = validateCode(code);

      // Assert
      const errorCount = result.violations.filter(v => v.severity === 'error').length;
      const warningCount = result.violations.filter(v => v.severity === 'warning').length;
      const infoCount = result.violations.filter(v => v.severity === 'info').length;

      expect(errorCount).toBeGreaterThan(0);
      expect(warningCount).toBeGreaterThan(0);
      expect(infoCount).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Tests - Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('handles undefined input gracefully', () => {
    // Arrange
    const result = validateUserData({});

    // Assert
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('handles empty error arrays', () => {
    // Arrange
    const items: any[] = [];

    // Act
    const result = processItems(items);

    // Assert
    expect(result.errors).toEqual([]);
    expect(result.success).toBe(true);
  });

  it('handles malformed JSON without crashing', () => {
    // Arrange
    const malformed = '{{{invalid}}}';

    // Act
    const result = parseJSON(malformed);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('preserves error context in messages', () => {
    // Arrange
    const userData = { email: 'bad-email', age: -10 };

    // Act
    const result = validateUserData(userData);

    // Assert
    expect(result.errors.some(e => e.includes('Email'))).toBe(true);
    expect(result.errors.some(e => e.includes('Age'))).toBe(true);
  });
});
