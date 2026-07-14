import { readFile } from 'fs/promises';
import { parse as parseYaml } from 'yaml';
import { TestCaseSchema, TestSuiteSchema, type TestCase, type TestSuite } from './test-case-schema.js';
import { normalizeAgentId } from '../config.js';

/**
 * Load a single test case from a YAML file
 */
export async function loadTestCase(filePath: string): Promise<TestCase> {
  const content = await readFile(filePath, 'utf-8');
  const data = parseYaml(content);
  
  try {
    const testCase = TestCaseSchema.parse(data);

    // Canonicalize legacy agent identifiers to category-based IDs (e.g. "openagent" → "core/openagent").
    // Unknown identifiers are preserved unchanged by normalizeAgentId.
    if (testCase.agent) {
      testCase.agent = normalizeAgentId(testCase.agent);
    }

    // Warn about deprecated schema
    if (testCase.expected && !testCase.behavior && !testCase.expectedViolations) {
      console.warn(`⚠️  Test ${testCase.id} uses deprecated "expected" schema.`);
      console.warn(`   Consider migrating to "behavior" + "expectedViolations" for more reliable tests.`);
      console.warn(`   See EVAL_TEST_DESIGN.md for details.\n`);
    }
    
    return testCase;
  } catch (error) {
    throw new Error(`Invalid test case in ${filePath}: ${error}`);
  }
}

/**
 * Load a test suite (multiple test cases) from a YAML file
 */
export async function loadTestSuite(filePath: string): Promise<TestSuite> {
  const content = await readFile(filePath, 'utf-8');
  const data = parseYaml(content);
  
  try {
    return TestSuiteSchema.parse(data);
  } catch (error) {
    throw new Error(`Invalid test suite in ${filePath}: ${error}`);
  }
}

/**
 * Load multiple test cases from multiple files
 */
export async function loadTestCases(filePaths: string[]): Promise<TestCase[]> {
  const promises = filePaths.map(loadTestCase);
  return Promise.all(promises);
}

/**
 * Validate a test case without loading from file
 */
export function validateTestCase(data: unknown): TestCase {
  return TestCaseSchema.parse(data);
}

/**
 * Validate a test suite without loading from file
 */
export function validateTestSuite(data: unknown): TestSuite {
  return TestSuiteSchema.parse(data);
}
