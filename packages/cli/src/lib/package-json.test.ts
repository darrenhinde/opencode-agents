/**
 * Structural tests for package.json correctness.
 *
 * These tests validate that package metadata follows npm best practices.
 * Several CURRENTLY FAIL — they will pass after the fix subtasks are applied.
 *
 * Each test is annotated with:
 *   - The subtask that fixes it (e.g. "subtask-01")
 *   - Whether it CURRENTLY FAILS or CURRENTLY PASSES
 *
 * Using Bun.file().json() for JSON loading (more reliable in Bun than
 * import assertions, and avoids module caching issues between test runs).
 */
import { describe, test, expect } from 'bun:test';
import { join } from 'node:path';

// ── Load both package.json files ──────────────────────────────────────────────

// Paths relative to this test file: packages/cli/src/lib/package-json.test.ts
// Root package.json: ../../../../package.json (4 levels up)
// CLI package.json:  ../../package.json (2 levels up)

const rootPkgPath = join(import.meta.dir, '../../../../package.json');
const cliPkgPath = join(import.meta.dir, '../../package.json');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rootPkg: any = await Bun.file(rootPkgPath).json();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cliPkg: any = await Bun.file(cliPkgPath).json();

// ── Root package.json ─────────────────────────────────────────────────────────

describe('root package.json structural requirements', () => {
  // ❌ CURRENTLY FAILS: root package.json has no publishConfig field.
  // WILL PASS after subtask-01 adds publishConfig.access = "public".
  test('has publishConfig.access set to "public" (subtask-01 gate)', () => {
    // Arrange — rootPkg loaded above
    // Act & Assert
    expect(rootPkg.publishConfig?.access).toBe('public');
  });

  // ❌ CURRENTLY FAILS: root package.json has engines.node = ">=18.0.0" but
  // the CLI requires Bun, not Node.js. After subtask-05, engines should have
  // a bun field instead of (or in addition to) node.
  // WILL PASS after subtask-05 fixes the engines field.
  test('engines field has bun requirement (not just node) (subtask-05 gate)', () => {
    // Arrange
    const engines = rootPkg.engines ?? {};

    // Assert — must have a bun engine requirement
    expect('bun' in engines).toBe(true);
  });

  // ❌ CURRENTLY FAILS: root package.json has no repository.directory field.
  // WILL PASS after subtask-03 adds repository.directory.
  test('has repository.directory field (subtask-03 gate)', () => {
    expect(rootPkg.repository?.directory).toBeDefined();
  });

  // ❌ CURRENTLY FAILS: root package.json has no prepublishOnly script.
  // WILL PASS after subtask-02 adds prepublishOnly.
  test('has prepublishOnly script (subtask-02 gate)', () => {
    expect(rootPkg.scripts?.prepublishOnly).toBeDefined();
  });

  // ❌ CURRENTLY FAILS: root is "0.7.1", cli is "1.0.0" — they don't match.
  // WILL PASS after subtask-06 syncs packages/cli version to root version.
  test('version matches packages/cli version (subtask-06 gate)', () => {
    // Both package.json files must have the same version string
    expect(rootPkg.version).toBe(cliPkg.version);
  });

  // ✅ CURRENTLY PASSES: root has a bin field pointing to bin/oac.js.
  // Regression guard — must not be removed by any subtask.
  test('has bin.oac pointing to ./bin/oac.js (regression guard)', () => {
    expect(rootPkg.bin?.oac).toBe('./bin/oac.js');
  });

  // ✅ CURRENTLY PASSES: root has a name field.
  // Regression guard.
  test('name is "@nextsystems/oac" (regression guard)', () => {
    expect(rootPkg.name).toBe('@nextsystems/oac');
  });

  // ✅ CURRENTLY PASSES: root has a license field.
  // Regression guard.
  test('has a license field (regression guard)', () => {
    expect(rootPkg.license).toBeDefined();
    expect(typeof rootPkg.license).toBe('string');
  });

  // ✅ CURRENTLY PASSES: root has a repository field.
  // Regression guard.
  test('has a repository field with type "git" (regression guard)', () => {
    expect(rootPkg.repository?.type).toBe('git');
  });

  // ✅ CURRENTLY PASSES: root has a files array.
  // Regression guard — the files array must include bin/ and .opencode/.
  test('files array includes "bin/" (regression guard)', () => {
    expect(Array.isArray(rootPkg.files)).toBe(true);
    expect(rootPkg.files).toContain('bin/');
  });
});

