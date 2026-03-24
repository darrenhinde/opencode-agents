import { type Command } from 'commander';

import { readCliVersion } from '../lib/version.js';
import { isProjectRoot, installFiles } from '../lib/installer.js';
import { getPackageRoot, listBundledFiles } from '../lib/bundled.js';
import { writeManifest } from '../lib/manifest.js';
import { readConfig, writeConfig, createDefaultConfig } from '../lib/config.js';
import { detectIdes } from '../lib/ide-detect.js';
import { log, info, warn, error, success, setVerbose, verbose } from '../ui/logger.js';
import { createSpinner } from '../ui/spinner.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type InitOptions = {
  yolo: boolean;
  dryRun: boolean;
  verbose: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Counts files by type prefix. Pure function. */
const countByType = (
  files: string[],
): { agents: number; context: number; skills: number; other: number } => ({
  agents: files.filter((f) => f.startsWith('.opencode/agent/')).length,
  context: files.filter((f) => f.startsWith('.opencode/context/')).length,
  skills: files.filter((f) => f.startsWith('.opencode/skills/')).length,
  other: files.filter(
    (f) =>
      !f.startsWith('.opencode/agent/') &&
      !f.startsWith('.opencode/context/') &&
      !f.startsWith('.opencode/skills/'),
  ).length,
});

/** Formats a file-count summary string. Pure function. */
const formatFileSummary = (counts: ReturnType<typeof countByType>): string => {
  const parts: string[] = [];
  if (counts.agents > 0) parts.push(`${counts.agents} agent${counts.agents !== 1 ? 's' : ''}`);
  if (counts.context > 0) parts.push(`${counts.context} context file${counts.context !== 1 ? 's' : ''}`);
  if (counts.skills > 0) parts.push(`${counts.skills} skill${counts.skills !== 1 ? 's' : ''}`);
  if (counts.other > 0) parts.push(`${counts.other} other file${counts.other !== 1 ? 's' : ''}`);
  return parts.join(', ') || '0 files';
};

/** Prints the pre-install plan. Side-effect only. */
const printPlan = (
  bundledFiles: string[],
  ides: Awaited<ReturnType<typeof detectIdes>>,
  dryRun: boolean,
): void => {
  const counts = countByType(bundledFiles);
  const detectedIdes = ides.filter((i) => i.detected).map((i) => i.type);

  log('');
  log(dryRun ? '  [dry-run] oac init — no files will be written' : '  oac init');
  log('');
  info(`Will install: ${formatFileSummary(counts)}`);
  info(`Destination:  .opencode/ (relative to project root)`);

  if (detectedIdes.length > 0) {
    info(`IDEs detected: ${detectedIdes.join(', ')} — run \`oac apply\` after init`);
  } else {
    info('No IDEs detected — run `oac apply <ide>` to generate IDE-specific files');
  }

  log('');
};

/** Prints the post-install summary. Side-effect only. */
const printSummary = (
  installed: number,
  skipped: number,
  errors: number,
  dryRun: boolean,
): void => {
  log('');
  if (dryRun) {
    info(`[dry-run] Would install ${installed} file${installed !== 1 ? 's' : ''}.`);
    info('No changes were made. Remove --dry-run to apply.');
    return;
  }
  if (errors > 0) {
    warn(`Completed with ${errors} error${errors !== 1 ? 's' : ''}.`);
  }
  if (skipped > 0) {
    info(`Skipped ${skipped} file${skipped !== 1 ? 's' : ''} (already modified — use --yolo to overwrite).`);
  }
  success(
    `Done! ${installed} file${installed !== 1 ? 's' : ''} installed. Run \`oac doctor\` to verify.`,
  );
  log('');
};

// ── Validation ────────────────────────────────────────────────────────────────

/** Validates we are in a project root. Exits with code 1 if not. */
const assertProjectRoot = async (cwd: string): Promise<void> => {
  const isRoot = await isProjectRoot(cwd);
  if (!isRoot) {
    error(
      'Not a project root — no package.json or .git found in the current directory.',
    );
    error('Fix: run `oac init` from your project root (where package.json lives).');
    process.exit(1);
  }
};

// ── Config guard ──────────────────────────────────────────────────────────────

/**
 * Writes the default config only if one does not already exist.
 * Idempotent — never overwrites an existing config.
 */
const ensureConfig = async (projectRoot: string, dryRun: boolean): Promise<void> => {
  const existing = await readConfig(projectRoot);
  if (existing !== null) {
    verbose('Config already exists — skipping config write.');
    return;
  }
  if (dryRun) {
    info('[dry-run] Would write .oac/config.json with defaults.');
    return;
  }
  await writeConfig(projectRoot, createDefaultConfig());
  verbose('Wrote .oac/config.json with defaults.');
};

