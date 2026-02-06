/**
 * CLI Utility Functions
 *
 * Pure utility functions for consistent CLI output and formatting.
 * Follows functional patterns with no side effects in core functions.
 *
 * @module cli/utils
 */

import chalk from "chalk";
import ora, { type Ora } from "ora";
import type { GlobalOptions, OutputFormat, CommandResult, Platform } from "./types.js";
import { PLATFORM_NAMES } from "./types.js";

// ============================================================================
// LOGGING
// ============================================================================

/**
 * Logger configuration based on global options
 */
export interface LoggerConfig {
  readonly verbose: boolean;
  readonly quiet: boolean;
  readonly outputFormat: OutputFormat;
}

/**
 * Create logger config from global options
 */
export const createLoggerConfig = (options: GlobalOptions): LoggerConfig => ({
  verbose: options.verbose ?? false,
  quiet: options.quiet ?? false,
  outputFormat: options.outputFormat ?? "text",
});

/**
 * Log an info message (respects quiet mode)
 */
export const logInfo = (config: LoggerConfig, message: string): void => {
  if (config.quiet) return;
  if (config.outputFormat === "json") return;
  console.log(message);
};

/**
 * Log a success message (respects quiet mode)
 */
export const logSuccess = (config: LoggerConfig, message: string): void => {
  if (config.quiet) return;
  if (config.outputFormat === "json") return;
  console.log(chalk.green("✓"), message);
};

/**
 * Log a warning message (respects quiet mode)
 */
export const logWarning = (config: LoggerConfig, message: string): void => {
  if (config.quiet) return;
  if (config.outputFormat === "json") return;
  console.log(chalk.yellow("⚠"), message);
};

/**
 * Log an error message (always shown)
 */
export const logError = (config: LoggerConfig, message: string): void => {
  if (config.outputFormat === "json") return;
  console.error(chalk.red("✗"), message);
};

/**
 * Log a verbose message (only in verbose mode)
 */
export const logVerbose = (config: LoggerConfig, message: string): void => {
  if (!config.verbose || config.quiet) return;
  if (config.outputFormat === "json") return;
  console.log(chalk.dim("›"), chalk.dim(message));
};

// ============================================================================
// SPINNER
// ============================================================================

/**
 * Create a spinner for async operations
 */
export const createSpinner = (
  config: LoggerConfig,
  text: string
): Ora | null => {
  if (config.quiet || config.outputFormat === "json") {
    return null;
  }
  return ora({ text, color: "cyan" }).start();
};

/**
 * Stop spinner with success
 */
export const spinnerSuccess = (spinner: Ora | null, text: string): void => {
  if (spinner) {
    spinner.succeed(text);
  }
};

/**
 * Stop spinner with failure
 */
export const spinnerFail = (spinner: Ora | null, text: string): void => {
  if (spinner) {
    spinner.fail(text);
  }
};

/**
 * Stop spinner with warning
 */
export const spinnerWarn = (spinner: Ora | null, text: string): void => {
  if (spinner) {
    spinner.warn(text);
  }
};

// ============================================================================
// OUTPUT FORMATTING
// ============================================================================

/**
 * Format output based on output format setting
 */
export const formatOutput = <T>(
  config: LoggerConfig,
  result: CommandResult<T>
): string => {
  if (config.outputFormat === "json") {
    return JSON.stringify(result, null, 2);
  }
  return formatTextOutput(result);
};

/**
 * Format result as human-readable text
 */
const formatTextOutput = <T>(result: CommandResult<T>): string => {
  const lines: string[] = [];

  if (result.success) {
    if (result.data !== undefined) {
      lines.push(formatData(result.data));
    }
  } else {
    lines.push(chalk.red(`Error: ${result.error}`));
  }

  if (result.warnings?.length) {
    lines.push("");
    lines.push(chalk.yellow("Warnings:"));
    result.warnings.forEach((w) => lines.push(chalk.yellow(`  • ${w}`)));
  }

  return lines.join("\n");
};

/**
 * Format data for text output
 */
const formatData = (data: unknown): string => {
  if (typeof data === "string") return data;
  if (typeof data === "object" && data !== null) {
    return JSON.stringify(data, null, 2);
  }
  return String(data);
};

/**
 * Print formatted output to console
 */
export const printOutput = <T>(
  config: LoggerConfig,
  result: CommandResult<T>
): void => {
  const output = formatOutput(config, result);
  if (output) {
    console.log(output);
  }
};

// ============================================================================
// PLATFORM HELPERS
// ============================================================================

/**
 * Get display name for a platform
 */
export const getPlatformDisplayName = (platform: Platform): string =>
  PLATFORM_NAMES[platform] ?? platform;

/**
 * Format platform list for display
 */
export const formatPlatformList = (platforms: readonly Platform[]): string =>
  platforms.map((p) => `${p} (${getPlatformDisplayName(p)})`).join(", ");

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate that a file path exists and is readable
 */
export const validateFilePath = async (
  filePath: string
): Promise<CommandResult<string>> => {
  const fs = await import("fs/promises");

  try {
    await fs.access(filePath);
    return { success: true, data: filePath };
  } catch {
    return {
      success: false,
      error: `File not found or not readable: ${filePath}`,
    };
  }
};

/**
 * Validate output directory exists or can be created
 */
export const validateOutputDir = async (
  dirPath: string
): Promise<CommandResult<string>> => {
  const fs = await import("fs/promises");
  const path = await import("path");

  try {
    const resolved = path.resolve(dirPath);
    await fs.mkdir(resolved, { recursive: true });
    return { success: true, data: resolved };
  } catch (error) {
    return {
      success: false,
      error: `Cannot create output directory: ${dirPath}`,
    };
  }
};

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Handle CLI errors consistently
 */
export const handleError = (
  config: LoggerConfig,
  error: unknown
): CommandResult<never> => {
  const message = error instanceof Error ? error.message : String(error);
  logError(config, message);

  return {
    success: false,
    error: message,
  };
};

/**
 * Exit with appropriate code based on result
 */
export const exitWithResult = <T>(result: CommandResult<T>): never => {
  process.exit(result.success ? 0 : 1);
};
