import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  detectIde,
  detectIdes,
  isIdePresent,
  getIdeOutputFile,
  getIdeDisplayName,
} from './ide-detect.js';

// ── getIdeOutputFile ───────────────────────────────────────────────────────────
// Pure function — no I/O.

describe('getIdeOutputFile', () => {
  // ✅ Positive: cursor maps to .cursorrules
  test('cursor → .cursorrules', () => {
    expect(getIdeOutputFile('cursor')).toBe('.cursorrules');
  });

  // ✅ Positive: claude maps to CLAUDE.md
  test('claude → CLAUDE.md', () => {
    expect(getIdeOutputFile('claude')).toBe('CLAUDE.md');
  });

  // ✅ Positive: windsurf maps to .windsurfrules
  test('windsurf → .windsurfrules', () => {
    expect(getIdeOutputFile('windsurf')).toBe('.windsurfrules');
  });

  // ✅ Positive: opencode maps to .opencode/
  test('opencode → .opencode/', () => {
    expect(getIdeOutputFile('opencode')).toBe('.opencode/');
  });
});

// ── getIdeDisplayName ─────────────────────────────────────────────────────────
// Pure function — no I/O.

describe('getIdeDisplayName', () => {
  // ✅ Positive: cursor → Cursor
  test('cursor → Cursor', () => {
    expect(getIdeDisplayName('cursor')).toBe('Cursor');
  });

  // ✅ Positive: claude → Claude
  test('claude → Claude', () => {
    expect(getIdeDisplayName('claude')).toBe('Claude');
  });

  // ✅ Positive: windsurf → Windsurf
  test('windsurf → Windsurf', () => {
    expect(getIdeDisplayName('windsurf')).toBe('Windsurf');
  });

  // ✅ Positive: opencode → OpenCode
  test('opencode → OpenCode', () => {
    expect(getIdeDisplayName('opencode')).toBe('OpenCode');
  });
});

// ── detectIde — directory-based IDEs ─────────────────────────────────────────
// These are the critical tests that verify the stat-based directory detection
// fix works correctly (Bun.file().exists() always returns false for directories).

describe('detectIde — opencode (directory-based)', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'oac-ide-detect-opencode-'));
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // ✅ Positive: .opencode/ directory present → detected: true
  test('detected: true when .opencode/ directory exists', async () => {
    // Arrange
    const projectRoot = join(tmpDir, 'with-opencode');
    await mkdir(join(projectRoot, '.opencode'), { recursive: true });
    // Act
    const result = await detectIde(projectRoot, 'opencode');
    // Assert
    expect(result.type).toBe('opencode');
    expect(result.detected).toBe(true);
    expect(result.indicator).toContain('.opencode');
  });

  // ❌ Negative: .opencode/ directory absent → detected: false
  test('detected: false when .opencode/ directory does not exist', async () => {
    // Arrange — fresh directory with no .opencode/ inside
    const projectRoot = join(tmpDir, 'without-opencode');
    await mkdir(projectRoot, { recursive: true });
    // Act
    const result = await detectIde(projectRoot, 'opencode');
    // Assert
    expect(result.type).toBe('opencode');
    expect(result.detected).toBe(false);
    expect(result.indicator).toContain('.opencode');
  });
});

describe('detectIde — cursor (directory-based)', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'oac-ide-detect-cursor-'));
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // ✅ Positive: .cursor/ directory present → detected: true
  test('detected: true when .cursor/ directory exists', async () => {
    // Arrange
    const projectRoot = join(tmpDir, 'with-cursor');
    await mkdir(join(projectRoot, '.cursor'), { recursive: true });
    // Act
    const result = await detectIde(projectRoot, 'cursor');
    // Assert
    expect(result.type).toBe('cursor');
    expect(result.detected).toBe(true);
    expect(result.indicator).toContain('.cursor');
  });

  // ❌ Negative: .cursor/ directory absent → detected: false
  test('detected: false when .cursor/ directory does not exist', async () => {
    // Arrange
    const projectRoot = join(tmpDir, 'without-cursor');
    await mkdir(projectRoot, { recursive: true });
    // Act
    const result = await detectIde(projectRoot, 'cursor');
    // Assert
    expect(result.type).toBe('cursor');
    expect(result.detected).toBe(false);
    expect(result.indicator).toContain('.cursor');
  });
});

