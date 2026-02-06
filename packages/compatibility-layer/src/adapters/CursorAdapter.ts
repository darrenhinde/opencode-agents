import { BaseAdapter } from "./BaseAdapter.js";
import type {
  OpenAgent,
  ConversionResult,
  ToolCapabilities,
  AgentFrontmatter,
} from "../types.js";

/**
 * Cursor IDE adapter for converting between OpenAgents Control and Cursor IDE formats.
 * 
 * Cursor IDE uses:
 * - `.cursorrules` - Single file in project root (plain text with optional frontmatter)
 * - No support for multiple agents (must merge into one)
 * - No support for hooks or skills
 * - Binary permissions (on/off only)
 * 
 * **Key Limitations**:
 * - Single agent only - multiple OAC agents get merged
 * - No Skills system - contexts must be inlined
 * - No Hooks - lost during conversion
 * - Binary permissions - granular rules degraded
 * 
 * @see https://cursor.sh/
 */
export class CursorAdapter extends BaseAdapter {
  readonly name = "cursor";
  readonly displayName = "Cursor IDE";

  constructor() {
    super();
  }

  // ============================================================================
  // CONVERSION METHODS
  // ============================================================================

  /**
   * Convert Cursor IDE format TO OpenAgents Control format.
   * 
   * Parses .cursorrules file which can be:
   * - Plain text (becomes systemPrompt)
   * - Markdown with frontmatter (YAML config + instructions)
   * 
   * @param source - .cursorrules file content
   * @returns OpenAgent object
   */
  toOAC(source: string): Promise<OpenAgent> {
    // Try parsing frontmatter
    const { frontmatter, body } = this.parseFrontmatter(source);

    // Build agent frontmatter
    const agentFrontmatter: AgentFrontmatter = {
      name: String(frontmatter.name || "cursor-agent"),
      description: String(
        frontmatter.description || "Agent imported from Cursor IDE"
      ),
      mode: "primary",
      model: this.mapCursorModelToOAC(frontmatter.model as string | undefined),
      tools: this.parseCursorTools(frontmatter.tools),
    };

    // Add temperature if present
    if (frontmatter.temperature !== undefined) {
      agentFrontmatter.temperature = Number(frontmatter.temperature);
    }

    return Promise.resolve({
      frontmatter: agentFrontmatter,
      metadata: {
        name: agentFrontmatter.name,
        category: "core",
        type: "agent",
      },
      systemPrompt: body.trim() || source.trim(),
      contexts: [],
    });
  }

  /**
   * Convert FROM OpenAgents Control format to Cursor IDE format.
   * 
   * Generates single `.cursorrules` file.
   * 
   * **Important**: If multiple agents are provided, they will be merged
   * into a single .cursorrules file with warnings.
   * 
   * @param agent - OpenAgent to convert (or array of agents to merge)
   * @returns ConversionResult with .cursorrules file and warnings
   */
  fromOAC(agent: OpenAgent): Promise<ConversionResult> {
    const warnings: string[] = [];

    // Validate conversion
    const validationWarnings = this.validateConversion(agent);
    warnings.push(...validationWarnings);

    // Check for features that will be lost
    if (agent.frontmatter.skills && agent.frontmatter.skills.length > 0) {
      warnings.push(
        this.unsupportedFeatureWarning(
          "skills",
          `${agent.frontmatter.skills.length} skills`
        )
      );
      warnings.push(
        "💡 Consider inlining skill content into the main prompt for Cursor"
      );
    }

    if (agent.frontmatter.hooks && agent.frontmatter.hooks.length > 0) {
      warnings.push(
        this.unsupportedFeatureWarning(
          "hooks",
          `${agent.frontmatter.hooks.length} hooks`
        )
      );
    }

    if (agent.frontmatter.maxSteps !== undefined) {
      warnings.push(
        this.unsupportedFeatureWarning("maxSteps", agent.frontmatter.maxSteps)
      );
    }

    // Check for granular permissions
    if (agent.frontmatter.permission) {
      const hasGranular = Object.values(agent.frontmatter.permission).some(
        (perm) => typeof perm === "object" && !Array.isArray(perm)
      );

      if (hasGranular) {
        warnings.push(
          this.degradedFeatureWarning(
            "granular permissions",
            "allow/deny/ask per path",
            "binary on/off per tool"
          )
        );
      }
    }

    // Generate .cursorrules content
    const cursorRules = this.generateCursorRules(agent, warnings);

    return Promise.resolve(this.createSuccessResult(
      [
        {
          fileName: ".cursorrules",
          content: cursorRules,
          encoding: "utf-8",
        },
      ],
      warnings
    ));
  }

