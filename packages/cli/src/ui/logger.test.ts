/**
 * Tests for logger.ts — verifies each function writes to the correct stream.
 *
 * Unix convention: diagnostic messages (warn, error) → stderr
 *                  status/progress messages (log, info, success, dim, bold) → stdout
 *
 * Subtask-07 gate: warn() currently uses console.log (stdout).
 * After subtask-07 it must use console.error (stderr).
 *
 * Pattern: capture console.log and console.error calls via spy wrappers,
 * restore originals in finally blocks to avoid test pollution.
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { log, info, warn, error, success, dim, bold, verbose, setVerbose } from './logger.js';

// ── Stream capture helpers ────────────────────────────────────────────────────

/** Captures all arguments passed to console.log during a callback. */
function captureStdout(fn: () => void): string[] {
  const captured: string[] = [];
  const orig = console.log;
  console.log = (...args: unknown[]) => {
    captured.push(args.map(String).join(' '));
  };
  try {
    fn();
  } finally {
    console.log = orig;
  }
  return captured;
}

/** Captures all arguments passed to console.error during a callback. */
function captureStderr(fn: () => void): string[] {
  const captured: string[] = [];
  const orig = console.error;
  console.error = (...args: unknown[]) => {
    captured.push(args.map(String).join(' '));
  };
  try {
    fn();
  } finally {
    console.error = orig;
  }
  return captured;
}

// ── warn() — subtask-07 gate ──────────────────────────────────────────────────

describe('warn() output stream (subtask-07 gate)', () => {
  // ❌ CURRENTLY FAILS: warn() uses console.log (stdout), not console.error (stderr).
  // WILL PASS after subtask-07 changes warn() to use console.error.
  test('warn() writes to stderr (console.error), NOT stdout (subtask-07 gate)', () => {
    // Arrange
    const stderrLines: string[] = [];
    const stdoutLines: string[] = [];
    const origError = console.error;
    const origLog = console.log;
    console.error = (...args: unknown[]) => { stderrLines.push(args.map(String).join(' ')); };
    console.log = (...args: unknown[]) => { stdoutLines.push(args.map(String).join(' ')); };

    try {
      // Act
      warn('test warning message');

      // Assert — message must appear on stderr
      expect(stderrLines.some(s => s.includes('test warning message'))).toBe(true);
      // Assert — message must NOT appear on stdout
      expect(stdoutLines.some(s => s.includes('test warning message'))).toBe(false);
    } finally {
      console.error = origError;
      console.log = origLog;
    }
  });

  // ❌ CURRENTLY FAILS: warn() goes to stdout, so suppressing stderr (2>/dev/null)
  // would NOT hide the warning. After the fix, stderr capture should contain it.
  test('warn() message is captured by stderr spy (subtask-07 gate)', () => {
    // Arrange & Act
    const stderrOutput = captureStderr(() => warn('stderr-only warning'));

    // Assert — CURRENTLY FAILS (warn uses console.log, not console.error)
    expect(stderrOutput.some(s => s.includes('stderr-only warning'))).toBe(true);
  });

  // ❌ CURRENTLY FAILS: warn() goes to stdout, so stdout spy captures it.
  // After the fix, stdout spy must NOT capture warn() output.
  test('warn() message is NOT captured by stdout spy (subtask-07 gate)', () => {
    // Arrange & Act
    const stdoutOutput = captureStdout(() => warn('should-not-be-on-stdout'));

    // Assert — CURRENTLY FAILS (warn uses console.log which IS captured by stdout spy)
    expect(stdoutOutput.some(s => s.includes('should-not-be-on-stdout'))).toBe(false);
  });
});

// ── error() — already correct, regression guard ───────────────────────────────

