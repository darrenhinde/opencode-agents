#!/usr/bin/env node
/**
 * CLI tool to validate test suite JSON files
 *
 * Usage:
 *   npm run validate:suites
 *   npm run validate:suites -- core/openagent
 *   npm run validate:suites -- --all
 */

import { SuiteValidator } from './suite-validator.js';
import { existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

export interface ValidationStats {
  totalSuites: number;
  validSuites: number;
  invalidSuites: number;
  totalErrors: number;
  totalWarnings: number;
}

/**
 * Recursively discover agent ids under a nested agents directory.
 *
 * An "agent" is any directory that CONTAINS a `config` subdirectory. Agents
 * live at a category-based path such as `core/openagent`, so the returned ids
 * are the relative path from `agentsDir` to each such directory. Discovery:
 *   - recurses through category directories (which have no direct `config`),
 *   - stops descending once a `config` subdir is found (agents don't nest),
 *   - skips hidden dirs and `node_modules`,
 *   - returns a SORTED array for deterministic ordering.
 */
export function discoverAgents(agentsDir: string): string[] {
  const results: string[] = [];

  function walk(dir: string, relPrefix: string): void {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const name = entry.name;
      if (name.startsWith('.') || name === 'node_modules') continue;

      const rel = relPrefix ? `${relPrefix}/${name}` : name;
      const full = join(dir, name);

      if (existsSync(join(full, 'config'))) {
        // This directory is an agent; record it and do not descend further.
        results.push(rel);
      } else {
        walk(full, rel);
      }
    }
  }

  walk(agentsDir, '');
  return results.sort();
}

/**
 * Collect suite JSON files for a single agent.
 *
 * Looks in `<config>/suites/*.json` (new location) and `<config>/*.json`
 * (legacy location, excluding the suite schema). Returns absolute paths.
 */
export function collectSuiteFiles(agentsDir: string, agentId: string): string[] {
  const agentConfigDir = join(agentsDir, agentId, 'config');
  const suiteFiles: string[] = [];

  if (!existsSync(agentConfigDir)) {
    return suiteFiles;
  }

  // New location: suites directory
  const suitesDir = join(agentConfigDir, 'suites');
  if (existsSync(suitesDir)) {
    readdirSync(suitesDir)
      .filter(f => f.endsWith('.json'))
      .forEach(f => suiteFiles.push(join(suitesDir, f)));
  }

  // Legacy location: JSON files directly in config directory
  readdirSync(agentConfigDir)
    .filter(f => f.endsWith('.json') && f !== 'suite-schema.json')
    .forEach(f => {
      const filePath = join(agentConfigDir, f);
      if (!suiteFiles.includes(filePath)) {
        suiteFiles.push(filePath);
      }
    });

  return suiteFiles;
}

/**
 * Fail-closed exit-code rule.
 *
 * Returns nonzero when NO suites were discovered (`totalSuites === 0`) OR when
 * any discovered suite is invalid (`invalidSuites > 0`). Returns 0 only when at
 * least one suite was discovered and every one of them validated.
 */
export function computeExitCode(stats: Pick<ValidationStats, 'totalSuites' | 'invalidSuites'>): number {
  if (stats.totalSuites === 0) return 1;
  if (stats.invalidSuites > 0) return 1;
  return 0;
}

function validateSuite(agent: string, suitePath: string, agentsDir: string): boolean {
  const suiteName = suitePath.split('/').pop()?.replace('.json', '') || 'unknown';

  console.log(`${colors.blue}Validating:${colors.reset} ${agent}/${suiteName}`);

  const validator = new SuiteValidator(agentsDir);
  const result = validator.validateSuiteFile(agent, suitePath);

  if (result.valid) {
    const testCount = result.suite?.tests.length || 0;
    console.log(`  ${colors.green}✅ Valid${colors.reset} (${testCount} tests)`);

    if (result.warnings.length > 0) {
      result.warnings.forEach(warn => {
        console.log(`  ${colors.yellow}⚠️  ${warn}${colors.reset}`);
      });
    }
  } else {
    console.log(`  ${colors.red}❌ Invalid${colors.reset} (${result.errors.length} errors, ${result.warnings.length} warnings)`);

    result.errors.forEach(err => {
      console.log(`     ${colors.red}Error:${colors.reset} ${err.field}: ${err.message}`);
      if (err.value) {
        console.log(`       Value: ${err.value}`);
      }
    });

    if (result.missingTests.length > 0) {
      console.log(`  ${colors.red}Missing test files (${result.missingTests.length}):${colors.reset}`);
      result.missingTests.forEach(path => {
        console.log(`     - ${path}`);
      });
    }
  }

  console.log();

  return result.valid;
}

function main() {
  const args = process.argv.slice(2);
  const validateAll = args.includes('--all');
  const agent = validateAll ? null : (args[0] || 'openagent');

  console.log(`${colors.blue}🔍 Validating Test Suites${colors.reset}\n`);

  const projectRoot = join(__dirname, '../../../..');
  const agentsDir = join(projectRoot, 'evals', 'agents');

  const stats: ValidationStats = {
    totalSuites: 0,
    validSuites: 0,
    invalidSuites: 0,
    totalErrors: 0,
    totalWarnings: 0
  };

  const agentsToValidate = validateAll
    ? discoverAgents(agentsDir)
    : [agent!];

  if (validateAll && agentsToValidate.length === 0) {
    console.log(`${colors.yellow}⚠️  No agents with a config directory found under: ${agentsDir}${colors.reset}\n`);
  }

  for (const agentName of agentsToValidate) {
    const agentConfigDir = join(agentsDir, agentName, 'config');

    if (!existsSync(agentConfigDir)) {
      console.log(`${colors.yellow}⚠️  No config directory for agent: ${agentName}${colors.reset}\n`);
      continue;
    }

    const suiteFiles = collectSuiteFiles(agentsDir, agentName);

    if (suiteFiles.length === 0) {
      console.log(`${colors.yellow}⚠️  No test suites found for agent: ${agentName}${colors.reset}\n`);
      continue;
    }

    // Validate each suite
    for (const suiteFile of suiteFiles) {
      stats.totalSuites++;
      const isValid = validateSuite(agentName, suiteFile, agentsDir);

      if (isValid) {
        stats.validSuites++;
      } else {
        stats.invalidSuites++;
      }
    }
  }

  // Print summary
  console.log(`${colors.blue}${'='.repeat(55)}${colors.reset}`);
  console.log(`${colors.blue}Summary${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(55)}${colors.reset}`);
  console.log(`Total suites:    ${stats.totalSuites}`);
  console.log(`${colors.green}Valid suites:    ${stats.validSuites}${colors.reset}`);

  if (stats.invalidSuites > 0) {
    console.log(`${colors.red}Invalid suites:  ${stats.invalidSuites}${colors.reset}`);
  }

  console.log();

  const exitCode = computeExitCode(stats);

  if (exitCode !== 0) {
    if (stats.totalSuites === 0) {
      console.log(`${colors.red}❌ Validation failed: no test suites were discovered${colors.reset}`);
    } else {
      console.log(`${colors.red}❌ Validation failed${colors.reset}`);
    }
    process.exit(exitCode);
  } else {
    console.log(`${colors.green}✅ All suites valid${colors.reset}`);
    process.exit(exitCode);
  }
}

// ESM entrypoint guard: only run the CLI when this module is executed directly
// (e.g. via `tsx src/sdk/validate-suites-cli.ts`). Importing it in tests must
// NOT trigger main()/process.exit().
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
