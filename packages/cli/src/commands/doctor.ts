import { join } from 'node:path';
import { type Command } from 'commander';
import semver from 'semver';

import { readCliVersion } from '../lib/version.js';
import { readManifest } from '../lib/manifest.js';
import { readConfig } from '../lib/config.js';
import { computeFileHash, hashesMatch } from '../lib/sha256.js';
import { detectIdes, getIdeDisplayName, getIdeOutputFile } from '../lib/ide-detect.js';
import { log, info, warn, error, success, dim, bold, setVerbose } from '../ui/logger.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type CheckStatus = 'ok' | 'warn' | 'error' | 'info';

export type CheckResult = {
  name: string;
  status: CheckStatus;
  message: string;
  detail?: string[];
};

export type DoctorOptions = {
  verbose: boolean;
  json: boolean;
};

type DoctorSummary = {
  ok: number;
  warnings: number;
  errors: number;
};

// ── Version helpers ───────────────────────────────────────────────────────────

/** Fetches the latest version from the npm registry. Returns null if offline. */
const fetchLatestNpmVersion = async (packageName: string): Promise<string | null> => {
  try {
    const url = `https://registry.npmjs.org/${packageName}/latest`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    // Network unavailable or timeout — non-blocking
    return null;
  }
};

// ── Individual check functions ────────────────────────────────────────────────

/** Check 1: OAC version vs npm registry (non-blocking, skipped if offline). */
const checkOacVersion = async (): Promise<CheckResult> => {
  const current = readCliVersion();
  const latest = await fetchLatestNpmVersion('@nextsystems/oac');

  if (latest === null) {
    return {
      name: 'OAC version',
      status: 'info',
      message: `${current} (registry check skipped — offline or unreachable)`,
    };
  }

  const isOutdated = semver.lt(current, latest);
  if (isOutdated) {
    return {
      name: 'OAC version',
      status: 'warn',
      message: `${current} (latest: ${latest}) — run 'npm install -g @nextsystems/oac' to update`,
    };
  }

  return {
    name: 'OAC version',
    status: 'ok',
    message: `${current} (latest)`,
  };
};

/** Check 2: Bun runtime version >= 1.0.0. */
const checkBunVersion = (): CheckResult => {
  const bunVersion = Bun.version; // e.g. "1.1.0" — global provided by @types/bun
  const MIN_BUN = '1.0.0';
  const isValid = semver.gte(bunVersion, MIN_BUN);

  return {
    name: 'Bun runtime',
    status: isValid ? 'ok' : 'error',
    message: isValid
      ? `${bunVersion} (>= ${MIN_BUN} required)`
      : `${bunVersion} is below minimum required ${MIN_BUN} — upgrade Bun`,
  };
};

/** Check 3: .oac/config.json exists and is valid JSON. */
const checkConfig = async (projectRoot: string): Promise<CheckResult> => {
  try {
    const config = await readConfig(projectRoot);
    if (config === null) {
      return {
        name: 'Config',
        status: 'warn',
        message: '.oac/config.json not found — run \'oac init\' to create it',
      };
    }
    return {
      name: 'Config',
      status: 'ok',
      message: '.oac/config.json valid',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      name: 'Config',
      status: 'error',
      message: `.oac/config.json invalid — ${msg}`,
    };
  }
};

/** Check 4: .oac/manifest.json exists and is valid JSON. */
const checkManifest = async (projectRoot: string): Promise<CheckResult> => {
  try {
    const manifest = await readManifest(projectRoot);
    if (manifest === null) {
      return {
        name: 'Manifest',
        status: 'error',
        message: '.oac/manifest.json not found — run \'oac init\' to create it',
      };
    }
    const fileCount = Object.keys(manifest.files).length;
    return {
      name: 'Manifest',
      status: 'ok',
      message: `.oac/manifest.json valid (${fileCount} file${fileCount !== 1 ? 's' : ''} tracked)`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      name: 'Manifest',
      status: 'error',
      message: `.oac/manifest.json invalid — ${msg}`,
    };
  }
};

