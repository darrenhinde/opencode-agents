/**
 * Unit tests for TranslationEngine
 *
 * Tests the orchestration of all mappers for complete agent translation.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  TranslationEngine,
  createTranslationEngine,
  translate,
  previewTranslation,
  type TranslationTarget,
  type TranslationOptions,
} from "../../../src/core/TranslationEngine";
import type { OpenAgent, ToolAccess, GranularPermission } from "../../../src/types";

// =============================================================================
// Test Fixtures
// =============================================================================

const createTestAgent = (overrides: Partial<OpenAgent> = {}): OpenAgent => ({
  frontmatter: {
    name: "Test Agent",
    description: "A comprehensive test agent",
    mode: "primary",
    model: "claude-sonnet-4",
    temperature: 0.7,
    tools: {
      bash: true,
      read: true,
      write: true,
      edit: true,
      grep: true,
      glob: true,
      task: true,
    },
    permission: {
      bash: { allow: ["npm *", "git *"], deny: ["rm -rf *"] },
      read: { allow: ["**/*"] },
      write: { allow: ["src/**/*"], deny: ["node_modules/**"] },
    },
    skills: ["coding", "testing"],
    ...overrides.frontmatter,
  },
  systemPrompt: "You are a helpful coding assistant.",
  contexts: [
    { path: ".opencode/context/core/standards.md", priority: "critical" },
    { path: ".opencode/context/guides/workflow.md", priority: "high" },
  ],
  ...overrides,
});

const createMinimalAgent = (overrides: Partial<OpenAgent> = {}): OpenAgent => ({
  frontmatter: {
    name: "Minimal Agent",
    description: "A minimal test agent",
    mode: "primary",
    ...overrides.frontmatter,
  },
  systemPrompt: "You are a minimal agent.",
  contexts: [],
  ...overrides,
});

