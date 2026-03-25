import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

// --- Types ---

/** The category of a bundled file, inferred from its path prefix. */
export type BundledFileType = "agent" | "context" | "skill" | "config";

// --- Constants ---

/** Subdirectories under the package root that contain bundled OAC files. */
const BUNDLED_SUBDIRS = [
  ".opencode/agent",
  ".opencode/context",
  ".opencode/skills",
] as const;

// --- Package root resolution ---

/**
 * Walks up the directory tree from `startDir` until it finds a directory
 * that contains both `.opencode/` and `package.json` — the npm package root.
 *
 * Works in both development (monorepo) and when installed via npm.
 * import.meta.dir is Bun's native equivalent of __dirname.
 */
export function getPackageRoot(): string {
  // Allow dev/monorepo override via environment variable.
  // In production (npm install), OAC_PACKAGE_ROOT is not set so the walk runs as before.
  // In dev, set OAC_PACKAGE_ROOT=/path/to/repo to bypass the walk entirely.
  const envOverride = process.env['OAC_PACKAGE_ROOT'];
  if (envOverride) {
    return envOverride;
  }
  // import.meta.dir is Bun's native equivalent of __dirname — points to packages/cli/dist/ at runtime
  return findPackageRoot(import.meta.dir);
}

/**
 * Synchronously walks up from `dir` until finding a directory that has
 * all three anchors:
 *   1. `.opencode/`   — OAC configuration directory
 *   2. `package.json` — npm package manifest
 *   3. No `registry.json` at the same level — `registry.json` is present at
 *      the monorepo root but NOT at the CLI package root, so its absence
 *      distinguishes the CLI package from the repo root in a monorepo layout.
 *
 * Throws if the filesystem root is reached without finding a match.
 *
 * Pure in intent — no side effects beyond filesystem reads.
 */
export function findPackageRoot(dir: string): string {
  let current = dir;

  while (true) {
    const hasOpencode = existsSync(join(current, ".opencode"));
    const hasPackageJson = existsSync(join(current, "package.json"));
    // registry.json exists at the monorepo root but NOT at the CLI package root.
    // Excluding directories that have it prevents the walk from stopping at the
    // repo root instead of the actual CLI package root.
    const hasRegistryJson = existsSync(join(current, "registry.json"));

    if (hasOpencode && hasPackageJson && !hasRegistryJson) {
      return current;
    }

    const parent = join(current, "..");
    // Reached filesystem root — no package root found
    if (parent === current) {
      throw new Error(
        `getPackageRoot: could not find a directory with ".opencode/" and "package.json" ` +
          `(without a "registry.json" at the same level) walking up from "${dir}". ` +
          `Is @nextsystems/oac installed correctly? ` +
          `In dev/monorepo mode, set OAC_PACKAGE_ROOT env var to the repo root.`,
      );
    }
    current = parent;
  }
}

// --- Path helpers ---

/**
 * Returns the absolute path to a bundled file given the package root and a
 * relative path (e.g. `.opencode/agent/core/openagent.md`).
 *
 * Pure function — no I/O.
 */
export const getBundledFilePath = (
  packageRoot: string,
  relativePath: string,
): string => join(packageRoot, relativePath);

// --- File enumeration ---

/**
 * Recursively collects all file paths under `dir`, returning them as
 * absolute paths. Directories are not included in the result.
 */
async function collectFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });

  const nested = await Promise.all(
    entries.map((entry) => {
      const fullPath = join(dir, entry.name);
      return entry.isDirectory() ? collectFiles(fullPath) : Promise.resolve([fullPath]);
    }),
  );

  return nested.flat();
}

/**
 * Lists all files under `.opencode/agent/`, `.opencode/context/`, and
 * `.opencode/skills/` within the given package root.
 *
 * Returns relative paths like `.opencode/agent/core/openagent.md`.
 * Subdirectories that do not exist are silently skipped.
 */
export async function listBundledFiles(packageRoot: string): Promise<string[]> {
  const results = await Promise.all(
    BUNDLED_SUBDIRS.map(async (subdir) => {
      const absSubdir = join(packageRoot, subdir);
      const exists = await stat(absSubdir).then((s) => s.isDirectory()).catch(() => false);
      if (!exists) return [];

      const absFiles = await collectFiles(absSubdir);
      return absFiles.map((absFile) => relative(packageRoot, absFile));
    }),
  );

  return results.flat();
}

// --- Existence check ---

/**
 * Returns true if the bundled file at `relativePath` exists within the
 * given package root.
 */
export const bundledFileExists = async (
  packageRoot: string,
  relativePath: string,
): Promise<boolean> => Bun.file(getBundledFilePath(packageRoot, relativePath)).exists();

// --- Classification ---

/**
 * Infers the BundledFileType from a relative path prefix.
 *
 * - `.opencode/agent/...`   → "agent"
 * - `.opencode/context/...` → "context"
 * - `.opencode/skills/...`  → "skill"
 * - anything else           → "config"
 *
 * Pure function — no I/O.
 */
export const classifyBundledFile = (relativePath: string): BundledFileType => {
  if (relativePath.startsWith(".opencode/agent/")) return "agent";
  if (relativePath.startsWith(".opencode/context/")) return "context";
  if (relativePath.startsWith(".opencode/skills/")) return "skill";
  return "config";
};
