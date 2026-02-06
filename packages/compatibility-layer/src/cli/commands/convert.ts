/**
 * Convert Command
 *
 * Converts agent files between different AI coding tool formats.
 * Supports OAC, Cursor, Claude, and Windsurf formats.
 *
 * @module cli/commands/convert
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname, basename, extname, resolve } from "path";
import type { Command } from "commander";
import type { OpenAgent, ConversionResult } from "../../types.js";
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
  logWarning,
  logVerbose,
  createSpinner,
  spinnerSuccess,
  spinnerFail,
  printOutput,
  handleError,
  type LoggerConfig,
} from "../utils.js";

// Dynamic imports to avoid ESM resolution issues at startup
const getAgentLoader = async () => {
  const module = await import("../../core/AgentLoader.js");
  return module;
};

const getAdapterRegistry = async () => {
  const module = await import("../../core/AdapterRegistry.js");
  // Ensure built-in adapters are registered
  await module.registry.registerBuiltInAdapters();
  return module;
};

// ============================================================================
// TYPES
// ============================================================================

/**
 * Options specific to the convert command
 */
interface ConvertCommandOptions {
  output?: string;
  format: Platform;
  from?: Platform;
  force?: boolean;
}

/**
 * Detected format information
 */
interface FormatDetection {
  format: Platform;
  confidence: "high" | "medium" | "low";
  reason: string;
}

// ============================================================================
// FORMAT DETECTION
// ============================================================================

interface ParsedConfig {
  cascadeConfig?: unknown;
  creativity?: unknown;
  permissions?: unknown;
  skills?: unknown;
}

/**
 * Detect the format of an input file based on path and content
 */
const detectInputFormat = (
  filePath: string,
  content: string
): FormatDetection => {
  const fileName = basename(filePath).toLowerCase();
  const ext = extname(filePath).toLowerCase();

  // Check file name patterns
  if (fileName === ".cursorrules" || fileName === "cursorrules") {
    return { format: "cursor", confidence: "high", reason: "File name .cursorrules" };
  }

  if (fileName.includes("windsurf") || filePath.includes(".windsurf/")) {
    return { format: "windsurf", confidence: "high", reason: "Windsurf path pattern" };
  }

  if (filePath.includes(".claude/") || fileName.includes("claude")) {
    return { format: "claude", confidence: "high", reason: "Claude path pattern" };
  }

  if (filePath.includes(".opencode/") || filePath.includes("openagent")) {
    return { format: "oac", confidence: "high", reason: "OAC path pattern" };
  }

  // Check content patterns
  if (ext === ".md") {
    // Check for OAC frontmatter
    if (content.startsWith("---")) {
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch?.[1]) {
        const frontmatter = frontmatterMatch[1];
        if (frontmatter.includes("mode:") || frontmatter.includes("tools:")) {
          return { format: "oac", confidence: "high", reason: "OAC frontmatter detected" };
        }
      }
    }
    // Default markdown to OAC
    return { format: "oac", confidence: "medium", reason: "Markdown file (assuming OAC)" };
  }

  if (ext === ".json") {
    try {
      const parsed = JSON.parse(content) as ParsedConfig;
      if (parsed.cascadeConfig || parsed.creativity !== undefined) {
        return { format: "windsurf", confidence: "high", reason: "Windsurf JSON structure" };
      }
      if (parsed.permissions || parsed.skills) {
        return { format: "claude", confidence: "high", reason: "Claude JSON structure" };
      }
    } catch {
      // Not valid JSON
    }
    return { format: "oac", confidence: "low", reason: "JSON file (format unclear)" };
  }

  // Plain text - likely cursor
  if (ext === ".txt" || ext === "") {
    return { format: "cursor", confidence: "medium", reason: "Plain text (assuming Cursor)" };
  }

  return { format: "oac", confidence: "low", reason: "Unknown format (defaulting to OAC)" };
};

// ============================================================================
// CONVERSION LOGIC
// ============================================================================

/**
 * Load an agent from any supported format
 */
const loadAgentFromFormat = async (
  filePath: string,
  content: string,
  format: Platform,
  config: LoggerConfig
): Promise<OpenAgent> => {
  logVerbose(config, `Loading agent from ${format} format`);

  if (format === "oac") {
    // Use AgentLoader for OAC format
    const { loadAgent } = await getAgentLoader();
    return await loadAgent(filePath);
  }

  // Use appropriate adapter for other formats
  const { getAdapter } = await getAdapterRegistry();
  const adapter = getAdapter(format);
  if (!adapter) {
    throw new Error(`No adapter found for format: ${format}`);
  }
  return await adapter.toOAC(content);
};

/**
 * Convert an agent to the target format
 */
const convertToFormat = async (
  agent: OpenAgent,
  targetFormat: Platform,
  config: LoggerConfig
): Promise<ConversionResult> => {
  logVerbose(config, `Converting to ${targetFormat} format`);

  if (targetFormat === "oac") {
    // Converting TO OAC - just serialize the agent
    const content = serializeOACAgent(agent);
    return {
      success: true,
      configs: [
        {
          fileName: `${agent.frontmatter.name || "agent"}.md`,
          content,
          encoding: "utf-8",
        },
      ],
      warnings: [],
    };
  }

  // Use adapter for other formats
  const { getAdapter } = await getAdapterRegistry();
  const adapter = getAdapter(targetFormat);
  if (!adapter) {
    throw new Error(`No adapter found for format: ${targetFormat}`);
  }
  return await adapter.fromOAC(agent);
};

/**
 * Serialize an OpenAgent to OAC markdown format
 */