describe("TranslationEngine", () => {
  let engine: TranslationEngine;

  beforeEach(() => {
    engine = new TranslationEngine();
  });

  // ==========================================================================
  // Constructor and Options
  // ==========================================================================
  describe("constructor", () => {
    it("creates engine with default options", () => {
      const engine = new TranslationEngine();
      const opts = engine.getOptions();
      expect(opts.permissionStrategy).toBe("permissive");
      expect(opts.analyzeCompatibility).toBe(true);
      expect(opts.preserveAsComments).toBe(false);
      expect(opts.modelFallback).toBe("claude-sonnet-4");
    });

    it("creates engine with custom options", () => {
      const engine = new TranslationEngine({
        permissionStrategy: "restrictive",
        analyzeCompatibility: false,
      });
      const opts = engine.getOptions();
      expect(opts.permissionStrategy).toBe("restrictive");
      expect(opts.analyzeCompatibility).toBe(false);
    });
  });

  describe("getOptions()", () => {
    it("returns a copy of options", () => {
      const opts1 = engine.getOptions();
      const opts2 = engine.getOptions();
      expect(opts1).not.toBe(opts2);
      expect(opts1).toEqual(opts2);
    });
  });

  describe("setOptions()", () => {
    it("updates options", () => {
      engine.setOptions({ permissionStrategy: "restrictive" });
      const opts = engine.getOptions();
      expect(opts.permissionStrategy).toBe("restrictive");
    });

    it("preserves unset options", () => {
      engine.setOptions({ permissionStrategy: "restrictive" });
      const opts = engine.getOptions();
      expect(opts.analyzeCompatibility).toBe(true);
    });
  });

  // ==========================================================================
  // translate() - OAC to Platform
  // ==========================================================================
  describe("translate()", () => {
    describe("basic translation", () => {
      it("translates minimal agent successfully", () => {
        const agent = createMinimalAgent();
        const result = engine.translate(agent, "claude");
        expect(result.success).toBe(true);
        expect(result.frontmatter.name).toBe("Minimal Agent");
        expect(result.frontmatter.description).toBe("A minimal test agent");
      });

      it("includes compatibility analysis by default", () => {
        const agent = createMinimalAgent();
        const result = engine.translate(agent, "claude");
        expect(result.compatibility).toBeDefined();
        expect(result.compatibility?.compatible).toBe(true);
      });

      it("skips compatibility analysis when disabled", () => {
        const agent = createMinimalAgent();
        const result = engine.translate(agent, "claude", {
          analyzeCompatibility: false,
        });
        expect(result.compatibility).toBeUndefined();
      });
    });

    describe("tool translation", () => {
      it("translates tools to target platform format", () => {
        const agent = createTestAgent();
        const result = engine.translate(agent, "claude");
        expect(result.tools).toBeDefined();
        expect(result.tools?.Bash).toBe(true);
        expect(result.tools?.Read).toBe(true);
        expect(result.tools?.Write).toBe(true);
      });

      it("translates tools to Cursor format", () => {
        const agent = createTestAgent();
        const result = engine.translate(agent, "cursor");
        expect(result.tools).toBeDefined();
        expect(result.tools?.terminal).toBe(true);
        expect(result.tools?.file_read).toBe(true);
      });
    });

    describe("permission translation", () => {
      it("translates granular permissions to binary format", () => {
        const agent = createTestAgent();
        const result = engine.translate(agent, "claude");
        expect(result.permissions).toBeDefined();
        expect(typeof result.permissions?.bash).toBe("boolean");
        expect(typeof result.permissions?.read).toBe("boolean");
        expect(typeof result.permissions?.write).toBe("boolean");
      });

      it("uses permissive strategy by default", () => {
        const agent = createTestAgent();
        const result = engine.translate(agent, "claude");
        // With permissive strategy, allow patterns enable the permission
        expect(result.permissions?.bash).toBe(true);
      });

      it("respects restrictive strategy option", () => {
        const agent = createTestAgent();
        const result = engine.translate(agent, "claude", {
          permissionStrategy: "restrictive",
        });
        // Even with restrictive, basic permissions should be enabled if allow exists
        expect(result.permissions).toBeDefined();
      });
    });

    describe("model translation", () => {
      it("translates model ID to target platform format", () => {
        const agent = createTestAgent();
        const result = engine.translate(agent, "claude");
        expect(result.model).toBeDefined();
        expect(result.model).toBe("claude-sonnet-4-20250514");
      });

      it("handles missing model", () => {
        const agent = createMinimalAgent();
        const result = engine.translate(agent, "claude");
        expect(result.model).toBeUndefined();
      });
    });

    describe("context translation", () => {
      it("translates context paths to target platform", () => {
        const agent = createTestAgent();
        const result = engine.translate(agent, "claude");
        expect(result.contextPaths).toBeDefined();
        expect(result.contextPaths?.length).toBe(2);
        expect(result.contextPaths?.[0]).toContain(".claude/skills");
      });

      it("returns empty paths for Cursor (inline-only)", () => {
        const agent = createTestAgent();
        const result = engine.translate(agent, "cursor");
        // Cursor doesn't support external context, paths should be filtered
        expect(result.contextPaths).toBeDefined();
        expect(result.contextPaths?.length).toBe(0);
      });

      it("collects context priority warnings", () => {
        const agent = createTestAgent();
        const result = engine.translate(agent, "claude");
        expect(result.warnings.some((w) => w.includes("priority"))).toBe(true);
      });
    });

    describe("skill translation", () => {
      it("translates skills to Claude format", () => {
        const agent = createTestAgent();
        const result = engine.translate(agent, "claude");
        expect(result.skills).toBeDefined();
        expect(result.skills?.length).toBe(2);
        expect(result.skills?.[0]).toBe(".claude/skills/coding.md");
      });

      it("does not include skills for non-Claude targets", () => {
        const agent = createTestAgent();
        const result = engine.translate(agent, "cursor");
        expect(result.skills).toBeUndefined();
      });
    });

    describe("temperature handling", () => {
      it("includes temperature when supported", () => {
        const agent = createTestAgent();
        const result = engine.translate(agent, "cursor");
        // Cursor has partial temperature support
        expect(result.frontmatter.temperature).toBeDefined();
      });

      it("excludes temperature when not supported", () => {
        const agent = createTestAgent();
        const result = engine.translate(agent, "claude");
        // Claude doesn't support temperature
        expect(result.frontmatter.temperature).toBeUndefined();
      });
    });

    describe("warnings collection", () => {
      it("collects all warnings from sub-mappers", () => {
        const agent = createTestAgent();
        const result = engine.translate(agent, "cursor");
        expect(result.warnings.length).toBeGreaterThan(0);
      });

      it("includes compatibility warnings", () => {
        const agent = createTestAgent({
          frontmatter: {
            name: "Agent with hooks",
            description: "Agent",
            mode: "primary",
            hooks: [{ event: "PreToolUse", command: "echo test" }],
          },
        });
        const result = engine.translate(agent, "cursor");
        expect(result.success).toBe(false);
        expect(result.compatibility?.compatible).toBe(false);
        expect(result.compatibility?.blockers.length).toBeGreaterThan(0);
      });
    });
  });

  // ==========================================================================
  // translateToOAC() - Platform to OAC
  // ==========================================================================
  describe("translateToOAC()", () => {
    it("translates Claude format to OAC", () => {
      const source = {
        name: "Claude Agent",
        description: "An agent from Claude",
        tools: { Bash: true, Read: true, Write: true },
        permissions: { bash: true, read: true, write: false },
        model: "claude-sonnet-4-20250514",
        skills: [".claude/skills/coding.md"],
        systemPrompt: "You are helpful.",
      };
      const result = engine.translateToOAC(source, "claude");
      expect(result.success).toBe(true);
      expect(result.agent.frontmatter?.name).toBe("Claude Agent");
      expect(result.agent.frontmatter?.tools).toBeDefined();
      expect(result.agent.frontmatter?.model).toBe("claude-sonnet-4");
    });

    it("translates Cursor format to OAC", () => {
      const source = {
        name: "Cursor Agent",
        tools: { terminal: true, file_read: true },
        permissions: { bash: true, read: true },
      };
      const result = engine.translateToOAC(source, "cursor");
      expect(result.success).toBe(true);
      expect(result.agent.frontmatter?.name).toBe("Cursor Agent");
      expect(result.agent.frontmatter?.tools?.bash).toBe(true);
      expect(result.agent.frontmatter?.tools?.read).toBe(true);
    });

    it("handles missing fields with defaults", () => {
      const source = {};
      const result = engine.translateToOAC(source, "claude");
      expect(result.success).toBe(true);
      expect(result.agent.frontmatter?.name).toBe("Unnamed Agent");
      expect(result.agent.frontmatter?.description).toBe("Imported agent");
      expect(result.agent.frontmatter?.mode).toBe("primary");
    });

    it("translates context paths back to OAC format", () => {
      const source = {
        name: "Agent",
        contextPaths: [".claude/skills/core/standards.md"],
      };
      const result = engine.translateToOAC(source, "claude");
      expect(result.agent.contexts).toBeDefined();
      expect(result.agent.contexts?.[0].path).toBe(
        ".opencode/context/core/standards.md"
      );
    });

    it("converts Claude skills to OAC skill references", () => {
      const source = {
        name: "Agent",
        skills: [".claude/skills/coding.md", ".claude/skills/testing.md"],
      };
      const result = engine.translateToOAC(source, "claude");
      expect(result.agent.frontmatter?.skills).toHaveLength(2);
      expect(result.agent.frontmatter?.skills?.[0]).toBe("coding");
    });

    it("includes system prompt when provided", () => {
      const source = {
        name: "Agent",
        systemPrompt: "Custom prompt",
      };
      const result = engine.translateToOAC(source, "claude");
      expect(result.agent.systemPrompt).toBe("Custom prompt");
    });
  });

  // ==========================================================================
  // translateBatch()
  // ==========================================================================
  describe("translateBatch()", () => {
    it("translates multiple agents", () => {
      const agents = [
        createMinimalAgent({ frontmatter: { name: "Agent 1", description: "First", mode: "primary" } }),
        createMinimalAgent({ frontmatter: { name: "Agent 2", description: "Second", mode: "primary" } }),
      ];
      const results = engine.translateBatch(agents, "claude");
      expect(results).toHaveLength(2);
      expect(results[0].frontmatter.name).toBe("Agent 1");
      expect(results[1].frontmatter.name).toBe("Agent 2");
    });

    it("handles empty array", () => {
      const results = engine.translateBatch([], "claude");
      expect(results).toHaveLength(0);
    });

    it("processes each agent independently", () => {
      const agents = [
        createTestAgent(),
        createMinimalAgent(),
      ];
      const results = engine.translateBatch(agents, "claude");
      expect(results[0].tools).toBeDefined();
      expect(results[1].tools).toBeUndefined();
    });
  });

  // ==========================================================================
  // preview()
  // ==========================================================================
  describe("preview()", () => {
    it("returns compatibility analysis without translation", () => {
      const agent = createTestAgent();
      const result = engine.preview(agent, "cursor");
      expect(result).toHaveProperty("compatible");
      expect(result).toHaveProperty("score");
      expect(result).toHaveProperty("warnings");
      expect(result).toHaveProperty("blockers");
    });

    it("identifies incompatible agents", () => {
      const agent = createTestAgent({
        frontmatter: {
          name: "Agent with hooks",
          description: "Agent",
          mode: "primary",
          hooks: [{ event: "PreToolUse", command: "echo test" }],
        },
      });
      const result = engine.preview(agent, "cursor");
      expect(result.compatible).toBe(false);
      expect(result.blockers.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // isFullyCompatible()
  // ==========================================================================
  describe("isFullyCompatible()", () => {
    it("returns true for minimal agent to Claude", () => {
      const agent = createMinimalAgent();
      expect(engine.isFullyCompatible(agent, "claude")).toBe(true);
    });

    it("returns false when features will be lost", () => {
      const agent = createTestAgent(); // Has temperature, contexts with priority
      expect(engine.isFullyCompatible(agent, "cursor")).toBe(false);
    });
  });

  // ==========================================================================
  // Factory Functions
  // ==========================================================================
  describe("createTranslationEngine()", () => {
    it("creates engine with default options", () => {
      const engine = createTranslationEngine();
      expect(engine).toBeInstanceOf(TranslationEngine);
      expect(engine.getOptions().permissionStrategy).toBe("permissive");
    });

    it("creates engine with custom options", () => {
      const engine = createTranslationEngine({
        permissionStrategy: "restrictive",
      });
      expect(engine.getOptions().permissionStrategy).toBe("restrictive");
    });
  });

  describe("translate() function", () => {
    it("performs one-off translation", () => {
      const agent = createMinimalAgent();
      const result = translate(agent, "claude");
      expect(result.success).toBe(true);
      expect(result.frontmatter.name).toBe("Minimal Agent");
    });

    it("accepts options", () => {
      const agent = createMinimalAgent();
      const result = translate(agent, "claude", {
        analyzeCompatibility: false,
      });
      expect(result.compatibility).toBeUndefined();
    });
  });

  describe("previewTranslation()", () => {
    it("performs one-off compatibility check", () => {
      const agent = createTestAgent();
      const result = previewTranslation(agent, "cursor");
      expect(result).toHaveProperty("compatible");
      expect(result).toHaveProperty("score");
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================
  describe("edge cases", () => {
    it("handles agent with no tools", () => {
      const agent = createMinimalAgent();
      const result = engine.translate(agent, "claude");
      expect(result.success).toBe(true);
      expect(result.tools).toBeUndefined();
    });

    it("handles agent with no permissions", () => {
      const agent = createMinimalAgent();
      const result = engine.translate(agent, "claude");
      expect(result.success).toBe(true);
      expect(result.permissions).toBeUndefined();
    });

    it("handles agent with no contexts", () => {
      const agent = createMinimalAgent({ contexts: [] });
      const result = engine.translate(agent, "claude");
      expect(result.success).toBe(true);
      expect(result.contextPaths).toBeUndefined();
    });

    it("handles agent with no skills", () => {
      const agent = createMinimalAgent();
      const result = engine.translate(agent, "claude");
      expect(result.success).toBe(true);
      expect(result.skills).toBeUndefined();
    });

    it("handles Windsurf target", () => {
      const agent = createTestAgent();
      const result = engine.translate(agent, "windsurf");
      expect(result.success).toBe(true);
      expect(result.frontmatter.name).toBe("Test Agent");
    });
  });
});