// ── Main command ──────────────────────────────────────────────────────────────

/**
 * Implements `oac init`:
 *  1. Validates we are in a project root
 *  2. Detects IDEs and prints the install plan
 *  3. Copies all bundled files via installFiles()
 *  4. Writes .oac/manifest.json
 *  5. Writes .oac/config.json (only if absent)
 *  6. Prints a completion summary
 */
export async function initCommand(options: InitOptions): Promise<void> {
  // Respect CI=true as implicit --yolo
  const effectiveYolo = options.yolo || process.env['CI'] === 'true';
  const effectiveOptions = { ...options, yolo: effectiveYolo };

  if (effectiveOptions.verbose) setVerbose(true);

  const projectRoot = process.cwd();

  // Step 1: validate project root
  await assertProjectRoot(projectRoot);

  // Step 2: locate bundled files
  let packageRoot: string;
  let bundledFiles: string[];
  try {
    packageRoot = getPackageRoot();
    bundledFiles = await listBundledFiles(packageRoot);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    error(`Could not locate bundled files: ${msg}`);
    error('Fix: ensure @nextsystems/oac is installed correctly (try reinstalling).');
    process.exit(1);
    return;
  }

  if (bundledFiles.length === 0) {
    warn('No bundled files found — nothing to install.');
    warn('Fix: the @nextsystems/oac package may be missing its bundled assets.');
    process.exit(1);
  }

  // Step 3: detect IDEs and print plan
  const ides = await detectIdes(projectRoot);
  printPlan(bundledFiles, ides, effectiveOptions.dryRun);

  // Step 4: install files
  const spinner = createSpinner('Installing files…', { dryRun: effectiveOptions.dryRun });
  spinner.start();

  let installResult: Awaited<ReturnType<typeof installFiles>>;
  try {
    installResult = await installFiles(bundledFiles, {
      projectRoot,
      packageRoot,
      dryRun: effectiveOptions.dryRun,
      yolo: effectiveOptions.yolo,
      verbose: effectiveOptions.verbose,
    });
  } catch (err) {
    spinner.fail('Installation failed.');
    const msg = err instanceof Error ? err.message : String(err);
    error(`Installation failed: ${msg}`);
    error('Fix: check file permissions in your project directory.');
    process.exit(1);
    return;
  }
  const { result, updatedManifest } = installResult;

  // Report per-file errors (non-fatal — partial installs are still useful)
  for (const fileError of result.errors) {
    warn(`Error: ${fileError}`);
  }

  spinner.succeed(`Installed ${result.installed.length} file${result.installed.length !== 1 ? 's' : ''}.`);

  // Step 5: write manifest (skip in dry-run)
  if (effectiveOptions.dryRun) {
    info('[dry-run] Would write .oac/manifest.json');
  } else {
    const cliVersion = readCliVersion();
    const finalManifest = { ...updatedManifest, oacVersion: cliVersion };

    await writeManifest(projectRoot, finalManifest).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      error(`Failed to write manifest: ${msg}`);
      error('Fix: check write permissions for the .oac/ directory.');
      process.exit(1) as never;
    });
    verbose('Wrote .oac/manifest.json');
  }

  // Step 6: write config (only if absent)
  await ensureConfig(projectRoot, effectiveOptions.dryRun).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    error(`Failed to write config: ${msg}`);
    error('Fix: check write permissions for the .oac/ directory.');
    process.exit(1) as never;
  });

  // Step 7: print summary
  printSummary(
    result.installed.length,
    result.skipped.length,
    result.errors.length,
    effectiveOptions.dryRun,
  );

  // Exit 0 on success (explicit for clarity)
  process.exit(0);
}

// ── Commander registration ────────────────────────────────────────────────────

/**
 * Registers the `init` subcommand on the given Commander program.
 * Called by the CLI entry point (index.ts).
 */
export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Set up OAC agents and context files in the current project')
    .option('--yolo', 'Skip conflict checks and overwrite user-modified files', false)
    .option('--dry-run', 'Print what would happen without making any changes', false)
    .option('--verbose', 'Show each file being copied', false)
    .action(async (opts: { yolo: boolean; dryRun: boolean; verbose: boolean }) => {
      await initCommand({
        yolo: opts.yolo,
        dryRun: opts.dryRun,
        verbose: opts.verbose,
      });
    });
}
