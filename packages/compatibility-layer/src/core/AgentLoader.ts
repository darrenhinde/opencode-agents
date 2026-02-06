import { readFileSync, readdirSync } from "fs";
import { join, extname, basename } from "path";
import * as yaml from "js-yaml";
import { ZodError } from "zod";
import { OpenAgentSchema, AgentFrontmatterSchema, OpenAgent, AgentFrontmatter } from "../types.js";

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Base error for agent loading operations
 */
export class AgentLoadError extends Error {
  public readonly filePath: string;
  public override readonly cause?: unknown;

  constructor(
    message: string,
    filePath: string,
    cause?: unknown
  ) {
    super(message);
    this.filePath = filePath;
    this.cause = cause;
    this.name = "AgentLoadError";
  }
}

/**
 * Error when frontmatter parsing fails
 */
export class FrontmatterParseError extends AgentLoadError {
  constructor(filePath: string, cause: unknown) {
    super(`Failed to parse frontmatter in ${filePath}`, filePath, cause);
    this.name = "FrontmatterParseError";
  }
}

/**
 * Error when Zod validation fails
 */
export class ValidationError extends AgentLoadError {
  constructor(
    filePath: string,
    public readonly validationErrors: ZodError
  ) {
    super(
      `Validation failed for ${filePath}:\n${validationErrors.errors
        .map((e) => `  - ${e.path.join(".")}: ${e.message}`)
        .join("\n")}`,
      filePath,
      validationErrors
    );
    this.name = "ValidationError";
  }
}

// ============================================================================
// FRONTMATTER PARSING
// ============================================================================

interface ParsedContent {
  frontmatter: unknown;
  body: string;
}

/**
 * Parse YAML frontmatter from markdown content
 * @param content - Full markdown file content
 * @param filePath - Path to file (for error reporting)
 * @returns Parsed frontmatter and body content
 */
function parseFrontmatter(content: string, filePath: string): ParsedContent {
  // Match YAML frontmatter between --- delimiters
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: null, body: content };
  }

  const [, yamlContent = "", body = ""] = match;

  try {
    const frontmatter = yaml.load(yamlContent);
    return { frontmatter, body: body.trim() };
  } catch (error) {
    throw new FrontmatterParseError(filePath, error);
  }
}

// ============================================================================
// MARKDOWN SECTION EXTRACTION
// ============================================================================

interface AgentSections {
  skills: string[];
  examples: string[];
  commands: string[];
  workflow?: string;
}

/**
 * Extract structured sections from markdown body
 * @param markdown - Agent markdown content (after frontmatter)
 * @returns Extracted sections
 */
function extractSections(markdown: string): AgentSections {
  const sections: AgentSections = {
    skills: [],
    examples: [],
    commands: [],
  };

  // Extract ## Skills or ## Available Skills section
  const skillsMatch = markdown.match(/##\s+(?:Available\s+)?Skills\s*\n([\s\S]*?)(?=\n##|\n---|$)/i);
  if (skillsMatch && skillsMatch[1]) {
    const skillsText = skillsMatch[1];
    // Extract list items or quoted names
    const skillItems = skillsText.match(/[-*]\s+`?([^`\n]+)`?/g);
    if (skillItems) {
      sections.skills = skillItems.map((item) =>
        item.replace(/[-*]\s+`?([^`\n]+)`?/, "$1").trim()
      );
    }
  }

  // Extract ## Examples section
  const examplesMatch = markdown.match(/##\s+Examples?\s*\n([\s\S]*?)(?=\n##|\n---|$)/i);
  if (examplesMatch && examplesMatch[1]) {
    const examplesText = examplesMatch[1];
    // Extract code blocks
    const codeBlocks = examplesText.match(/```[\s\S]*?```/g);
    if (codeBlocks) {
      sections.examples = codeBlocks;
    }
  }

  // Extract ## Commands or ## Available Commands section
  const commandsMatch = markdown.match(/##\s+(?:Available\s+)?Commands?\s*\n([\s\S]*?)(?=\n##|\n---|$)/i);
  if (commandsMatch && commandsMatch[1]) {
    const commandsText = commandsMatch[1];
    const commandItems = commandsText.match(/[-*]\s+`?([^`\n]+)`?/g);
    if (commandItems) {
      sections.commands = commandItems.map((item) =>
        item.replace(/[-*]\s+`?([^`\n]+)`?/, "$1").trim()
      );
    }
  }

  // Extract ## Workflow section
  const workflowMatch = markdown.match(/##\s+Workflow\s*\n([\s\S]*?)(?=\n##|\n---|$)/i);
  if (workflowMatch && workflowMatch[1]) {
    sections.workflow = workflowMatch[1].trim();
  }

  return sections;
}

// ============================================================================
// METADATA LOADER (from agent-metadata.json)
// ============================================================================

interface AgentMetadataFile {
  agents?: Record<string, Partial<OpenAgent["metadata"]>>;
}

let cachedMetadata: Record<string, Partial<OpenAgent["metadata"]>> = {};
let metadataLoaded = false;

/**
 * Load agent metadata from .opencode/config/agent-metadata.json
 * @param projectRoot - Optional project root path
 * @returns Metadata object keyed by agent ID
 */
