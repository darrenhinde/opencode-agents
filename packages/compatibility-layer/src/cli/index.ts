#!/usr/bin/env node
/**
 * oac-compat CLI
 *
 * Command-line interface for converting agent definitions between
 * AI coding tool formats (OAC, Cursor, Claude, Windsurf).
 *
 * @module cli
 *
 * @example
 * ```bash
 * # Convert an agent file
 * oac-compat convert agent.md --format cursor
 *
 * # Validate compatibility
 * oac-compat validate agent.md --target claude
 *
 * # Migrate a project
 * oac-compat migrate ./agents --format windsurf --out-dir ./output
 *
 * # Show tool capabilities
 * oac-compat info cursor --compare claude
 * ```
 */

import { Command, Option } from "commander";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import {
  OUTPUT_FORMATS,
  PLATFORMS,
  type OutputFormat,
} from "./types.js";
import {
  logError,
} from "./utils.js";
import { createConvertAction } from "./commands/convert.js";
import { createValidateAction } from "./commands/validate.js";
import { createInfoAction } from "./commands/info.js";
import { createMigrateAction } from "./commands/migrate.js";

// Read version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, "..", "..", "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as { version: string };
const VERSION = packageJson.version;

// ============================================================================
// PROGRAM SETUP
// ============================================================================

/**
 * Create and configure the main CLI program
 */
const createProgram = (): Command => {
  const program = new Command();

  program
    .name("oac-compat")
    .description(
      "Convert agent definitions between AI coding tool formats\n\n" +
        "Supported formats: OAC (OpenAgents Control), Cursor, Claude Code, Windsurf"
    )
    .version(VERSION, "-V, --version", "display version number")
    .helpOption("-h, --help", "display help for command")
    .configureHelp({ showGlobalOptions: true });

  // Global options
  program
    .option("-v, --verbose", "enable verbose output")
    .option("-q, --quiet", "suppress all output except errors")
    .addOption(
      new Option("--output-format <format>", "output format")
        .choices(OUTPUT_FORMATS as unknown as string[])
        .default("text" as OutputFormat)
    );

  // Validate mutually exclusive options
  program.hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.verbose && opts.quiet) {
      console.error("Error: --verbose and --quiet are mutually exclusive");
      process.exit(1);
    }
  });

  return program;
};

// ============================================================================
// COMMANDS
// ============================================================================

/**
 * Register the 'convert' command
 */
const registerConvertCommand = (program: Command): void => {
  program
    .command("convert")
    .description("Convert an agent file to another format")
    .argument("<input>", "input agent file path")
    .option("-o, --output <path>", "output file path")
    .addOption(
      new Option("-f, --format <format>", "target format")
        .choices(PLATFORMS as unknown as string[])
        .makeOptionMandatory()
    )
    .addOption(
      new Option("--from <format>", "source format (auto-detect if omitted)")
        .choices(PLATFORMS as unknown as string[])
    )
    .option("--force", "overwrite existing output file")
    .action(createConvertAction());
};

/**
 * Register the 'validate' command
 */
const registerValidateCommand = (program: Command): void => {
  program
    .command("validate")
    .description("Validate agent compatibility with a target format")
    .argument("<input>", "input agent file path")
    .addOption(
      new Option("-t, --target <format>", "target format to validate against")
        .choices(PLATFORMS as unknown as string[])
        .makeOptionMandatory()
    )
    .option("--strict", "enable strict validation mode")
    .action(createValidateAction());
};

/**
 * Register the 'migrate' command
 */
const registerMigrateCommand = (program: Command): void => {
  program
    .command("migrate")
    .description("Migrate an entire project to another format")
    .argument("<source>", "source directory path")
    .addOption(
      new Option("-f, --format <format>", "target format")
        .choices(PLATFORMS as unknown as string[])
        .makeOptionMandatory()
    )
    .option("-o, --out-dir <path>", "output directory path")
    .option("--dry-run", "simulate migration without making changes")
    .option("--force", "overwrite existing files")
    .action(createMigrateAction());
};

/**
 * Register the 'info' command
 */
const registerInfoCommand = (program: Command): void => {
  program
    .command("info")
    .description("Display tool capabilities and feature parity")
    .argument("[platform]", "platform to show info for")
    .option("-d, --detailed", "show detailed capability information")
    .addOption(
      new Option("-c, --compare <platform>", "compare with another platform")
        .choices(PLATFORMS as unknown as string[])
    )
    .action(createInfoAction());
};

// ============================================================================
// MAIN
// ============================================================================

/**
 * Main CLI entry point
 */
const main = async (): Promise<void> => {
  const program = createProgram();

  // Register all commands
  registerConvertCommand(program);
  registerValidateCommand(program);
  registerMigrateCommand(program);
  registerInfoCommand(program);

  // Add examples to help
  program.addHelpText(
    "after",
    `
Examples:
  $ oac-compat convert agent.md -f cursor -o cursor-rules.md
  $ oac-compat validate agent.md -t claude --strict
  $ oac-compat migrate ./agents -f windsurf --dry-run
  $ oac-compat info cursor --compare claude
  $ oac-compat --help
`
  );

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError({ verbose: false, quiet: false, outputFormat: "text" }, message);
    process.exit(1);
  }
};

// Run CLI
void main();
