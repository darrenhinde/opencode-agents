/**
 * Tests for update-check.ts — verifies update notification logic.
 *
 * These tests FAIL until subtask-12 creates packages/cli/src/lib/update-check.ts.
 * After subtask-12, all tests should pass.
 *
 * Design notes:
 * - fetchLatestNpmVersion() makes real network calls in production.
 *   Tests that call it use a known-stable package ('commander') and handle
 *   null gracefully (network may be unavailable in CI).
 * - shouldShowUpdateNotice() is a pure function — fully deterministic tests.
 * - Module-existence tests fail immediately with "Cannot find module" until
 *   the file is created.
 *
 * Note on TypeScript errors: tsconfig.json excludes *.test.ts from type checking
 * (line 26: "exclude": [..., "**\/*.test.ts"]). The "Cannot find module" errors
 * shown by the editor are expected — they prove the module doesn't exist yet.
 * Bun's test runner resolves modules at runtime, so the tests run and fail with
 * a clear "Cannot find module" error message.
 */
import { describe, test, expect } from 'bun:test';

// ── Helper: load the module or throw a clear error ────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadUpdateCheck(): Promise<any> {
  // Dynamic import — fails with "Cannot find module" until subtask-12 creates the file.
  // Using a string expression (not a literal) to prevent TypeScript from resolving
  // the module at compile time and emitting a hard error.
  const modulePath = './update-check.js';
  return import(modulePath);
}

// ── Module existence (subtask-12 gate) ────────────────────────────────────────

describe('update-check module exports (subtask-12 gate)', () => {
  // ❌ CURRENTLY FAILS: module does not exist yet.
  // WILL PASS after subtask-12 creates update-check.ts.
  test('module exports fetchLatestNpmVersion function', async () => {
    // Act — throws "Cannot find module" until update-check.ts is created
    const mod = await loadUpdateCheck();

    // Assert
    expect(typeof mod.fetchLatestNpmVersion).toBe('function');
  });

  // ❌ CURRENTLY FAILS: module does not exist yet.
  test('module exports checkForUpdate function', async () => {
    const mod = await loadUpdateCheck();
    expect(typeof mod.checkForUpdate).toBe('function');
  });

  // ❌ CURRENTLY FAILS: module does not exist yet.
  // shouldShowUpdateNotice is a pure helper — exported for testability.
  test('module exports shouldShowUpdateNotice function', async () => {
    const mod = await loadUpdateCheck();
    expect(typeof mod.shouldShowUpdateNotice).toBe('function');
  });
});

// ── shouldShowUpdateNotice() — pure function, fully deterministic ─────────────

describe('shouldShowUpdateNotice() (subtask-12 gate)', () => {
  // ❌ CURRENTLY FAILS: module does not exist yet.
  // WILL PASS after subtask-12.

  // ✅ Positive: returns true when latest version is strictly newer
  test('returns true when latest is newer than current (patch bump)', async () => {
    // Arrange
    const { shouldShowUpdateNotice } = await loadUpdateCheck();

    // Act
    const result = shouldShowUpdateNotice('1.0.0', '1.0.1');

    // Assert
    expect(result).toBe(true);
  });

  // ✅ Positive: returns true when latest is newer (minor bump)
  test('returns true when latest is newer than current (minor bump)', async () => {
    const { shouldShowUpdateNotice } = await loadUpdateCheck();
    expect(shouldShowUpdateNotice('1.0.0', '1.1.0')).toBe(true);
  });

  // ✅ Positive: returns true when latest is newer (major bump)
  test('returns true when latest is newer than current (major bump)', async () => {
    const { shouldShowUpdateNotice } = await loadUpdateCheck();
    expect(shouldShowUpdateNotice('1.0.0', '2.0.0')).toBe(true);
  });

  // ❌ Negative: returns false when versions are identical
  test('returns false when current equals latest', async () => {
    const { shouldShowUpdateNotice } = await loadUpdateCheck();
    expect(shouldShowUpdateNotice('1.0.0', '1.0.0')).toBe(false);
  });

  // ❌ Negative: returns false when current is NEWER than latest (pre-release / dev build)
  test('returns false when current is newer than latest (pre-release scenario)', async () => {
    const { shouldShowUpdateNotice } = await loadUpdateCheck();
    expect(shouldShowUpdateNotice('2.0.0', '1.9.9')).toBe(false);
  });

  // ❌ Negative: returns false when latest is null (offline / fetch failed)
  test('returns false when latest is null (offline scenario)', async () => {
    const { shouldShowUpdateNotice } = await loadUpdateCheck();
    expect(shouldShowUpdateNotice('1.0.0', null)).toBe(false);
  });
});

// ── fetchLatestNpmVersion() — network call, graceful null on failure ──────────

describe('fetchLatestNpmVersion() (subtask-12 gate)', () => {
  // ❌ CURRENTLY FAILS: module does not exist yet.
  // WILL PASS after subtask-12.

  // ✅ Positive: returns a semver string for a known package (or null if offline)
  test('returns a semver string or null for a known npm package', async () => {
    // Arrange
    const { fetchLatestNpmVersion } = await loadUpdateCheck();

    // Act — use 'commander' which is a stable, always-published package
    const version = await fetchLatestNpmVersion('commander');

    // Assert — either a valid semver string or null (if network unavailable in CI)
    if (version !== null) {
      expect(version).toMatch(/^\d+\.\d+\.\d+/);
    } else {
      // null is acceptable — network may be unavailable
      expect(version).toBeNull();
    }
  });

  // ❌ Negative: returns null for a non-existent package (404 from registry)
  test('returns null for a package that does not exist on npm', async () => {
    // Arrange
    const { fetchLatestNpmVersion } = await loadUpdateCheck();

    // Act — this package definitely does not exist
    const version = await fetchLatestNpmVersion('@nextsystems/this-package-does-not-exist-xyz-abc-123');

    // Assert — must return null, not throw
    expect(version).toBeNull();
  });

  // ❌ Negative: returns null (does not throw) when fetch fails
  test('returns null (does not throw) when fetch fails for invalid package', async () => {
    // Arrange
    const { fetchLatestNpmVersion } = await loadUpdateCheck();

    // Act — use a clearly invalid package name that will 404
    let result: string | null;
    let threw = false;
    try {
      result = await fetchLatestNpmVersion('@invalid-scope-xyz/no-such-package-ever');
    } catch {
      threw = true;
      result = null;
    }

    // Assert — must return null, never throw
    expect(threw).toBe(false);
    expect(result).toBeNull();
  });
});

// ── checkForUpdate() — integration, non-blocking ─────────────────────────────

describe('checkForUpdate() (subtask-12 gate)', () => {
  // ❌ CURRENTLY FAILS: module does not exist yet.
  // WILL PASS after subtask-12.

  // ✅ Positive: checkForUpdate() resolves without throwing
  test('checkForUpdate() resolves without throwing (non-blocking contract)', async () => {
    // Arrange
    const { checkForUpdate } = await loadUpdateCheck();

    // Act & Assert — must never throw, even if network is unavailable
    await expect(checkForUpdate()).resolves.toBeUndefined();
  });

  // ✅ Positive: checkForUpdate() returns void (undefined), not a value
  test('checkForUpdate() returns undefined (void)', async () => {
    const { checkForUpdate } = await loadUpdateCheck();
    const result = await checkForUpdate();
    expect(result).toBeUndefined();
  });
});
