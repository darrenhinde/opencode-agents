# Test Gates for oac-package-standards Fix Batch

Each test below acts as a gate: it **FAILS before the fix**, **PASSES after**.

Run after each subtask to confirm the fix worked and no regressions were introduced:

```bash
cd packages/cli && ~/.bun/bin/bun test 2>&1
```

---

## Currently Failing Tests (will pass after fixes)

| Test Description | File | Fails Until Subtask | Why It Fails Now |
|---|---|---|---|
| `has publishConfig.access set to "public"` (root) | `package-json.test.ts` | subtask-01 | `publishConfig` field missing from root `package.json` |
| `has publishConfig.access set to "public"` (cli) | `package-json.test.ts` | subtask-01 | `publishConfig` field missing from `packages/cli/package.json` |
| `has prepublishOnly script` (root) | `package-json.test.ts` | subtask-02 | No `prepublishOnly` script in root `package.json` |
| `has prepublishOnly script` (cli) | `package-json.test.ts` | subtask-02 | No `prepublishOnly` script in `packages/cli/package.json` |
| `has repository.directory field` (root) | `package-json.test.ts` | subtask-03 | No `repository.directory` in root `package.json` |
| `has repository.directory set to "packages/cli"` | `package-json.test.ts` | subtask-03 | No `repository.directory` in `packages/cli/package.json` |
| `does NOT have a bin field` (cli) | `package-json.test.ts` | subtask-04 | `packages/cli/package.json` has `bin: { oac: "./dist/index.js" }` |
| `is marked private: true` (cli) | `package-json.test.ts` | subtask-04 | `packages/cli/package.json` is not marked `private` |
| `engines field has bun requirement` (root) | `package-json.test.ts` | subtask-05 | Root `engines` only has `node: ">=18.0.0"`, no `bun` field |
| `version matches packages/cli version` (root) | `package-json.test.ts` | subtask-06 | Root is `0.7.1`, cli is `1.0.0` |
| `version matches root package.json version` (cli) | `package-json.test.ts` | subtask-06 | Same mismatch |
| `root and cli versions are identical` | `package-json.test.ts` | subtask-06 | Same mismatch |
| `warn() writes to stderr (console.error), NOT stdout` | `logger.test.ts` | subtask-07 | `warn()` uses `console.log` (stdout) |
| `warn() message is captured by stderr spy` | `logger.test.ts` | subtask-07 | `warn()` uses `console.log`, not `console.error` |
| `warn() message is NOT captured by stdout spy` | `logger.test.ts` | subtask-07 | `warn()` uses `console.log` which IS captured by stdout spy |
| `finds package root even when registry.json is present` | `bundled.test.ts` | subtask-09 | `!hasRegistryJson` guard skips dirs with `registry.json` |
| `writeManifest creates .oac/ directory if it does not exist` | `manifest.test.ts` | subtask-10 | Regression guard: validates explicit mkdir behavior added by subtask-10 |
| `writeManifest is idempotent — calling twice does not throw` | `manifest.test.ts` | subtask-10 | Regression guard: validates idempotent mkdir behavior |
| `module exports fetchLatestNpmVersion function` | `update-check.test.ts` | subtask-12 | `update-check.ts` does not exist yet |
| `module exports checkForUpdate function` | `update-check.test.ts` | subtask-12 | `update-check.ts` does not exist yet |
| `module exports shouldShowUpdateNotice function` | `update-check.test.ts` | subtask-12 | `update-check.ts` does not exist yet |
| `shouldShowUpdateNotice returns true when latest is newer (patch)` | `update-check.test.ts` | subtask-12 | Module doesn't exist |
| `shouldShowUpdateNotice returns true when latest is newer (minor)` | `update-check.test.ts` | subtask-12 | Module doesn't exist |
| `shouldShowUpdateNotice returns true when latest is newer (major)` | `update-check.test.ts` | subtask-12 | Module doesn't exist |
| `shouldShowUpdateNotice returns false when versions match` | `update-check.test.ts` | subtask-12 | Module doesn't exist |
| `shouldShowUpdateNotice returns false when current is newer` | `update-check.test.ts` | subtask-12 | Module doesn't exist |
| `shouldShowUpdateNotice returns false when latest is null` | `update-check.test.ts` | subtask-12 | Module doesn't exist |
| `fetchLatestNpmVersion returns semver string or null` | `update-check.test.ts` | subtask-12 | Module doesn't exist |
| `fetchLatestNpmVersion returns null for non-existent package` | `update-check.test.ts` | subtask-12 | Module doesn't exist |
| `fetchLatestNpmVersion returns null (does not throw) on failure` | `update-check.test.ts` | subtask-12 | Module doesn't exist |
| `checkForUpdate() resolves without throwing` | `update-check.test.ts` | subtask-12 | Module doesn't exist |
| `checkForUpdate() returns undefined (void)` | `update-check.test.ts` | subtask-12 | Module doesn't exist |
| `module exports cleanCommand function` | `clean.test.ts` | subtask-13 | `clean.ts` does not exist yet |
| `module exports registerCleanCommand function` | `clean.test.ts` | subtask-13 | `clean.ts` does not exist yet |
| `cleanCommand --force removes .oac/ directory` | `clean.test.ts` | subtask-13 | Module doesn't exist |
| `cleanCommand --force removes .opencode/ directory by default` | `clean.test.ts` | subtask-13 | Module doesn't exist |
| `cleanCommand --force removes both .oac/ and .opencode/` | `clean.test.ts` | subtask-13 | Module doesn't exist |
| `cleanCommand --keep-opencode --force removes .oac/ but preserves .opencode/` | `clean.test.ts` | subtask-13 | Module doesn't exist |
| `cleanCommand --dry-run does not remove any directories` | `clean.test.ts` | subtask-13 | Module doesn't exist |
| `cleanCommand does not throw when nothing to clean` | `clean.test.ts` | subtask-13 | Module doesn't exist |
| `cleanCommand --ide --force removes CLAUDE.md when present` | `clean.test.ts` | subtask-13 | Module doesn't exist |
| `cleanCommand without --ide preserves CLAUDE.md` | `clean.test.ts` | subtask-13 | Module doesn't exist |
| `registerCleanCommand registers a "clean" command` | `clean.test.ts` | subtask-13 | Module doesn't exist |
| `clean command has --force option` | `clean.test.ts` | subtask-13 | Module doesn't exist |
| `clean command has --dry-run option` | `clean.test.ts` | subtask-13 | Module doesn't exist |
| `clean command has --keep-opencode option` | `clean.test.ts` | subtask-13 | Module doesn't exist |

