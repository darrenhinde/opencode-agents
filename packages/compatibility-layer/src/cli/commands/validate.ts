/**
 * Validate Command
 *
 * Validates agent compatibility with a target format before conversion.
 * Reports compatibility score, feature parity, and potential issues.
 *
 * @module cli/commands/validate
 */

import { readFile } from "fs/promises";
import type { Command } from "commander";
import type { OpenAgent } from "../../types.js";
import {
  type GlobalOptions,
  type Platform,
  successResult,
  errorResult,
  type CommandResult,
} from "../types.js";
import {
  createLoggerConfig,
  logInfo,
  logSuccess,
  logError,
  logVerbose,
  createSpinner,
  spinnerSuccess,
  spinnerFail,
  spinnerWarn,
  printOutput,
  handleError,
  getPlatformDisplayName,
  type LoggerConfig,
} from "../utils.js";
import chalk from "chalk";

// Dynamic imports to avoid ESM resolution issues at startup
const getAgentLoader = async () => {
  const module = await import("../../core/AgentLoader.js");
  return module;
};

const getCapabilityMatrix = async () => {
  const module = await import("../../core/CapabilityMatrix.js");
  return module;
};

// ============================================================================
// TYPES
// ============================================================================

/**
 * Options specific to the validate command
 */
interface ValidateCommandOptions {
  target?: Platform;
  strict?: boolean;
}

/**
 * Validation result data
 */
interface ValidationResultData {
  /** Input file path */
  input: string;
  /** Target platform */
  target: Platform;
  /** Compatibility score (0-100) */
  score: number;
  /** Overall compatibility status */
  status: "compatible" | "partial" | "incompatible";
  /** Whether conversion is possible */
  canConvert: boolean;
  /** Features that will be preserved */
  preserved: string[];
  /** Features that will be degraded */
  degraded: string[];
  /** Features that will be lost */
  lost: string[];
  /** Blocking issues */
  blockers: string[];
  /** Suggestions for unsupported features */
  suggestions: string[];
}

/**
 * Exit codes for validation
 */
const EXIT_CODES = {
  COMPATIBLE: 0,
  PARTIAL: 1,
  INCOMPATIBLE: 2,
} as const;

// ============================================================================
// SUGGESTION MAPPINGS
// ============================================================================

/**
 * Suggestions for features that are lost or degraded
 */
const FEATURE_SUGGESTIONS: Record<string, Record<string, string>> = {
  cursor: {
    granularPermissions: "Use .cursorrules sections to document expected permissions",
    hooks: "Implement hook-like behavior in custom cursor rules or scripts",
    externalContext: "Inline all context content directly in .cursorrules",
    contextPriority: "Order context sections by importance in .cursorrules",
    multipleAgents: "Merge agent behaviors into a single comprehensive .cursorrules",
    skillsSystem: "Document skill instructions inline in the rules file",
    askPermissions: "Configure permissions at IDE settings level",
    maxSteps: "Use cursor settings to manage execution limits",
  },
  claude: {
    temperatureControl: "Temperature is managed by Claude Code settings",
    maxSteps: "Execution limits managed by Claude Code runtime",
    contextPriority: "Order context files alphabetically or by naming convention",
  },
  windsurf: {
    granularPermissions: "Use cascadeConfig for workspace-level permissions",
    hooks: "Implement workflows using Windsurf's flow system",
    askPermissions: "Configure permissions in Windsurf settings",
  },
};

/**
 * Get suggestions for a feature on a platform
 */
const getSuggestion = (feature: string, platform: Platform): string | null => {
  return FEATURE_SUGGESTIONS[platform]?.[feature] ?? null;
};

// ============================================================================
// VALIDATION LOGIC
// ============================================================================

/**
 * Load an agent from OAC format
 */
const loadAgent = async (
  filePath: string,
  config: LoggerConfig
): Promise<OpenAgent> => {
  logVerbose(config, `Loading agent from: ${filePath}`);
  const { loadAgent } = await getAgentLoader();
  return await loadAgent(filePath);
};