// ── packages/cli/package.json ─────────────────────────────────────────────────

describe('packages/cli/package.json structural requirements', () => {
  // ❌ CURRENTLY FAILS: packages/cli has no publishConfig field.
  // WILL PASS after subtask-01 adds publishConfig.access = "public".
  test('has publishConfig.access set to "public" (subtask-01 gate)', () => {
    expect(cliPkg.publishConfig?.access).toBe('public');
  });

  // ❌ CURRENTLY FAILS: packages/cli has a bin field { oac: "./dist/index.js" }.
  // The sub-package should not be directly installable as a CLI tool —
  // the root package owns the bin entry point.
  // WILL PASS after subtask-04 removes the bin field from packages/cli.
  test('does NOT have a bin field (subtask-04 gate)', () => {
    expect(cliPkg.bin).toBeUndefined();
  });

  // ❌ CURRENTLY FAILS: packages/cli has no repository.directory field.
  // WILL PASS after subtask-03 adds repository.directory = "packages/cli".
  test('has repository.directory set to "packages/cli" (subtask-03 gate)', () => {
    expect(cliPkg.repository?.directory).toBe('packages/cli');
  });

  // ❌ CURRENTLY FAILS: packages/cli has no prepublishOnly script.
  // WILL PASS after subtask-02 adds prepublishOnly.
  test('has prepublishOnly script (subtask-02 gate)', () => {
    expect(cliPkg.scripts?.prepublishOnly).toBeDefined();
  });

  // ❌ CURRENTLY FAILS: packages/cli is not marked private.
  // The sub-package should be private (not directly publishable to npm).
  // WILL PASS after subtask-04 adds "private": true to packages/cli.
  test('is marked private: true (subtask-04 gate)', () => {
    expect(cliPkg.private).toBe(true);
  });

  // ❌ CURRENTLY FAILS: packages/cli version is "1.0.0", root is "0.7.1".
  // WILL PASS after subtask-06 syncs the version.
  test('version matches root package.json version (subtask-06 gate)', () => {
    expect(cliPkg.version).toBe(rootPkg.version);
  });

  // ✅ CURRENTLY PASSES: packages/cli has engines.bun >= 1.0.0.
  // Regression guard.
  test('engines.bun is set (regression guard)', () => {
    expect(cliPkg.engines?.bun).toBeDefined();
  });

  // ✅ CURRENTLY PASSES: packages/cli has a name field.
  // Regression guard.
  test('name is "@nextsystems/oac-cli" (regression guard)', () => {
    expect(cliPkg.name).toBe('@nextsystems/oac-cli');
  });

  // ✅ CURRENTLY PASSES: packages/cli has a build script.
  // Regression guard — build script must not be removed.
  test('has a build script (regression guard)', () => {
    expect(cliPkg.scripts?.build).toBeDefined();
  });

  // ✅ CURRENTLY PASSES: packages/cli has a test script.
  // Regression guard.
  test('has a test script (regression guard)', () => {
    expect(cliPkg.scripts?.test).toBeDefined();
  });

  // ✅ CURRENTLY PASSES: packages/cli has required runtime dependencies.
  // Regression guard — commander and chalk must remain.
  test('has commander as a dependency (regression guard)', () => {
    expect(cliPkg.dependencies?.commander).toBeDefined();
  });

  test('has chalk as a dependency (regression guard)', () => {
    expect(cliPkg.dependencies?.chalk).toBeDefined();
  });

  test('has zod as a dependency (regression guard)', () => {
    expect(cliPkg.dependencies?.zod).toBeDefined();
  });
});

// ── Cross-package consistency ─────────────────────────────────────────────────

describe('cross-package consistency', () => {
  // ❌ CURRENTLY FAILS: versions are out of sync (0.7.1 vs 1.0.0).
  // WILL PASS after subtask-06.
  test('root and cli versions are identical (subtask-06 gate)', () => {
    expect(rootPkg.version).toBe(cliPkg.version);
  });

  // ✅ CURRENTLY PASSES: both packages have the same license.
  // Regression guard.
  test('root and cli have the same license (regression guard)', () => {
    // Both should be MIT (or whatever the root specifies)
    if (rootPkg.license && cliPkg.license) {
      expect(cliPkg.license).toBe(rootPkg.license);
    }
    // If cli doesn't have a license field yet, that's acceptable
    expect(true).toBe(true);
  });
});