  /**
   * Get the configuration path for Cursor IDE.
   */
  getConfigPath(): string {
    return ".cursorrules";
  }

  /**
   * Get Cursor IDE capabilities.
   */
  getCapabilities(): ToolCapabilities {
    return {
      name: this.name,
      displayName: this.displayName,
      supportsMultipleAgents: false, // ❌ Single file only
      supportsSkills: false, // ❌ No skills system
      supportsHooks: false, // ❌ No hooks
      supportsGranularPermissions: false, // ⚠️ Binary only
      supportsContexts: true, // ✅ Can inline context
      supportsCustomModels: true, // ✅ Model selection
      supportsTemperature: true, // ✅ Limited support
      supportsMaxSteps: false, // ❌ Not supported
      configFormat: "plain",
      outputStructure: "single-file",
      notes: [
        "Single .cursorrules file in project root",
        "Multiple agents must be merged into one",
        "No Skills system - inline context content instead",
        "No Hooks support - behavioral rules lost",
        "Binary permissions only - granular rules degraded",
        "Temperature support limited compared to OAC",
      ],
    };
  }

  /**
   * Validate if an agent can be converted with full fidelity.
   */
  validateConversion(agent: OpenAgent): string[] {
    const warnings: string[] = [];

    // Cursor always works with single file, so minimal validation
    if (!agent.frontmatter.name) {
      warnings.push("⚠️  Agent name missing - using 'cursor-agent' as default");
    }

    // Warn about subagent mode (Cursor doesn't distinguish)
    if (agent.frontmatter.mode === "subagent") {
      warnings.push(
        "⚠️  Cursor IDE does not distinguish between primary and subagent modes"
      );
    }

    return warnings;
  }

  // ============================================================================
  // PARSING HELPERS (toOAC)
  // ============================================================================

  /**
   * Parse frontmatter from .cursorrules file.
   * Cursor supports optional YAML frontmatter like:
   * ---
   * name: my-agent
   * model: gpt-4
   * ---
   * Rules content here...
   */
  private parseFrontmatter(content: string): {
    frontmatter: Record<string, unknown>;
    body: string;
  } {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) {
      // No frontmatter, entire content is the body
      return { frontmatter: {}, body: content };
    }

    const yamlContent = match[1] || "";
    const body = match[2] || "";

