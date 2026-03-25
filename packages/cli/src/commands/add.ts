import path from 'node:path';
// node:fs/promises rm is used intentionally — Bun has no built-in recursive directory removal
import { rm } from 'node:fs/promises';
import { type Command } from 'commander';
import { loadRegistry, resolveComponent, listComponents } from '../lib/registry.js';
import { getPackageRoot, getBundledFilePath } from '../lib/bundled.js';
import { installFile } from '../lib/installer.js';
import {
  readManifest,
  writeManifest,
  addFileToManifest,
  removeFileFromManifest,
  createEmptyManifest,
  type ManifestFile,
  type FileEntry,
} from '../lib/manifest.js';
import { log, info, warn, error, success, verbose } from '../ui/logger.js';
import { createSpinner } from '../ui/spinner.js';
import { computeFileHash } from '../lib/sha256.js';
import { readCliVersion } from '../lib/version.js';
import type { RegistryComponent } from '../lib/registry.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AddOptions = {
  yolo: boolean;
  dryRun: boolean;
  verbose: boolean;
  force: boolean;
};

export type RemoveOptions = {
  yolo: boolean;
  dryRun: boolean;
  verbose: boolean;
};

// ── Pure helpers ──────────────────────────────────────────────────────────────

/** Returns the destination path (relative to project root) for a component.
 *  Uses component.path directly if it already starts with .opencode/,
 *  otherwise prefixes with the correct subdirectory. */
const getDestRelativePath = (component: RegistryComponent): string => {
  if (component.path.startsWith('.opencode/')) return component.path;
  const base = component.type === 'skill' ? '.opencode/skills' :
               component.type === 'agent' ? '.opencode/agent' :
               '.opencode/context';
  return path.join(base, component.path);
};

/** Builds a FileEntry for a newly installed component. */
const buildFileEntry = (
  sha256: string,
  component: RegistryComponent,
): FileEntry => ({
  sha256,
  type: component.type,
  source: 'registry',
  installedAt: new Date().toISOString(),
});

/** Returns true if the file at destPath is already tracked in the manifest. */
const isAlreadyInstalled = (
  manifest: ManifestFile | null,
  destRelativePath: string,
): boolean => manifest?.files[destRelativePath] !== undefined;

// ── List display ──────────────────────────────────────────────────────────────

/** Prints all available components grouped by type. */
const printAvailableComponents = async (_projectRoot: string): Promise<void> => {
  const packageRoot = getPackageRoot();
  const registry = await loadRegistry(packageRoot);
  const all = listComponents(registry);

  const byType = {
    agent: all.filter((c) => c.type === 'agent'),
    context: all.filter((c) => c.type === 'context'),
    skill: all.filter((c) => c.type === 'skill'),
  };

  log('');
  log('Available components:');
  log('');

  for (const [type, components] of Object.entries(byType)) {
    if (components.length === 0) continue;
    log(`  ${type.toUpperCase()}S`);
    for (const c of components) {
      log(`    oac add ${type}:${c.id}  — ${c.description}`);
    }
    log('');
  }

  log(`Run 'oac add <type>:<name>' to install a component.`);
  log(`Example: oac add context:react-patterns`);
};

// ── Core install logic ────────────────────────────────────────────────────────

/** Resolves the component from the registry or exits with a clear error. */
const resolveOrFail = async (
  ref: string,
): Promise<{ component: RegistryComponent; packageRoot: string }> => {
  const packageRoot = getPackageRoot();
  const registry = await loadRegistry(packageRoot);
  const component = resolveComponent(registry, ref);

  if (component === null) {
    error(`Component '${ref}' not found. Run 'oac add' to see available components.`);
    process.exit(1);
  }

  return { component, packageRoot };
};

/** Checks if the component is already installed and handles --force / warning. */
const checkAlreadyInstalled = (
  manifest: ManifestFile | null,
  destRelativePath: string,
  force: boolean,
): boolean => {
  if (!isAlreadyInstalled(manifest, destRelativePath)) return false;

  if (!force) {
    warn(`Already installed. Use --force to reinstall.`);
    return true; // signal: abort
  }

  info('Reinstalling (--force).');
  return false; // signal: proceed
};

/** Performs the actual file copy and manifest update. */
const performInstall = async (
  component: RegistryComponent,
  packageRoot: string,
  projectRoot: string,
  destRelativePath: string,
  manifest: ManifestFile,
  opts: AddOptions,
): Promise<void> => {
  const sourcePath = getBundledFilePath(packageRoot, component.path);
  const destPath = path.join(projectRoot, destRelativePath);
  const destDir = path.dirname(destRelativePath);

  info(`Installing ${component.type}:${component.id} → ${destDir}/`);

  if (opts.verbose) {
    verbose(`Source: ${sourcePath}`);
    verbose(`Destination: ${destPath}`);
  }

  const installOpts = {
    projectRoot,
    packageRoot,
    dryRun: opts.dryRun,
    yolo: opts.yolo,
    verbose: opts.verbose,
  };

  await installFile(sourcePath, destPath, installOpts);

  if (opts.dryRun) {
    info(`[dry-run] Would install ${component.type}:${component.id} to ${destDir}/`);
    return;
  }

  const sha256 = await computeFileHash(destPath);
  const entry = buildFileEntry(sha256, component);
  const updatedManifest = addFileToManifest(manifest, destRelativePath, entry);
  await writeManifest(projectRoot, updatedManifest);

  success(`Added ${component.id} to ${destDir}/`);
};

