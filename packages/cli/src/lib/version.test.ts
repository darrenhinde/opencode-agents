import { describe, test, expect } from 'bun:test';
import { readCliVersion } from './version.js';

describe('readCliVersion', () => {
  test('returns a non-empty string', () => {
    const version = readCliVersion();
    expect(typeof version).toBe('string');
    expect(version.length).toBeGreaterThan(0);
  });

  test('matches semver format (x.y.z)', () => {
    const version = readCliVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });

  test('is deterministic across calls', () => {
    expect(readCliVersion()).toBe(readCliVersion());
  });
});
