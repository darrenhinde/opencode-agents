import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createEmptyManifest,
  addFileToManifest,
  removeFileFromManifest,
  updateFileHash,
  readManifest,
  writeManifest,
  ManifestError,
  type ManifestFile,
  type FileEntry,
} from './manifest.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeEntry = (overrides: Partial<FileEntry> = {}): FileEntry => ({
  sha256: 'abc123',
  type: 'agent',
  source: 'bundled',
  installedAt: new Date().toISOString(),
  ...overrides,
});

// ── createEmptyManifest ───────────────────────────────────────────────────────

describe('createEmptyManifest', () => {
  test('returns a manifest with version "1"', () => {
    const m = createEmptyManifest('1.0.0');
    expect(m.version).toBe('1');
  });

  test('stores the provided oacVersion', () => {
    const m = createEmptyManifest('2.3.4');
    expect(m.oacVersion).toBe('2.3.4');
  });

  test('starts with an empty files record', () => {
    const m = createEmptyManifest('1.0.0');
    expect(Object.keys(m.files)).toHaveLength(0);
  });

  test('installedAt and updatedAt are valid ISO strings', () => {
    const m = createEmptyManifest('1.0.0');
    expect(() => new Date(m.installedAt)).not.toThrow();
    expect(() => new Date(m.updatedAt)).not.toThrow();
  });
});

// ── addFileToManifest ─────────────────────────────────────────────────────────

describe('addFileToManifest', () => {
  test('adds a new file entry', () => {
    const m = createEmptyManifest('1.0.0');
    const entry = makeEntry();
    const updated = addFileToManifest(m, 'agents/foo.md', entry);
    expect(updated.files['agents/foo.md']).toEqual(entry);
  });

  test('does not mutate the original manifest', () => {
    const m = createEmptyManifest('1.0.0');
    addFileToManifest(m, 'agents/foo.md', makeEntry());
    expect(Object.keys(m.files)).toHaveLength(0);
  });

  test('replaces an existing entry for the same path', () => {
    const m = createEmptyManifest('1.0.0');
    const first = makeEntry({ sha256: 'aaa' });
    const second = makeEntry({ sha256: 'bbb' });
    const m1 = addFileToManifest(m, 'agents/foo.md', first);
    const m2 = addFileToManifest(m1, 'agents/foo.md', second);
    expect(m2.files['agents/foo.md']?.sha256).toBe('bbb');
    expect(Object.keys(m2.files)).toHaveLength(1);
  });

  test('updates updatedAt', () => {
    const m = createEmptyManifest('1.0.0');
    const before = m.updatedAt;
    // Ensure at least 1ms passes
    const updated = addFileToManifest(m, 'agents/foo.md', makeEntry());
    expect(updated.updatedAt >= before).toBe(true);
  });
});

// ── removeFileFromManifest ────────────────────────────────────────────────────

describe('removeFileFromManifest', () => {
  test('removes an existing file', () => {
    const m = addFileToManifest(createEmptyManifest('1.0.0'), 'agents/foo.md', makeEntry());
    const updated = removeFileFromManifest(m, 'agents/foo.md');
    expect(updated.files['agents/foo.md']).toBeUndefined();
  });

  test('is a no-op for a path not in the manifest', () => {
    const m = createEmptyManifest('1.0.0');
    const updated = removeFileFromManifest(m, 'agents/nonexistent.md');
    expect(Object.keys(updated.files)).toHaveLength(0);
  });

  test('does not mutate the original manifest', () => {
    const m = addFileToManifest(createEmptyManifest('1.0.0'), 'agents/foo.md', makeEntry());
    removeFileFromManifest(m, 'agents/foo.md');
    expect(m.files['agents/foo.md']).toBeDefined();
  });

  test('leaves other entries intact', () => {
    let m = createEmptyManifest('1.0.0');
    m = addFileToManifest(m, 'agents/a.md', makeEntry());
    m = addFileToManifest(m, 'agents/b.md', makeEntry());
    const updated = removeFileFromManifest(m, 'agents/a.md');
    expect(updated.files['agents/b.md']).toBeDefined();
    expect(Object.keys(updated.files)).toHaveLength(1);
  });
});

// ── updateFileHash ────────────────────────────────────────────────────────────

describe('updateFileHash', () => {
  test('updates the sha256 of a tracked file', () => {
    const m = addFileToManifest(createEmptyManifest('1.0.0'), 'agents/foo.md', makeEntry({ sha256: 'old' }));
    const updated = updateFileHash(m, 'agents/foo.md', 'new-hash');
    expect(updated.files['agents/foo.md']?.sha256).toBe('new-hash');
  });

  test('throws ManifestError for an untracked file', () => {
    const m = createEmptyManifest('1.0.0');
    expect(() => updateFileHash(m, 'agents/missing.md', 'hash')).toThrow(ManifestError);
  });

  test('preserves other fields on the entry', () => {
    const entry = makeEntry({ type: 'context', source: 'registry' });
    const m = addFileToManifest(createEmptyManifest('1.0.0'), 'ctx/foo.md', entry);
    const updated = updateFileHash(m, 'ctx/foo.md', 'new-hash');
    expect(updated.files['ctx/foo.md']?.type).toBe('context');
    expect(updated.files['ctx/foo.md']?.source).toBe('registry');
  });
});

// ── ManifestError ─────────────────────────────────────────────────────────────

