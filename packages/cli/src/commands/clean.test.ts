/**
 * Tests for clean.ts — verifies oac clean removes correct directories.
 *
 * These tests FAIL until subtask-13 creates packages/cli/src/commands/clean.ts.
 * After subtask-13, all tests should pass.
 *
 * Design note: cleanCommand() uses process.cwd() internally to determine the
 * project root. Tests use process.chdir() to point it at a temp directory,
 * and restore the original cwd in afterAll/finally blocks.
 *
 * Note on TypeScript errors: tsconfig.json excludes *.test.ts from type checking.
 * The "Cannot find module" errors are expected — they prove the module doesn't
 * exist yet. Bun's test runner resolves modules at runtime.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtemp, rm, mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Option } from 'commander';

// ── Helper: load the module or throw a clear error ────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadClean(): Promise<any> {
  // Dynamic import — fails with "Cannot find module" until subtask-13 creates the file.
  const modulePath = './clean.js';
  return import(modulePath);
}

/** Returns true if the path exists (file or directory). */
async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

// ── Module existence (subtask-13 gate) ────────────────────────────────────────

describe('clean module exports (subtask-13 gate)', () => {
  // ❌ CURRENTLY FAILS: module does not exist yet.
  // WILL PASS after subtask-13 creates clean.ts.
  test('module exports cleanCommand function', async () => {
    const mod = await loadClean();
    expect(typeof mod.cleanCommand).toBe('function');
  });

  // ❌ CURRENTLY FAILS: module does not exist yet.
  test('module exports registerCleanCommand function', async () => {
    const mod = await loadClean();
    expect(typeof mod.registerCleanCommand).toBe('function');
  });
});

// ── cleanCommand() — core removal behaviour ───────────────────────────────────

