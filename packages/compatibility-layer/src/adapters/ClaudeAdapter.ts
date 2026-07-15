import matter from "gray-matter";
import { dump } from "js-yaml";
import { BaseAdapter } from "./BaseAdapter.js";
import { projectToFlatTools, rulesFor, type ToolBinding } from "../core/Capabilities.js";
import { getToolCapabilities } from "../core/CapabilityMatrix.js";
import {
  CanonicalAgentSchema,
  desugarPermission,
  type AgentFrontmatter,
  type ConversionResult,
  type GranularPermission,
  type HookDefinition,
  type HookEvent,
  type OpenAgent,
  type SkillReference,
  type ToolCapabilities,
  type ToolConfig,
} from "../types.js";

/**
 * Claude Code adapter — emits the `plugins/claude-code/` plugin layout.
 *
 * Claude Code agents are one markdown file per agent under `plugins/claude-code/agents/`,
 * carrying flat YAML frontmatter:
 *
 * ```yaml
 * name: code-reviewer          # the canonical `oac.id`, NOT the authored display name
 * description: …
 * tools: Read, Glob, Grep
 * disallowedTools: Write, Edit, Bash, Task
 * model: sonnet
 * ```
 *
 * ## Why this is not `.claude/`
 *
 * This adapter previously emitted `.claude/config.json` + `.claude/agents/*.md`. The
 * `config.json` half was fabricated — Claude Code has no such agent-config file — and the
 * real target is the plugin tree that already ships in this repo. `plugins/claude-code/`
 * is therefore the only output root; `.claude/` appears nowhere in what this adapter emits.
 *
 * ## Permissions are NOT decided here
 *
 * Claude Code's frontmatter carries two flat lists and no scoping: no ordered globs, no
 * `ask`, no last-match-wins. Canonical agents rely on all three. Collapsing that safely is
 * a security decision, so it lives in exactly one place — {@link projectToFlatTools} in
 * `core/Capabilities.ts`, which fails CLOSED. This class contributes tool NAMING and
 * ORDERING only.
 *
 * Concretely, `PermissionMapper.mapPermissionsFromOAC` must never be used here: it defaults
 * to `strategy="permissive"` (`hasAllow || !hasDeny`), which answers `bash: true` for
 * coder-agent's deny-all-then-allowlist block and would hand Claude Code unrestricted Bash.
 *
 * @see https://code.claude.com/docs/en/sub-agents
 */
export class ClaudeAdapter extends BaseAdapter {
  readonly name = "claude";
  readonly displayName = "Claude Code";

  constructor() {
    super();
  }

  // ============================================================================
  // CANONICAL EMISSION (fromCanonical) — the `oac build` path
  // ============================================================================

  /**
   * Emit one canonical agent file as its Claude Code plugin agent file.
   *
   * `async` rather than a plain `Promise` return so a malformed source REJECTS instead of
   * throwing synchronously — a caller doing `adapter.fromCanonical(x).catch(…)` must not be
   * bypassed by the parse failing before the promise is ever constructed.
   *
   * @param source raw canonical `.md` — OpenCode-legal frontmatter plus the `oac:` block
   * @returns the emitted path, its exact bytes, and one warning per semantic actually lost
   * @throws {Error} if the source does not parse against {@link CanonicalAgentSchema}
   */
  async fromCanonical(source: string): Promise<ClaudeEmission> {
    const parsed = CanonicalAgentSchema.safeParse(structuredClone(matter(source).data));

    if (!parsed.success) {
      throw new Error(
        `ClaudeAdapter: source is not a canonical agent file: ${parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
          .join("; ")}`
      );
    }

    const agent = parsed.data;
    const warnings: string[] = [];
    const body = matter(source).content.trim();

    const frontmatter = this.buildAgentFrontmatter(
      {
        name: agent.oac.id,
        description: agent.description,
        model: agent.model,
        temperature: agent.temperature,
        maxSteps: agent.maxSteps,
        permission: agent.permission,
      },
      warnings
    );

    return {
      path: this.agentPath(agent.oac.id),
      content: `---\n${frontmatter}---\n\n${body}\n`,
      warnings,
    };
  }

