import { describe, it, expect, beforeEach } from "vitest";
import { WindsurfAdapter } from "../../../src/adapters/WindsurfAdapter";
import type { OpenAgent, AgentFrontmatter } from "../../../src/types";

/**
 * Unit tests for WindsurfAdapter with 80%+ coverage
 *
 * Test strategy:
 * 1. toOAC() - Parse Windsurf JSON to OpenAgent
 * 2. fromOAC() - Convert OpenAgent to Windsurf JSON
 * 3. getCapabilities() - Feature matrix validation
 * 4. validateConversion() - Validation and warnings
 * 5. Helper methods - Model/tool/creativity mapping
 * 6. Temperature ↔ Creativity mapping (WINDSURF-SPECIFIC)
 * 7. Priority mapping (critical→high, medium→low)
 * 8. Context and skill handling
 * 9. Edge cases and roundtrip
 */

describe("WindsurfAdapter", () => {
  let adapter: WindsurfAdapter;

  beforeEach(() => {
    adapter = new WindsurfAdapter();
  });

  // ============================================================================
  // ADAPTER IDENTITY
  // ============================================================================

  describe("adapter identity", () => {
    it("has correct name", () => {
      expect(adapter.name).toBe("windsurf");
    });

    it("has correct displayName", () => {
      expect(adapter.displayName).toBe("Windsurf");
    });

    it("returns correct config path", () => {
      expect(adapter.getConfigPath()).toBe(".windsurf/");
    });
  });

  // ============================================================================
  // CAPABILITIES
  // ============================================================================

  describe("getCapabilities()", () => {
    it("returns correct capabilities object", () => {
      const capabilities = adapter.getCapabilities();

      expect(capabilities.name).toBe("windsurf");
      expect(capabilities.displayName).toBe("Windsurf");
      expect(capabilities.supportsMultipleAgents).toBe(true);
      expect(capabilities.supportsSkills).toBe(true);
      expect(capabilities.supportsHooks).toBe(false);
      expect(capabilities.supportsGranularPermissions).toBe(false);
      expect(capabilities.supportsContexts).toBe(true);
      expect(capabilities.supportsCustomModels).toBe(true);
      expect(capabilities.supportsTemperature).toBe(true);
      expect(capabilities.supportsMaxSteps).toBe(false);
      expect(capabilities.configFormat).toBe("json");
      expect(capabilities.outputStructure).toBe("directory");
    });

    it("includes appropriate notes", () => {
      const capabilities = adapter.getCapabilities();

      expect(capabilities.notes).toBeDefined();
      expect(capabilities.notes && capabilities.notes.length > 0).toBe(true);
    });
  });

  // ============================================================================
  // toOAC() - PARSING WINDSURF JSON
  // ============================================================================

  describe("toOAC() - parsing Windsurf JSON", () => {
    it("parses minimal config", async () => {
      const source = JSON.stringify({
        name: "windsurf-agent",
        description: "Test agent",
        systemPrompt: "You are helpful",
      });

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.name).toBe("windsurf-agent");
      expect(result.frontmatter.description).toBe("Test agent");
      expect(result.systemPrompt).toBe("You are helpful");
      expect(result.frontmatter.mode).toBe("primary");
    });

    it("parses agent with model", async () => {
      const source = JSON.stringify({
        name: "agent",
        description: "Test",
        model: "gpt-4",
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.model).toBe("gpt-4");
    });

    it("parses agent with tools object", async () => {
      const source = JSON.stringify({
        name: "agent",
        description: "Test",
        tools: { read: true, write: true, bash: false },
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.tools).toEqual({
        read: true,
        write: true,
        bash: false,
      });
    });

    it("parses agent with tools array", async () => {
      const source = JSON.stringify({
        name: "agent",
        description: "Test",
        tools: ["read", "write", "bash"],
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.tools).toEqual({
        read: true,
        write: true,
        bash: true,
      });
    });

    it("parses agent with creativity setting", async () => {
      const source = JSON.stringify({
        name: "agent",
        description: "Test",
        creativity: "high",
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.temperature).toBe(1.0);
    });

    it("parses numeric creativity value", async () => {
      const source = JSON.stringify({
        name: "agent",
        description: "Test",
        creativity: 0.6,
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.temperature).toBe(0.6);
    });

    it("parses agent type (primary vs subagent)", async () => {
      const source = JSON.stringify({
        name: "agent",
        description: "Test",
        type: "subagent",
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.mode).toBe("subagent");
    });

    it("parses contexts", async () => {
      const source = JSON.stringify({
        name: "agent",
        description: "Test",
        contexts: [
          { path: "context1.md", priority: "high", description: "Important" },
          { path: "context2.md" },
        ],
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.contexts).toHaveLength(2);
      expect(result.contexts[0].path).toBe("context1.md");
      expect(result.contexts[0].priority).toBe("high");
    });

    it("parses contexts as string array", async () => {
      const source = JSON.stringify({
        name: "agent",
        description: "Test",
        contexts: ["context1.md", "context2.md"],
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.contexts).toHaveLength(2);
      expect(result.contexts[0].path).toBe("context1.md");
    });

    it("throws error on invalid JSON", async () => {
      const source = "not valid json";

      await expect(adapter.toOAC(source)).rejects.toThrow(
        "Invalid Windsurf config format"
      );
    });

    it("throws error on non-object JSON", async () => {
      const source = JSON.stringify("just a string");

      await expect(adapter.toOAC(source)).rejects.toThrow(
        "Invalid Windsurf config format"
      );
    });

    it("handles prompt field as fallback for systemPrompt", async () => {
      const source = JSON.stringify({
        name: "agent",
        description: "Test",
        prompt: "This is the prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.systemPrompt).toBe("This is the prompt");
    });

    it("prefers systemPrompt over prompt field", async () => {
      const source = JSON.stringify({
        name: "agent",
        description: "Test",
        systemPrompt: "System",
        prompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.systemPrompt).toBe("System");
    });

    it("uses category from config", async () => {
      const source = JSON.stringify({
        name: "agent",
        description: "Test",
        category: "specialist",
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.metadata.category).toBe("specialist");
    });

    it("defaults to core category", async () => {
      const source = JSON.stringify({
        name: "agent",
        description: "Test",
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.metadata.category).toBe("core");
    });
  });

  // ============================================================================
  // fromOAC() - GENERATING WINDSURF JSON
  // ============================================================================

  describe("fromOAC() - generating Windsurf config", () => {
    const createAgent = (overrides?: Partial<OpenAgent>): OpenAgent => ({
      frontmatter: {
        name: "test-agent",
        description: "A test agent",
        mode: "primary",
        ...overrides?.frontmatter,
      },
      metadata: {
        name: "test-agent",
        category: "core",
        type: "agent",
      },
      systemPrompt: "You are helpful",
      contexts: [],
      ...overrides,
    });

    it("converts agent to config.json file", async () => {
      const agent = createAgent();

      const result = await adapter.fromOAC(agent);

      expect(result.success).toBe(true);
      expect(result.configs).toHaveLength(1);
      expect(result.configs[0].fileName).toBe(".windsurf/config.json");
    });

    it("converts subagent to agents/{name}.json file", async () => {
      const agent = createAgent({
        frontmatter: {
          name: "test-agent",
          mode: "subagent",
        },
      });

      const result = await adapter.fromOAC(agent);

      expect(result.configs[0].fileName).toBe(".windsurf/agents/test-agent.json");
    });

    it("includes agent name and description", async () => {
      const agent = createAgent({
        frontmatter: {
          name: "analyzer",
          description: "Code analyzer",
        },
      });

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.name).toBe("analyzer");
      expect(config.description).toBe("Code analyzer");
    });

    it("includes system prompt", async () => {
      const agent = createAgent({
        systemPrompt: "You are a code reviewer",
      });

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.systemPrompt).toBe("You are a code reviewer");
    });

    it("maps model correctly", async () => {
      const agent = createAgent({
        frontmatter: {
          model: "gpt-4",
        },
      });

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.model).toBe("gpt-4");
    });

    it("includes type field (primary vs subagent)", async () => {
      const agent = createAgent({
        frontmatter: {
          mode: "subagent",
        },
      });

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.type).toBe("subagent");
    });

    it("maps temperature to creativity", async () => {
      const agent = createAgent({
        frontmatter: {
          temperature: 0.9,
        },
      });

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.creativity).toBe("high");
    });

    it("includes category from metadata", async () => {
      const agent = createAgent({
        metadata: {
          name: "agent",
          category: "specialist",
          type: "agent",
        },
      });

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.category).toBe("specialist");
    });

    it("warns on unsupported hooks", async () => {
      const agent = createAgent({
        frontmatter: {
          hooks: [{ event: "PreToolUse", commands: [{ type: "command", command: "log" }] }],
        },
      });

      const result = await adapter.fromOAC(agent);

      expect(result.warnings.some((w) => w.includes("hooks"))).toBe(true);
    });

    it("warns on unsupported maxSteps", async () => {
      const agent = createAgent({
        frontmatter: {
          maxSteps: 10,
        },
      });

      const result = await adapter.fromOAC(agent);

      expect(result.warnings.some((w) => w.includes("maxSteps"))).toBe(true);
    });

    it("warns on granular permissions", async () => {
      const agent = createAgent({
        frontmatter: {
          permission: {
            read: { "*.txt": "allow" },
          },
        },
      });

      const result = await adapter.fromOAC(agent);

      expect(result.warnings.some((w) => w.includes("granular"))).toBe(true);
    });

    it("warns on degraded skills", async () => {
      const agent = createAgent({
        frontmatter: {
          skills: ["skill1", "skill2"],
        },
      });

      const result = await adapter.fromOAC(agent);

      expect(result.warnings.some((w) => w.includes("skills"))).toBe(true);
    });

    it("maps skills to context references", async () => {
      const agent = createAgent({
        frontmatter: {
          skills: ["python-patterns", "typescript-tips"],
        },
      });

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.contexts).toBeDefined();
      expect(config.contexts.some((c: any) => c.path.includes("python-patterns"))).toBe(true);
    });

    it("includes tool access", async () => {
      const agent = createAgent({
        frontmatter: {
          tools: { read: true, write: true, bash: false },
        },
      });

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.tools).toEqual({ read: true, write: true, bash: false });
    });

    it("includes contexts with priority mapping", async () => {
      const agent = createAgent({
        contexts: [
          { path: "critical-context.md", priority: "critical" },
          { path: "medium-context.md", priority: "medium" },
        ],
      });

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.contexts).toHaveLength(2);
      // critical → high, medium → low
      expect(config.contexts[0].priority).toBe("high");
      expect(config.contexts[1].priority).toBe("low");
    });

    it("generates context warning", async () => {
      const agent = createAgent({
        contexts: [{ path: "context.md" }],
      });

      const result = await adapter.fromOAC(agent);

      expect(result.warnings.some((w) => w.includes("context"))).toBe(true);
    });

    it("maps permissions to binary on/off", async () => {
      const agent = createAgent({
        frontmatter: {
          permission: {
            read: "allow",
            write: "deny",
            bash: "ask",
          },
        },
      });

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.permissions.read).toBe(true);
      expect(config.permissions.write).toBe(false);
      expect(config.permissions.bash).toBe(false); // ask → false
    });
  });

  // ============================================================================
  // VALIDATION
  // ============================================================================

  describe("validateConversion()", () => {
    const createAgent = (overrides?: Partial<AgentFrontmatter>): OpenAgent => ({
      frontmatter: {
        name: "agent",
        description: "Test",
        mode: "primary",
        ...overrides,
      },
      metadata: { category: "core", type: "agent" },
      systemPrompt: "Prompt",
      contexts: [],
    });

    it("returns no warnings for valid agent", () => {
      const agent = createAgent();

      const warnings = adapter.validateConversion(agent);

      expect(warnings).toHaveLength(0);
    });

    it("warns when name is missing", () => {
      const agent = createAgent({ name: "" });

      const warnings = adapter.validateConversion(agent);

      expect(warnings.some((w) => w.includes("name"))).toBe(true);
    });

    it("warns when description is missing", () => {
      const agent = createAgent({ description: "" });

      const warnings = adapter.validateConversion(agent);

      expect(warnings.some((w) => w.includes("description"))).toBe(true);
    });
  });

  // ============================================================================
  // TEMPERATURE ↔ CREATIVITY MAPPING (WINDSURF-SPECIFIC)
  // ============================================================================

  describe("temperature to creativity mapping", () => {
    it("maps low temperature (0.3) to low creativity", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          description: "Test",
          mode: "primary",
          temperature: 0.3,
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.creativity).toBe("low");
    });

    it("maps medium temperature (0.6) to medium creativity", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          description: "Test",
          mode: "primary",
          temperature: 0.6,
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.creativity).toBe("medium");
    });

    it("maps high temperature (0.9) to high creativity", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          description: "Test",
          mode: "primary",
          temperature: 0.9,
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.creativity).toBe("high");
    });

    it("maps creativity low string to 0.3 temperature", async () => {
      const source = JSON.stringify({
        name: "agent",
        description: "Test",
        creativity: "low",
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.temperature).toBe(0.3);
    });

    it("maps creativity high string to 1.0 temperature", async () => {
      const source = JSON.stringify({
        name: "agent",
        description: "Test",
        creativity: "high",
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.temperature).toBe(1.0);
    });

    it("maps creativity balanced to 0.5 temperature", async () => {
      const source = JSON.stringify({
        name: "agent",
        description: "Test",
        creativity: "balanced",
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.temperature).toBe(0.5);
    });

    it("defaults to medium (0.7) for unknown creativity", async () => {
      const source = JSON.stringify({
        name: "agent",
        description: "Test",
        creativity: "unknown-value",
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.temperature).toBe(0.7);
    });

    it("handles boundary temperature 0.4", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          description: "Test",
          mode: "primary",
          temperature: 0.4,
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.creativity).toBe("low");
    });

    it("handles boundary temperature 0.8", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          description: "Test",
          mode: "primary",
          temperature: 0.8,
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.creativity).toBe("medium");
    });
  });

  // ============================================================================
  // PRIORITY MAPPING
  // ============================================================================

  describe("priority mapping (OAC → Windsurf)", () => {
    it("maps critical to high", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          description: "Test",
          mode: "primary",
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [{ path: "critical.md", priority: "critical" }],
      };

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.contexts[0].priority).toBe("high");
    });

    it("maps medium to low", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          description: "Test",
          mode: "primary",
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [{ path: "medium.md", priority: "medium" }],
      };

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.contexts[0].priority).toBe("low");
    });

    it("normalizes invalid priority to medium", async () => {
      const source = JSON.stringify({
        name: "agent",
        description: "Test",
        contexts: [{ path: "context.md", priority: "invalid" }],
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.contexts[0].priority).toBe("medium");
    });
  });

  // ============================================================================
  // MODEL MAPPING
  // ============================================================================

  describe("model mapping", () => {
    it("maps claude-4-sonnet to claude-sonnet-4", async () => {
      const source = JSON.stringify({
        name: "agent",
        description: "Test",
        model: "claude-4-sonnet",
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.model).toBe("claude-sonnet-4");
    });

    it("maps claude-4-opus to claude-opus-4", async () => {
      const source = JSON.stringify({
        name: "agent",
        description: "Test",
        model: "claude-4-opus",
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.model).toBe("claude-opus-4");
    });

    it("maps gpt-4 to gpt-4", async () => {
      const source = JSON.stringify({
        name: "agent",
        description: "Test",
        model: "gpt-4",
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.model).toBe("gpt-4");
    });

    it("preserves unknown models", async () => {
      const source = JSON.stringify({
        name: "agent",
        description: "Test",
        model: "custom-model",
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.model).toBe("custom-model");
    });

    it("maps claude-sonnet-4 back to claude-4-sonnet", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          description: "Test",
          mode: "primary",
          model: "claude-sonnet-4",
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.model).toBe("claude-4-sonnet");
    });

    it("defaults to claude-4-sonnet for unknown models", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          description: "Test",
          mode: "primary",
          model: "unknown-model",
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.model).toBe("claude-4-sonnet");
    });
  });

  // ============================================================================
  // TOOL MAPPING
  // ============================================================================

  describe("tool handling", () => {
    it("preserves tool boolean values", async () => {
      const source = JSON.stringify({
        name: "agent",
        description: "Test",
        tools: { read: true, write: false, bash: true },
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.tools).toEqual({
        read: true,
        write: false,
        bash: true,
      });
    });

    it("normalizes tools array to object", async () => {
      const source = JSON.stringify({
        name: "agent",
        description: "Test",
        tools: ["Read", "WRITE", "Bash"],
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.tools?.read).toBe(true);
      expect(result.frontmatter.tools?.write).toBe(true);
      expect(result.frontmatter.tools?.bash).toBe(true);
    });

    it("handles empty tools", async () => {
      const source = JSON.stringify({
        name: "agent",
        description: "Test",
        tools: {},
        systemPrompt: "Prompt",
      });

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.tools).toBeUndefined();
    });
  });

  // ============================================================================
  // PERMISSION MAPPING
  // ============================================================================

  describe("permission mapping", () => {
    it("maps allow to true", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          description: "Test",
          mode: "primary",
          permission: { read: "allow" },
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.permissions.read).toBe(true);
    });

    it("maps deny to false", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          description: "Test",
          mode: "primary",
          permission: { write: "deny" },
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.permissions.write).toBe(false);
    });

    it("maps ask to false with warning", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          description: "Test",
          mode: "primary",
          permission: { bash: "ask" },
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.permissions.bash).toBe(false);
      expect(result.warnings.some((w) => w.includes("ask"))).toBe(true);
    });

    it("handles boolean permissions", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          description: "Test",
          mode: "primary",
          permission: { read: true, write: false },
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.permissions.read).toBe(true);
      expect(config.permissions.write).toBe(false);
    });
  });

  // ============================================================================
  // ROUNDTRIP & EDGE CASES
  // ============================================================================

  describe("roundtrip conversion", () => {
    it("preserves agent properties through roundtrip", async () => {
      const original: OpenAgent = {
        frontmatter: {
          name: "roundtrip-agent",
          description: "Test roundtrip",
          mode: "primary",
          model: "gpt-4o",
          temperature: 0.7,
          tools: { read: true, write: true },
        },
        metadata: { name: "roundtrip-agent", category: "core", type: "agent" },
        systemPrompt: "Be helpful",
        contexts: [{ path: "context.md", priority: "high" }],
      };

      // Convert to Windsurf
      const windsurfResult = await adapter.fromOAC(original);
      const windsurfConfig = JSON.parse(windsurfResult.configs[0].content);

      // Convert back to OAC
      const backToOAC = await adapter.toOAC(JSON.stringify(windsurfConfig));

      expect(backToOAC.frontmatter.name).toBe("roundtrip-agent");
      expect(backToOAC.systemPrompt).toBe("Be helpful");
      expect(backToOAC.frontmatter.temperature).toBe(0.7);
    });
  });

  describe("edge cases", () => {
    it("handles empty system prompt", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          description: "Test",
          mode: "primary",
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: "",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);

      expect(result.success).toBe(true);
    });

    it("handles very long system prompt", async () => {
      const longPrompt = "A".repeat(5000);
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          description: "Test",
          mode: "primary",
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: longPrompt,
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.systemPrompt.length).toBe(5000);
    });

    it("handles special characters in names", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent-with-dashes_and_underscores",
          description: "Test",
          mode: "primary",
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.name).toBe("agent-with-dashes_and_underscores");
    });

    it("handles zero temperature", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          description: "Test",
          mode: "primary",
          temperature: 0,
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.creativity).toBe("low");
    });

    it("handles high temperature values", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          description: "Test",
          mode: "primary",
          temperature: 1.5,
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.creativity).toBe("high");
    });

    it("handles null contexts", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          description: "Test",
          mode: "primary",
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: null as any,
      };

      const result = await adapter.fromOAC(agent);

      expect(result.success).toBe(true);
    });

    it("handles undefined tools", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          description: "Test",
          mode: "primary",
          tools: undefined,
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      expect(config.tools).toBeUndefined();
    });

    it("combines contexts and skills", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          description: "Test",
          mode: "primary",
          skills: ["python-tips", "typescript-guide"],
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [{ path: "project-style.md", priority: "high" }],
      };

      const result = await adapter.fromOAC(agent);
      const config = JSON.parse(result.configs[0].content);

      // Should have 3 contexts: 1 original + 2 skills
      expect(config.contexts.length).toBe(3);
    });
  });

  // ============================================================================
  // CONVERSION RESULT STRUCTURE
  // ============================================================================

  describe("conversion result structure", () => {
    it("returns success true on valid conversion", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          description: "Test",
          mode: "primary",
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);

      expect(result.success).toBe(true);
    });

    it("includes capabilities in result", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          description: "Test",
          mode: "primary",
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);

      expect(result.capabilities).toBeDefined();
      expect(result.capabilities?.name).toBe("windsurf");
    });

    it("includes encoding in tool config", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          description: "Test",
          mode: "primary",
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);

      expect(result.configs[0].encoding).toBe("utf-8");
    });

    it("returns single config file per agent", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          description: "Test",
          mode: "primary",
          tools: { read: true, write: true },
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [{ path: "ctx1.md" }, { path: "ctx2.md" }],
      };

      const result = await adapter.fromOAC(agent);

      expect(result.configs).toHaveLength(1);
      expect(result.configs[0].fileName).toBe(".windsurf/config.json");
    });
  });
});