/**
 * Analyze compatibility and generate validation result
 */
const analyzeAgent = async (
  agent: OpenAgent,
  target: Platform,
  filePath: string,
  strict: boolean
): Promise<ValidationResultData> => {
  const { analyzeCompatibility } = await getCapabilityMatrix();

  // Analyze compatibility (target must not be 'oac')
  const targetPlatform = target as Exclude<Platform, "oac">;
  const analysis = analyzeCompatibility(agent, targetPlatform);

  // Generate suggestions for lost/degraded features
  const suggestions: string[] = [];
  for (const feature of [...analysis.lost, ...analysis.degraded]) {
    const suggestion = getSuggestion(feature, target);
    if (suggestion) {
      suggestions.push(`${feature}: ${suggestion}`);
    }
  }

  // Determine status
  let status: "compatible" | "partial" | "incompatible";
  if (analysis.blockers.length > 0 || (strict && analysis.lost.length > 0)) {
    status = "incompatible";
  } else if (analysis.degraded.length > 0 || analysis.lost.length > 0) {
    status = "partial";
  } else {
    status = "compatible";
  }

  return {
    input: filePath,
    target,
    score: analysis.score,
    status,
    canConvert: analysis.blockers.length === 0,
    preserved: analysis.preserved,
    degraded: analysis.degraded,
    lost: analysis.lost,
    blockers: analysis.blockers,
    suggestions,
  };
};

/**
 * Format feature list for display
 */
const formatFeatureList = (
  features: string[],
  icon: string,
  color: (s: string) => string
): string[] => {
  if (features.length === 0) return [];
  return features.map((f) => `  ${icon} ${color(f)}`);
};

/**
 * Print validation result in text format
 */
const printTextResult = (
  config: LoggerConfig,
  result: ValidationResultData
): void => {
  const targetName = getPlatformDisplayName(result.target);

  // Header
  logInfo(config, "");
  logInfo(config, chalk.bold(`Validation Report: ${result.input}`));
  logInfo(config, chalk.dim(`Target: ${targetName}`));
  logInfo(config, "");

  // Score bar
  const scoreColor =
    result.score >= 80
      ? chalk.green
      : result.score >= 50
        ? chalk.yellow
        : chalk.red;
  const scoreBar = "█".repeat(Math.floor(result.score / 5)) +
    "░".repeat(20 - Math.floor(result.score / 5));
  logInfo(config, `Compatibility Score: ${scoreColor(`${result.score}%`)} [${scoreBar}]`);
  logInfo(config, "");

  // Status
  const statusIcon =
    result.status === "compatible"
      ? chalk.green("✓")
      : result.status === "partial"
        ? chalk.yellow("◐")
        : chalk.red("✗");
  const statusText =
    result.status === "compatible"
      ? chalk.green("Fully Compatible")
      : result.status === "partial"
        ? chalk.yellow("Partially Compatible")
        : chalk.red("Incompatible");
  logInfo(config, `Status: ${statusIcon} ${statusText}`);
  logInfo(config, "");

  // Blockers (if any)
  if (result.blockers.length > 0) {
    logInfo(config, chalk.red.bold("Blocking Issues:"));
    for (const blocker of result.blockers) {
      logInfo(config, `  ${chalk.red("✗")} ${blocker}`);
    }
    logInfo(config, "");
  }

  // Feature breakdown
  if (result.preserved.length > 0) {
    logInfo(config, chalk.green.bold("Preserved Features:"));
    for (const line of formatFeatureList(result.preserved, "✓", chalk.green)) {
      logInfo(config, line);
    }
    logInfo(config, "");
  }

  if (result.degraded.length > 0) {
    logInfo(config, chalk.yellow.bold("Degraded Features:"));
    for (const line of formatFeatureList(result.degraded, "◐", chalk.yellow)) {
      logInfo(config, line);
    }
    logInfo(config, "");
  }

  if (result.lost.length > 0) {
    logInfo(config, chalk.red.bold("Lost Features:"));
    for (const line of formatFeatureList(result.lost, "✗", chalk.red)) {
      logInfo(config, line);
    }
    logInfo(config, "");
  }

  // Suggestions
  if (result.suggestions.length > 0) {
    logInfo(config, chalk.cyan.bold("Suggestions:"));
    for (const suggestion of result.suggestions) {
      logInfo(config, `  ${chalk.cyan("→")} ${suggestion}`);
    }
    logInfo(config, "");
  }

  // Summary
  if (result.canConvert) {
    logSuccess(config, `Conversion to ${targetName} is possible`);
  } else {
    logError(config, `Conversion to ${targetName} is blocked`);
  }
};