    // Simple YAML parser
    const frontmatter: Record<string, unknown> = {};
    yamlContent.split("\n").forEach((line) => {
      const colonIndex = line.indexOf(":");
      if (colonIndex > -1) {
        const key = line.slice(0, colonIndex).trim();
        let value: unknown = line.slice(colonIndex + 1).trim();

        // Remove quotes
        if (typeof value === "string") {
          value = value.replace(/^["']|["']$/g, "");
        }

        // Parse numbers
        if (typeof value === "string" && !isNaN(Number(value))) {
          value = Number(value);
        }

        // Parse booleans
        if (value === "true") value = true;
        if (value === "false") value = false;

        frontmatter[key] = value;
      }
    });

    return { frontmatter, body };
  }

  /**
   * Parse Cursor tools specification.
   * Cursor typically doesn't have explicit tool config in .cursorrules,
   * but we support it if present.
   */
  private parseCursorTools(
    tools: unknown
  ): Record<string, boolean> | undefined {
    if (!tools) return undefined;

    const toolAccess: Record<string, boolean> = {};

    if (typeof tools === "string") {
      // Parse comma-separated: "read, write, bash"
      tools.split(",").forEach((tool) => {
        const toolName = tool.trim().toLowerCase();
        if (toolName) {
          toolAccess[toolName] = true;
        }
      });
    } else if (Array.isArray(tools)) {
      // Parse array: ["read", "write", "bash"]
      tools.forEach((tool) => {
        const toolName = String(tool).toLowerCase();
        if (toolName) {
          toolAccess[toolName] = true;
        }
      });
    }

    return Object.keys(toolAccess).length > 0 ? toolAccess : undefined;
  }

  // ============================================================================
  // GENERATION HELPERS (fromOAC)
  // ============================================================================

  /**
   * Generate .cursorrules content from OpenAgent.
   * 
   * Format:
   * ---
   * name: agent-name
   * model: gpt-4
   * temperature: 0.7
   * ---
   * 
   * System prompt content here...
   * 
   * [Inlined context if present]
   */
  private generateCursorRules(
    agent: OpenAgent,
    warnings: string[]
  ): string {
    const parts: string[] = [];

    // Generate frontmatter if we have metadata
    const hasFrontmatter =
      agent.frontmatter.name ||
      agent.frontmatter.model ||
      agent.frontmatter.temperature !== undefined;

    if (hasFrontmatter) {
      const frontmatterLines: string[] = [];

      if (agent.frontmatter.name) {
        frontmatterLines.push(`name: ${agent.frontmatter.name}`);
      }

      if (agent.frontmatter.description) {
        frontmatterLines.push(`description: ${agent.frontmatter.description}`);
      }

      if (agent.frontmatter.model) {
        const cursorModel = this.mapOACModelToCursor(agent.frontmatter.model);
        frontmatterLines.push(`model: ${cursorModel}`);
      }

      if (agent.frontmatter.temperature !== undefined) {
        frontmatterLines.push(`temperature: ${agent.frontmatter.temperature}`);
      }

      if (frontmatterLines.length > 0) {
        parts.push("---");
        parts.push(frontmatterLines.join("\n"));
        parts.push("---");
        parts.push(""); // Empty line after frontmatter
      }
    }

    // Add system prompt
    if (agent.systemPrompt) {
      parts.push(agent.systemPrompt);
    }

    // Inline contexts if present
    if (agent.contexts && agent.contexts.length > 0) {
      parts.push("");
      parts.push("---");
      parts.push("");
      parts.push("# Context Files");
      parts.push("");
      parts.push(
        "The following contexts from OpenAgents Control have been inlined:"
      );
      parts.push("");

      agent.contexts.forEach((ctx) => {
        parts.push(`## ${ctx.path}`);
        if (ctx.description) {
          parts.push(`*${ctx.description}*`);
        }
        if (ctx.priority) {
          parts.push(`**Priority**: ${ctx.priority}`);
        }
        parts.push("");
        parts.push(
          `> **Note**: Original context file: \`${ctx.path}\`. Load this file for full details.`
        );
        parts.push("");
      });

      warnings.push(
        `💡 ${agent.contexts.length} context file(s) referenced - consider loading them manually in Cursor`
      );
    }

    // Add tool access information as comments
    if (agent.frontmatter.tools) {
      const enabledTools = Object.entries(agent.frontmatter.tools)
        .filter(([, enabled]) => enabled)
        .map(([tool]) => tool);

      if (enabledTools.length > 0) {
        parts.push("");
        parts.push("---");
        parts.push("");
        parts.push("# Tool Access");
        parts.push("");
        parts.push("Enabled tools:");
        enabledTools.forEach((tool) => {
          parts.push(`- ${tool}`);
        });
      }
    }

    return parts.join("\n");
  }

  // ============================================================================
  // MAPPING HELPERS
  // ============================================================================

  /**
   * Map Cursor model ID to OAC model ID.
   */
  private mapCursorModelToOAC(model?: string): string | undefined {
    if (!model) return undefined;

    const modelMap: Record<string, string> = {
      "gpt-4": "gpt-4",
      "gpt-4-turbo": "gpt-4-turbo",
      "gpt-4o": "gpt-4o",
      "gpt-3.5-turbo": "gpt-3.5-turbo",
      "claude-3-opus": "claude-opus-3",
      "claude-3-sonnet": "claude-sonnet-3",
      "claude-3-haiku": "claude-haiku-3",
    };

    return modelMap[model] || model;
  }

  /**
   * Map OAC model ID to Cursor model ID.
   */
  private mapOACModelToCursor(model: string): string {
    const modelMap: Record<string, string> = {
      "gpt-4": "gpt-4",
      "gpt-4-turbo": "gpt-4-turbo",
      "gpt-4o": "gpt-4o",
      "gpt-3.5-turbo": "gpt-3.5-turbo",
      "claude-opus-3": "claude-3-opus",
      "claude-sonnet-3": "claude-3-sonnet",
      "claude-haiku-3": "claude-3-haiku",
      "claude-opus-4": "claude-3-opus", // Fallback to v3
      "claude-sonnet-4": "claude-3-sonnet", // Fallback to v3
      "claude-haiku-4": "claude-3-haiku", // Fallback to v3
    };

    return modelMap[model] || "gpt-4"; // Default to gpt-4
  }

  /**
   * Merge multiple OpenAgents into a single Cursor-compatible agent.
   * 
   * This is needed because Cursor only supports a single .cursorrules file.
   * 
   * @param agents - Array of OpenAgent objects to merge
   * @returns Single merged OpenAgent
   */
  mergeAgents(agents: OpenAgent[]): OpenAgent {
    if (agents.length === 0) {
      throw new Error("Cannot merge empty agent array");
    }

    if (agents.length === 1) {
      const agent = agents[0];
      if (!agent) {
        throw new Error("Agent at index 0 is undefined");
      }
      return {
        frontmatter: { ...agent.frontmatter },
        metadata: { ...agent.metadata },
        systemPrompt: agent.systemPrompt,
        contexts: agent.contexts ? [...agent.contexts] : [],
        sections: agent.sections ? { ...agent.sections } : undefined,
      };
    }

    // Use first agent as base
    const merged: OpenAgent = {
      frontmatter: {
        name: agents.map((a) => a.frontmatter.name).join("-"),
        description: `Merged agent: ${agents.map((a) => a.frontmatter.name).join(", ")}`,
        mode: "primary",
      },
      metadata: {
        name: "merged-agent",
        category: "core",
        type: "agent",
      },
      systemPrompt: "",
      contexts: [],
    };

    // Merge system prompts
    const prompts: string[] = [];
    agents.forEach((agent, index) => {
      prompts.push(`# Agent ${index + 1}: ${agent.frontmatter.name}`);
      prompts.push(agent.frontmatter.description || "");
      prompts.push("");
      prompts.push(agent.systemPrompt);
      prompts.push("");
      prompts.push("---");
      prompts.push("");
    });

    merged.systemPrompt = prompts.join("\n");

    // Merge tools (union of all enabled tools)
    const allTools: Record<string, boolean> = {};
    agents.forEach((agent) => {
      if (agent.frontmatter.tools) {
        Object.entries(agent.frontmatter.tools).forEach(([tool, enabled]) => {
          if (enabled) {
            allTools[tool] = true;
          }
        });
      }
    });

    if (Object.keys(allTools).length > 0) {
      merged.frontmatter.tools = allTools;
    }

    // Merge contexts
    const allContexts = agents.flatMap((agent) => agent.contexts || []);
    if (allContexts.length > 0) {
      merged.contexts = allContexts;
    }

    // Use highest temperature if any
    const temps = agents
      .map((a) => a.frontmatter.temperature)
      .filter((t): t is number => t !== undefined);
    if (temps.length > 0) {
      merged.frontmatter.temperature = Math.max(...temps);
    }

    // Use first available model
    const model = agents.find((a) => a.frontmatter.model)?.frontmatter.model;
    if (model) {
      merged.frontmatter.model = model;
    }

    return merged;
  }
}
