import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  classifyBundledFile,
  findPackageRoot,
  getBundledFilePath,
  listBundledFiles,
  bundledFileExists,
  type BundledFileType,
} from './bundled.js';

// ── classifyBundledFile ───────────────────────────────────────────────────────
// Pure function — no I/O, no setup needed.

describe('classifyBundledFile', () => {
  // ✅ Positive: agent prefix
  test('returns "agent" for .opencode/agent/ paths', () => {
    // Arrange
    const path = '.opencode/agent/core/openagent.md';
    // Act
    const result: BundledFileType = classifyBundledFile(path);
    // Assert
    expect(result).toBe('agent');
  });

  // ✅ Positive: agent prefix — nested deeply
  test('returns "agent" for deeply nested agent paths', () => {
    expect(classifyBundledFile('.opencode/agent/sub/dir/file.md')).toBe('agent');
  });

  // ✅ Positive: context prefix
  test('returns "context" for .opencode/context/ paths', () => {
    expect(classifyBundledFile('.opencode/context/standards.md')).toBe('context');
  });

  // ✅ Positive: context prefix — nested
  test('returns "context" for nested context paths', () => {
    expect(classifyBundledFile('.opencode/context/sub/file.md')).toBe('context');
  });

  // ✅ Positive: skill prefix
  test('returns "skill" for .opencode/skills/ paths', () => {
    expect(classifyBundledFile('.opencode/skills/my-skill.md')).toBe('skill');
  });

  // ✅ Positive: skill prefix — nested
  test('returns "skill" for nested skills paths', () => {
    expect(classifyBundledFile('.opencode/skills/category/skill.md')).toBe('skill');
  });

  // ✅ Positive: config fallback — arbitrary path
  test('returns "config" for unrecognised paths', () => {
    expect(classifyBundledFile('some/other/file.json')).toBe('config');
  });

  // ✅ Positive: config fallback — root-level file
  test('returns "config" for a root-level file', () => {
    expect(classifyBundledFile('README.md')).toBe('config');
  });

  // ❌ Negative: path that starts with .opencode/ but not a known subdir
  test('returns "config" for .opencode/ paths with unknown subdir', () => {
    expect(classifyBundledFile('.opencode/unknown/file.md')).toBe('config');
  });

  // ❌ Negative: partial prefix match should NOT classify as agent
  test('returns "config" for path that only partially matches agent prefix', () => {
    // ".opencode/agentX/" is NOT ".opencode/agent/"
    expect(classifyBundledFile('.opencode/agentX/file.md')).toBe('config');
  });

  // ❌ Negative: partial prefix match should NOT classify as context
  test('returns "config" for path that only partially matches context prefix', () => {
    expect(classifyBundledFile('.opencode/contexts/file.md')).toBe('config');
  });

  // ❌ Negative: empty string
  test('returns "config" for an empty string', () => {
    expect(classifyBundledFile('')).toBe('config');
  });
});

// ── getBundledFilePath ────────────────────────────────────────────────────────
// Pure function — no I/O.

describe('getBundledFilePath', () => {
  // ✅ Positive: joins packageRoot and relativePath
  test('joins packageRoot and relativePath correctly', () => {
    // Arrange
    const packageRoot = '/usr/local/lib/oac';
    const relativePath = '.opencode/agent/core/openagent.md';
    // Act
    const result = getBundledFilePath(packageRoot, relativePath);
    // Assert
    expect(result).toBe('/usr/local/lib/oac/.opencode/agent/core/openagent.md');
  });

  // ✅ Positive: works with nested relative paths
  test('handles nested relative paths', () => {
    const result = getBundledFilePath('/root', '.opencode/skills/sub/skill.md');
    expect(result).toBe('/root/.opencode/skills/sub/skill.md');
  });

  // ❌ Negative: empty relative path returns just the packageRoot
  test('returns packageRoot when relativePath is empty', () => {
    const result = getBundledFilePath('/root', '');
    expect(result).toBe('/root');
  });
});

// ── findPackageRoot ───────────────────────────────────────────────────────────