describe('detectIde — windsurf (directory-based)', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'oac-ide-detect-windsurf-'));
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // ✅ Positive: .windsurf/ directory present → detected: true
  test('detected: true when .windsurf/ directory exists', async () => {
    // Arrange
    const projectRoot = join(tmpDir, 'with-windsurf');
    await mkdir(join(projectRoot, '.windsurf'), { recursive: true });
    // Act
    const result = await detectIde(projectRoot, 'windsurf');
    // Assert
    expect(result.type).toBe('windsurf');
    expect(result.detected).toBe(true);
    expect(result.indicator).toContain('.windsurf');
  });

  // ❌ Negative: .windsurf/ directory absent → detected: false
  test('detected: false when .windsurf/ directory does not exist', async () => {
    // Arrange
    const projectRoot = join(tmpDir, 'without-windsurf');
    await mkdir(projectRoot, { recursive: true });
    // Act
    const result = await detectIde(projectRoot, 'windsurf');
    // Assert
    expect(result.type).toBe('windsurf');
    expect(result.detected).toBe(false);
    expect(result.indicator).toContain('.windsurf');
  });
});

// ── detectIde — claude (two indicators) ──────────────────────────────────────
// Claude is special: it checks for a .claude/ directory OR a CLAUDE.md file.

describe('detectIde — claude (directory + file indicators)', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'oac-ide-detect-claude-'));
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // ✅ Positive: .claude/ directory present → detected: true, indicator mentions .claude/
  test('detected: true when .claude/ directory exists', async () => {
    // Arrange
    const projectRoot = join(tmpDir, 'with-claude-dir');
    await mkdir(join(projectRoot, '.claude'), { recursive: true });
    // Act
    const result = await detectIde(projectRoot, 'claude');
    // Assert
    expect(result.type).toBe('claude');
    expect(result.detected).toBe(true);
    expect(result.indicator).toContain('.claude');
  });

  // ✅ Positive: CLAUDE.md file present (no directory) → detected: true, indicator mentions CLAUDE.md
  test('detected: true when CLAUDE.md file exists (no .claude/ directory)', async () => {
    // Arrange — only the file, no .claude/ directory
    const projectRoot = join(tmpDir, 'with-claude-file');
    await mkdir(projectRoot, { recursive: true });
    await writeFile(join(projectRoot, 'CLAUDE.md'), '# Claude rules\n', 'utf8');
    // Act
    const result = await detectIde(projectRoot, 'claude');
    // Assert
    expect(result.type).toBe('claude');
    expect(result.detected).toBe(true);
    expect(result.indicator).toContain('CLAUDE.md');
  });

  // ✅ Positive: both .claude/ directory and CLAUDE.md present → detected: true
  test('detected: true when both .claude/ directory and CLAUDE.md exist', async () => {
    // Arrange
    const projectRoot = join(tmpDir, 'with-claude-both');
    await mkdir(join(projectRoot, '.claude'), { recursive: true });
    await writeFile(join(projectRoot, 'CLAUDE.md'), '# Claude rules\n', 'utf8');
    // Act
    const result = await detectIde(projectRoot, 'claude');
    // Assert
    expect(result.type).toBe('claude');
    expect(result.detected).toBe(true);
  });

  // ❌ Negative: neither .claude/ nor CLAUDE.md present → detected: false
  test('detected: false when neither .claude/ directory nor CLAUDE.md exists', async () => {
    // Arrange — empty project root
    const projectRoot = join(tmpDir, 'without-claude');
    await mkdir(projectRoot, { recursive: true });
    // Act
    const result = await detectIde(projectRoot, 'claude');
    // Assert
    expect(result.type).toBe('claude');
    expect(result.detected).toBe(false);
  });
});

// ── detectIdes — all 4 IDEs in parallel ──────────────────────────────────────