// ── Public command functions ──────────────────────────────────────────────────

/**
 * Implements `oac add [ref]`.
 * With no ref: lists available components grouped by type.
 * With ref (e.g. `context:react-patterns`): installs the component.
 */
export async function addCommand(
  ref: string | undefined,
  options: AddOptions,
): Promise<void> {
  const projectRoot = process.cwd();

  if (ref === undefined) {
    await printAvailableComponents(projectRoot);
    return;
  }

  const spinner = createSpinner(`Resolving ${ref}…`, { dryRun: options.dryRun });
  spinner.start();

  try {
    const { component, packageRoot } = await resolveOrFail(ref);
    spinner.stop();

    const manifest = (await readManifest(projectRoot)) ?? createEmptyManifest(readCliVersion());
    const destRelativePath = getDestRelativePath(component);

    const shouldAbort = checkAlreadyInstalled(manifest, destRelativePath, options.force);
    if (shouldAbort) return;

    await performInstall(component, packageRoot, projectRoot, destRelativePath, manifest, options);
  } catch (err: unknown) {
    spinner.fail();
    const msg = err instanceof Error ? err.message : String(err);
    error(`Failed to add '${ref}': ${msg}`);
    process.exit(1);
  }
}

/**
 * Implements `oac remove [ref]`.
 * Removes the component file from disk and updates the manifest.
 */
export async function removeCommand(
  ref: string | undefined,
  options: RemoveOptions,
): Promise<void> {
  const projectRoot = process.cwd();

  if (ref === undefined) {
    error('Please specify a component to remove. Example: oac remove context:react-patterns');
    process.exit(1);
  }

  const spinner = createSpinner(`Resolving ${ref}…`, { dryRun: options.dryRun });
  spinner.start();

  try {
    const { component } = await resolveOrFail(ref);
    spinner.stop();

    const manifest = await readManifest(projectRoot);
    const destRelativePath = getDestRelativePath(component);

    if (!isAlreadyInstalled(manifest, destRelativePath)) {
      warn(`'${ref}' is not installed — nothing to remove.`);
      return;
    }

    const destPath = path.join(projectRoot, destRelativePath);

    if (options.verbose) {
      verbose(`Removing: ${destPath}`);
    }

    info(`Removing ${component.type}:${component.id} from ${path.dirname(destRelativePath)}/`);

    if (!options.dryRun) {
      await rm(destPath, { recursive: true, force: true });
      const updatedManifest = removeFileFromManifest(manifest!, destRelativePath);
      await writeManifest(projectRoot, updatedManifest);
      success(`Removed ${component.id}`);
    } else {
      info(`[dry-run] Would remove ${destPath}`);
    }
  } catch (err: unknown) {
    spinner.fail();
    const msg = err instanceof Error ? err.message : String(err);
    error(`Failed to remove '${ref}': ${msg}`);
    process.exit(1);
  }
}

// ── Commander registration ────────────────────────────────────────────────────

/**
 * Registers the `add` and `remove` subcommands on the given Commander program.
 */
export function registerAddCommand(program: Command): void {
  program
    .command('add [ref]')
    .description('Add a component (agent, context, or skill). Example: oac add context:react-patterns')
    .option('--force', 'Reinstall even if already installed', false)
    .option('--dry-run', 'Show what would happen without making changes', false)
    .option('--yolo', 'Skip safety checks and overwrite user-modified files', false)
    .option('--verbose', 'Show source and destination paths', false)
    .action(async (ref: string | undefined, opts: { force?: boolean; dryRun?: boolean; yolo?: boolean; verbose?: boolean }) => {
      await addCommand(ref, {
        force: opts.force ?? false,
        dryRun: opts.dryRun ?? false,
        yolo: opts.yolo ?? false,
        verbose: opts.verbose ?? false,
      });
    });

  program
    .command('remove [ref]')
    .description('Remove an installed component. Example: oac remove context:react-patterns')
    .option('--dry-run', 'Show what would happen without making changes', false)
    .option('--yolo', 'Skip safety checks', false)
    .option('--verbose', 'Show file paths', false)
    .action(async (ref: string | undefined, opts: { dryRun?: boolean; yolo?: boolean; verbose?: boolean }) => {
      await removeCommand(ref, {
        dryRun: opts.dryRun ?? false,
        yolo: opts.yolo ?? false,
        verbose: opts.verbose ?? false,
      });
    });
}
