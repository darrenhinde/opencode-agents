/**
 * Unit tests for ClaudeAdapter — the `plugins/claude-code/` emitter.
 *
 * ## What changed, and why the old suite could not simply be edited
 *
 * This adapter used to emit `.claude/config.json` + `.claude/agents/*.md`. The `config.json`
 * half was fabricated (Claude Code has no such agent-config file) and the real target is the
 * plugin tree committed at `plugins/claude-code/`. Roughly half the old suite asserted the
 * shape of a file that should never have existed, so those tests are gone rather than
 * retargeted — keeping them would pin a format nothing reads.
 *
 * ## The one rule these tests exist to defend
 *
 * Claude Code's frontmatter has two flat lists and no scoping: no ordered globs, no `ask`,
 * no last-match-wins. Canonical agents depend on all three. Emitting MORE permission than
 * canonical specifies is the single unacceptable outcome, so every projection here is
 * checked to fail CLOSED and to say out loud what it dropped. A silent widening is the bug
 * class this file is aimed at — `PermissionMapper`'s permissive default (`hasAllow ||
 * !hasDeny`) answers `bash: true` for a deny-all-then-allowlist block, which is exactly why
 * the adapter routes through `core/Capabilities.ts` instead.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { ClaudeAdapter } from "../../../src/adapters/ClaudeAdapter";
import { packagePath } from "../../support/pending.js";
import type { OpenAgent, AgentFrontmatter, HookDefinition } from "../../../src/types";

const FIXTURE_REVIEWER = packagePath("tests/golden/fixtures/fixture-reviewer.md");
const FIXTURE_PLANNER = packagePath("tests/golden/fixtures/fixture-planner.md");

function fixture(path: string): string {
  return readFileSync(path, "utf-8");
}

/** A canonical agent file built around one permission block, for targeted projection tests. */
function canonical(permission: string, extra = ""): string {
  return `---
name: ProbeAgent
description: A probe agent.
mode: subagent
${extra}permission:
${permission}
oac:
  id: probe-agent
  name: ProbeAgent
  category: subagents/test
  type: subagent
  targets:
    - claude-code
---

# ProbeAgent

Body.
`;
}