const serializeOACAgent = (agent: OpenAgent): string => {
  const lines: string[] = ["---"];

  // Serialize frontmatter
  const fm = agent.frontmatter;
  lines.push(`name: "${fm.name}"`);
  if (fm.description) lines.push(`description: "${fm.description}"`);
  lines.push(`mode: ${fm.mode}`);
  if (fm.model) lines.push(`model: ${fm.model}`);
  if (fm.temperature !== undefined) lines.push(`temperature: ${fm.temperature}`);

  // Tools
  if (fm.tools) {
    lines.push("tools:");
    for (const [tool, access] of Object.entries(fm.tools)) {
      const accessValue = access as boolean | string;
      if (typeof accessValue === "boolean") {
        lines.push(`  ${tool}: ${String(accessValue)}`);
      } else {
        lines.push(`  ${tool}: "${String(accessValue)}"`);
      }
    }
  }

  lines.push("---");
  lines.push("");
  lines.push(agent.systemPrompt);

  return lines.join("\n");
};

/**
 * Determine output path for converted file
 */
const getOutputPath = (
  _inputPath: string,
  outputOption: string | undefined,
  _result: ConversionResult
): string | null => {
  if (outputOption) {
    return resolve(outputOption);
  }

  // No output specified - will write to stdout
  return null;
};

/**
 * Write conversion result to file or stdout
 */
const writeOutput = async (
  result: ConversionResult,
  outputPath: string | null,
  config: LoggerConfig,
  force: boolean
): Promise<void> => {
  if (result.configs.length === 0) {
    throw new Error("Conversion produced no output files");
  }

  // Get primary output content
  const primaryConfig = result.configs[0];
  if (!primaryConfig) {
    throw new Error("No primary config in conversion result");
  }

  if (outputPath) {
    // Write to file
    const dir = dirname(outputPath);
    await mkdir(dir, { recursive: true });

    // Check if file exists (unless --force)
    if (!force) {
      try {
        await readFile(outputPath);
        throw new Error(
          `Output file already exists: ${outputPath}. Use --force to overwrite.`
        );
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
          throw err;
        }
      }
    }

    await writeFile(outputPath, primaryConfig.content, "utf-8");
    logSuccess(config, `Wrote ${outputPath}`);

    // Write additional files if present
    for (let i = 1; i < result.configs.length; i++) {
      const additionalConfig = result.configs[i];
      if (additionalConfig) {
        const additionalPath = resolve(dirname(outputPath), additionalConfig.fileName);
        await writeFile(additionalPath, additionalConfig.content, "utf-8");
        logSuccess(config, `Wrote ${additionalPath}`);
      }
    }
  } else {
    // Write to stdout
    console.log(primaryConfig.content);
  }
};

// ============================================================================
// COMMAND HANDLER
// ============================================================================

/**
 * Execute the convert command
 */
export const executeConvert = async (
  input: string,
  options: ConvertCommandOptions,
  globalOptions: GlobalOptions
): Promise<CommandResult<ConversionResult>> => {
  const config = createLoggerConfig(globalOptions);

  try {
    // Read input file
    logVerbose(config, `Reading input file: ${input}`);
    const content = await readFile(input, "utf-8");

    // Detect or use specified source format
    let sourceFormat: Platform;
    if (options.from) {
      sourceFormat = options.from;
      logVerbose(config, `Using specified source format: ${sourceFormat}`);
    } else {
      const detection = detectInputFormat(input, content);
      sourceFormat = detection.format;
      logVerbose(
        config,
        `Detected source format: ${sourceFormat} (${detection.confidence} confidence: ${detection.reason})`
      );

      if (detection.confidence === "low") {
        logWarning(
          config,
          `Low confidence format detection. Use --from to specify source format.`
        );
      }
    }

    // Check for same format conversion
    if (sourceFormat === options.format) {
      return errorResult(
        `Source and target formats are the same: ${sourceFormat}. No conversion needed.`
      );
    }

    // Create spinner for conversion
    const spinner = createSpinner(
      config,
      `Converting from ${sourceFormat} to ${options.format}...`
    );

    try {
      // Load agent from source format
      const agent = await loadAgentFromFormat(input, content, sourceFormat, config);
      logVerbose(config, `Loaded agent: ${agent.frontmatter.name}`);

      // Convert to target format
      const result = await convertToFormat(agent, options.format, config);

      if (!result.success) {
        spinnerFail(spinner, "Conversion failed");
        return errorResult(
          result.errors?.join(", ") || "Unknown conversion error",
          result.warnings
        );
      }

      spinnerSuccess(spinner, `Converted to ${options.format} format`);

      // Show warnings
      if (result.warnings.length > 0) {
        logInfo(config, "");
        for (const warning of result.warnings) {
          logWarning(config, warning);
        }
      }

      // Write output
      const outputPath = getOutputPath(input, options.output, result);
      await writeOutput(result, outputPath, config, options.force ?? false);

      return successResult(result, result.warnings);
    } catch (err) {
      spinnerFail(spinner, "Conversion failed");
      throw err;
    }
  } catch (err) {
    return handleError(config, err);
  }
};

/**
 * Create the convert command action handler
 */
export const createConvertAction = (): ((
  input: string,
  options: ConvertCommandOptions,
  command: Command
) => Promise<void>) => {
  return async (
    input: string,
    options: ConvertCommandOptions,
    command: Command
  ): Promise<void> => {
    const globalOptions = command.optsWithGlobals() as unknown as GlobalOptions;
    const result = await executeConvert(input, options, globalOptions);

    if (globalOptions.outputFormat === "json") {
      printOutput(createLoggerConfig(globalOptions), result);
    }

    if (!result.success) {
      process.exit(1);
    }
  };
};
