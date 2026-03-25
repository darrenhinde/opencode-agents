import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { computeFileHash, computeStringHash, hashesMatch } from './sha256.js';

// ── computeStringHash ─────────────────────────────────────────────────────────

describe('computeStringHash', () => {
  test('returns a 64-char hex string', () => {
    const hash = computeStringHash('hello');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test('is deterministic for the same input', () => {
    expect(computeStringHash('hello')).toBe(computeStringHash('hello'));
  });

  test('differs for different inputs', () => {
    expect(computeStringHash('hello')).not.toBe(computeStringHash('world'));
  });

  test('empty string has a known SHA256', () => {
    // SHA256('') = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    expect(computeStringHash('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });
});

// ── hashesMatch ───────────────────────────────────────────────────────────────

describe('hashesMatch', () => {
  test('returns true for identical hashes', () => {
    const h = computeStringHash('test');
    expect(hashesMatch(h, h)).toBe(true);
  });

  test('returns false for different hashes', () => {
    expect(hashesMatch(computeStringHash('a'), computeStringHash('b'))).toBe(false);
  });

  test('is case-insensitive', () => {
    const lower = 'abc123def456';
    const upper = 'ABC123DEF456';
    expect(hashesMatch(lower, upper)).toBe(true);
  });
});

// ── computeFileHash ───────────────────────────────────────────────────────────

describe('computeFileHash', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'oac-sha256-test-'));
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test('returns the SHA256 of a file matching computeStringHash', async () => {
    const content = 'hello world';
    const filePath = join(tmpDir, 'test.txt');
    await writeFile(filePath, content, 'utf8');

    const fileHash = await computeFileHash(filePath);
    const stringHash = computeStringHash(content);
    expect(fileHash).toBe(stringHash);
  });

  test('throws a descriptive error for a missing file', async () => {
    const missing = join(tmpDir, 'does-not-exist.txt');
    await expect(computeFileHash(missing)).rejects.toThrow('computeFileHash: cannot read');
  });

  test('is deterministic across two reads of the same file', async () => {
    const filePath = join(tmpDir, 'stable.txt');
    await writeFile(filePath, 'stable content', 'utf8');
    const h1 = await computeFileHash(filePath);
    const h2 = await computeFileHash(filePath);
    expect(h1).toBe(h2);
  });

  // ✅ Positive: binary file — hash is a valid 64-char hex string
  test('returns a valid 64-char hex hash for a binary file', async () => {
    // Arrange — write raw bytes (not valid UTF-8 text)
    const binaryPath = join(tmpDir, 'binary.bin');
    const bytes = new Uint8Array([0x00, 0xff, 0xfe, 0x80, 0x01, 0x7f, 0xab, 0xcd]);
    await Bun.write(binaryPath, bytes);

    // Act
    const hash = await computeFileHash(binaryPath);

    // Assert
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  // ✅ Positive: binary file hash matches computeStringHash of same bytes
  test('binary file hash is consistent with hashing the same byte sequence', async () => {
    // Arrange
    const binaryPath = join(tmpDir, 'binary-consistent.bin');
    const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    await Bun.write(binaryPath, bytes);

    // Act
    const fileHash = await computeFileHash(binaryPath);
    // computeStringHash uses utf8 encoding, so we compare against the raw
    // crypto hash of the same bytes to verify correctness
    const { createHash } = await import('node:crypto');
    const expectedHash = createHash('sha256').update(bytes).digest('hex');

    // Assert
    expect(fileHash).toBe(expectedHash);
  });

  // ✅ Positive: large file (1 MB) — hash is computed correctly
  test('returns a valid hash for a large file (1 MB)', async () => {
    // Arrange — 1 MB of repeated bytes
    const largePath = join(tmpDir, 'large.bin');
    const oneMB = 1024 * 1024;
    const largeBytes = new Uint8Array(oneMB).fill(0x42); // 1 MB of 'B'
    await Bun.write(largePath, largeBytes);

    // Act
    const hash = await computeFileHash(largePath);

    // Assert
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // Verify determinism for large file
    const hash2 = await computeFileHash(largePath);
    expect(hash).toBe(hash2);
  });

  // ❌ Negative: empty file has the known SHA256 of empty content
  test('empty file returns the SHA256 of empty content', async () => {
    // Arrange
    const emptyPath = join(tmpDir, 'empty.txt');
    await writeFile(emptyPath, '', 'utf8');

    // Act
    const hash = await computeFileHash(emptyPath);

    // Assert — SHA256('') is the well-known constant
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  // ❌ Negative: two files with different content have different hashes
  test('different file contents produce different hashes', async () => {
    // Arrange
    const pathA = join(tmpDir, 'diff-a.txt');
    const pathB = join(tmpDir, 'diff-b.txt');
    await writeFile(pathA, 'content A', 'utf8');
    await writeFile(pathB, 'content B', 'utf8');

    // Act
    const hashA = await computeFileHash(pathA);
    const hashB = await computeFileHash(pathB);

    // Assert
    expect(hashA).not.toBe(hashB);
  });
});