function loadMetadataFile(projectRoot?: string): Record<string, Partial<OpenAgent["metadata"]>> {
  if (metadataLoaded) {
    return cachedMetadata;
  }

  const metadataPath = projectRoot
    ? join(projectRoot, ".opencode/config/agent-metadata.json")
    : ".opencode/config/agent-metadata.json";

  try {
    const content = readFileSync(metadataPath, "utf-8");
    const parsed = JSON.parse(content) as AgentMetadataFile;
    cachedMetadata = parsed.agents || {};
  } catch (error) {
    // Metadata file is optional
    cachedMetadata = {};
  }

  metadataLoaded = true;
  return cachedMetadata;
}

/**
 * Infer agent ID from file path
 * @param filePath - Path to agent file
 * @returns Agent ID (lowercase, kebab-case)
 */
function inferAgentId(filePath: string): string {
  // Extract agent ID from filename (e.g., "opencoder.md" -> "opencoder")
  const filename = basename(filePath, extname(filePath));
  return filename.toLowerCase().replace(/[^a-z0-9-]/g, "-");
}

// ============================================================================
// AGENT LOADER CLASS
// ============================================================================

/**
 * Loads and parses OpenAgent files from the filesystem
 */
export class AgentLoader {
  private projectRoot?: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot;
  }

  /**
   * Load and parse a single agent file
   * @param filePath - Path to agent markdown file
   * @returns Parsed and validated OpenAgent
   */
  loadFromFile(filePath: string): Promise<OpenAgent> {
    let content: string;

    try {
      content = readFileSync(filePath, "utf-8");
    } catch (error) {
      throw new AgentLoadError(`Failed to read file: ${filePath}`, filePath, error);
    }

    // Parse frontmatter
    const { frontmatter, body } = parseFrontmatter(content, filePath);

    if (!frontmatter) {
      throw new AgentLoadError(
        `No frontmatter found in ${filePath}. Agent files must have YAML frontmatter.`,
        filePath
      );
    }

    // Validate frontmatter against schema
    let validatedFrontmatter: AgentFrontmatter;
    try {
      validatedFrontmatter = AgentFrontmatterSchema.parse(frontmatter);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationError(filePath, error);
      }
      throw error;
    }

    // Load extended metadata from agent-metadata.json
    const agentId = inferAgentId(filePath);
    const metadataFile = loadMetadataFile(this.projectRoot);
    const extendedMetadata = metadataFile[agentId] || {};

    // Merge metadata with defaults
    const metadata: OpenAgent["metadata"] = {
      id: agentId,
      name: validatedFrontmatter.name,
      version: "1.0.0",
      author: "opencode",
      tags: [],
      dependencies: [],
      ...extendedMetadata,
    };

    // Extract sections from markdown body
    const sections = extractSections(body);

    // Construct OpenAgent object
    const agent: OpenAgent = {
      frontmatter: validatedFrontmatter,
      metadata,
      systemPrompt: body,
      contexts: [], // Can be populated by context discovery later
      sections,
    };

    // Final validation
    try {
      return Promise.resolve(OpenAgentSchema.parse(agent));
    } catch (error) {
      if (error instanceof ZodError) {
        return Promise.reject(new ValidationError(filePath, error));
      }
      return Promise.reject(error);
    }
  }

  /**
   * Load multiple agents from a directory (recursive)
   * @param dirPath - Path to directory containing agent files
   * @returns Array of parsed OpenAgents
   */
  async loadFromDirectory(dirPath: string): Promise<OpenAgent[]> {
    const agents: OpenAgent[] = [];
    const errors: AgentLoadError[] = [];

    const scanDirectory = async (currentPath: string): Promise<void> => {
      const entries = readdirSync(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(currentPath, entry.name);

        if (entry.isDirectory()) {
          await scanDirectory(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(".md")) {
          try {
            const agent = await new AgentLoader(this.projectRoot).loadFromFile(fullPath);
            agents.push(agent);
          } catch (error) {
            if (error instanceof AgentLoadError) {
              errors.push(error);
            } else {
              errors.push(
                new AgentLoadError(`Unexpected error loading ${fullPath}`, fullPath, error)
              );
            }
          }
        }
      }
    };

    await scanDirectory(dirPath);

    if (errors.length > 0 && agents.length === 0) {
      throw new AgentLoadError(
        `Failed to load any agents from ${dirPath}. Errors:\n${errors
          .map((e) => e.message)
          .join("\n")}`,
        dirPath
      );
    }

    return agents;
  }

  /**
   * Validate an agent file without fully loading it
   * @param filePath - Path to agent file
   * @returns Validation result
   */
  async validate(filePath: string): Promise<{ valid: true } | { valid: false; errors: ZodError }> {
    try {
      await this.loadFromFile(filePath);
      return { valid: true };
    } catch (error) {
      if (error instanceof ValidationError) {
        return { valid: false, errors: error.validationErrors };
      }
      throw error;
    }
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Load a single agent file (convenience function)
 * @param filePath - Path to agent markdown file
 * @returns Parsed OpenAgent
 */
export async function loadAgent(filePath: string): Promise<OpenAgent> {
  const loader = new AgentLoader();
  return loader.loadFromFile(filePath);
}

/**
 * Load all agents from a directory (convenience function)
 * @param dirPath - Path to directory containing agents
 * @returns Array of parsed OpenAgents
 */
export async function loadAgents(dirPath: string): Promise<OpenAgent[]> {
  const loader = new AgentLoader();
  return loader.loadFromDirectory(dirPath);
}