// ============================================================================
// COMMAND HANDLER
// ============================================================================

/**
 * Execute the validate command
 */
export const executeValidate = async (
  input: string,
  options: ValidateCommandOptions,
  globalOptions: GlobalOptions
): Promise<CommandResult<ValidationResultData>> => {
  const config = createLoggerConfig(globalOptions);

  try {
    // Validate target is specified
    if (!options.target) {
      return errorResult(
        "Target format is required. Use --target <format> to specify."
      );
    }

    // Cannot validate against OAC (source format)
    if (options.target === "oac") {
      return errorResult(
        "Cannot validate against OAC format. Specify a target platform: cursor, claude, or windsurf."
      );
    }

    // Check file exists
    logVerbose(config, `Validating file: ${input}`);
    try {
      await readFile(input, "utf-8");
    } catch {
      return errorResult(`File not found or not readable: ${input}`);
    }

    // Create spinner
    const spinner = createSpinner(
      config,
      `Validating compatibility with ${getPlatformDisplayName(options.target)}...`
    );

    try {
      // Load agent
      const agent = await loadAgent(input, config);
      logVerbose(config, `Loaded agent: ${agent.frontmatter.name}`);

      // Analyze compatibility
      const result = await analyzeAgent(
        agent,
        options.target,
        input,
        options.strict ?? false
      );

      // Update spinner based on result
      if (result.status === "compatible") {
        spinnerSuccess(spinner, "Validation complete - Fully compatible");
      } else if (result.status === "partial") {
        spinnerWarn(spinner, "Validation complete - Partially compatible");
      } else {
        spinnerFail(spinner, "Validation complete - Incompatible");
      }

      // Print detailed result (text format)
      if (globalOptions.outputFormat !== "json") {
        printTextResult(config, result);
      }

      return successResult(result);
    } catch (err) {
      spinnerFail(spinner, "Validation failed");
      throw err;
    }
  } catch (err) {
    return handleError(config, err);
  }
};

/**
 * Get exit code based on validation result
 */
export const getValidationExitCode = (
  result: CommandResult<ValidationResultData>
): number => {
  if (!result.success || !result.data) {
    return EXIT_CODES.INCOMPATIBLE;
  }

  switch (result.data.status) {
    case "compatible":
      return EXIT_CODES.COMPATIBLE;
    case "partial":
      return EXIT_CODES.PARTIAL;
    case "incompatible":
      return EXIT_CODES.INCOMPATIBLE;
  }
};

/**
 * Create the validate command action handler
 */
export const createValidateAction = (): ((
  input: string,
  options: ValidateCommandOptions,
  command: Command
) => Promise<void>) => {
  return async (
    input: string,
    options: ValidateCommandOptions,
    command: Command
  ): Promise<void> => {
    const globalOptions = command.optsWithGlobals() as unknown as GlobalOptions;
    const result = await executeValidate(input, options, globalOptions);

    // Print JSON output if requested
    if (globalOptions.outputFormat === "json") {
      printOutput(createLoggerConfig(globalOptions), result);
    }

    // Exit with appropriate code
    const exitCode = getValidationExitCode(result);
    process.exit(exitCode);
  };
};