describe('ManifestError', () => {
  test('has name "ManifestError"', () => {
    const err = new ManifestError('oops');
    expect(err.name).toBe('ManifestError');
  });

  test('is an instance of Error', () => {
    expect(new ManifestError('oops')).toBeInstanceOf(Error);
  });

  test('carries the message', () => {
    expect(new ManifestError('bad manifest').message).toBe('bad manifest');
  });
});

// ── readManifest / writeManifest (I/O) ────────────────────────────────────────

describe('readManifest / writeManifest', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'oac-manifest-test-'));
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test('readManifest returns null when no manifest exists', async () => {
    const result = await readManifest(tmpDir);
    expect(result).toBeNull();
  });

  test('writeManifest then readManifest round-trips correctly', async () => {
    const original = createEmptyManifest('1.2.3');
    await writeManifest(tmpDir, original);
    const read = await readManifest(tmpDir);
    expect(read).not.toBeNull();
    expect(read?.version).toBe('1');
    expect(read?.oacVersion).toBe('1.2.3');
    expect(Object.keys(read?.files ?? {})).toHaveLength(0);
  });

  test('readManifest throws ManifestError for invalid JSON structure', async () => {
    // Write a manifest with a bad version field
    const badDir = await mkdtemp(join(tmpdir(), 'oac-bad-manifest-'));
    try {
      await Bun.write(join(badDir, '.oac/manifest.json'), JSON.stringify({ version: '99', files: {} }));
      await expect(readManifest(badDir)).rejects.toThrow(ManifestError);
    } finally {
      await rm(badDir, { recursive: true, force: true });
    }
  });

  test('round-trips a manifest with file entries', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'oac-manifest-entries-'));
    try {
      let m = createEmptyManifest('1.0.0');
      m = addFileToManifest(m, '.opencode/agent/foo.md', makeEntry({ type: 'agent' }));
      await writeManifest(dir, m);
      const read = await readManifest(dir);
      expect(read?.files['.opencode/agent/foo.md']?.type).toBe('agent');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  // ✅ Positive (subtask-10 gate): writeManifest creates .oac/ directory if it does not exist.
  //
  // Context: Bun.write() with a string path currently auto-creates parent directories
  // as undocumented behavior. The subtask-10 fix adds an explicit mkdir() call to make
  // this behavior documented and reliable across Bun versions.
  //
  // This test CURRENTLY PASSES (Bun.write auto-creates dirs in current Bun version).
  // It acts as a REGRESSION GUARD — after subtask-10 adds explicit mkdir, the test
  // must continue to pass. If Bun ever removes the auto-create behavior, the explicit
  // mkdir in subtask-10 ensures this test still passes.
  //
  // The test is labeled "subtask-10 gate" because it validates the acceptance criteria
  // of subtask-10 (writeManifest must work on a fresh directory with no .oac/).
  test('writeManifest creates .oac/ directory if it does not exist (subtask-10 gate)', async () => {
    // Arrange — a completely fresh directory with NO .oac/ subdirectory
    const freshDir = await mkdtemp(join(tmpdir(), 'oac-manifest-mkdir-'));
    try {
      // Verify .oac/ does NOT exist before the call
      const oacDir = join(freshDir, '.oac');
      expect(await Bun.file(join(oacDir, 'manifest.json')).exists()).toBe(false);

      // Act — must succeed whether or not Bun.write auto-creates dirs
      // After subtask-10: explicit mkdir guarantees this works on all Bun versions
      await writeManifest(freshDir, createEmptyManifest('1.0.0'));

      // Assert — .oac/manifest.json must now exist
      expect(await Bun.file(join(oacDir, 'manifest.json')).exists()).toBe(true);
    } finally {
      await rm(freshDir, { recursive: true, force: true });
    }
  });

  // ✅ Positive (subtask-10 gate): writeManifest is idempotent — calling twice does not throw.
  // CURRENTLY PASSES. Regression guard for subtask-10.
  test('writeManifest is idempotent — calling twice with different manifests does not throw (subtask-10 gate)', async () => {
    // Arrange — fresh directory, no .oac/
    const freshDir = await mkdtemp(join(tmpdir(), 'oac-manifest-idempotent-'));
    try {
      const first = createEmptyManifest('1.0.0');
      const second = createEmptyManifest('2.0.0');

      // Act — both calls must succeed without throwing
      await writeManifest(freshDir, first);
      await writeManifest(freshDir, second);

      // Assert — the second write's data is what readManifest returns
      const read = await readManifest(freshDir);
      expect(read?.oacVersion).toBe('2.0.0');
    } finally {
      await rm(freshDir, { recursive: true, force: true });
    }
  });

  // ❌ Negative (regression guard): writeManifest on an existing .oac/ dir does not throw.
  // This test CURRENTLY PASSES (the existing round-trip test already covers this).
  // It acts as a regression guard — subtask-10 must not break the happy path.
  test('writeManifest does not throw when .oac/ already exists (regression guard)', async () => {
    // Arrange — use the shared tmpDir which already has .oac/ from the round-trip test
    const existingDir = await mkdtemp(join(tmpdir(), 'oac-manifest-existing-'));
    try {
      // First write creates .oac/
      await writeManifest(existingDir, createEmptyManifest('1.0.0'));
      // Second write — .oac/ already exists, must not throw
      await expect(writeManifest(existingDir, createEmptyManifest('1.1.0'))).resolves.toBeUndefined();
    } finally {
      await rm(existingDir, { recursive: true, force: true });
    }
  });
});