describe('cleanCommand() removal behaviour (subtask-13 gate)', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'oac-clean-test-'));
    originalCwd = process.cwd();
  });

  afterAll(async () => {
    // Always restore cwd before cleaning up
    process.chdir(originalCwd);
    await rm(tmpDir, { recursive: true, force: true });
  });

  // ❌ CURRENTLY FAILS: module does not exist yet.
  // ✅ Positive: cleanCommand removes .oac/ directory
  test('cleanCommand --force removes .oac/ directory', async () => {
    // Arrange
    const projectDir = join(tmpDir, 'test-remove-oac');
    await mkdir(join(projectDir, '.oac'), { recursive: true });
    await writeFile(join(projectDir, '.oac', 'manifest.json'), '{}');
    process.chdir(projectDir);

    const { cleanCommand } = await loadClean();

    // Act — force mode skips confirmation prompt
    await cleanCommand({ force: true, keepOpencode: false, dryRun: false, ide: false });

    // Assert — .oac/ should be gone
    expect(await pathExists(join(projectDir, '.oac'))).toBe(false);

    // Cleanup
    process.chdir(originalCwd);
  });

  // ❌ CURRENTLY FAILS: module does not exist yet.
  // ✅ Positive: cleanCommand removes .opencode/ directory by default
  test('cleanCommand --force removes .opencode/ directory by default', async () => {
    // Arrange
    const projectDir = join(tmpDir, 'test-remove-opencode');
    await mkdir(join(projectDir, '.opencode', 'agent'), { recursive: true });
    await writeFile(join(projectDir, '.opencode', 'agent', 'test.md'), '# test');
    process.chdir(projectDir);

    const { cleanCommand } = await loadClean();

    // Act
    await cleanCommand({ force: true, keepOpencode: false, dryRun: false, ide: false });

    // Assert
    expect(await pathExists(join(projectDir, '.opencode'))).toBe(false);

    // Cleanup
    process.chdir(originalCwd);
  });

  // ❌ CURRENTLY FAILS: module does not exist yet.
  // ✅ Positive: cleanCommand removes both .oac/ and .opencode/ when both exist
  test('cleanCommand --force removes both .oac/ and .opencode/ when both exist', async () => {
    // Arrange
    const projectDir = join(tmpDir, 'test-remove-both');
    await mkdir(join(projectDir, '.oac'), { recursive: true });
    await mkdir(join(projectDir, '.opencode', 'agent'), { recursive: true });
    await writeFile(join(projectDir, '.oac', 'manifest.json'), '{}');
    await writeFile(join(projectDir, '.opencode', 'agent', 'test.md'), '# test');
    process.chdir(projectDir);

    const { cleanCommand } = await loadClean();

    // Act
    await cleanCommand({ force: true, keepOpencode: false, dryRun: false, ide: false });

    // Assert — both gone
    expect(await pathExists(join(projectDir, '.oac'))).toBe(false);
    expect(await pathExists(join(projectDir, '.opencode'))).toBe(false);

    // Cleanup
    process.chdir(originalCwd);
  });

  // ❌ CURRENTLY FAILS: module does not exist yet.
  // ✅ Positive: --keep-opencode preserves .opencode/ while removing .oac/
  test('cleanCommand --keep-opencode --force removes .oac/ but preserves .opencode/', async () => {
    // Arrange
    const projectDir = join(tmpDir, 'test-keep-opencode');
    await mkdir(join(projectDir, '.oac'), { recursive: true });
    await mkdir(join(projectDir, '.opencode', 'agent'), { recursive: true });
    await writeFile(join(projectDir, '.oac', 'manifest.json'), '{}');
    await writeFile(join(projectDir, '.opencode', 'agent', 'test.md'), '# test');
    process.chdir(projectDir);

    const { cleanCommand } = await loadClean();

    // Act — keepOpencode: true
    await cleanCommand({ force: true, keepOpencode: true, dryRun: false, ide: false });

    // Assert — .oac/ gone, .opencode/ preserved
    expect(await pathExists(join(projectDir, '.oac'))).toBe(false);
    expect(await pathExists(join(projectDir, '.opencode'))).toBe(true);
    expect(await pathExists(join(projectDir, '.opencode', 'agent', 'test.md'))).toBe(true);

    // Cleanup
    process.chdir(originalCwd);
  });

  // ❌ CURRENTLY FAILS: module does not exist yet.
  // ❌ Negative: --dry-run does NOT remove anything
  test('cleanCommand --dry-run does not remove any directories', async () => {
    // Arrange
    const projectDir = join(tmpDir, 'test-dryrun');
    await mkdir(join(projectDir, '.oac'), { recursive: true });
    await mkdir(join(projectDir, '.opencode'), { recursive: true });
    await writeFile(join(projectDir, '.oac', 'manifest.json'), '{}');
    process.chdir(projectDir);

    const { cleanCommand } = await loadClean();

    // Act — dry-run: nothing should be removed
    await cleanCommand({ force: true, keepOpencode: false, dryRun: true, ide: false });

    // Assert — both directories still exist
    expect(await pathExists(join(projectDir, '.oac'))).toBe(true);
    expect(await pathExists(join(projectDir, '.opencode'))).toBe(true);

    // Cleanup
    process.chdir(originalCwd);
  });

  // ❌ CURRENTLY FAILS: module does not exist yet.
  // ❌ Negative: cleanCommand does not throw when neither .oac/ nor .opencode/ exists
  test('cleanCommand does not throw when nothing to clean', async () => {
    // Arrange — empty project directory
    const projectDir = join(tmpDir, 'test-nothing-to-clean');
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);

    const { cleanCommand } = await loadClean();

    // Act & Assert — must not throw
    await expect(
      cleanCommand({ force: true, keepOpencode: false, dryRun: false, ide: false })
    ).resolves.toBeUndefined();

    // Cleanup
    process.chdir(originalCwd);
  });

  // ❌ CURRENTLY FAILS: module does not exist yet.
  // ✅ Positive: --ide flag removes CLAUDE.md when present
  test('cleanCommand --ide --force removes CLAUDE.md when present', async () => {
    // Arrange
    const projectDir = join(tmpDir, 'test-ide-files');
    await mkdir(join(projectDir, '.oac'), { recursive: true });
    await writeFile(join(projectDir, '.oac', 'manifest.json'), '{}');
    await writeFile(join(projectDir, 'CLAUDE.md'), '# Claude instructions');
    process.chdir(projectDir);

    const { cleanCommand } = await loadClean();

    // Act
    await cleanCommand({ force: true, keepOpencode: false, dryRun: false, ide: true });

    // Assert — CLAUDE.md removed
    expect(await pathExists(join(projectDir, 'CLAUDE.md'))).toBe(false);

    // Cleanup
    process.chdir(originalCwd);
  });

  // ❌ CURRENTLY FAILS: module does not exist yet.
  // ❌ Negative: without --ide flag, CLAUDE.md is preserved
  test('cleanCommand without --ide preserves CLAUDE.md', async () => {
    // Arrange
    const projectDir = join(tmpDir, 'test-no-ide-flag');
    await mkdir(join(projectDir, '.oac'), { recursive: true });
    await writeFile(join(projectDir, '.oac', 'manifest.json'), '{}');
    await writeFile(join(projectDir, 'CLAUDE.md'), '# Claude instructions');
    process.chdir(projectDir);

    const { cleanCommand } = await loadClean();

    // Act — ide: false (default)
    await cleanCommand({ force: true, keepOpencode: false, dryRun: false, ide: false });

    // Assert — CLAUDE.md preserved
    expect(await pathExists(join(projectDir, 'CLAUDE.md'))).toBe(true);

    // Cleanup
    process.chdir(originalCwd);
  });
});

