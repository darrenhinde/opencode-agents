import { BaseAdapter } from "./BaseAdapter.js";
import type {
  OpenAgent,
  ConversionResult,
  ToolCapabilities,
  ToolConfig,
  AgentFrontmatter,
} from "../types.js";

/**
 * Windsurf adapter for converting between OpenAgents Control and Windsurf formats.
 * 
 * Windsurf uses:
 * - `.windsurf/config.json` for main configuration
 * - `.windsurf/agents/*.json` for individual agents
 * - `.windsurf/context/` for context files
 * 
 * **Key Features**:
 * - ✅ Multiple agents support
 * - ⚠️ Partial permissions (binary on/off, not granular)
 * - ⚠️ Limited temperature support (maps to creativity)
 * - ⚠️ Partial skills support
 * - ❌ No hooks support
 * 
 * @see https://windsurf.ai/docs
 */
export class WindsurfAdapter extends BaseAdapter {
  readonly name = "windsurf";
  readonly displayName = "Windsurf";

  constructor() {
    super();
  }

  /**
   * Get the config path for Windsurf.
   */
  getConfigPath(): string {
    return ".windsurf/";
  }

  // ============================================================================
  // CONVERSION METHODS
  // ============================================================================

  /**
   * Convert Windsurf format TO OpenAgents Control format.
   * 
   * Expects JSON content from either:
   * - `.windsurf/config.json` (main config)
   * - `.windsurf/agents/{name}.json` (agent config)
   * 
   * @param source - Windsurf JSON config content
   * @returns OpenAgent object
   */
  toOAC(source: string): Promise<OpenAgent> {
    const config = this.safeParseJSON(source, "windsurf-config.json");
    if (!config || typeof config !== "object") {
      return Promise.reject(new Error("Invalid Windsurf config format"));
    }

    const windsurfConfig = config as Record<string, unknown>;

    // Build agent frontmatter
    const frontmatter: AgentFrontmatter = {
      name: String(windsurfConfig.name || "windsurf-agent"),
      description: String(
        windsurfConfig.description || "Agent imported from Windsurf"
      ),
      mode: windsurfConfig.type === "subagent" ? "subagent" : "primary",
      model: this.mapWindsurfModelToOAC(windsurfConfig.model as string),
      tools: this.parseWindsurfTools(windsurfConfig.tools),
    };

    // Map creativity to temperature (approximate)
    if (windsurfConfig.creativity !== undefined) {
      frontmatter.temperature = this.mapCreativityToTemperature(
        windsurfConfig.creativity as string | number
      );
    }

    // Validate category is one of the valid AgentCategory values
    const validCategories = ["core", "development", "content", "data", "product", "learning", "meta", "specialist"] as const;
    const categoryStr = String(windsurfConfig.category || "core");
    const category = validCategories.includes(categoryStr as never) ? (categoryStr as typeof validCategories[number]) : "core";

    return Promise.resolve({
      frontmatter,
      metadata: {
        name: frontmatter.name,
        category,
        type: frontmatter.mode === "subagent" ? "subagent" : "agent",
      },
      systemPrompt: String(windsurfConfig.systemPrompt || windsurfConfig.prompt || ""),
      contexts: this.parseWindsurfContexts(windsurfConfig.contexts),
    });
  }

