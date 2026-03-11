import { join } from 'node:path'
import { homedir } from 'node:os'
import { mkdir } from 'node:fs/promises'
import semver from 'semver'
import { readCliVersion } from './version.js'

const CACHE_DIR = join(homedir(), '.config', 'oac')
const CACHE_FILE = join(CACHE_DIR, 'update-check.json')
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 hours
const PACKAGE_NAME = '@nextsystems/oac'

type UpdateCache = {
  checkedAt: string        // ISO timestamp
  latestVersion: string | null
}

/** Reads the cached update check result. Returns null if cache is missing or stale. */
async function readCache(): Promise<UpdateCache | null> {
  try {
    const raw = (await Bun.file(CACHE_FILE).json()) as UpdateCache
    const age = Date.now() - new Date(raw.checkedAt).getTime()
    if (age > CHECK_INTERVAL_MS) return null // stale
    return raw
  } catch {
    return null
  }
}

/** Writes the update check result to the cache file. Failure is non-fatal. */
async function writeCache(latestVersion: string | null): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true })
    const cache: UpdateCache = {
      checkedAt: new Date().toISOString(),
      latestVersion,
    }
    await Bun.write(CACHE_FILE, JSON.stringify(cache, null, 2))
  } catch {
    // Cache write failure is non-fatal — silently ignore
  }
}

/**
 * Fetches the latest version of a package from the npm registry.
 * Returns null on any error (network unavailable, timeout, 404, parse error).
 * Uses a 3-second timeout so it never blocks the CLI.
 *
 * Exported as a named export so doctor.ts can import it instead of duplicating it.
 */
export async function fetchLatestNpmVersion(packageName: string): Promise<string | null> {
  try {
    const url = `https://registry.npmjs.org/${packageName}/latest`
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return null
    const data = (await res.json()) as { version?: string }
    return data.version ?? null
  } catch {
    // Network unavailable, timeout, or parse error — always return null, never throw
    return null
  }
}

/**
 * Pure function: returns true if latestVersion is semver-greater than currentVersion.
 * Returns false if latestVersion is null (offline / fetch failed).
 *
 * Exported for testability — deterministic, no side effects.
 */
export function shouldShowUpdateNotice(
  currentVersion: string,
  latestVersion: string | null,
): boolean {
  if (latestVersion === null) return false
  // semver.lt returns false for invalid versions — safe to call without validation
  return semver.lt(currentVersion, latestVersion)
}

/**
 * Non-blocking update check. Runs after the main command completes.
 * Checks at most once per 24 hours (cached in ~/.config/oac/update-check.json).
 * Prints a simple notice to stderr if an update is available.
 *
 * Intentionally skipped on --version fast path (index.ts returns before reaching this).
 * Never throws — all errors are swallowed to protect the CLI exit code.
 */
export async function checkForUpdate(): Promise<void> {
  try {
    // Try cache first to avoid hitting the registry on every command
    const cached = await readCache()
    let latestVersion: string | null

    if (cached !== null) {
      latestVersion = cached.latestVersion
    } else {
      // Cache miss or stale — fetch from registry and persist result
      latestVersion = await fetchLatestNpmVersion(PACKAGE_NAME)
      await writeCache(latestVersion)
    }

    const current = readCliVersion()
    if (!shouldShowUpdateNotice(current, latestVersion)) return

    // Print notice to stderr — does not pollute piped stdout
    // latestVersion is guaranteed non-null here: shouldShowUpdateNotice returns false when null
    if (latestVersion === null) return
    process.stderr.write(`\n  Update available: ${current} → ${latestVersion}\n`)
    process.stderr.write(`  Run: npm install -g @nextsystems/oac\n\n`)
  } catch {
    // Update check failure is always non-fatal — never affect exit code
  }
}