  /**
   * Where a canonical id lands in the plugin tree.
   *
   * Keyed by `oac.id`, never by source filename or display name: the canonical ids and the
   * Claude Code filenames genuinely differ (`contextscout` → `context-scout.md`,
   * `reviewer` → `code-reviewer.md`, `tester` → `test-engineer.md`), and only the id is
   * stable identity.
   */
  agentPath(id: string): string {
    return `plugins/claude-code/agents/${id}.md`;
  }

  // ============================================================================
  // CONVERSION METHODS (legacy OpenAgent interface)
  // ============================================================================

  /**
   * Convert Claude Code format TO OpenAgents Control format.
   *
   * This is the IMPORT direction — it ingests whatever a user already has, including the
   * older `.claude/` shapes, so it deliberately still accepts `config.json`. Nothing here
   * decides where output is written.
   *
   * @param source Claude agent markdown, or a legacy `config.json`
   */
  toOAC(source: string): Promise<OpenAgent> {
    if (source.trim().startsWith("{")) {
      return Promise.resolve(this.parseClaudeConfig(source));
    }

    return Promise.resolve(this.parseClaudeAgent(source));
  }

  /**
   * Convert FROM an in-memory OpenAgent to the Claude Code plugin layout.
   *
   * Every agent — primary or subagent — emits exactly one
   * `plugins/claude-code/agents/{name}.md`. The old primary/subagent split existed only to
   * choose between `config.json` and an agent file; with `config.json` gone there is one
   * shape, which is what Claude Code actually reads.
   */
  fromOAC(agent: OpenAgent): Promise<ConversionResult> {
    const warnings: string[] = [...this.validateConversion(agent)];
    const configs: ToolConfig[] = [];

    const frontmatter = this.buildAgentFrontmatter(
      {
        name: agent.frontmatter.name,
        description: agent.frontmatter.description,
        model: agent.frontmatter.model,
        temperature: agent.frontmatter.temperature,
        maxSteps: agent.frontmatter.maxSteps,
        permission: agent.frontmatter.permission
          ? desugarPermission(agent.frontmatter.permission)
          : undefined,
        tools: agent.frontmatter.tools,
      },
      warnings
    );

    configs.push({
      fileName: this.agentPath(agent.frontmatter.name),
      content: `---\n${frontmatter}---\n\n${agent.systemPrompt.trim()}\n`,
      encoding: "utf-8",
    });

    if (agent.contexts && agent.contexts.length > 0) {
      configs.push(...this.generateSkillsFromContexts(agent.contexts));
    }

    return Promise.resolve(this.createSuccessResult(configs, warnings));
  }

  /**
   * Get the configuration root for Claude Code.
   */
  getConfigPath(): string {
    return "plugins/claude-code/";
  }

  /**
   * Get Claude Code capabilities.
   *
   * Delegates to the {@link getToolCapabilities} matrix rather than restating it: the two
   * previously disagreed (the matrix called Claude `json`, this class called it `markdown`),
   * and a platform cannot have two answers about itself. The matrix is the single row set;
   * only the prose notes are added here.
   */
  getCapabilities(): ToolCapabilities {
    return {
      ...getToolCapabilities("claude"),
      displayName: this.displayName,
      notes: [
        "Agents emit to plugins/claude-code/agents/<id>.md — one flat markdown file each",
        "Permissions are two flat lists (tools/disallowedTools) — ordered rules, path globs " +
          "and 'ask' have no equivalent and degrade fail-closed to disallowedTools",
        "Temperature and maxSteps are not expressible in agent frontmatter",
        "Skills provide context injection similar to OAC contexts",
      ],
    };
  }

  /**
   * Validate if an agent can be converted with full fidelity.
   *
   * Reports only what this adapter can see without projecting permissions; the lossy
   * permission detail comes from {@link projectToFlatTools} at emit time, so it is not
   * duplicated (and cannot drift) here.
   */
  validateConversion(agent: OpenAgent): string[] {
    const warnings: string[] = [];

    if (!agent.frontmatter.name) {
      warnings.push("⚠️  Agent name is required for Claude Code");
    }

    if (!agent.frontmatter.description) {
      warnings.push("⚠️  Agent description is required for Claude Code");
    }

    if (agent.frontmatter.permission) {
      const hasGranularPerms = Object.values(agent.frontmatter.permission).some(
        (perm) => typeof perm === "object" && !Array.isArray(perm)
      );

      if (hasGranularPerms) {
        warnings.push(
          this.degradedFeatureWarning(
            "granular permissions",
            "ordered allow/deny/ask rules per operation",
            "flat tools/disallowedTools lists (fail-closed)"
          )
        );
      }
    }

    return warnings;
  }

