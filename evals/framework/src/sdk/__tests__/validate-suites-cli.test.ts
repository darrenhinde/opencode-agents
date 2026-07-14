/**
 * Tests for the validate-suites CLI helpers.
 *
 * Exercises the pure, exported discovery and exit-code functions using temp
 * directory fixtures (mkdtempSync). No CLI/process.exit is triggered because
 * the module uses an ESM entrypoint guard, so importing it is side-effect free.
 *
 * NOTE: Filesystem-only. No network, model, paid API, or agent execution.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

import {
  discoverAgents,
  computeExitCode
} from '../validate-suites-cli.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Real agents directory (matches the layout used by the validate:suites CLI).
const realAgentsDir = join(__dirname, '../../../../agents');

describe('validate-suites-cli - discoverAgents', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'discover-agents-'));
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('recursively finds category-based agent config dirs and ignores non-agent siblings', () => {
    // Arrange: nested <category>/<agent>/config layout.
    mkdirSync(join(tmpRoot, 'core', 'openagent', 'config'), { recursive: true });
    mkdirSync(join(tmpRoot, 'core', 'opencoder', 'config'), { recursive: true });
    mkdirSync(join(tmpRoot, 'development', 'frontend-specialist', 'config'), { recursive: true });
    // Sibling directory WITHOUT a config subdir -> must be ignored.
    mkdirSync(join(tmpRoot, 'content', 'copywriter', 'docs'), { recursive: true });
    // Noise directories that must be skipped.
    mkdirSync(join(tmpRoot, '.hidden', 'config'), { recursive: true });
    mkdirSync(join(tmpRoot, 'node_modules', 'pkg', 'config'), { recursive: true });

    // Act
    const agents = discoverAgents(tmpRoot);

    // Assert: category-based ids, sorted, deterministic; no non-agent dirs.
    expect(agents).toEqual([
      'core/opencoder',
      'core/openagent',
      'development/frontend-specialist'
    ].sort());
    expect(agents).not.toContain('content/copywriter');
    expect(agents).not.toContain('.hidden');
    expect(agents.some(a => a.includes('node_modules'))).toBe(false);
  });

  it('returns a sorted, deterministic order', () => {
    // Arrange
    mkdirSync(join(tmpRoot, 'zeta', 'zzz', 'config'), { recursive: true });
    mkdirSync(join(tmpRoot, 'alpha', 'aaa', 'config'), { recursive: true });
    mkdirSync(join(tmpRoot, 'core', 'mmm', 'config'), { recursive: true });

    // Act
    const agents = discoverAgents(tmpRoot);

    // Assert
    expect(agents).toEqual([...agents].sort());
    expect(agents).toEqual(['alpha/aaa', 'core/mmm', 'zeta/zzz']);
  });

  it('returns an empty array for an empty tree', () => {
    // Arrange: tmpRoot exists but has no agent config dirs.
    // Act
    const agents = discoverAgents(tmpRoot);

    // Assert
    expect(agents).toEqual([]);
  });

  it('returns an empty array for a nonexistent directory', () => {
    // Act
    const agents = discoverAgents(join(tmpRoot, 'does-not-exist'));

    // Assert
    expect(agents).toEqual([]);
  });

  it('discovers core/openagent in the real agents directory', () => {
    // Act
    const agents = discoverAgents(realAgentsDir);

    // Assert
    expect(agents).toContain('core/openagent');
  });
});

describe('validate-suites-cli - computeExitCode (fail-closed)', () => {
  it('returns nonzero when zero suites were discovered', () => {
    // Assert
    expect(computeExitCode({ totalSuites: 0, invalidSuites: 0 })).not.toBe(0);
  });

  it('returns nonzero when any suite is invalid', () => {
    // Assert
    expect(computeExitCode({ totalSuites: 5, invalidSuites: 1 })).not.toBe(0);
  });

  it('returns zero only when total > 0 and every suite is valid', () => {
    // Assert
    expect(computeExitCode({ totalSuites: 3, invalidSuites: 0 })).toBe(0);
  });

  it('treats zero suites as a failure even with no invalid suites', () => {
    // Assert: fail-closed — empty discovery must not be reported as success.
    expect(computeExitCode({ totalSuites: 0, invalidSuites: 0 })).toBe(1);
  });
});
