/**
 * Suite Validator - TypeScript validation for test suites
 * 
 * Provides compile-time type safety and runtime validation using Zod
 */

import { z } from 'zod';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { normalizeAgentId } from '../config.js';

/**
 * Zod schema for test definition
 */
const TestDefinitionSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  path: z.string().regex(/^[^/].*\.yaml$/, 'Path must be relative and end with .yaml'),
  category: z.enum([
    'critical-rules',
    'workflow-stages',
    'delegation',
    'execution-paths',
    'edge-cases',
    'integration',
    'negative',
    'behavior',
    'tool-usage'
  ]),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  required: z.boolean().optional().default(true),
  estimatedTime: z.string().regex(/^\d+-\d+(s|m)$/).optional(),
  description: z.string().optional()
});

/**
 * Zod schema for test suite
 */
const TestSuiteSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be semver (e.g., 1.0.0)'),
  // Accept both legacy flat ids (e.g. "openagent") and canonical category-based
  // ids (e.g. "core/openagent"). A value is valid when it is already
  // category-based (contains "/") or maps to a known canonical id via
  // normalizeAgentId. Arbitrary/unknown flat ids are rejected.
  agent: z.string().min(1).refine(
    (val) => val.includes('/') || normalizeAgentId(val) !== val,
    { message: 'Agent must be a known agent id (e.g., "openagent") or a category-based path (e.g., "core/openagent")' }
  ),
  totalTests: z.number().int().positive(),
  estimatedRuntime: z.string().regex(/^\d+-\d+ (minutes|seconds|hours)$/),
  coverage: z.record(z.boolean()).optional(),
  tests: z.array(TestDefinitionSchema).min(1),
  rationale: z.object({
    why7Tests: z.string().optional(),
    coverageBreakdown: z.record(z.string()).optional(),
    useCases: z.array(z.string()).optional()
  }).optional(),
  usage: z.record(z.any()).optional(),
  comparison: z.record(z.any()).optional()
});

/**
 * Infer TypeScript types from Zod schemas
 */
export type TestDefinition = z.infer<typeof TestDefinitionSchema>;
export type TestSuite = z.infer<typeof TestSuiteSchema>;

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
  missingTests: string[];
  suite?: TestSuite;
}

/**
 * Suite Validator class
 */
export class SuiteValidator {
  private readonly agentsDir: string;
  
  constructor(agentsDir: string) {
    this.agentsDir = agentsDir;
  }
  