describe('error() output stream (regression guard)', () => {
  // ✅ CURRENTLY PASSES: error() already uses console.error.
  // Guards against regression — subtask-07 must not break error().
  test('error() writes to stderr (console.error)', () => {
    // Arrange & Act
    const stderrOutput = captureStderr(() => error('test error message'));

    // Assert
    expect(stderrOutput.some(s => s.includes('test error message'))).toBe(true);
  });

  // ✅ CURRENTLY PASSES: error() does not write to stdout.
  test('error() does NOT write to stdout', () => {
    // Arrange & Act
    const stdoutOutput = captureStdout(() => error('error-not-on-stdout'));

    // Assert
    expect(stdoutOutput.some(s => s.includes('error-not-on-stdout'))).toBe(false);
  });
});

// ── success() — stdout, regression guard ─────────────────────────────────────

describe('success() output stream (regression guard)', () => {
  // ✅ CURRENTLY PASSES: success() uses console.log (stdout).
  test('success() writes to stdout (console.log)', () => {
    // Arrange & Act
    const stdoutOutput = captureStdout(() => success('test success message'));

    // Assert
    expect(stdoutOutput.some(s => s.includes('test success message'))).toBe(true);
  });

  // ✅ CURRENTLY PASSES: success() does not write to stderr.
  test('success() does NOT write to stderr', () => {
    // Arrange & Act
    const stderrOutput = captureStderr(() => success('success-not-on-stderr'));

    // Assert
    expect(stderrOutput.some(s => s.includes('success-not-on-stderr'))).toBe(false);
  });
});

// ── log() — stdout, regression guard ─────────────────────────────────────────

describe('log() output stream (regression guard)', () => {
  // ✅ CURRENTLY PASSES
  test('log() writes to stdout', () => {
    const stdoutOutput = captureStdout(() => log('plain log message'));
    expect(stdoutOutput.some(s => s.includes('plain log message'))).toBe(true);
  });
});

// ── info() — stdout, regression guard ────────────────────────────────────────

describe('info() output stream (regression guard)', () => {
  // ✅ CURRENTLY PASSES
  test('info() writes to stdout', () => {
    const stdoutOutput = captureStdout(() => info('info message'));
    expect(stdoutOutput.some(s => s.includes('info message'))).toBe(true);
  });
});

// ── dim() — stdout, regression guard ─────────────────────────────────────────

describe('dim() output stream (regression guard)', () => {
  // ✅ CURRENTLY PASSES
  test('dim() writes to stdout', () => {
    const stdoutOutput = captureStdout(() => dim('dim message'));
    expect(stdoutOutput.some(s => s.includes('dim message'))).toBe(true);
  });
});

// ── bold() — stdout, regression guard ────────────────────────────────────────

describe('bold() output stream (regression guard)', () => {
  // ✅ CURRENTLY PASSES
  test('bold() writes to stdout', () => {
    const stdoutOutput = captureStdout(() => bold('bold message'));
    expect(stdoutOutput.some(s => s.includes('bold message'))).toBe(true);
  });
});

// ── verbose() — conditional stdout ───────────────────────────────────────────

describe('verbose() output stream', () => {
  afterEach(() => {
    // Always reset verbose state after each test
    setVerbose(false);
  });

  // ✅ CURRENTLY PASSES: verbose() writes to stdout when enabled
  test('verbose() writes to stdout when verbose is enabled', () => {
    // Arrange
    setVerbose(true);

    // Act
    const stdoutOutput = captureStdout(() => verbose('verbose message'));

    // Assert
    expect(stdoutOutput.some(s => s.includes('verbose message'))).toBe(true);
  });

  // ✅ CURRENTLY PASSES: verbose() is silent when disabled
  test('verbose() does NOT write when verbose is disabled', () => {
    // Arrange
    setVerbose(false);

    // Act
    const stdoutOutput = captureStdout(() => verbose('silent verbose'));

    // Assert
    expect(stdoutOutput.some(s => s.includes('silent verbose'))).toBe(false);
  });
});

// ── Stream separation summary ─────────────────────────────────────────────────
// After all fixes are applied, the stream contract is:
//   stdout (console.log):  log, info, success, dim, bold, verbose
//   stderr (console.error): warn, error
//
// This matches Unix convention: diagnostic messages go to stderr so they
// don't corrupt piped output (e.g. `oac list | grep agent`).