describe('detectIdes — parallel detection of all 4 IDEs', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'oac-ide-detect-all-'));
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // ✅ Positive: returns exactly 4 results covering all IDE types
  test('returns an array of 4 DetectedIde results', async () => {
    // Arrange
    const projectRoot = join(tmpDir, 'count-check');
    await mkdir(projectRoot, { recursive: true });
    // Act
    const results = await detectIdes(projectRoot);
    // Assert
    expect(results).toHaveLength(4);
    const types = results.map((r) => r.type);
    expect(types).toContain('opencode');
    expect(types).toContain('cursor');
    expect(types).toContain('claude');
    expect(types).toContain('windsurf');
  });

  // ❌ Negative: empty temp dir → all 4 IDEs return detected: false
  test('all 4 IDEs return detected: false in an empty directory', async () => {
    // Arrange — directory with no IDE indicators
    const projectRoot = join(tmpDir, 'all-absent');
    await mkdir(projectRoot, { recursive: true });
    // Act
    const results = await detectIdes(projectRoot);
    // Assert
    for (const result of results) {
      expect(result.detected).toBe(false);
    }
  });

  // ✅ Positive: .cursor/ and CLAUDE.md present → cursor and claude detected, others not
  test('detects cursor and claude when their indicators are present', async () => {
    // Arrange
    const projectRoot = join(tmpDir, 'cursor-and-claude');
    await mkdir(join(projectRoot, '.cursor'), { recursive: true });
    await writeFile(join(projectRoot, 'CLAUDE.md'), '# Claude rules\n', 'utf8');
    // Act
    const results = await detectIdes(projectRoot);
    // Assert
    const byType = Object.fromEntries(results.map((r) => [r.type, r]));
    expect(byType['cursor']?.detected).toBe(true);
    expect(byType['claude']?.detected).toBe(true);
    expect(byType['opencode']?.detected).toBe(false);
    expect(byType['windsurf']?.detected).toBe(false);
  });

  // ✅ Positive: all 4 IDE directories present → all 4 detected
  test('detects all 4 IDEs when all indicator directories are present', async () => {
    // Arrange
    const projectRoot = join(tmpDir, 'all-present');
    await mkdir(join(projectRoot, '.opencode'), { recursive: true });
    await mkdir(join(projectRoot, '.cursor'), { recursive: true });
    await mkdir(join(projectRoot, '.claude'), { recursive: true });
    await mkdir(join(projectRoot, '.windsurf'), { recursive: true });
    // Act
    const results = await detectIdes(projectRoot);
    // Assert
    for (const result of results) {
      expect(result.detected).toBe(true);
    }
  });
});

// ── isIdePresent ──────────────────────────────────────────────────────────────

describe('isIdePresent', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'oac-ide-present-'));
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // ✅ Positive: returns true when the IDE directory exists
  test('returns true when .cursor/ directory exists', async () => {
    // Arrange
    const projectRoot = join(tmpDir, 'present-cursor');
    await mkdir(join(projectRoot, '.cursor'), { recursive: true });
    // Act
    const present = await isIdePresent(projectRoot, 'cursor');
    // Assert
    expect(present).toBe(true);
  });

  // ✅ Positive: returns true for opencode when .opencode/ directory exists
  test('returns true when .opencode/ directory exists', async () => {
    // Arrange
    const projectRoot = join(tmpDir, 'present-opencode');
    await mkdir(join(projectRoot, '.opencode'), { recursive: true });
    // Act
    const present = await isIdePresent(projectRoot, 'opencode');
    // Assert
    expect(present).toBe(true);
  });

  // ❌ Negative: returns false when the IDE directory is absent
  test('returns false when .cursor/ directory does not exist', async () => {
    // Arrange — empty project root
    const projectRoot = join(tmpDir, 'absent-cursor');
    await mkdir(projectRoot, { recursive: true });
    // Act
    const present = await isIdePresent(projectRoot, 'cursor');
    // Assert
    expect(present).toBe(false);
  });

  // ❌ Negative: returns false for windsurf when directory is absent
  test('returns false when .windsurf/ directory does not exist', async () => {
    // Arrange
    const projectRoot = join(tmpDir, 'absent-windsurf');
    await mkdir(projectRoot, { recursive: true });
    // Act
    const present = await isIdePresent(projectRoot, 'windsurf');
    // Assert
    expect(present).toBe(false);
  });

  // ✅ Positive: returns true for claude when CLAUDE.md file exists (no directory)
  test('returns true for claude when CLAUDE.md file exists', async () => {
    // Arrange — only the file, no .claude/ directory
    const projectRoot = join(tmpDir, 'present-claude-file');
    await mkdir(projectRoot, { recursive: true });
    await writeFile(join(projectRoot, 'CLAUDE.md'), '# Claude\n', 'utf8');
    // Act
    const present = await isIdePresent(projectRoot, 'claude');
    // Assert
    expect(present).toBe(true);
  });

  // ❌ Negative: returns false when project root itself does not exist
  test('returns false when the project root directory does not exist', async () => {
    // Arrange — a path that was never created
    const nonExistentRoot = join(tmpDir, 'does-not-exist-at-all');
    // Act
    const present = await isIdePresent(nonExistentRoot, 'cursor');
    // Assert
    expect(present).toBe(false);
  });
});