  /**
   * Validate a test suite JSON file
   */
  validateSuiteFile(agent: string, suitePath: string): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      missingTests: []
    };
    
    // Check file exists
    if (!existsSync(suitePath)) {
      result.valid = false;
      result.errors.push({
        field: 'file',
        message: `Suite file not found: ${suitePath}`
      });
      return result;
    }
    
    // Parse JSON
    let suiteData: any;
    try {
      const content = readFileSync(suitePath, 'utf8');
      suiteData = JSON.parse(content);
    } catch (error) {
      result.valid = false;
      result.errors.push({
        field: 'json',
        message: `Invalid JSON: ${(error as Error).message}`
      });
      return result;
    }
    
    // Validate against schema
    const parseResult = TestSuiteSchema.safeParse(suiteData);
    
    if (!parseResult.success) {
      result.valid = false;
      
      // Convert Zod errors to ValidationErrors
      parseResult.error.errors.forEach(err => {
        result.errors.push({
          field: err.path.join('.'),
          message: err.message,
          value: err.code === 'invalid_type' ? undefined : suiteData
        });
      });
      
      return result;
    }
    
    const suite = parseResult.data;
    result.suite = suite;

    // Conflict detection: the requested agent must resolve to the same
    // canonical id as the agent declared in the suite. Legacy vs canonical
    // forms of the SAME agent (e.g. "openagent" vs "core/openagent") match.
    if (suite.agent && normalizeAgentId(agent) !== normalizeAgentId(suite.agent)) {
      result.valid = false;
      result.errors.push({
        field: 'agent',
        message: `Suite agent "${suite.agent}" (resolves to "${normalizeAgentId(suite.agent)}") does not match requested agent "${agent}" (resolves to "${normalizeAgentId(agent)}")`
      });
      return result;
    }

    // Validate test paths exist (resolve legacy ids to canonical dirs)
    const testsDir = join(this.agentsDir, normalizeAgentId(agent), 'tests');
    
    if (!existsSync(testsDir)) {
      result.valid = false;
      result.errors.push({
        field: 'testsDir',
        message: `Tests directory not found: ${testsDir}`
      });
      return result;
    }
    
    // Check each test file
    let foundTests = 0;
    
    for (const test of suite.tests) {
      const testPath = join(testsDir, test.path);
      
      if (!existsSync(testPath)) {
        result.missingTests.push(test.path);
        
        if (test.required !== false) {
          result.valid = false;
          result.errors.push({
            field: `tests[${test.id}].path`,
            message: `Required test file not found: ${test.path}`,
            value: testPath
          });
        } else {
          result.warnings.push(
            `Optional test file not found: ${test.name} (${test.path})`
          );
        }
      } else {
        foundTests++;
      }
    }
    
    // Validate test count
    if (foundTests !== suite.totalTests) {
      result.warnings.push(
        `Test count mismatch: Found ${foundTests} tests, declared ${suite.totalTests}`
      );
    }
    
    // Validate unique test IDs
    const testIds = suite.tests.map(t => t.id);
    const uniqueIds = new Set(testIds);
    
    if (testIds.length !== uniqueIds.size) {
      result.valid = false;
      result.errors.push({
        field: 'tests[].id',
        message: 'Duplicate test IDs found'
      });
    }
    
    return result;
  }
  
  /**
   * Validate a loaded suite object (checks paths exist)
   */
  validateSuite(agent: string, suite: TestSuite): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      missingTests: [],
      suite
    };

    // Conflict detection: requested agent must resolve to the same canonical
    // id as the declared suite agent (legacy vs canonical forms still match).
    if (suite.agent && normalizeAgentId(agent) !== normalizeAgentId(suite.agent)) {
      result.valid = false;
      result.errors.push({
        field: 'agent',
        message: `Suite agent "${suite.agent}" (resolves to "${normalizeAgentId(suite.agent)}") does not match requested agent "${agent}" (resolves to "${normalizeAgentId(agent)}")`
      });
      return result;
    }

    const testsDir = join(this.agentsDir, normalizeAgentId(agent), 'tests');
    
    if (!existsSync(testsDir)) {
      result.valid = false;
      result.errors.push({
        field: 'testsDir',
        message: `Tests directory not found: ${testsDir}`
      });
      return result;
    }
    
    // Check each test file
    let foundTests = 0;
    
    for (const test of suite.tests) {
      const testPath = join(testsDir, test.path);
      
      if (!existsSync(testPath)) {
        result.missingTests.push(test.path);
        
        if (test.required !== false) {
          result.valid = false;
          result.errors.push({
            field: `tests[${test.id}].path`,
            message: `Required test file not found: ${test.path}`,
            value: testPath
          });
        } else {
          result.warnings.push(
            `Optional test file not found: ${test.name} (${test.path})`
          );
        }
      } else {
        foundTests++;
      }
    }
    
    // Validate test count
    if (foundTests !== suite.totalTests) {
      result.warnings.push(
        `Test count mismatch: Found ${foundTests} tests, declared ${suite.totalTests}`
      );
    }
    
    return result;
  }
  
  /**
   * Validate suite data (for runtime validation)
   */
  validateSuiteData(suiteData: unknown): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      missingTests: []
    };
    
    const parseResult = TestSuiteSchema.safeParse(suiteData);
    
    if (!parseResult.success) {
      result.valid = false;
      
      parseResult.error.errors.forEach(err => {
        result.errors.push({
          field: err.path.join('.'),
          message: err.message
        });
      });
    } else {
      result.suite = parseResult.data;
    }
    
    return result;
  }
  
  /**
   * Load a test suite definition
   */
  loadSuite(agent: string, suiteName: string): TestSuite {
    // Try new location first (suites directory)
    let suitePath = join(this.agentsDir, agent, 'config', 'suites', `${suiteName}.json`);
    
    // Fallback to config directory
    if (!existsSync(suitePath)) {
      suitePath = join(this.agentsDir, agent, 'config', `${suiteName}.json`);
    }
    
    // Fallback to legacy naming
    if (!existsSync(suitePath)) {
      suitePath = join(this.agentsDir, agent, 'config', `${suiteName}-tests.json`);
    }
    
    if (!existsSync(suitePath)) {
      throw new Error(`Suite not found: ${suiteName} for agent ${agent}`);
    }
    
    const content = readFileSync(suitePath, 'utf8');
    const suite = JSON.parse(content) as TestSuite;
    
    // Ensure agent field is set (canonicalize the requested id)
    if (!suite.agent) {
      suite.agent = normalizeAgentId(agent);
    }
    
    return suite;
  }
  
  /**
   * Get absolute paths for all tests in a suite
   */
  getTestPaths(agent: string, suite: TestSuite): string[] {
    const testsDir = join(this.agentsDir, normalizeAgentId(agent), 'tests');
    const paths: string[] = [];
    
    for (const test of suite.tests) {
      const testPath = join(testsDir, test.path);
      if (existsSync(testPath)) {
        paths.push(testPath);
      }
    }
    
    return paths;
  }
  
  /**
   * Type guard for TestSuite
   */
  isValidSuite(data: unknown): data is TestSuite {
    return TestSuiteSchema.safeParse(data).success;
  }
}

/**
 * Standalone validation function
 */
export function validateTestSuite(suiteData: unknown): ValidationResult {
  const validator = new SuiteValidator('');
  return validator.validateSuiteData(suiteData);
}