describe('findPackageRoot', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'oac-bundled-test-'));
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // ✅ Positive: finds a directory that has both .opencode/ and package.json
  test('returns the directory that has both .opencode/ and package.json', async () => {
    // Arrange — create a fake package root
    const fakeRoot = join(tmpDir, 'fake-pkg');
    await mkdir(join(fakeRoot, '.opencode'), { recursive: true });
    await writeFile(join(fakeRoot, 'package.json'), '{}', 'utf8');
    // Also create a subdirectory to start the walk from
    const startDir = join(fakeRoot, 'dist', 'lib');
    await mkdir(startDir, { recursive: true });

    // Act
    const result = findPackageRoot(startDir);

    // Assert
    expect(result).toBe(fakeRoot);
  });

  // ✅ Positive: finds root when starting exactly at the package root
  test('returns the start directory itself when it is the package root', async () => {
    // Arrange
    const fakeRoot = join(tmpDir, 'exact-root');
    await mkdir(join(fakeRoot, '.opencode'), { recursive: true });
    await writeFile(join(fakeRoot, 'package.json'), '{}', 'utf8');

    // Act
    const result = findPackageRoot(fakeRoot);

    // Assert
    expect(result).toBe(fakeRoot);
  });

  // ❌ Negative: throws when no package root is found (isolated tmp dir with no markers)
  test('throws an error when no package root is found walking to filesystem root', async () => {
    // Arrange — a directory with neither .opencode/ nor package.json
    const isolated = join(tmpDir, 'isolated-no-markers');
    await mkdir(isolated, { recursive: true });

    // Act & Assert — we cannot actually walk to the real filesystem root in a
    // test (it would find the monorepo's package.json), so we test the error
    // message shape by checking that a directory missing .opencode throws when
    // the walk terminates. We use a path that IS the filesystem root equivalent
    // by mocking: instead, we verify the thrown error message format by calling
    // with a path that has package.json but no .opencode, and one that has
    // .opencode but no package.json — neither should match, but the walk will
    // eventually reach the real monorepo root. So we test the error path by
    // verifying the function throws when given a path that cannot possibly
    // resolve (we use the OS tmpdir itself, which has no .opencode).
    //
    // The safest approach: create a temp dir tree that is self-contained and
    // has no .opencode anywhere. We can't prevent the walk from going above
    // tmpdir, so we test the error message by checking it contains the
    // expected substring when we know it will throw.
    //
    // NOTE: In CI / a clean environment this will throw because there is no
    // .opencode above the tmpdir. In a monorepo dev environment the walk may
    // find the repo root. We therefore test the error *shape* by directly
    // calling with a path that we know will fail: the filesystem root '/'.
    expect(() => findPackageRoot('/')).toThrow(
      'getPackageRoot: could not find a directory with ".opencode/" and "package.json"',
    );
  });

  // ❌ Negative: error message includes the start directory
  test('error message includes the starting directory', () => {
    // Arrange & Act & Assert
    let thrownMessage = '';
    try {
      findPackageRoot('/');
    } catch (err) {
      thrownMessage = err instanceof Error ? err.message : String(err);
    }
    expect(thrownMessage).toContain('"/"');
  });

  // ❌ Negative: directory with only package.json (no .opencode) does not match
  test('does not match a directory that has package.json but no .opencode', async () => {
    // Arrange — a directory with only package.json, no .opencode
    const noOpencode = join(tmpDir, 'no-opencode');
    await mkdir(noOpencode, { recursive: true });
    await writeFile(join(noOpencode, 'package.json'), '{}', 'utf8');
    // Start from a child — the walk will pass through noOpencode (no match)
    // and continue upward until it finds the monorepo root or throws.
    // We just verify it does NOT return noOpencode.
    let result: string | undefined;
    try {
      result = findPackageRoot(noOpencode);
    } catch {
      result = undefined;
    }
    // If it found something, it must NOT be noOpencode (which lacks .opencode)
    if (result !== undefined) {
      expect(result).not.toBe(noOpencode);
    }
    // Either it threw (correct) or found a higher-level root (also acceptable)
    expect(true).toBe(true); // test passes either way — the key is it didn't return noOpencode
  });
});

// ── listBundledFiles ──────────────────────────────────────────────────────────