  // ============================================================================
  // GENERATION HELPERS
  // ============================================================================

  /**
   * Build the YAML frontmatter block shared by both emit paths.
   *
   * Key order is fixed (`name, description, tools, disallowedTools, model`) to match the
   * committed corpus and to keep output deterministic — it must never depend on the source's
   * own key order.
   */
  private buildAgentFrontmatter(input: ClaudeAgentInput, warnings: string[]): string {
    const lines = [
      yamlLine("name", input.name),
      yamlLine("description", input.description),
    ];

    const { tools, disallowedTools } = this.resolveTools(input, warnings);

    if (tools.length > 0) lines.push(yamlLine("tools", tools.join(", ")));
    if (disallowedTools.length > 0) {
      lines.push(yamlLine("disallowedTools", disallowedTools.join(", ")));
    }
    if (input.model) lines.push(yamlLine("model", input.model));

    if (input.temperature !== undefined) {
      warnings.push(this.unsupportedFeatureWarning("temperature", input.temperature));
    }
    if (input.maxSteps !== undefined) {
      warnings.push(this.unsupportedFeatureWarning("maxSteps", input.maxSteps));
    }

    return lines.join("");
  }

  /**
   * Decide which Claude Code tools an agent gets, and which it is explicitly denied.
   *
   * The allow/deny decision is entirely {@link projectToFlatTools}'s; this method only picks
   * which tools are in play and hands back the two lists in {@link CLAUDE_TOOL_BINDINGS}
   * order.
   */
  private resolveTools(
    input: ClaudeAgentInput,
    warnings: string[]
  ): { tools: string[]; disallowedTools: string[] } {
    if (input.permission) {
      const bindings = CLAUDE_TOOL_BINDINGS.filter(
        (binding) => rulesFor(input.permission!, binding.capability).length > 0
      );

      warnings.push(...unmappableCapabilityWarnings(input.permission));

      const projection = projectToFlatTools(input.permission, bindings, {
        target: "Claude Code",
      });

      warnings.push(...projection.warnings);
      return { tools: projection.tools, disallowedTools: projection.disallowedTools };
    }

    // No permission block: fall back to the authored `tools:` on/off map, which carries no
    // scoping to lose and therefore needs no projection.
    if (input.tools) {
      const enabled = new Set(
        Object.entries(input.tools)
          .filter(([, on]) => on)
          .map(([tool]) => tool)
      );

      return {
        tools: CLAUDE_TOOL_BINDINGS.filter((b) => enabled.has(b.capability)).map((b) => b.tool),
        disallowedTools: [],
      };
    }

    return { tools: [], disallowedTools: [] };
  }

  /**
   * Generate Skills from OAC contexts.
   *
   * Phase 1 does not wire this into `oac build` (agents only) — the path is kept so the
   * `oac-compat convert` CLI keeps working.
   */
  private generateSkillsFromContexts(
    contexts: Array<{ path: string; priority?: string; description?: string }>
  ): ToolConfig[] {
    return contexts.map((ctx) => {
      const skillName =
        ctx.path
          .split("/")
          .pop()
          ?.replace(/\.md$/, "")
          .toLowerCase()
          .replace(/\s+/g, "-") || "context-skill";

      const skillContent = `---
name: ${skillName}
description: ${ctx.description || `Context from ${ctx.path}`}
---

# ${skillName}

This skill provides context from: \`${ctx.path}\`

Priority: ${ctx.priority || "medium"}

Load the full context file for detailed information:
\`\`\`bash
cat ${ctx.path}
\`\`\`
`;

      return {
        fileName: `plugins/claude-code/skills/${skillName}/SKILL.md`,
        content: skillContent,
        encoding: "utf-8" as const,
      };
    });
  }

  // ============================================================================
  // PARSING HELPERS (toOAC)
  // ============================================================================