/** Check 5: Every file listed in manifest exists on disk. */
const checkFilesOnDisk = async (projectRoot: string): Promise<CheckResult> => {
  const manifest = await readManifest(projectRoot);
  if (manifest === null) {
    return {
      name: 'Files on disk',
      status: 'error',
      message: 'Cannot check files — manifest is missing',
    };
  }

  const trackedFiles = Object.keys(manifest.files);
  if (trackedFiles.length === 0) {
    return {
      name: 'Files on disk',
      status: 'ok',
      message: 'No files tracked in manifest',
    };
  }

  const missingFiles: string[] = [];
  for (const filePath of trackedFiles) {
    const absPath = join(projectRoot, filePath);
    const exists = await Bun.file(absPath).exists();
    if (!exists) missingFiles.push(filePath);
  }

  if (missingFiles.length > 0) {
    return {
      name: 'Files on disk',
      status: 'error',
      message: `${missingFiles.length} file${missingFiles.length !== 1 ? 's' : ''} missing from disk`,
      detail: missingFiles,
    };
  }

  return {
    name: 'Files on disk',
    status: 'ok',
    message: `All ${trackedFiles.length} tracked file${trackedFiles.length !== 1 ? 's' : ''} present`,
  };
};

/** Check 6: SHA256 mismatch detection — warn for user-modified files. */
const checkModifiedFiles = async (projectRoot: string): Promise<CheckResult> => {
  const manifest = await readManifest(projectRoot);
  if (manifest === null) {
    return {
      name: 'Modified files',
      status: 'error',
      message: 'Cannot check modifications — manifest is missing',
    };
  }

  const trackedFiles = Object.keys(manifest.files);
  if (trackedFiles.length === 0) {
    return {
      name: 'Modified files',
      status: 'ok',
      message: 'No files tracked',
    };
  }

  const modifiedFiles: string[] = [];
  for (const filePath of trackedFiles) {
    const absPath = join(projectRoot, filePath);
    const exists = await Bun.file(absPath).exists();
    if (!exists) continue; // Already reported by checkFilesOnDisk

    try {
      const currentHash = await computeFileHash(absPath);
      const manifestHash = manifest.files[filePath]!.sha256;
      if (!hashesMatch(currentHash, manifestHash)) {
        modifiedFiles.push(filePath);
      }
    } catch {
      // If we can't hash it, skip — checkFilesOnDisk will catch missing files
    }
  }

  if (modifiedFiles.length > 0) {
    return {
      name: 'Modified files',
      status: 'warn',
      message: `${modifiedFiles.length} file${modifiedFiles.length !== 1 ? 's' : ''} modified since install`,
      detail: modifiedFiles,
    };
  }

  return {
    name: 'Modified files',
    status: 'ok',
    message: 'No files modified since install',
  };
};

/** Check 7: IDE detection — suggests 'oac apply' for each detected IDE. */
const checkIdes = async (projectRoot: string): Promise<CheckResult[]> => {
  const ides = await detectIdes(projectRoot);
  const detected = ides.filter((ide) => ide.detected);

  if (detected.length === 0) {
    return [
      {
        name: 'IDE detection',
        status: 'info',
        message: 'No IDEs detected — run \'oac apply <ide>\' to generate IDE-specific files',
      },
    ];
  }

  return detected.map((ide) => ({
    name: `IDE: ${getIdeDisplayName(ide.type)}`,
    status: 'warn' as CheckStatus,
    message: `${getIdeDisplayName(ide.type)} detected (${ide.indicator}) — run 'oac apply ${ide.type}' to sync ${getIdeOutputFile(ide.type)}`,
  }));
};

// ── Result rendering ──────────────────────────────────────────────────────────