describe("ClaudeAdapter", () => {
  let adapter: ClaudeAdapter;

  beforeEach(() => {
    adapter = new ClaudeAdapter();
  });

  // ============================================================================
  // ADAPTER IDENTITY
  // ============================================================================

  describe("adapter identity", () => {
    it("has correct name", () => {
      expect(adapter.name).toBe("claude");
    });

    it("has correct displayName", () => {
      expect(adapter.displayName).toBe("Claude Code");
    });

    it("returns the plugin tree as its config path, not .claude/", () => {
      expect(adapter.getConfigPath()).toBe("plugins/claude-code/");
    });
  });

  // ============================================================================
  // OUTPUT LAYOUT
  // ============================================================================

  describe("output layout", () => {
    it("emits agents under plugins/claude-code/agents/", async () => {
      const { path } = await adapter.fromCanonical(fixture(FIXTURE_REVIEWER));

      expect(path).toBe("plugins/claude-code/agents/fixture-reviewer.md");
    });

    it("keys the emitted path on oac.id, not the authored display name", async () => {
      // The canonical ids and the Claude Code filenames genuinely differ across the corpus
      // (`contextscout` -> `context-scout.md`, `reviewer` -> `code-reviewer.md`). Only the
      // id is stable identity, so resolving by `name:` would emit the wrong filename.
      const { path, content } = await adapter.fromCanonical(fixture(FIXTURE_REVIEWER));

      expect(path).toContain("fixture-reviewer.md"); // oac.id
      expect(path).not.toContain("FixtureReviewer"); // frontmatter name
      expect(content).toMatch(/^name: fixture-reviewer$/m);
    });

    it("emits no .claude/ path from any conversion", async () => {
      const canonicalResult = await adapter.fromCanonical(fixture(FIXTURE_PLANNER));
      const oacResult = await adapter.fromOAC({
        frontmatter: { name: "Agent", description: "Test", mode: "primary" },
        metadata: { name: "Agent", category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [{ path: "context/a.md", description: "A" }],
      });

      expect(canonicalResult.path).not.toContain(".claude/");
      for (const config of oacResult.configs) {
        expect(config.fileName, `${config.fileName} still targets the old layout`).not.toContain(
          ".claude/"
        );
        expect(config.fileName).toMatch(/^plugins\/claude-code\//);
      }
    });

    it("never emits a config.json", async () => {
      const result = await adapter.fromOAC({
        frontmatter: { name: "Agent", description: "Test", mode: "primary" },
        metadata: { name: "Agent", category: "core", type: "agent" },
        systemPrompt: "Prompt",
        contexts: [],
      });

      expect(result.configs.map((c) => c.fileName)).toEqual([
        "plugins/claude-code/agents/Agent.md",
      ]);
    });

    it("emits one agent file for a primary agent, same as a subagent", async () => {
      // The old primary/subagent split existed only to choose between config.json and an
      // agent file. With config.json gone there is exactly one shape.
      const primary = await adapter.fromCanonical(fixture(FIXTURE_PLANNER)); // mode: primary

      expect(primary.path).toBe("plugins/claude-code/agents/fixture-planner.md");
      expect(primary.content).toMatch(/^---\nname: fixture-planner$/m);
    });
  });

  // ============================================================================
  // FRONTMATTER SHAPE
  // ============================================================================

  describe("frontmatter shape", () => {
    it("emits keys in the committed order: name, description, tools, disallowedTools, model", async () => {
      const { content } = await adapter.fromCanonical(fixture(FIXTURE_REVIEWER));
      const keys = content
        .split("---")[1]!
        .trim()
        .split("\n")
        .map((line) => line.split(":")[0]);

      expect(keys).toEqual(["name", "description", "tools", "disallowedTools", "model"]);
    });

    it("reproduces the committed frontmatter shape byte-for-byte", async () => {
      const { content } = await adapter.fromCanonical(fixture(FIXTURE_REVIEWER));

      expect(content.split("---\n\n")[0]).toBe(
        `---\nname: fixture-reviewer\n` +
          `description: Reviews code for correctness. A golden-file fixture, not a shipped agent.\n` +
          `tools: Read, Glob, Grep\n` +
          `disallowedTools: Write, Edit, Bash, Task\n` +
          `model: haiku\n`
      );
    });

    it("passes the model through unmapped", async () => {
      // The committed corpus uses Claude Code's own aliases (`sonnet`, `haiku`). Expanding
      // them to dated ids (`claude-sonnet-4-20250514`) would break every committed agent.
      const { content } = await adapter.fromCanonical(fixture(FIXTURE_PLANNER));

      expect(content).toMatch(/^model: sonnet$/m);
    });

    it("omits model when the source declares none", async () => {
      const { content } = await adapter.fromCanonical(canonical(`  read:\n    "*": "allow"\n`));

      expect(content).not.toMatch(/^model:/m);
    });

    it("omits an empty tools list rather than emitting a bare key", async () => {
      // `tools:` with no value means something different to Claude Code than an absent key.
      const { content } = await adapter.fromCanonical(canonical(`  bash:\n    "*": "deny"\n`));

      expect(content).not.toMatch(/^tools:\s*$/m);
      expect(content).toMatch(/^disallowedTools: Bash$/m);
    });

    it("omits an empty disallowedTools list", async () => {
      const { content } = await adapter.fromCanonical(canonical(`  read:\n    "*": "allow"\n`));

      expect(content).toMatch(/^tools: Read$/m);
      expect(content).not.toMatch(/^disallowedTools:/m);
    });

    it("preserves the body verbatim after the frontmatter", async () => {
      const { content } = await adapter.fromCanonical(fixture(FIXTURE_REVIEWER));

      expect(content).toContain("# FixtureReviewer");
      expect(content).toContain("- Report findings, do not fix them.");
      expect(content.endsWith("- Report findings, do not fix them.\n")).toBe(true);
    });

    it("renders a multi-line description as a YAML block scalar", async () => {
      // The committed agents carry multi-line `description: |` blocks with <example> tags.
      // A naive `key: "value"` would emit a broken single line.
      const source = canonical(`  read:\n    "*": "allow"\n`).replace(
        "description: A probe agent.",
        'description: |\n  First line.\n  user: "quoted colon"\n'
      );

      const { content } = await adapter.fromCanonical(source);

      expect(content).toContain('description: |\n  First line.\n  user: "quoted colon"\n');
    });

    it("quotes a description that would otherwise be ambiguous YAML", async () => {
      const source = canonical(`  read:\n    "*": "allow"\n`).replace(
        "description: A probe agent.",
        'description: "*starts with a star"'
      );

      const { content } = await adapter.fromCanonical(source);

      expect(content).toMatch(/^description: '\*starts with a star'$/m);
    });
  });

  // ============================================================================
  // TOOL ORDERING
  // ============================================================================

  describe("tool ordering", () => {
    it("emits tools in the canonical Read, Write, Edit, Glob, Grep, Bash, WebFetch, Task order", async () => {
      // Recovered from the 7 committed agents: all 10 of their lists fit this order and it
      // is the only total order that does. Alphabetical is refuted by context-manager.md
      // (`Read, Write, Glob, Grep, Bash`); so is ToolAccessSchema field order.
      const { content } = await adapter.fromCanonical(
        canonical(
          `  task:\n    "*": "allow"\n` +
            `  bash:\n    "*": "allow"\n` +
            `  grep:\n    "*": "allow"\n` +
            `  glob:\n    "*": "allow"\n` +
            `  edit:\n    "*": "allow"\n` +
            `  write:\n    "*": "allow"\n` +
            `  read:\n    "*": "allow"\n` +
            `  webfetch:\n    "*": "allow"\n`
        )
      );

      expect(content).toMatch(
        /^tools: Read, Write, Edit, Glob, Grep, Bash, WebFetch, Task$/m
      );
    });

    it("orders disallowedTools by the same rule", async () => {
      const { content } = await adapter.fromCanonical(
        canonical(
          `  task:\n    "*": "deny"\n` +
            `  bash:\n    "*": "deny"\n` +
            `  edit:\n    "*": "deny"\n` +
            `  write:\n    "*": "deny"\n`
        )
      );

      expect(content).toMatch(/^disallowedTools: Write, Edit, Bash, Task$/m);
    });

    it("does not emit a tool for a capability the source never mentions", async () => {
      // Ratified rule (02 §1.2.5 case 1): an absent capability means "the target's own
      // default", so naming it in either list would invent an intent the author never had.
      const { content } = await adapter.fromCanonical(canonical(`  read:\n    "*": "allow"\n`));

      for (const tool of ["Write", "Edit", "Glob", "Grep", "Bash", "WebFetch", "Task"]) {
        expect(content, `${tool} was invented from silence`).not.toContain(tool);
      }
    });
  });

  // ============================================================================
  // PERMISSION PROJECTION — fails closed
  // ============================================================================

  describe("permission projection", () => {
    it("fails closed on a deny-all-then-allowlist bash block", async () => {
      // The live shape: `bash: {"*": deny, "git log*": allow}`. Claude Code has no ordered
      // -glob equivalent. Answering `tools: Bash` because "an allow rule exists" would hand
      // it unrestricted shell — the precise failure PermissionMapper's permissive default
      // produces, and the reason this adapter does not use it.
      const { content } = await adapter.fromCanonical(fixture(FIXTURE_PLANNER));

      expect(content).toMatch(/^disallowedTools:.*\bBash\b/m);
      expect(content).not.toMatch(/^tools:.*\bBash\b/m);
    });

    it("degrades 'ask' to deny, never to allow", async () => {
      const { content } = await adapter.fromCanonical(canonical(`  bash:\n    "*": "ask"\n`));

      expect(content).toMatch(/^disallowedTools: Bash$/m);
      expect(content).not.toMatch(/^tools:.*Bash/m);
    });

    it("does not treat an allow-with-exceptions as a plain allow", async () => {
      const { content } = await adapter.fromCanonical(
        canonical(`  edit:\n    "*": "allow"\n    "**/*.env*": "deny"\n`)
      );

      expect(content).toMatch(/^disallowedTools: Edit$/m);
    });

    it("carries a provably uniform allow through as a grant", async () => {
      const { content, warnings } = await adapter.fromCanonical(
        canonical(`  read:\n    "*": "allow"\n`)
      );

      expect(content).toMatch(/^tools: Read$/m);
      expect(warnings).toEqual([]);
    });

    it("carries a provably uniform deny through as a denial, silently", async () => {
      // An exact projection loses nothing, so it must not warn — warnings mean loss, and
      // noise here would train readers to ignore the real ones.
      const { content, warnings } = await adapter.fromCanonical(
        canonical(`  bash:\n    "*": "deny"\n`)
      );

      expect(content).toMatch(/^disallowedTools: Bash$/m);
      expect(warnings).toEqual([]);
    });

    it("never grants a tool whose rules contain any deny", async () => {
      // Property check over every mixed shape in the live corpus.
      const shapes = [
        `  bash:\n    "*": "deny"\n    "git log*": "allow"\n`,
        `  bash:\n    "git log*": "allow"\n    "*": "deny"\n`,
        `  edit:\n    "**/*.env*": "deny"\n    "**/*.key": "deny"\n`,
        `  read:\n    "**/*": "deny"\n    ".tmp/**": "allow"\n`,
      ];

      for (const shape of shapes) {
        const { content } = await adapter.fromCanonical(canonical(shape));
        const tools = /^tools: (.*)$/m.exec(content)?.[1] ?? "";

        expect(tools, `${shape} leaked a grant`).toBe("");
      }
    });
  });

  // ============================================================================
  // WARNINGS — one per lossy projection
  // ============================================================================

  describe("warnings", () => {
    it("emits exactly one warning for a single unrepresentable capability", async () => {
      const { warnings } = await adapter.fromCanonical(
        canonical(`  bash:\n    "*": "deny"\n    "git log*": "allow"\n`)
      );

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatch(/bash/i);
      expect(warnings[0]).toMatch(/fail-closed/);
    });

    it("counts one warning per lossy capability, and none for the lossless ones", async () => {
      // read/glob are exact; bash and edit are not. Two losses, two warnings.
      const { warnings } = await adapter.fromCanonical(
        canonical(
          `  read:\n    "*": "allow"\n` +
            `  glob:\n    "*": "allow"\n` +
            `  bash:\n    "*": "deny"\n    "git log*": "allow"\n` +
            `  edit:\n    "*": "allow"\n    "**/*.key": "deny"\n`
        )
      );

      expect(warnings).toHaveLength(2);
      expect(warnings.filter((w) => /'bash'/.test(w))).toHaveLength(1);
      expect(warnings.filter((w) => /'edit'/.test(w))).toHaveLength(1);
    });

    it("adds a second warning naming 'ask' when a mixed list contains one", async () => {
      // test-engineer's real block: a test-runner allowlist plus `rm -rf *: ask`.
      const { warnings } = await adapter.fromCanonical(
        canonical(`  bash:\n    "npx vitest *": "allow"\n    "rm -rf *": "ask"\n    "*": "deny"\n`)
      );

      expect(warnings).toHaveLength(2);
      expect(warnings.some((w) => /cannot express/.test(w) && /ask/.test(w))).toBe(true);
    });

    it("warns when a rule list has no recoverable default", async () => {
      // context-manager's real `write` block: allow + deny with no "*" rule.
      const { warnings } = await adapter.fromCanonical(
        canonical(
          `  write:\n    ".opencode/context/**/*.md": "allow"\n    "**/*.env*": "deny"\n`
        )
      );

      expect(warnings).toHaveLength(2);
      expect(warnings.some((w) => /ambiguous/.test(w))).toBe(true);
    });

    it("warns when a capability has no Claude Code tool at all", async () => {
      // externalscout's real `skill` block restricts which skills it may invoke. Claude Code
      // cannot express that; dropping it silently is the widening this suite guards against.
      const { warnings } = await adapter.fromCanonical(
        canonical(`  skill:\n    "*": "deny"\n    "*context7*": "allow"\n`)
      );

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatch(/'skill' has no Claude Code tool/);
    });

    it("warns that temperature and maxSteps cannot be carried", async () => {
      const { warnings } = await adapter.fromCanonical(
        canonical(`  read:\n    "*": "allow"\n`, "temperature: 0.1\nmaxSteps: 10\n")
      );

      expect(warnings).toHaveLength(2);
      expect(warnings.some((w) => w.includes("temperature"))).toBe(true);
      expect(warnings.some((w) => w.includes("maxSteps"))).toBe(true);
    });

    it("reports no permission loss for an agent whose every capability projects exactly", async () => {
      // fixture-reviewer's block is uniform-per-capability, so nothing about its permissions
      // is lost. Its `temperature: 0.1` still is — and that one warning is the whole list.
      const { warnings } = await adapter.fromCanonical(fixture(FIXTURE_REVIEWER));

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("temperature");
    });
  });

  // ============================================================================
  // DETERMINISM
  // ============================================================================

  describe("determinism", () => {
    it("emits identical bytes regardless of the source's key order", async () => {
      const rules = {
        read: `  read:\n    "*": "allow"\n`,
        bash: `  bash:\n    "*": "deny"\n`,
        write: `  write:\n    "*": "deny"\n`,
      };

      const forward = await adapter.fromCanonical(
        canonical(rules.read + rules.bash + rules.write)
      );
      const reversed = await adapter.fromCanonical(
        canonical(rules.write + rules.bash + rules.read)
      );

      expect(reversed.content).toBe(forward.content);
    });

    it("emits identical bytes across separate adapter instances", async () => {
      const source = fixture(FIXTURE_REVIEWER);

      expect((await new ClaudeAdapter().fromCanonical(source)).content).toBe(
        (await new ClaudeAdapter().fromCanonical(source)).content
      );
    });
  });

  // ============================================================================
  // INPUT VALIDATION
  // ============================================================================

  describe("input validation", () => {
    it("throws a named error when the source lacks an oac: block", async () => {
      const source = `---\nname: X\ndescription: Y\nmode: subagent\n---\n\nBody\n`;

      await expect(adapter.fromCanonical(source)).rejects.toThrow(/not a canonical agent file/);
    });

    it("names the offending field when the oac: block is malformed", async () => {
      const source = canonical(`  read:\n    "*": "allow"\n`).replace(
        "id: probe-agent",
        "id: Probe_Agent"
      );

      await expect(adapter.fromCanonical(source)).rejects.toThrow(/oac\.id/);
    });
  });

  // ============================================================================
  // CAPABILITIES
  // ============================================================================

  describe("getCapabilities()", () => {
    it("returns correct capabilities object", () => {
      const capabilities = adapter.getCapabilities();

      expect(capabilities.name).toBe("claude");
      expect(capabilities.displayName).toBe("Claude Code");
      expect(capabilities.supportsMultipleAgents).toBe(true);
      expect(capabilities.supportsSkills).toBe(true);
      expect(capabilities.supportsHooks).toBe(true);
      expect(capabilities.supportsGranularPermissions).toBe(false);
      expect(capabilities.supportsContexts).toBe(true);
      expect(capabilities.supportsCustomModels).toBe(true);
      expect(capabilities.supportsTemperature).toBe(false);
      expect(capabilities.supportsMaxSteps).toBe(false);
      expect(capabilities.configFormat).toBe("markdown");
      expect(capabilities.outputStructure).toBe("directory");
    });

    it("agrees with the CapabilityMatrix rather than restating it", async () => {
      // These two disagreed before: the matrix called Claude `json`, the adapter `markdown`.
      // A platform cannot have two answers about itself.
      const { getToolCapabilities } = await import("../../../src/core/CapabilityMatrix.js");

      expect(adapter.getCapabilities().configFormat).toBe(
        getToolCapabilities("claude").configFormat
      );
    });

    it("includes appropriate notes", () => {
      const capabilities = adapter.getCapabilities();

      expect(capabilities.notes?.length).toBeGreaterThan(0);
      expect(capabilities.notes?.some((n) => /permission/i.test(n))).toBe(true);
    });
  });

  // ============================================================================
  // toOAC() — the IMPORT direction (still accepts legacy .claude/ shapes)
  // ============================================================================

  describe("toOAC() - parsing config.json", () => {
    it("parses minimal config.json", async () => {
      const result = await adapter.toOAC(
        JSON.stringify({
          name: "TestAgent",
          description: "Test description",
          systemPrompt: "You are helpful",
        })
      );

      expect(result.frontmatter.name).toBe("TestAgent");
      expect(result.frontmatter.description).toBe("Test description");
      expect(result.systemPrompt).toBe("You are helpful");
      expect(result.frontmatter.mode).toBe("primary");
    });

    it("parses config with tools array", async () => {
      const result = await adapter.toOAC(
        JSON.stringify({ name: "Agent", description: "Test", tools: ["Read", "Write", "Bash"] })
      );

      expect(result.frontmatter.tools).toEqual({ read: true, write: true, bash: true });
    });

    it("parses config with tools string", async () => {
      const result = await adapter.toOAC(
        JSON.stringify({ name: "Agent", description: "Test", tools: "Read, Write, Edit" })
      );

      expect(result.frontmatter.tools).toEqual({ read: true, write: true, edit: true });
    });

    it("parses config with skills", async () => {
      const result = await adapter.toOAC(
        JSON.stringify({ name: "Agent", description: "Test", skills: ["skill1", "skill2"] })
      );

      expect(result.frontmatter.skills).toEqual(["skill1", "skill2"]);
    });

    it("parses config with hooks", async () => {
      const result = await adapter.toOAC(
        JSON.stringify({
          name: "Agent",
          description: "Test",
          hooks: {
            PreToolUse: [{ matcher: "*.txt", hooks: [{ type: "command", command: "validate" }] }],
          },
        })
      );

      expect(result.frontmatter.hooks?.length).toBe(1);
      expect(result.frontmatter.hooks?.[0].event).toBe("PreToolUse");
      expect(result.frontmatter.hooks?.[0].matchers).toEqual(["*.txt"]);
    });

    it("handles missing optional fields gracefully", async () => {
      const result = await adapter.toOAC(
        JSON.stringify({ name: "MinimalAgent", description: "Minimal" })
      );

      expect(result.frontmatter.name).toBe("MinimalAgent");
      expect(result.systemPrompt).toBe("");
      expect(result.frontmatter.tools).toBeUndefined();
      expect(result.frontmatter.skills).toBeUndefined();
    });

    it("parses invalid JSON as markdown (subagent fallback)", async () => {
      const result = await adapter.toOAC("not valid json");

      expect(result.frontmatter.mode).toBe("subagent");
      expect(result.systemPrompt).toBe("not valid json");
    });

    it("handles null system prompt", async () => {
      const result = await adapter.toOAC(
        JSON.stringify({ name: "Agent", description: "Test", systemPrompt: null })
      );

      expect(result.systemPrompt).toBe("");
    });
  });

  describe("toOAC() - parsing agent.md with YAML frontmatter", () => {
    it("parses agent.md with minimal frontmatter", async () => {
      const result = await adapter.toOAC(
        `---\nname: SubAgent\ndescription: A subagent\n---\n\nThis is the system prompt.`
      );

      expect(result.frontmatter.name).toBe("SubAgent");
      expect(result.frontmatter.description).toBe("A subagent");
      expect(result.frontmatter.mode).toBe("subagent");
      expect(result.systemPrompt).toBe("This is the system prompt.");
    });

    it("parses a committed plugin agent's flat tools list", async () => {
      const result = await adapter.toOAC(
        `---\nname: code-reviewer\ndescription: Reviews\ntools: Read, Glob, Grep\nmodel: sonnet\n---\n\nPrompt`
      );

      expect(result.frontmatter.tools).toEqual({ read: true, glob: true, grep: true });
      expect(result.frontmatter.model).toBe("claude-sonnet-4");
    });

    it("handles agent.md without frontmatter as markdown content", async () => {
      const result = await adapter.toOAC("No frontmatter here, just markdown content");

      expect(result.systemPrompt).toBe("No frontmatter here, just markdown content");
      expect(result.frontmatter.mode).toBe("subagent");
    });

    it("preserves multiline system prompt", async () => {
      const result = await adapter.toOAC(
        `---\nname: Agent\ndescription: Test\n---\n\nLine one.\nLine two.\nLine three.`
      );

      expect(result.systemPrompt).toContain("Line one.");
      expect(result.systemPrompt).toContain("Line three.");
    });
  });

  describe("model mapping (Claude to OAC)", () => {
    it("maps dated sonnet id to claude-sonnet-4", async () => {
      const result = await adapter.toOAC(
        JSON.stringify({ name: "A", description: "T", model: "claude-sonnet-4-20250514" })
      );

      expect(result.frontmatter.model).toBe("claude-sonnet-4");
    });

    it("maps short model aliases", async () => {
      const result = await adapter.toOAC(
        JSON.stringify({ name: "A", description: "T", model: "opus" })
      );

      expect(result.frontmatter.model).toBe("claude-opus-4");
    });

    it("preserves unknown models", async () => {
      const result = await adapter.toOAC(
        JSON.stringify({ name: "A", description: "T", model: "claude-custom-model" })
      );

      expect(result.frontmatter.model).toBe("claude-custom-model");
    });

    it("handles missing model gracefully", async () => {
      const result = await adapter.toOAC(JSON.stringify({ name: "A", description: "T" }));

      expect(result.frontmatter.model).toBeUndefined();
    });
  });

  // ============================================================================
  // fromOAC() — legacy in-memory interface, retargeted to the plugin layout
  // ============================================================================

  describe("fromOAC()", () => {
    const createAgent = (overrides?: Partial<AgentFrontmatter>): OpenAgent => ({
      frontmatter: {
        name: "CodeAnalyzer",
        description: "Analyzes code",
        mode: "subagent",
        ...overrides,
      },
      metadata: { name: "CodeAnalyzer", category: "specialist", type: "subagent" },
      systemPrompt: "Analyze code quality",
      contexts: [],
    });

    it("emits a single agent markdown file", async () => {
      const result = await adapter.fromOAC(createAgent());

      expect(result.success).toBe(true);
      expect(result.configs).toHaveLength(1);
      expect(result.configs[0].fileName).toBe("plugins/claude-code/agents/CodeAnalyzer.md");
      expect(result.configs[0].encoding).toBe("utf-8");
    });

    it("generates flat frontmatter and includes the system prompt", async () => {
      const result = await adapter.fromOAC(createAgent());
      const content = result.configs[0].content;

      expect(content).toMatch(/^---\nname: CodeAnalyzer\ndescription: Analyzes code\n/);
      expect(content).toContain("---\n\n");
      expect(content).toContain("Analyze code quality");
    });

    it("maps an authored tools map through the canonical ordering", async () => {
      const result = await adapter.fromOAC(
        createAgent({ tools: { bash: true, read: true, write: false } })
      );

      expect(result.configs[0].content).toMatch(/^tools: Read, Bash$/m);
    });

    it("projects an authored permission map fail-closed", async () => {
      const result = await adapter.fromOAC(
        createAgent({ permission: { bash: { "*": "deny", "git log*": "allow" } } })
      );

      expect(result.configs[0].content).toMatch(/^disallowedTools: Bash$/m);
      expect(result.warnings.some((w) => /bash/i.test(w))).toBe(true);
    });

    it("does not emit a permissionMode — Claude Code has no such agent field", async () => {
      const result = await adapter.fromOAC(
        createAgent({ permission: { read: "allow", write: "allow" } })
      );

      expect(result.configs[0].content).not.toContain("permissionMode");
      expect(result.configs[0].content).not.toContain("bypassPermissions");
    });

    it("warns when temperature is set (unsupported)", async () => {
      const result = await adapter.fromOAC(createAgent({ temperature: 0.7 }));

      expect(result.warnings.some((w) => w.includes("temperature"))).toBe(true);
    });

    it("warns when maxSteps is set (unsupported)", async () => {
      const result = await adapter.fromOAC(createAgent({ maxSteps: 10 }));

      expect(result.warnings.some((w) => w.includes("maxSteps"))).toBe(true);
    });

    it("includes validation warnings for a nameless agent", async () => {
      const result = await adapter.fromOAC(createAgent({ name: "", description: "" }));

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("includes capabilities in the result", async () => {
      const result = await adapter.fromOAC(createAgent());

      expect(result.capabilities?.name).toBe("claude");
    });

    it("handles an empty system prompt", async () => {
      const result = await adapter.fromOAC({ ...createAgent(), systemPrompt: "" });

      expect(result.success).toBe(true);
      expect(result.configs[0].content).toBe(
        "---\nname: CodeAnalyzer\ndescription: Analyzes code\n---\n\n\n"
      );
    });

    it("carries hooks nowhere in agent frontmatter", async () => {
      // Claude Code agent frontmatter accepts name/description/tools/disallowedTools/model
      // and nothing else. The old adapter wrote a `hooks:` key that Claude Code silently
      // ignores, which reads as support that does not exist.
      const hook: HookDefinition = {
        event: "PreToolUse",
        matchers: ["*.txt"],
        commands: [{ type: "command", command: "validate" }],
      };

      const result = await adapter.fromOAC(createAgent({ hooks: [hook] }));

      expect(result.configs[0].content).not.toContain("hooks");
    });
  });

  // ============================================================================
  // SKILLS GENERATION FROM CONTEXTS
  // ============================================================================

  describe("fromOAC() - generating skills from contexts", () => {
    const withContexts = (
      contexts: Array<{ path: string; priority?: string; description?: string }>
    ): OpenAgent => ({
      frontmatter: { name: "Agent", description: "Test", mode: "primary" },
      metadata: { name: "Agent", category: "core", type: "agent" },
      systemPrompt: "Prompt",
      contexts,
    });

    it("generates skill files under the plugin tree", async () => {
      const result = await adapter.fromOAC(
        withContexts([
          { path: ".opencode/context/skills/python.md", description: "Python standards" },
        ])
      );

      const skill = result.configs.find((c) => c.fileName.includes("/skills/"));
      expect(skill?.fileName).toBe("plugins/claude-code/skills/python/SKILL.md");
    });

    it("generates a slugified skill name from the context path", async () => {
      const result = await adapter.fromOAC(
        withContexts([{ path: "docs/React Hooks Guide.md", description: "React docs" }])
      );

      expect(result.configs.find((c) => c.fileName.includes("/skills/"))?.fileName).toMatch(
        /react-hooks-guide/
      );
    });

    it("includes context priority in skill content", async () => {
      const result = await adapter.fromOAC(
        withContexts([{ path: "context/important.md", priority: "high", description: "Ctx" }])
      );

      expect(result.configs.find((c) => c.fileName.includes("/skills/"))?.content).toContain(
        "Priority: high"
      );
    });

    it("generates one skill per context", async () => {
      const result = await adapter.fromOAC(
        withContexts([{ path: "a.md" }, { path: "b.md" }, { path: "c.md" }])
      );

      expect(result.configs.filter((c) => c.fileName.includes("/skills/"))).toHaveLength(3);
    });

    it("falls back to a generated description when the context lacks one", async () => {
      const result = await adapter.fromOAC(withContexts([{ path: ".opencode/context/styles.md" }]));
      const skill = result.configs.find((c) => c.fileName.includes("/skills/"));

      expect(skill?.content).toContain("Context from");
      expect(skill?.content).toContain("styles.md");
    });
  });

  // ============================================================================
  // VALIDATION
  // ============================================================================

  describe("validateConversion()", () => {
    const createAgent = (overrides?: Partial<AgentFrontmatter>): OpenAgent => ({
      frontmatter: { name: "Agent", description: "Test", mode: "primary", ...overrides },
      metadata: { name: "Agent", category: "core", type: "agent" },
      systemPrompt: "Prompt",
      contexts: [],
    });

    it("returns no warnings for valid agent", () => {
      expect(adapter.validateConversion(createAgent())).toHaveLength(0);
    });

    it("warns when name is missing", () => {
      expect(adapter.validateConversion(createAgent({ name: "" })).some((w) => w.includes("name"))).toBe(
        true
      );
    });

    it("warns when description is missing", () => {
      expect(
        adapter
          .validateConversion(createAgent({ description: "" }))
          .some((w) => w.includes("description"))
      ).toBe(true);
    });

    it("warns about granular permission degradation", () => {
      const warnings = adapter.validateConversion(
        createAgent({ permission: { read: { "file1.txt": "allow", "file2.txt": "deny" } } })
      );

      expect(warnings.some((w) => w.includes("granular permissions"))).toBe(true);
    });

    it("does not warn about simple permission rules", () => {
      const warnings = adapter.validateConversion(
        createAgent({ permission: { read: "allow", write: "allow" } })
      );

      expect(warnings.some((w) => w.includes("granular permissions"))).toBe(false);
    });
  });
});
