import { rm, access } from 'node:fs/promises'
import { join } from 'node:path'
import { type Command } from 'commander'
import { log, warn, success, dim } from '../ui/logger.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export type CleanOptions = {
  force: boolean
  keepOpencode: boolean
  dryRun: boolean
  ide: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true if the path exists (file or directory). */
async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

// ── Core command ──────────────────────────────────────────────────────────────

/**
 * Implements `oac clean`:
 *  Removes .oac/ and (by default) .opencode/ from the current project directory.
 *  --keep-opencode: removes only .oac/, preserves .opencode/
 *  --dry-run: prints what would be removed without removing anything
 *  --force: skips the destructive-action warning prompt
 *  --ide: also removes IDE-specific files (e.g. CLAUDE.md)
 *
 * Never throws — all errors are caught and reported via warn().
 */
export async function cleanCommand(options: CleanOptions): Promise<void> {
  const projectRoot = process.cwd()

  // Build the list of targets to remove
  const targets: Array<{ path: string; label: string }> = []

  const oacDir = join(projectRoot, '.oac')
  if (await pathExists(oacDir)) {
    targets.push({ path: oacDir, label: '.oac/' })
  }

  if (!options.keepOpencode) {
    const opencodeDir = join(projectRoot, '.opencode')
    if (await pathExists(opencodeDir)) {
      targets.push({ path: opencodeDir, label: '.opencode/' })
    }
  }

  if (options.ide) {
    const claudeMd = join(projectRoot, 'CLAUDE.md')
    if (await pathExists(claudeMd)) {
      targets.push({ path: claudeMd, label: 'CLAUDE.md' })
    }
  }

  // Nothing to do
  if (targets.length === 0) {
    log('Nothing to clean — no OAC directories found.')
    return
  }

  // Dry-run: list what would be removed and exit
  if (options.dryRun) {
    log('')
    log('Dry run — the following would be removed:')
    for (const t of targets) {
      dim(`  ${t.label}`)
    }
    log('')
    log('Run without --dry-run to remove them.')
    return
  }

  // Print destructive warning listing targets
  if (!options.force) {
    warn('')
    warn('This will permanently remove:')
    for (const t of targets) {
      warn(`  ${t.label}`)
    }
    warn('')
    warn('Use --force to confirm, or --dry-run to preview.')
    return
  }

  // Force mode — remove all targets
  for (const t of targets) {
    try {
      await rm(t.path, { recursive: true, force: true })
      success(`Removed ${t.label}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      warn(`Failed to remove ${t.label}: ${msg}`)
    }
  }
}

// ── Commander registration ────────────────────────────────────────────────────

/**
 * Registers the `clean` subcommand on the given Commander program.
 * Called by the CLI entry point (index.ts).
 */
export function registerCleanCommand(program: Command): void {
  program
    .command('clean')
    .description('Remove OAC-managed directories (.oac/ and .opencode/) from the project')
    .option('--force', 'Skip confirmation and remove immediately', false)
    .option('--dry-run', 'Preview what would be removed without removing anything', false)
    .option('--keep-opencode', 'Remove only .oac/ — preserve .opencode/', false)
    .option('--ide', 'Also remove IDE-specific files (e.g. CLAUDE.md)', false)
    .option('--verbose', 'Show additional output', false)
    .action(async (opts: { force: boolean; dryRun: boolean; keepOpencode: boolean; ide: boolean }) => {
      await cleanCommand({
        force: opts.force,
        dryRun: opts.dryRun,
        keepOpencode: opts.keepOpencode,
        ide: opts.ide,
      })
    })
}