---

## Currently Passing Tests (must stay passing — regression guards)

| Test Description | File | Guards Against |
|---|---|---|
| `returns OAC_PACKAGE_ROOT env var value without walking` | `bundled.test.ts` | Regression in subtask-09 breaking env var override |
| `OAC_PACKAGE_ROOT bypasses walk even for path with no .opencode/` | `bundled.test.ts` | Regression in subtask-09 breaking production scenario |
| `falls through to walk when OAC_PACKAGE_ROOT is empty string` | `bundled.test.ts` | Regression in subtask-09 changing falsy-check behaviour |
| `returns the nearest ancestor with .opencode/ and package.json` | `bundled.test.ts` | Regression in subtask-09 breaking basic walk |
| `returns the directory that has both .opencode/ and package.json` | `bundled.test.ts` | Core walk functionality |
| `returns the start directory itself when it is the package root` | `bundled.test.ts` | Walk starting at root |
| `throws an error when no package root is found` | `bundled.test.ts` | Error path still works |
| `error message includes the starting directory` | `bundled.test.ts` | Error message format |
| `writeManifest then readManifest round-trips correctly` | `manifest.test.ts` | Regression in subtask-10 breaking existing write path |
| `writeManifest does not throw when .oac/ already exists` | `manifest.test.ts` | Regression in subtask-10 breaking idempotent writes |
| `error() writes to stderr (console.error)` | `logger.test.ts` | Regression in subtask-07 breaking error() |
| `error() does NOT write to stdout` | `logger.test.ts` | Regression in subtask-07 |
| `success() writes to stdout (console.log)` | `logger.test.ts` | Regression in subtask-07 |
| `success() does NOT write to stderr` | `logger.test.ts` | Regression in subtask-07 |
| `log() writes to stdout` | `logger.test.ts` | Regression in subtask-07 |
| `info() writes to stdout` | `logger.test.ts` | Regression in subtask-07 |
| `dim() writes to stdout` | `logger.test.ts` | Regression in subtask-07 |
| `bold() writes to stdout` | `logger.test.ts` | Regression in subtask-07 |
| `verbose() writes to stdout when verbose is enabled` | `logger.test.ts` | Regression in subtask-07 |
| `verbose() does NOT write when verbose is disabled` | `logger.test.ts` | Regression in subtask-07 |
| `has bin.oac pointing to ./bin/oac.js` (root) | `package-json.test.ts` | Regression removing the bin entry point |
| `name is "@nextsystems/oac"` (root) | `package-json.test.ts` | Package name change |
| `has a license field` (root) | `package-json.test.ts` | License removal |
| `has a repository field with type "git"` (root) | `package-json.test.ts` | Repository field removal |
| `files array includes "bin/"` (root) | `package-json.test.ts` | Removing bin/ from published files |
| `engines.bun is set` (cli) | `package-json.test.ts` | Removing bun engine requirement from cli |
| `name is "@nextsystems/oac-cli"` (cli) | `package-json.test.ts` | Package name change |
| `has a build script` (cli) | `package-json.test.ts` | Build script removal |
| `has a test script` (cli) | `package-json.test.ts` | Test script removal |
| `has commander as a dependency` (cli) | `package-json.test.ts` | Dependency removal |
| `has chalk as a dependency` (cli) | `package-json.test.ts` | Dependency removal |
| `has zod as a dependency` (cli) | `package-json.test.ts` | Dependency removal |
| All 142 pre-existing tests | `*.test.ts` | Any regression from any subtask |