  /**
   * Convert FROM OpenAgents Control format to Windsurf format.
   * 
   * Generates:
   * - `.windsurf/agents/{name}.json` for each agent
   * - Context file references
   * 
   * @param agent - OpenAgent to convert
   * @returns ConversionResult with generated files and warnings
   */
  fromOAC(agent: OpenAgent): Promise<ConversionResult> {
    const warnings: string[] = [];
    const configs: ToolConfig[] = [];

    // Validate conversion
    const validationWarnings = this.validateConversion(agent);
    warnings.push(...validationWarnings);

    // Check for unsupported features
    if (agent.frontmatter.hooks && agent.frontmatter.hooks.length > 0) {
      warnings.push(
        this.unsupportedFeatureWarning(
          "hooks",
          `${agent.frontmatter.hooks.length} hooks`
        )
      );
      warnings.push("❌ Windsurf does not support hooks - behavioral rules will be lost");
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

    // Check for skills
    if (agent.frontmatter.skills && agent.frontmatter.skills.length > 0) {
      warnings.push(
        this.degradedFeatureWarning(
          "skills",
          "full Skills system",
          "basic context references"
        )
      );
    }

    // Generate Windsurf agent config
    const windsurfConfig = this.generateWindsurfConfig(agent, warnings);

    // Determine output path based on agent mode
    const fileName =
      agent.frontmatter.mode === "subagent"
        ? `.windsurf/agents/${agent.frontmatter.name}.json`
        : ".windsurf/config.json";

    configs.push({
      fileName,
      content: JSON.stringify(windsurfConfig, null, 2),
      encoding: "utf-8",
    });

    // Generate context file references if present
    if (agent.contexts && agent.contexts.length > 0) {
      warnings.push(
        `💡 ${agent.contexts.length} context file(s) referenced - ensure they exist in .windsurf/context/`
      );
    }

    return Promise.resolve(this.createSuccessResult(configs, warnings));
  }

  /**
   * Get Windsurf capabilities.
   */
  getCapabilities(): ToolCapabilities {
    return {
      name: this.name,
      displayName: this.displayName,
      supportsMultipleAgents: true, // ✅ Supports .windsurf/agents/
      supportsSkills: true, // ⚠️ Partial - basic context support
      supportsHooks: false, // ❌ Not supported
      supportsGranularPermissions: false, // ⚠️ Binary only
      supportsContexts: true, // ✅ .windsurf/context/
      supportsCustomModels: true, // ✅ Model selection
      supportsTemperature: true, // ⚠️ Via creativity setting
      supportsMaxSteps: false, // ❌ Not supported
      configFormat: "json",
      outputStructure: "directory",
      notes: [
        "Multiple agents supported via .windsurf/agents/",
        "Permissions are binary (on/off) - granular rules degraded",
        "Temperature maps to/from creativity setting (low/medium/high)",
        "No hooks support - behavioral rules will be lost",
        "Skills map to basic context file references",
        "Priority levels: only high/low (medium/critical → degraded)",
      ],
    };
  }

  /**
   * Validate if an agent can be converted with full fidelity.
   */
  validateConversion(agent: OpenAgent): string[] {
    const warnings: string[] = [];

    if (!agent.frontmatter.name) {
      warnings.push("⚠️  Agent name is required for Windsurf");
    }

    if (!agent.frontmatter.description) {
      warnings.push("⚠️  Agent description recommended for Windsurf");
    }

    return warnings;
  }

  // ============================================================================
  // PARSING HELPERS (toOAC)
  // ============================================================================

  /**
   * Parse Windsurf tools to OAC ToolAccess.
   */
  private parseWindsurfTools(
    tools: unknown
  ): Record<string, boolean> | undefined {
    if (!tools) return undefined;

    const toolAccess: Record<string, boolean> = {};

    if (typeof tools === "object" && !Array.isArray(tools)) {
      // Parse object: { read: true, write: false }
      const toolsObj = tools as Record<string, unknown>;
      for (const [tool, enabled] of Object.entries(toolsObj)) {
        toolAccess[tool.toLowerCase()] = Boolean(enabled);
      }
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

  /**
   * Parse Windsurf contexts to OAC format.
   */
  private parseWindsurfContexts(
    contexts: unknown
  ): Array<{ path: string; priority?: "critical" | "high" | "medium" | "low"; description?: string }> {
    if (!contexts || !Array.isArray(contexts)) return [];

    return contexts.map((ctx) => {
      if (typeof ctx === "string") {
        return { path: ctx };
      }

      if (typeof ctx === "object" && ctx !== null) {
        const ctxObj = ctx as Record<string, unknown>;
        const priority = ctxObj.priority ? String(ctxObj.priority).toLowerCase() : undefined;
        
        return {
          path: String(ctxObj.path || ""),
          priority: this.normalizeOACPriority(priority),
          description: ctxObj.description ? String(ctxObj.description) : undefined,
        };
      }

      return { path: "" };
    }).filter((ctx) => ctx.path);
  }

  /**
   * Normalize priority to OAC valid values.
   */
  private normalizeOACPriority(
    priority?: string
  ): "critical" | "high" | "medium" | "low" | undefined {
    if (!priority) return undefined;

    const normalized = priority.toLowerCase();
    if (
      normalized === "critical" ||
      normalized === "high" ||
      normalized === "medium" ||
      normalized === "low"
    ) {
      return normalized;
    }

    // Default to medium if invalid
    return "medium";
  }

  /**
   * Map Windsurf creativity setting to OAC temperature.
   */
  private mapCreativityToTemperature(creativity: string | number): number {
    if (typeof creativity === "number") {
      return creativity; // Already numeric
    }

    const creativityMap: Record<string, number> = {
      low: 0.3,
      medium: 0.7,
      high: 1.0,
      balanced: 0.5,
    };

    return creativityMap[creativity.toLowerCase()] || 0.7;
  }

  // ============================================================================
  // GENERATION HELPERS (fromOAC)
  // ============================================================================

  /**
   * Generate Windsurf config from OpenAgent.
   */
  private generateWindsurfConfig(
    agent: OpenAgent,
    warnings: string[]
  ): Record<string, unknown> {
    const config: Record<string, unknown> = {
      name: agent.frontmatter.name,
      description: agent.frontmatter.description,
      type: agent.frontmatter.mode === "subagent" ? "subagent" : "primary",
      systemPrompt: agent.systemPrompt,
    };

    // Model mapping
    if (agent.frontmatter.model) {
      config.model = this.mapOACModelToWindsurf(agent.frontmatter.model);
    }

    // Tools mapping
    if (agent.frontmatter.tools) {
      config.tools = this.mapOACToolsToWindsurf(agent.frontmatter.tools);
    }

    // Temperature → creativity
    if (agent.frontmatter.temperature !== undefined) {
      config.creativity = this.mapTemperatureToCreativity(
        agent.frontmatter.temperature
      );
    }

    // Category
    if (agent.metadata?.category) {
      config.category = agent.metadata.category;
    }

    // Contexts
    if (agent.contexts && agent.contexts.length > 0) {
      config.contexts = agent.contexts.map((ctx) => ({
        path: ctx.path,
        priority: this.mapOACPriorityToWindsurf(ctx.priority || "medium"),
        description: ctx.description,
      }));
    }

    // Skills → context references
    if (agent.frontmatter.skills && agent.frontmatter.skills.length > 0) {
      const skillContexts = agent.frontmatter.skills.map((skill) => {
        const skillName = typeof skill === "string" ? skill : skill.name;
        return {
          path: `.windsurf/context/${skillName}.md`,
          priority: "medium",
          description: `Skill: ${skillName}`,
        };
      });

      if (!config.contexts) {
        config.contexts = skillContexts;
      } else {
        (config.contexts as Array<unknown>).push(...skillContexts);
      }
    }

    // Permissions (simplified)
    if (agent.frontmatter.permission) {
      config.permissions = this.mapOACPermissionsToWindsurf(
        agent.frontmatter.permission,
        warnings
      );
    }

    return config;
  }

  // ============================================================================
  // MAPPING HELPERS
  // ============================================================================

  /**
   * Map Windsurf model ID to OAC model ID.
   */
  private mapWindsurfModelToOAC(model?: string): string | undefined {
    if (!model) return undefined;

    const modelMap: Record<string, string> = {
      "claude-4-sonnet": "claude-sonnet-4",
      "claude-4-opus": "claude-opus-4",
      "claude-4-haiku": "claude-haiku-4",
      "gpt-4": "gpt-4",
      "gpt-4-turbo": "gpt-4-turbo",
      "gpt-4o": "gpt-4o",
    };

    return modelMap[model] || model;
  }

  /**
   * Map OAC model ID to Windsurf model ID.
   */
  private mapOACModelToWindsurf(model: string): string {
    const modelMap: Record<string, string> = {
      "claude-sonnet-4": "claude-4-sonnet",
      "claude-opus-4": "claude-4-opus",
      "claude-haiku-4": "claude-4-haiku",
      "gpt-4": "gpt-4",
      "gpt-4-turbo": "gpt-4-turbo",
      "gpt-4o": "gpt-4o",
    };

    return modelMap[model] || "claude-4-sonnet"; // Default
  }

  /**
   * Map OAC ToolAccess to Windsurf tools object.
   */
  private mapOACToolsToWindsurf(
    tools: Record<string, boolean>
  ): Record<string, boolean> {
    // Windsurf uses binary on/off for tools
    const windsurfTools: Record<string, boolean> = {};

    for (const [tool, enabled] of Object.entries(tools)) {
      windsurfTools[tool] = Boolean(enabled);
    }

    return windsurfTools;
  }

  /**
   * Map OAC temperature to Windsurf creativity.
   */
  private mapTemperatureToCreativity(temperature: number): string {
    if (temperature <= 0.4) return "low";
    if (temperature <= 0.8) return "medium";
    return "high";
  }

  /**
   * Map OAC priority to Windsurf priority.
   */
  private mapOACPriorityToWindsurf(priority: string): string {
    const priorityMap: Record<string, string> = {
      critical: "high",
      high: "high",
      medium: "low",
      low: "low",
    };

    return priorityMap[priority.toLowerCase()] || "low";
  }

  /**
   * Map OAC granular permissions to Windsurf binary permissions.
   */
  private mapOACPermissionsToWindsurf(
    permissions: Record<string, unknown>,
    warnings: string[]
  ): Record<string, boolean> {
    const windsurfPerms: Record<string, boolean> = {};

    // Analyze each permission and convert to binary
    for (const [tool, perm] of Object.entries(permissions)) {
      if (typeof perm === "boolean") {
        windsurfPerms[tool] = perm;
      } else if (perm === "allow") {
        windsurfPerms[tool] = true;
      } else if (perm === "deny") {
        windsurfPerms[tool] = false;
      } else if (perm === "ask") {
        // "ask" → default to false (cautious approach)
        windsurfPerms[tool] = false;
        warnings.push(
          `⚠️  Permission "ask" for ${tool} degraded to false (deny). Windsurf only supports binary on/off.`
        );
      } else if (typeof perm === "object" && perm !== null) {
        // Granular permissions - default to true if any allow exists
        const permObj = perm as Record<string, unknown>;
        const hasAllow = permObj.allow !== undefined;
        windsurfPerms[tool] = hasAllow;
      } else {
        windsurfPerms[tool] = false;
      }
    }

    return windsurfPerms;
  }
}