  /**
   * Parse a legacy Claude config.json to OpenAgent.
   */
  private parseClaudeConfig(source: string): OpenAgent {
    const config = this.safeParseJSON(source, "config.json");
    if (!config || typeof config !== "object") {
      throw new Error("Invalid Claude config.json format");
    }

    const claudeConfig = config as Record<string, unknown>;

    const frontmatter: AgentFrontmatter = {
      name: String(claudeConfig.name || "unnamed"),
      description: String(claudeConfig.description || ""),
      mode: "primary",
      model: this.mapClaudeModelToOAC(claudeConfig.model as string),
      tools: this.parseClaudeTools(claudeConfig.tools),
      skills: this.parseClaudeSkills(claudeConfig.skills),
      hooks: this.parseClaudeHooks(claudeConfig.hooks),
    };

    return {
      frontmatter,
      metadata: {
        name: frontmatter.name,
        category: "core",
        type: "agent",
      },
      systemPrompt: String(claudeConfig.systemPrompt || ""),
      contexts: [],
    };
  }

  /**
   * Parse a Claude agent markdown file to OpenAgent.
   */
  private parseClaudeAgent(source: string): OpenAgent {
    const { frontmatter, body } = this.parseFrontmatter(source);

    const agentFrontmatter: AgentFrontmatter = {
      name: String(frontmatter.name || "unnamed"),
      description: String(frontmatter.description || ""),
      mode: "subagent",
      model: this.mapClaudeModelToOAC(frontmatter.model as string | undefined),
      tools: this.parseClaudeTools(frontmatter.tools),
      skills: this.parseClaudeSkills(frontmatter.skills),
      hooks: this.parseClaudeHooks(frontmatter.hooks),
    };

    return {
      frontmatter: agentFrontmatter,
      metadata: {
        name: agentFrontmatter.name,
        category: "specialist",
        type: "subagent",
      },
      systemPrompt: body.trim(),
      contexts: [],
    };
  }

  /**
   * Parse YAML frontmatter from markdown.
   */
  private parseFrontmatter(content: string): {
    frontmatter: Record<string, unknown>;
    body: string;
  } {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) {
      return { frontmatter: {}, body: content };
    }

    const yamlContent = match[1] || "";
    const body = match[2] || "";

    // Simple YAML parser (supports basic key: value format)
    const frontmatter: Record<string, unknown> = {};
    yamlContent.split("\n").forEach((line) => {
      const colonIndex = line.indexOf(":");
      if (colonIndex > -1) {
        const key = line.slice(0, colonIndex).trim();
        let value: unknown = line.slice(colonIndex + 1).trim();

        // Parse arrays: [item1, item2]
        if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
          value = value
            .slice(1, -1)
            .split(",")
            .map((v) => v.trim().replace(/"/g, ""));
        }

        frontmatter[key] = value;
      }
    });

    return { frontmatter, body };
  }

  // ============================================================================
  // MAPPING HELPERS
  // ============================================================================

  /**
   * Map Claude model ID to OAC model ID.
   */
  private mapClaudeModelToOAC(model?: string): string | undefined {
    if (!model) return undefined;

    const modelMap: Record<string, string> = {
      "claude-sonnet-4-20250514": "claude-sonnet-4",
      "claude-opus-4": "claude-opus-4",
      "claude-haiku-4": "claude-haiku-4",
      sonnet: "claude-sonnet-4",
      opus: "claude-opus-4",
      haiku: "claude-haiku-4",
    };

    return modelMap[model] || model;
  }

  /**
   * Parse Claude tools to OAC ToolAccess.
   */
  private parseClaudeTools(tools: unknown): Record<string, boolean> | undefined {
    if (!tools) return undefined;

    const toolAccess: Record<string, boolean> = {};

    if (typeof tools === "string") {
      tools.split(",").forEach((tool) => {
        toolAccess[tool.trim().toLowerCase()] = true;
      });
    } else if (Array.isArray(tools)) {
      tools.forEach((tool) => {
        toolAccess[String(tool).toLowerCase()] = true;
      });
    }

    return Object.keys(toolAccess).length > 0 ? toolAccess : undefined;
  }

  /**
   * Parse Claude skills to OAC SkillReference array.
   */
  private parseClaudeSkills(skills: unknown): SkillReference[] | undefined {
    if (!skills) return undefined;

    if (typeof skills === "string") {
      return skills.split(",").map((s) => s.trim());
    }

    if (Array.isArray(skills)) {
      return skills.map((s) => String(s));
    }

    return undefined;
  }