---

## How to Use These Gates

### Run all tests after each subtask:

```bash
cd packages/cli && ~/.bun/bin/bun test 2>&1
```

### Run only the new gate tests (faster feedback loop):

```bash
cd packages/cli && ~/.bun/bin/bun test --testNamePattern "subtask-" 2>&1
```

### Run a specific test file:

```bash
cd packages/cli && ~/.bun/bin/bun test src/lib/manifest.test.ts 2>&1
cd packages/cli && ~/.bun/bin/bun test src/ui/logger.test.ts 2>&1
cd packages/cli && ~/.bun/bin/bun test src/lib/package-json.test.ts 2>&1
cd packages/cli && ~/.bun/bin/bun test src/lib/update-check.test.ts 2>&1
cd packages/cli && ~/.bun/bin/bun test src/commands/clean.test.ts 2>&1
```

---

## Expected Progression

| After Subtask | Expected Pass Count | Expected Fail Count | Notes |
|---|---|---|---|
| Before any fixes | ~142 | ~46 | All new gate tests fail |
| After subtask-01 | ~144 | ~44 | publishConfig tests pass |
| After subtask-02 | ~146 | ~42 | prepublishOnly tests pass |
| After subtask-03 | ~148 | ~40 | repository.directory tests pass |
| After subtask-04 | ~150 | ~38 | bin removal + private tests pass |
| After subtask-05 | ~151 | ~37 | engines.bun test passes |
| After subtask-06 | ~154 | ~34 | 3 version-sync tests pass |
| After subtask-07 | ~157 | ~31 | 3 warn() stderr tests pass |
| After subtask-09 | ~158 | ~30 | registry.json guard test passes |
| After subtask-10 | ~161 | ~27 | writeManifest mkdir tests confirmed (regression guards) |
| After subtask-12 | ~174 | ~14 | 13 update-check tests pass |
| After subtask-13 | ~188 | 0 | All 14 clean tests pass |

> Note: Subtask-11 (signal handlers) adds no new tests — it's validated by manual
> terminal testing (Ctrl-C restores cursor). The signal handler tests would require
> spawning a subprocess, which is out of scope for this unit test suite.

---

## Test File Locations

| File | Type | Tests Added |
|---|---|---|
| `packages/cli/src/lib/bundled.test.ts` | Modified (added) | 5 new tests |
| `packages/cli/src/lib/manifest.test.ts` | Modified (added) | 4 new tests |
| `packages/cli/src/ui/logger.test.ts` | New file | 13 tests |
| `packages/cli/src/lib/update-check.test.ts` | New file | 13 tests |
| `packages/cli/src/commands/clean.test.ts` | New file | 14 tests |
| `packages/cli/src/lib/package-json.test.ts` | New file | 22 tests |

**Total new tests: 71** (46 failing gates + 25 passing regression guards)