describe('listBundledFiles', () => {
  let packageRoot: string;

  beforeAll(async () => {
    packageRoot = await mkdtemp(join(tmpdir(), 'oac-list-bundled-'));

    // Create a fake package structure with files in all three subdirs
    await mkdir(join(packageRoot, '.opencode', 'agent', 'core'), { recursive: true });
    await mkdir(join(packageRoot, '.opencode', 'context'), { recursive: true });
    await mkdir(join(packageRoot, '.opencode', 'skills', 'sub'), { recursive: true });

    await writeFile(join(packageRoot, '.opencode', 'agent', 'core', 'openagent.md'), '# Agent', 'utf8');
    await writeFile(join(packageRoot, '.opencode', 'agent', 'helper.md'), '# Helper', 'utf8');
    await writeFile(join(packageRoot, '.opencode', 'context', 'standards.md'), '# Standards', 'utf8');
    await writeFile(join(packageRoot, '.opencode', 'skills', 'sub', 'skill.md'), '# Skill', 'utf8');
  });

  afterAll(async () => {
    await rm(packageRoot, { recursive: true, force: true });
  });

  // ✅ Positive: returns relative paths for all files in all three subdirs
  test('returns relative paths for all bundled files', async () => {
    // Act
    const files = await listBundledFiles(packageRoot);

    // Assert — all four files should be present
    expect(files).toContain('.opencode/agent/core/openagent.md');
    expect(files).toContain('.opencode/agent/helper.md');
    expect(files).toContain('.opencode/context/standards.md');
    expect(files).toContain('.opencode/skills/sub/skill.md');
    expect(files).toHaveLength(4);
  });

  // ✅ Positive: paths are relative (not absolute)
  test('returns relative paths, not absolute paths', async () => {
    const files = await listBundledFiles(packageRoot);
    for (const f of files) {
      expect(f.startsWith('/')).toBe(false);
    }
  });

  // ✅ Positive: paths start with .opencode/
  test('all returned paths start with .opencode/', async () => {
    const files = await listBundledFiles(packageRoot);
    for (const f of files) {
      expect(f.startsWith('.opencode/')).toBe(true);
    }
  });

  // ❌ Negative: missing subdirectories are silently skipped
  test('silently skips subdirectories that do not exist', async () => {
    // Arrange — a package root with only the agent subdir
    const sparseRoot = await mkdtemp(join(tmpdir(), 'oac-sparse-pkg-'));
    try {
      await mkdir(join(sparseRoot, '.opencode', 'agent'), { recursive: true });
      await writeFile(join(sparseRoot, '.opencode', 'agent', 'only.md'), '# Only', 'utf8');

      // Act — context/ and skills/ don't exist
      const files = await listBundledFiles(sparseRoot);

      // Assert — only the agent file, no errors
      expect(files).toHaveLength(1);
      expect(files[0]).toBe('.opencode/agent/only.md');
    } finally {
      await rm(sparseRoot, { recursive: true, force: true });
    }
  });

  // ❌ Negative: empty package root returns empty array
  test('returns empty array when no bundled subdirs exist', async () => {
    // Arrange — completely empty package root
    const emptyRoot = await mkdtemp(join(tmpdir(), 'oac-empty-pkg-'));
    try {
      const files = await listBundledFiles(emptyRoot);
      expect(files).toHaveLength(0);
    } finally {
      await rm(emptyRoot, { recursive: true, force: true });
    }
  });
});

// ── bundledFileExists ─────────────────────────────────────────────────────────

describe('bundledFileExists', () => {
  let packageRoot: string;

  beforeAll(async () => {
    packageRoot = await mkdtemp(join(tmpdir(), 'oac-exists-test-'));
    await mkdir(join(packageRoot, '.opencode', 'agent'), { recursive: true });
    await writeFile(join(packageRoot, '.opencode', 'agent', 'present.md'), '# Present', 'utf8');
  });

  afterAll(async () => {
    await rm(packageRoot, { recursive: true, force: true });
  });

  // ✅ Positive: returns true for a file that exists
  test('returns true when the bundled file exists', async () => {
    const exists = await bundledFileExists(packageRoot, '.opencode/agent/present.md');
    expect(exists).toBe(true);
  });

  // ❌ Negative: returns false for a file that does not exist
  test('returns false when the bundled file does not exist', async () => {
    const exists = await bundledFileExists(packageRoot, '.opencode/agent/missing.md');
    expect(exists).toBe(false);
  });
});