// ── registerCleanCommand() — Commander integration ────────────────────────────

describe('registerCleanCommand() Commander integration (subtask-13 gate)', () => {
  // ❌ CURRENTLY FAILS: module does not exist yet.
  // ✅ Positive: registerCleanCommand registers 'clean' on a Commander program
  test('registerCleanCommand registers a "clean" command on the program', async () => {
    // Arrange
    const { Command } = await import('commander');
    const { registerCleanCommand } = await loadClean();
    const program = new Command();

    // Act
    registerCleanCommand(program);

    // Assert — 'clean' command is now registered
    const commands = program.commands.map((c: { name: () => string }) => c.name());
    expect(commands).toContain('clean');
  });

  // ❌ CURRENTLY FAILS: module does not exist yet.
  // ✅ Positive: clean command has --force option
  test('clean command has --force option', async () => {
    // Arrange
    const { Command } = await import('commander');
    const { registerCleanCommand } = await loadClean();
    const program = new Command();
    registerCleanCommand(program);

    // Act
    const cleanCmd = program.commands.find((c: { name: () => string }) => c.name() === 'clean');

    // Assert
    expect(cleanCmd).toBeDefined();
    const optionNames = cleanCmd!.options.map((o: Option) => o.long ?? '');
    expect(optionNames).toContain('--force');
  });

  // ❌ CURRENTLY FAILS: module does not exist yet.
  // ✅ Positive: clean command has --dry-run option
  test('clean command has --dry-run option', async () => {
    // Arrange
    const { Command } = await import('commander');
    const { registerCleanCommand } = await loadClean();
    const program = new Command();
    registerCleanCommand(program);

    // Act
    const cleanCmd = program.commands.find((c: { name: () => string }) => c.name() === 'clean');
    const optionNames = cleanCmd!.options.map((o: Option) => o.long ?? '');

    // Assert
    expect(optionNames).toContain('--dry-run');
  });

  // ❌ CURRENTLY FAILS: module does not exist yet.
  // ✅ Positive: clean command has --keep-opencode option
  test('clean command has --keep-opencode option', async () => {
    // Arrange
    const { Command } = await import('commander');
    const { registerCleanCommand } = await loadClean();
    const program = new Command();
    registerCleanCommand(program);

    // Act
    const cleanCmd = program.commands.find((c: { name: () => string }) => c.name() === 'clean');
    const optionNames = cleanCmd!.options.map((o: Option) => o.long ?? '');

    // Assert
    expect(optionNames).toContain('--keep-opencode');
  });
});
