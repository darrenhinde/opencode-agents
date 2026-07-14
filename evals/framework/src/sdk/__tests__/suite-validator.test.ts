/**
 * Tests for SuiteValidator category-based identity and path resolution.
 *
 * Uses the REAL evals/agents directory as agentsDir so that the canonical
 * `core/openagent` core suite and its nested test paths are exercised
 * end-to-end. Conflict / missing-test / duplicate-id cases use small temp
 * fixture files whose paths are passed directly to the validator.
 *
 * NOTE: Validation is filesystem-only. No network, model, or agent execution.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SuiteValidator } from '../suite-validator.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Real agents directory (matches the layout used by the validate:suites CLI)
const agentsDir = join(__dirname, '../../../../agents');
const coreSuitePath = join(
  agentsDir,
  'core/openagent/config/core-suite.json'
);

/**
 * Minimal but schema-valid suite object used for temp fixtures.
 */
function makeSuite(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'Fixture Suite',
    description: 'Temporary fixture suite for validator tests',
    version: '1.0.0',
    agent: 'core/openagent',
    totalTests: 1,
    estimatedRuntime: '1-2 minutes',
    tests: [
      {
        id: 1,
        name: 'Approval Gate',
        path: '01-critical-rules/approval-gate/05-approval-before-execution-positive.yaml',
        category: 'critical-rules',
        priority: 'critical'
      }
    ],
    ...overrides
  };
}

describe('SuiteValidator - category-based identities', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'suite-validator-'));
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeFixture(name: string, data: unknown): string {
    const filePath = join(tmpDir, name);
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return filePath;
  }

  describe('canonical id resolution (criterion 1)', () => {
    it('accepts canonical core/openagent suite and resolves its test paths', () => {
      // Arrange
      const validator = new SuiteValidator(agentsDir);

      // Act
      const result = validator.validateSuiteFile('core/openagent', coreSuitePath);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.suite?.agent).toBe('core/openagent');
      // Required tests were located under evals/agents/core/openagent/tests
      expect(result.missingTests).toHaveLength(0);
      expect(result.suite?.tests.length).toBeGreaterThan(0);
    });
  });

  describe('legacy id resolution (criterion 2)', () => {
    it('accepts legacy "openagent" request and resolves to the canonical dir', () => {
      // Arrange
      const validator = new SuiteValidator(agentsDir);

      // Act: request with the legacy flat id against the canonical suite file
      const result = validator.validateSuiteFile('openagent', coreSuitePath);

      // Assert: legacy and canonical forms of the SAME agent must match
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      // Paths still resolved under core/openagent/tests (nothing missing)
      expect(result.missingTests).toHaveLength(0);
    });
  });

  describe('conflict detection (criterion 3)', () => {
    it('fails with an "agent" field error when requested agent differs from declared', () => {
      // Arrange: suite declares a DIFFERENT agent than the one requested
      const fixturePath = writeFixture(
        'conflict.json',
        makeSuite({ agent: 'core/opencoder' })
      );
      const validator = new SuiteValidator(agentsDir);

      // Act
      const result = validator.validateSuiteFile('core/openagent', fixturePath);

      // Assert
      expect(result.valid).toBe(false);
      const agentError = result.errors.find(e => e.field === 'agent');
      expect(agentError).toBeDefined();
      expect(agentError?.message).toContain('does not match requested agent');
    });

    it('does NOT flag a conflict for legacy vs canonical forms of the same agent', () => {
      // Arrange: suite declares canonical, request uses legacy flat id
      const fixturePath = writeFixture(
        'no-conflict.json',
        makeSuite({ agent: 'core/openagent' })
      );
      const validator = new SuiteValidator(agentsDir);

      // Act
      const result = validator.validateSuiteFile('openagent', fixturePath);

      // Assert: no agent-field conflict error
      const agentError = result.errors.find(e => e.field === 'agent');
      expect(agentError).toBeUndefined();
      expect(result.valid).toBe(true);
    });
  });

  describe('required test presence and unique ids (criterion 4)', () => {
    it('fails when a required test file is missing', () => {
      // Arrange: required test with a path that does not exist
      const fixturePath = writeFixture(
        'missing-test.json',
        makeSuite({
          tests: [
            {
              id: 1,
              name: 'Nonexistent Test',
              path: 'does-not-exist/nope.yaml',
              category: 'critical-rules',
              priority: 'critical',
              required: true
            }
          ]
        })
      );
      const validator = new SuiteValidator(agentsDir);

      // Act
      const result = validator.validateSuiteFile('core/openagent', fixturePath);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.missingTests).toContain('does-not-exist/nope.yaml');
      expect(
        result.errors.some(e => e.message.includes('Required test file not found'))
      ).toBe(true);
    });

    it('fails when duplicate test IDs are present', () => {
      // Arrange: two tests sharing id 1 (both point at a real file so the
      // failure is attributable to the duplicate id, not a missing path)
      const realPath =
        '01-critical-rules/approval-gate/05-approval-before-execution-positive.yaml';
      const fixturePath = writeFixture(
        'dup-ids.json',
        makeSuite({
          totalTests: 2,
          tests: [
            { id: 1, name: 'A', path: realPath, category: 'critical-rules', priority: 'critical' },
            { id: 1, name: 'B', path: realPath, category: 'critical-rules', priority: 'high' }
          ]
        })
      );
      const validator = new SuiteValidator(agentsDir);

      // Act
      const result = validator.validateSuiteFile('core/openagent', fixturePath);

      // Assert
      expect(result.valid).toBe(false);
      expect(
        result.errors.some(e => e.message.includes('Duplicate test IDs'))
      ).toBe(true);
    });
  });

  describe('schema acceptance matrix', () => {
    it('accepts all supported core agent id forms and rejects unknown flat ids', () => {
      // Arrange
      const validator = new SuiteValidator(agentsDir);

      // Act + Assert: supported forms validate at the data/schema level
      for (const agent of ['openagent', 'opencoder', 'core/openagent', 'core/opencoder']) {
        const res = validator.validateSuiteData(makeSuite({ agent }));
        expect(res.valid, `expected ${agent} to be schema-valid`).toBe(true);
      }

      // Unknown flat id (no slash, not normalizable) is rejected by the schema
      const bad = validator.validateSuiteData(makeSuite({ agent: 'totally-unknown-agent' }));
      expect(bad.valid).toBe(false);
      expect(bad.errors.some(e => e.field === 'agent')).toBe(true);
    });
  });
});