/** Prints a single check result with colored status indicator. */
const printCheckResult = (result: CheckResult): void => {
  switch (result.status) {
    case 'ok':
      success(`${result.name}: ${result.message}`);
      break;
    case 'warn':
      warn(`${result.name}: ${result.message}`);
      break;
    case 'error':
      error(`${result.name}: ${result.message}`);
      break;
    case 'info':
      info(`${result.name}: ${result.message}`);
      break;
  }

  if (result.detail && result.detail.length > 0) {
    for (const line of result.detail) {
      dim(`      - ${line}`);
    }
  }
};

/** Computes summary counts from check results. Pure function. */
const summariseResults = (results: CheckResult[]): DoctorSummary => ({
  ok: results.filter((r) => r.status === 'ok' || r.status === 'info').length,
  warnings: results.filter((r) => r.status === 'warn').length,
  errors: results.filter((r) => r.status === 'error').length,
});

/** Returns the overall status string from a summary. Pure function. */
const overallStatus = (summary: DoctorSummary): 'healthy' | 'warning' | 'error' => {
  if (summary.errors > 0) return 'error';
  if (summary.warnings > 0) return 'warning';
  return 'healthy';
};

/** Prints the final result line. Side-effect only. */
const printFinalResult = (summary: DoctorSummary): void => {
  log('');
  const status = overallStatus(summary);
  const parts: string[] = [];
  if (summary.warnings > 0) parts.push(`${summary.warnings} warning${summary.warnings !== 1 ? 's' : ''}`);
  if (summary.errors > 0) parts.push(`${summary.errors} error${summary.errors !== 1 ? 's' : ''}`);
  const detail = parts.length > 0 ? ` (${parts.join(', ')})` : '';

  if (status === 'healthy') {
    success(`Result: HEALTHY${detail}`);
  } else if (status === 'warning') {
    warn(`Result: WARNING${detail}`);
  } else {
    error(`Result: UNHEALTHY${detail}`);
  }
  log('');
};

// ── Main command ──────────────────────────────────────────────────────────────

/**
 * Implements `oac doctor`:
 *  Runs all 7 health checks, prints results, and exits with code 0 (healthy/warnings)
 *  or 1 (errors found). Supports --json for machine-readable output.
 */
export async function doctorCommand(options: DoctorOptions): Promise<void> {
  if (options.verbose) setVerbose(true);

  const projectRoot = process.cwd();

  // Run all independent async checks in parallel for speed
  const [configResult, manifestResult, filesResult, modifiedResult, ideResults, versionResult] =
    await Promise.all([
      checkConfig(projectRoot),
      checkManifest(projectRoot),
      checkFilesOnDisk(projectRoot),
      checkModifiedFiles(projectRoot),
      checkIdes(projectRoot),
      checkOacVersion(),
    ]);

  const allResults: CheckResult[] = [
    checkBunVersion(), // synchronous — call directly
    configResult,
    manifestResult,
    filesResult,
    modifiedResult,
    ...ideResults,    // checkIdes returns CheckResult[]
    versionResult,
  ];

  const summary = summariseResults(allResults);
  const status = overallStatus(summary);

  // JSON output mode (for CI)
  if (options.json) {
    const output = {
      status,
      checks: allResults,
      summary,
    };
    log(JSON.stringify(output, null, 2));
    process.exit(summary.errors > 0 ? 1 : 0);
    return;
  }

  // Human-readable output
  log('');
  bold('OAC Doctor — Checking your setup...');
  log('');

  for (const result of allResults) {
    printCheckResult(result);
  }

  printFinalResult(summary);

  process.exit(summary.errors > 0 ? 1 : 0);
}

// ── Commander registration ────────────────────────────────────────────────────

/**
 * Registers the `doctor` subcommand on the given Commander program.
 * Called by the CLI entry point (index.ts).
 */
export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Check your OAC setup and report any issues')
    .option('--verbose', 'Show additional diagnostic detail', false)
    .option('--json', 'Output results as machine-readable JSON (for CI)', false)
    .action(async (opts: { verbose: boolean; json: boolean }) => {
      await doctorCommand({ verbose: opts.verbose, json: opts.json });
    });
}
