import chalk from 'chalk';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Logger {
  log: (msg: string) => void;
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
  success: (msg: string) => void;
  dim: (msg: string) => void;
  bold: (msg: string) => void;
  verbose: (msg: string) => void;
}

// ── Verbose state (module-local, mutated only via setVerbose) ────────────────

let verboseEnabled = false;

export const setVerbose = (enabled: boolean): void => {
  verboseEnabled = enabled;
};

// ── Output functions (pure aside from console.log side effect) ───────────────

export const log     = (msg: string): void => console.log(msg);
export const info    = (msg: string): void => console.log(chalk.blue(`  ℹ ${msg}`));
export const warn    = (msg: string): void => console.log(chalk.yellow(`  ⚠ ${msg}`));
export const error   = (msg: string): void => console.error(chalk.red(`  ✗ ${msg}`));
export const success = (msg: string): void => console.log(chalk.green(`  ✓ ${msg}`));
export const dim     = (msg: string): void => console.log(chalk.gray(msg));
export const bold    = (msg: string): void => console.log(chalk.bold(msg));
export const verbose = (msg: string): void => { if (verboseEnabled) console.log(chalk.gray(`  … ${msg}`)); };

// ── Logger object (aggregates all methods) ───────────────────────────────────
// Named `logger` (lowercase) to avoid collision with the `Logger` interface in
// the same namespace. Import as: import { logger } from './logger.js'

export const logger: Logger = { log, info, warn, error, success, dim, bold, verbose };
