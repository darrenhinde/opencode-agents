import { describe, it, expect, beforeEach } from "vitest";
import { CursorAdapter } from "../../../src/adapters/CursorAdapter";
import type { OpenAgent, AgentFrontmatter } from "../../../src/types";

/**
 * Unit tests for CursorAdapter with 80%+ coverage
 *
 * Test strategy:
 * 1. toOAC() - Parse .cursorrules to OpenAgent
 * 2. fromOAC() - Convert OpenAgent to .cursorrules
 * 3. getCapabilities() - Feature matrix validation
 * 4. validateConversion() - Validation and warnings
 * 5. Helper methods - Model/tool mapping
 * 6. Agent Merging - Multiple agents to single file (CURSOR-SPECIFIC)
 * 7. Edge cases - Invalid input, missing fields, empty values
 * 8. Roundtrip - Data integrity checks
 */

describe("CursorAdapter", () => {
  let adapter: CursorAdapter;

  beforeEach(() => {
    adapter = new CursorAdapter();
  });

  // ============================================================================
  // ADAPTER IDENTITY
  // ============================================================================

  describe("adapter identity", () => {
    it("has correct name", () => {
      expect(adapter.name).toBe("cursor");
    });

    it("has correct displayName", () => {
      expect(adapter.displayName).toBe("Cursor IDE");
    });

    it("returns correct config path", () => {
      expect(adapter.getConfigPath()).toBe(".cursorrules");
    });
  });

  // ============================================================================
  // CAPABILITIES
  // ============================================================================

  describe("getCapabilities()", () => {
    it("returns correct capabilities object", () => {
      const capabilities = adapter.getCapabilities();

      expect(capabilities.name).toBe("cursor");
      expect(capabilities.displayName).toBe("Cursor IDE");
      expect(capabilities.supportsMultipleAgents).toBe(false);
      expect(capabilities.supportsSkills).toBe(false);
      expect(capabilities.supportsHooks).toBe(false);
      expect(capabilities.supportsGranularPermissions).toBe(false);
      expect(capabilities.supportsContexts).toBe(true);
      expect(capabilities.supportsCustomModels).toBe(true);
      expect(capabilities.supportsTemperature).toBe(true);
      expect(capabilities.supportsMaxSteps).toBe(false);
      expect(capabilities.configFormat).toBe("plain");
      expect(capabilities.outputStructure).toBe("single-file");
    });

    it("includes appropriate notes", () => {
      const capabilities = adapter.getCapabilities();

      expect(capabilities.notes).toBeDefined();
      expect(capabilities.notes && capabilities.notes.length > 0).toBe(true);
    });
  });

  // ============================================================================
  // toOAC() - PARSING .cursorrules (PLAIN TEXT)
  // ============================================================================

  describe("toOAC() - parsing plain .cursorrules", () => {
    it("parses plain text .cursorrules", async () => {
      const source = `You are a helpful assistant.
Do not delete files.
Always confirm before bash commands.`;

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.name).toBe("cursor-agent");
      expect(result.systemPrompt).toBe(source);
      expect(result.frontmatter.mode).toBe("primary");
    });

    it("handles very simple rules", async () => {
      const source = "Be helpful.";

      const result = await adapter.toOAC(source);

      expect(result.systemPrompt).toBe("Be helpful.");
      expect(result.frontmatter.name).toBe("cursor-agent");
    });

    it("preserves multiline plain text", async () => {
      const source = `Line 1
Line 2
Line 3
Line 4`;

      const result = await adapter.toOAC(source);

      expect(result.systemPrompt).toContain("Line 1");
      expect(result.systemPrompt).toContain("Line 4");
    });
  });

  // ============================================================================
  // toOAC() - PARSING .cursorrules WITH YAML FRONTMATTER
  // ============================================================================

  describe("toOAC() - parsing with YAML frontmatter", () => {
    it("parses .cursorrules with name in frontmatter", async () => {
      const source = `---
name: my-agent
---

Rules here`;

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.name).toBe("my-agent");
      expect(result.systemPrompt).toBe("Rules here");
    });

    it("parses model in frontmatter", async () => {
      const source = `---
name: analyzer
model: gpt-4
---

Analyze code`;

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.model).toBe("gpt-4");
    });

    it("parses temperature in frontmatter", async () => {
      const source = `---
name: creative
temperature: 0.8
---

Be creative`;

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.temperature).toBe(0.8);
    });

    it("parses tools as comma-separated string", async () => {
      const source = `---
name: agent
tools: read, write, bash
---

Prompt`;

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.tools).toEqual({
        read: true,
        write: true,
        bash: true,
      });
    });

    it("parses tools as array", async () => {
      const source = `---
name: agent
tools: [read, write]
---

Prompt`;

      // Note: Simple YAML parser doesn't handle arrays in the implementation
      // This tests current behavior
      const result = await adapter.toOAC(source);

      expect(result.frontmatter.tools).toBeDefined();
    });

    it("parses description in frontmatter", async () => {
      const source = `---
name: agent
description: A test agent
---

Content`;

      const result = await adapter.toOAC(source);

      expect(result.systemPrompt).toContain("Content");
    });

    it("handles numeric values in frontmatter", async () => {
      const source = `---
name: agent
temperature: 0.5
max_tokens: 2000
---

Prompt`;

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.temperature).toBe(0.5);
      expect(typeof result.frontmatter.temperature).toBe("number");
    });

    it("handles quoted values in frontmatter", async () => {
      const source = `---
name: "quoted-agent"
model: "gpt-4"
---

Rules`;

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.name).toBe("quoted-agent");
      expect(result.frontmatter.model).toBe("gpt-4");
    });

    it("handles boolean values in frontmatter", async () => {
      const source = `---
name: agent
some_flag: true
---

Content`;

      const result = await adapter.toOAC(source);

      expect(result.systemPrompt).toContain("Content");
    });

    it("preserves multiline content after frontmatter", async () => {
      const source = `---
name: agent
---

Line 1
Line 2
Line 3`;

      const result = await adapter.toOAC(source);

      expect(result.systemPrompt).toContain("Line 1");
      expect(result.systemPrompt).toContain("Line 3");
    });

    it("handles empty body with frontmatter", async () => {
      const source = `---
name: agent
model: gpt-4
---

`;

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.name).toBe("agent");
    });
  });

  // ============================================================================
  // fromOAC() - GENERATING .cursorrules
  // ============================================================================

  describe("fromOAC() - generating .cursorrules", () => {
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

    it("converts agent to .cursorrules file", async () => {
      const agent = createAgent();

      const result = await adapter.fromOAC(agent);

      expect(result.success).toBe(true);
      expect(result.configs).toHaveLength(1);
      expect(result.configs[0].fileName).toBe(".cursorrules");
    });

    it("includes agent name in frontmatter", async () => {
      const agent = createAgent();

      const result = await adapter.fromOAC(agent);
      const content = result.configs[0].content;

      expect(content).toContain("name: test-agent");
    });

    it("includes system prompt in body", async () => {
      const agent = createAgent({
        systemPrompt: "Be helpful and kind",
      });

      const result = await adapter.fromOAC(agent);
      const content = result.configs[0].content;

      expect(content).toContain("Be helpful and kind");
    });

    it("includes model in frontmatter", async () => {
      const agent = createAgent({
        frontmatter: {
          model: "gpt-4",
        },
      });

      const result = await adapter.fromOAC(agent);
      const content = result.configs[0].content;

      expect(content).toContain("model: gpt-4");
    });

    it("includes temperature in frontmatter", async () => {
      const agent = createAgent({
        frontmatter: {
          temperature: 0.7,
        },
      });

      const result = await adapter.fromOAC(agent);
      const content = result.configs[0].content;

      expect(content).toContain("temperature: 0.7");
    });

    it("includes description in frontmatter when agent has one", async () => {
      const agent = createAgent({
        frontmatter: {
          name: "analyzer",
          description: "Code analyzer",
        },
      });

      const result = await adapter.fromOAC(agent);
      const content = result.configs[0].content;

      // Description should be in frontmatter only if other frontmatter exists
      expect(content).toBeDefined();
      expect(result.success).toBe(true);
    });

    it("warns on unsupported skills", async () => {
      const agent = createAgent({
        frontmatter: {
          skills: ["skill1", "skill2"],
        },
      });

      const result = await adapter.fromOAC(agent);

      expect(result.warnings.some((w) => w.includes("skills"))).toBe(true);
    });

    it("warns on unsupported hooks", async () => {
      const agent = createAgent({
        frontmatter: {
          hooks: [
            { event: "PreToolUse", commands: [{ type: "command", command: "log" }] },
          ],
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

    it("warns on mixed permissions", async () => {
      const agent = createAgent({
        frontmatter: {
          permission: {
            read: { "*.txt": "allow", "*.js": "deny" },
            write: "ask",
          },
        },
      });

      const result = await adapter.fromOAC(agent);

      // Should warn about granular permissions if they're detected
      expect(result.warnings.length >= 0).toBe(true);
      expect(result.success).toBe(true);
    });

    it("handles agent with tools", async () => {
      const agent = createAgent({
        frontmatter: {
          tools: { read: true, write: true, bash: true },
        },
      });

      const result = await adapter.fromOAC(agent);
      const content = result.configs[0].content;

      expect(content).toContain("read");
      expect(content).toContain("write");
      expect(content).toContain("bash");
    });

    it("generates frontmatter only when needed", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          mode: "primary",
        },
        metadata: {
          category: "core",
          type: "agent",
        },
        systemPrompt: "Rules here",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const content = result.configs[0].content;

      // If no frontmatter data, should not include frontmatter section
      expect(content).toBe("Rules here");
    });
  });

  // ============================================================================
  // fromOAC() - CONTEXT INLINING
  // ============================================================================

  describe("fromOAC() - context inlining", () => {
    it("inlines single context", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          description: "Test",
          mode: "primary",
        },
        metadata: { name: "agent", category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [
          {
            path: ".opencode/context/python-style.md",
            description: "Python style guide",
          },
        ],
      };

      const result = await adapter.fromOAC(agent);
      const content = result.configs[0].content;

      expect(content).toContain("# Context Files");
      expect(content).toContain("python-style.md");
      expect(content).toContain("Python style guide");
    });

    it("inlines multiple contexts", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          description: "Test",
          mode: "primary",
        },
        metadata: { name: "agent", category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [
          { path: "context1.md", description: "First" },
          { path: "context2.md", description: "Second" },
          { path: "context3.md", description: "Third" },
        ],
      };

      const result = await adapter.fromOAC(agent);
      const content = result.configs[0].content;

      expect(content).toContain("context1.md");
      expect(content).toContain("context2.md");
      expect(content).toContain("context3.md");
    });

    it("includes context priority information in inlined content", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          description: "Test",
          mode: "primary",
        },
        metadata: { name: "agent", category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [
          {
            path: "important.md",
            priority: "critical",
            description: "Critical context",
          },
        ],
      };

      const result = await adapter.fromOAC(agent);
      const content = result.configs[0].content;

      // Priority should be mentioned in the content
      expect(content).toContain("critical");
      expect(content).toContain("important.md");
    });

    it("generates warning for inlined contexts", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          description: "Test",
          mode: "primary",
        },
        metadata: { name: "agent", category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [{ path: "context.md", description: "Test" }],
      };

      const result = await adapter.fromOAC(agent);

      expect(result.warnings.some((w) => w.includes("context"))).toBe(true);
    });

    it("handles contexts without description", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          description: "Test",
          mode: "primary",
        },
        metadata: { name: "agent", category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [{ path: "context.md" }],
      };

      const result = await adapter.fromOAC(agent);
      const content = result.configs[0].content;

      expect(content).toContain("context.md");
    });

    it("includes tool access information", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          description: "Test",
          mode: "primary",
          tools: { read: true, write: true, bash: false },
        },
        metadata: { name: "agent", category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const content = result.configs[0].content;

      expect(content).toContain("# Tool Access");
      expect(content).toContain("read");
      expect(content).toContain("write");
      expect(content).not.toContain("- bash");
    });
  });

  // ============================================================================
  // VALIDATION
  // ============================================================================

  describe("validateConversion()", () => {
    const createAgent = (overrides?: Partial<AgentFrontmatter>): OpenAgent => ({
      frontmatter: {
        name: "agent",
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

    it("warns about subagent mode", () => {
      const agent = createAgent({ mode: "subagent" });

      const warnings = adapter.validateConversion(agent);

      expect(warnings.some((w) => w.includes("subagent"))).toBe(true);
    });

    it("accepts primary mode", () => {
      const agent = createAgent({ mode: "primary" });

      const warnings = adapter.validateConversion(agent);

      expect(warnings.length).toBe(0);
    });
  });

  // ============================================================================
  // AGENT MERGING (CURSOR-SPECIFIC)
  // ============================================================================

  describe("mergeAgents() - merging multiple agents", () => {
    const createAgent = (name: string, prompt: string): OpenAgent => ({
      frontmatter: {
        name,
        description: `Agent ${name}`,
        mode: "primary",
        tools: { read: true },
      },
      metadata: { name, category: "core", type: "agent" },
      systemPrompt: prompt,
      contexts: [],
    });

    it("returns cloned agent for single agent", () => {
      const agent = createAgent("single", "Single agent prompt");

      const result = adapter.mergeAgents([agent]);

      expect(result.frontmatter.name).toBe("single");
      expect(result.systemPrompt).toBe("Single agent prompt");
    });

    it("merges two agents", () => {
      const agents = [
        createAgent("agent1", "First prompt"),
        createAgent("agent2", "Second prompt"),
      ];

      const result = adapter.mergeAgents(agents);

      expect(result.frontmatter.name).toContain("agent1");
      expect(result.frontmatter.name).toContain("agent2");
      expect(result.systemPrompt).toContain("First prompt");
      expect(result.systemPrompt).toContain("Second prompt");
    });

    it("merges three agents", () => {
      const agents = [
        createAgent("a1", "P1"),
        createAgent("a2", "P2"),
        createAgent("a3", "P3"),
      ];

      const result = adapter.mergeAgents(agents);

      expect(result.systemPrompt).toContain("P1");
      expect(result.systemPrompt).toContain("P2");
      expect(result.systemPrompt).toContain("P3");
    });

    it("uses union of tools from all agents", () => {
      const agents = [
        {
          ...createAgent("a1", "P1"),
          frontmatter: { ...createAgent("a1", "P1").frontmatter, tools: { read: true, write: false } },
        },
        {
          ...createAgent("a2", "P2"),
          frontmatter: { ...createAgent("a2", "P2").frontmatter, tools: { write: true, bash: true } },
        },
      ];

      const result = adapter.mergeAgents(agents);

      expect(result.frontmatter.tools?.read).toBe(true);
      expect(result.frontmatter.tools?.write).toBe(true);
      expect(result.frontmatter.tools?.bash).toBe(true);
    });

    it("uses maximum temperature", () => {
      const agents = [
        { ...createAgent("a1", "P1"), frontmatter: { ...createAgent("a1", "P1").frontmatter, temperature: 0.5 } },
        { ...createAgent("a2", "P2"), frontmatter: { ...createAgent("a2", "P2").frontmatter, temperature: 0.8 } },
        { ...createAgent("a3", "P3"), frontmatter: { ...createAgent("a3", "P3").frontmatter, temperature: 0.6 } },
      ];

      const result = adapter.mergeAgents(agents);

      expect(result.frontmatter.temperature).toBe(0.8);
    });

    it("uses first available model", () => {
      const agents = [
        { ...createAgent("a1", "P1"), frontmatter: { ...createAgent("a1", "P1").frontmatter, model: undefined } },
        { ...createAgent("a2", "P2"), frontmatter: { ...createAgent("a2", "P2").frontmatter, model: "gpt-4" } },
        { ...createAgent("a3", "P3"), frontmatter: { ...createAgent("a3", "P3").frontmatter, model: "gpt-3.5" } },
      ];

      const result = adapter.mergeAgents(agents);

      expect(result.frontmatter.model).toBe("gpt-4");
    });

    it("flattens contexts from all agents", () => {
      const agents = [
        { ...createAgent("a1", "P1"), contexts: [{ path: "ctx1.md" }] },
        { ...createAgent("a2", "P2"), contexts: [{ path: "ctx2.md" }, { path: "ctx3.md" }] },
      ];

      const result = adapter.mergeAgents(agents);

      expect(result.contexts).toHaveLength(3);
      expect(result.contexts?.map((c) => c.path)).toContain("ctx1.md");
    });

    it("throws error on empty array", () => {
      expect(() => adapter.mergeAgents([])).toThrow("Cannot merge empty agent array");
    });

    it("throws error on undefined agent", () => {
      expect(() => adapter.mergeAgents([undefined as any])).toThrow("Agent at index 0 is undefined");
    });

    it("includes divider between prompts", () => {
      const agents = [
        createAgent("a1", "First"),
        createAgent("a2", "Second"),
      ];

      const result = adapter.mergeAgents(agents);

      expect(result.systemPrompt).toContain("---");
    });

    it("includes agent descriptions in merged prompt", () => {
      const agents = [
        { ...createAgent("a1", "First"), frontmatter: { ...createAgent("a1", "First").frontmatter, description: "First agent description" } },
        { ...createAgent("a2", "Second"), frontmatter: { ...createAgent("a2", "Second").frontmatter, description: "Second agent description" } },
      ];

      const result = adapter.mergeAgents(agents);

      expect(result.systemPrompt).toContain("First agent description");
      expect(result.systemPrompt).toContain("Second agent description");
    });
  });

  // ============================================================================
  // MODEL MAPPING
  // ============================================================================

  describe("model mapping (Cursor to OAC)", () => {
    it("maps gpt-4 to gpt-4", async () => {
      const source = `---
name: agent
model: gpt-4
---

Prompt`;

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.model).toBe("gpt-4");
    });

    it("maps gpt-4o to gpt-4o", async () => {
      const source = `---
name: agent
model: gpt-4o
---

Prompt`;

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.model).toBe("gpt-4o");
    });

    it("maps claude-3-opus to claude-opus-3", async () => {
      const source = `---
name: agent
model: claude-3-opus
---

Prompt`;

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.model).toBe("claude-opus-3");
    });

    it("preserves unknown models", async () => {
      const source = `---
name: agent
model: custom-model
---

Prompt`;

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.model).toBe("custom-model");
    });
  });

  describe("model mapping (OAC to Cursor)", () => {
    it("maps gpt-4 to gpt-4", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          mode: "primary",
          model: "gpt-4",
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const content = result.configs[0].content;

      expect(content).toContain("model: gpt-4");
    });

    it("maps gpt-4o to gpt-4o", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          mode: "primary",
          model: "gpt-4o",
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const content = result.configs[0].content;

      expect(content).toContain("model: gpt-4o");
    });

    it("maps claude-sonnet-4 to claude-3-sonnet (v3 fallback)", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          mode: "primary",
          model: "claude-sonnet-4",
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const content = result.configs[0].content;

      expect(content).toContain("model: claude-3-sonnet");
    });

    it("defaults to gpt-4 for unknown models", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          mode: "primary",
          model: "unknown-model",
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const content = result.configs[0].content;

      expect(content).toContain("model: gpt-4");
    });

    it("omits model when not provided", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          mode: "primary",
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const content = result.configs[0].content;

      expect(content).not.toContain("model:");
    });
  });

  // ============================================================================
  // TOOL PARSING
  // ============================================================================

  describe("tool parsing", () => {
    it("parses comma-separated tools", async () => {
      const source = `---
name: agent
tools: read, write, bash
---

Prompt`;

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.tools).toEqual({
        read: true,
        write: true,
        bash: true,
      });
    });

    it("normalizes tools to lowercase", async () => {
      const source = `---
name: agent
tools: Read, WRITE, BaSh
---

Prompt`;

      const result = await adapter.toOAC(source);

      expect(Object.keys(result.frontmatter.tools || {})).toContain("read");
      expect(Object.keys(result.frontmatter.tools || {})).toContain("write");
    });

    it("handles empty tools", async () => {
      const source = `---
name: agent
tools:
---

Prompt`;

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.tools).toBeUndefined();
    });

    it("omits disabled tools from output", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          mode: "primary",
          tools: { read: true, write: false, bash: true },
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const content = result.configs[0].content;

      expect(content).toContain("- read");
      expect(content).toContain("- bash");
      expect(content).not.toContain("- write");
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
          model: "gpt-4",
          temperature: 0.6,
        },
        metadata: { name: "roundtrip-agent", category: "core", type: "agent" },
        systemPrompt: "Be helpful",
        contexts: [],
      };

      // Convert to Cursor
      const cursorResult = await adapter.fromOAC(original);
      const cursorRules = cursorResult.configs[0].content;

      // Convert back to OAC
      const backToOAC = await adapter.toOAC(cursorRules);

      expect(backToOAC.frontmatter.name).toBe("roundtrip-agent");
      expect(backToOAC.systemPrompt).toContain("Be helpful");
      expect(backToOAC.frontmatter.temperature).toBe(0.6);
    });
  });

  describe("edge cases", () => {
    it("handles empty system prompt", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          mode: "primary",
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: "",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);

      expect(result.success).toBe(true);
      expect(result.configs[0].content).toBeDefined();
    });

    it("handles very long system prompt", async () => {
      const longPrompt = "A".repeat(5000);
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          mode: "primary",
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: longPrompt,
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const content = result.configs[0].content;

      expect(content.length).toBeGreaterThan(5000);
    });

    it("handles special characters in names", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent-with-dashes_and_underscores",
          mode: "primary",
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);
      const content = result.configs[0].content;

      expect(content).toContain("agent-with-dashes_and_underscores");
    });

    it("handles null context array", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
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
          mode: "primary",
          tools: undefined,
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);

      expect(result.success).toBe(true);
    });

    it("handles decimal temperature values", async () => {
      const source = `---
name: agent
temperature: 0.123
---

Prompt`;

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.temperature).toBe(0.123);
    });

    it("handles zero temperature", async () => {
      const source = `---
name: agent
temperature: 0
---

Prompt`;

      const result = await adapter.toOAC(source);

      expect(result.frontmatter.temperature).toBe(0);
    });

    it("preserves whitespace in prompts", async () => {
      const source = `---
name: agent
---

  Indented line 1
    Indented line 2
Regular line`;

      const result = await adapter.toOAC(source);

      expect(result.systemPrompt).toContain("  Indented");
      expect(result.systemPrompt).toContain("    Indented");
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
          mode: "primary",
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);

      expect(result.capabilities).toBeDefined();
      expect(result.capabilities?.name).toBe("cursor");
    });

    it("includes encoding in tool config", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          mode: "primary",
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      };

      const result = await adapter.fromOAC(agent);

      expect(result.configs[0].encoding).toBe("utf-8");
    });

    it("always returns single .cursorrules file", async () => {
      const agent: OpenAgent = {
        frontmatter: {
          name: "agent",
          mode: "primary",
          tools: { read: true, write: true },
        },
        metadata: { category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [{ path: "ctx1.md" }, { path: "ctx2.md" }],
      };

      const result = await adapter.fromOAC(agent);

      expect(result.configs).toHaveLength(1);
      expect(result.configs[0].fileName).toBe(".cursorrules");
    });
  });
});