  /**
   * Parse Claude hooks to OAC HookDefinition array.
   */
  private parseClaudeHooks(hooks: unknown): HookDefinition[] | undefined {
    if (!hooks || typeof hooks !== "object") return undefined;

    const hookDefinitions: HookDefinition[] = [];
    const hooksObj = hooks as Record<string, unknown>;

    for (const [event, hookList] of Object.entries(hooksObj)) {
      if (!Array.isArray(hookList)) continue;

      hookList.forEach((hook) => {
        if (typeof hook === "object" && hook !== null) {
          const hookObj = hook as Record<string, unknown>;
          hookDefinitions.push({
            event: event as HookEvent,
            matchers: hookObj.matcher ? [String(hookObj.matcher)] : undefined,
            commands: hookObj.hooks
              ? (hookObj.hooks as Array<{ type: "command"; command: string }>)
              : [],
          });
        }
      });
    }

    return hookDefinitions.length > 0 ? hookDefinitions : undefined;
  }
}

// ============================================================================
// Module-private helpers
// ============================================================================

/** What {@link ClaudeAdapter.fromCanonical} produces for one agent. */
export interface ClaudeEmission {
  /** Repo-relative destination, e.g. `plugins/claude-code/agents/code-reviewer.md`. */
  path: string;
  /** The exact bytes to write. */
  content: string;
  /** One entry per semantic that could not be carried. Empty means a lossless projection. */
  warnings: string[];
}

/** The frontmatter inputs both emit paths share. */
interface ClaudeAgentInput {
  name: string;
  description: string;
  model?: string;
  temperature?: number;
  maxSteps?: number;
  permission?: GranularPermission;
  tools?: Record<string, boolean | undefined>;
}

/**
 * Claude Code's tool names bound to the canonical capability governing each, **in the order
 * they are emitted**.
 *
 * The order is not a preference — it is recovered from the 7 committed agents in
 * `plugins/claude-code/agents/`. All 10 of their `tools:`/`disallowedTools:` lists are
 * consistent with it, and it is the only total order that is: alphabetical is refuted by
 * `context-manager.md` (`Read, Write, Glob, Grep, Bash`), and so is `ToolAccessSchema` field
 * order (which would put Bash before Glob/Grep). Changing it silently breaks reproduction of
 * every committed agent.
 */
const CLAUDE_TOOL_BINDINGS: readonly ToolBinding[] = [
  { tool: "Read", capability: "read" },
  { tool: "Write", capability: "write" },
  { tool: "Edit", capability: "edit" },
  { tool: "Glob", capability: "glob" },
  { tool: "Grep", capability: "grep" },
  { tool: "Bash", capability: "bash" },
  { tool: "WebFetch", capability: "webfetch" },
  { tool: "Task", capability: "task" },
];

/** Capabilities that bind to a Claude Code tool. Anything else cannot be carried. */
const MAPPED_CAPABILITIES = new Set(CLAUDE_TOOL_BINDINGS.map((binding) => binding.capability));

/**
 * Warn for each authored capability Claude Code has no tool for.
 *
 * Silence here would be a real loss: `externalscout`'s `skill: { "*": deny, "*context7*":
 * allow }` restricts which skills it may invoke, and Claude Code cannot express that at all.
 * Dropping it without a word is exactly the class of silent widening this adapter exists to
 * prevent. Wildcard capabilities are skipped — they bind to every tool, so nothing is lost.
 */
function unmappableCapabilityWarnings(permissions: GranularPermission): string[] {
  return permissions
    .filter(
      (entry) =>
        !MAPPED_CAPABILITIES.has(entry.capability) &&
        !entry.capability.includes("*") &&
        entry.rules.length > 0
    )
    .map(
      (entry) =>
        `⚠️  Permission '${entry.capability}' has no Claude Code tool: ` +
        `${entry.rules.length} rule(s) are dropped because Claude Code exposes no tool this ` +
        `capability maps to. Claude Code will not enforce them.`
    );
}

/**
 * Render one frontmatter line, letting js-yaml decide the scalar style.
 *
 * Delegating quoting is deliberate: a hand-rolled `key: "value"` either over-quotes (the
 * committed corpus uses plain scalars) or breaks on a description containing `: `, `#` or a
 * leading `*`. js-yaml also renders a value with a trailing newline as a `|` block scalar
 * and one without as `|-`, which is precisely the distinction the committed multi-line
 * descriptions rely on.
 */
function yamlLine(key: string, value: string): string {
  return `${key}: ${dump(value, { lineWidth: -1 }).trimEnd()}\n`;
}
