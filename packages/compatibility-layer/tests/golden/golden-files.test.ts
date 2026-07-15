/**
 * Golden-file snapshots — per adapter, per agent.
 *
 * Two corpora, on purpose:
 *
 *   1. `fixtures/` + `expected/` — 2 agents x 2 targets, controlled input. These pin the
 *      details a live corpus does not happen to exercise (a deny-all-then-allowlist bash
 *      block that Claude Code cannot represent, and must therefore fail CLOSED).
 *
 *   2. `plugins/claude-code/agents/` — the 7 agents already committed in the flat
 *      tools:/disallowedTools: format. This is a FREE regression corpus: whatever subtask 07
 *      emits must reproduce those 7 files byte-for-byte, and no one had to author an
 *      expectation for it. It is guess-free in a way `expected/` cannot be.
 *
 * ─── On the expected/ files being a specification ───────────────────────────────────────
 *
 * The adapters do not exist yet, so `expected/` was authored from the live formats rather
 * than captured from a run: the OpenCode files mirror `.opencode/agent/**` frontmatter minus
 * the `oac:` block; the Claude Code files mirror `plugins/claude-code/agents/**`. They are a
 * SPEC, and they are red until subtasks 06/07 land. If an adapter emits different-but-better
 * bytes, update these files deliberately and say why in the commit — that is the gate
 * working, not the gate being wrong. What must NOT happen is an adapter being relaxed to
 * match a golden, or a golden being regenerated blindly from adapter output.
 *
 * ─── The tool ordering rule, recovered from the live corpus ─────────────────────────────
 *
 * Verified 2026-07-15 against all 7 live agents: `tools:` and `disallowedTools:` are both
 * ordered `Read, Write, Edit, Glob, Grep, Bash, WebFetch, Task`. Every one of the 10 lists
 * across those files is consistent with it, and it is the ONLY total order that is —
 * alphabetical is not (`context-manager.md` is `Read, Write, Glob, Grep, Bash`), and neither
 * is `ToolAccessSchema` field order (which would put Bash before Glob/Grep). Subtask 07 must
 * emit this order or the 7 will not reproduce.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import {
  importPendingSymbols,
  listFiles,
  packagePath,
  repoPath,
  requireMethod,
} from "../support/pending.js";

const FIXTURES = packagePath("tests/golden/fixtures");
const EXPECTED = packagePath("tests/golden/expected");
const LIVE_CC_AGENTS = repoPath("plugins/claude-code/agents");

/** The canonical emit order for Claude Code tool lists, recovered from the live corpus. */
export const CLAUDE_TOOL_ORDER = [
  "Read",
  "Write",
  "Edit",
  "Glob",
  "Grep",
  "Bash",
  "WebFetch",
  "Task",
] as const;

const TARGETS = ["opencode", "claude-code"] as const;
const AGENTS = ["fixture-reviewer", "fixture-planner"] as const;

interface Adapter {
  fromCanonical(source: string): Promise<{ content: string; warnings?: string[] }>;
}

const ADAPTER_MODULE: Record<(typeof TARGETS)[number], { path: string; symbol: string; owedBy: string }> = {
  opencode: {
    path: "src/adapters/OpenCodeAdapter.ts",
    symbol: "OpenCodeAdapter",
    owedBy: "subtask 06 (src/adapters/OpenCodeAdapter.ts)",
  },
  "claude-code": {
    path: "src/adapters/ClaudeAdapter.ts",
    symbol: "ClaudeAdapter",
    owedBy: "subtask 07 (src/adapters/ClaudeAdapter.ts)",
  },
};

async function adapterFor(target: (typeof TARGETS)[number], why: string): Promise<Adapter> {
  const { path, symbol, owedBy } = ADAPTER_MODULE[target];
  const module = await importPendingSymbols<Record<string, new () => Adapter>>(
    path,
    [symbol],
    owedBy,
    why
  );
  // ClaudeAdapter already exists and speaks the old `fromOAC` interface, so the symbol probe
  // alone would let this through and fail as a bare TypeError. Name the gap instead.
  return requireMethod(new module[symbol]!(), "fromCanonical", owedBy, why);
}

function fixture(agent: string): string {
  return readFileSync(join(FIXTURES, `${agent}.md`), "utf-8");
}

function golden(target: string, agent: string): string {
  return readFileSync(join(EXPECTED, target, `${agent}.md`), "utf-8");
}

// ============================================================================
// Green today — the corpora themselves are well-formed
// ============================================================================

describe("golden corpus", () => {
  it("has a fixture and both goldens for each agent", () => {
    for (const agent of AGENTS) {
      expect(() => fixture(agent), `fixtures/${agent}.md`).not.toThrow();
      for (const target of TARGETS) {
        expect(() => golden(target, agent), `expected/${target}/${agent}.md`).not.toThrow();
      }
    }
  });

  it("keeps the oac: block out of every golden — it is authoring-only", () => {
    for (const target of TARGETS) {
      for (const agent of AGENTS) {
        expect(golden(target, agent), `expected/${target}/${agent}.md leaks the oac: block`).not.toContain(
          "oac:"
        );
      }
    }
  });

  it("fails closed in the claude-code golden: an unrepresentable bash allowlist becomes a deny", () => {
    // fixture-planner authorises `git status` / `git log*` AFTER a catch-all bash deny.
    // Claude Code has no ordered-glob equivalent, so the only safe degradation is to deny
    // Bash outright. A golden that listed Bash under `tools:` would be silently widening
    // access — the exact failure mode the permission work exists to prevent.
    const emitted = golden("claude-code", "fixture-planner");

    expect(emitted).toMatch(/^disallowedTools:.*\bBash\b/m);
    expect(emitted).not.toMatch(/^tools:.*\bBash\b/m);
  });

  it("orders every live tool list by the canonical order", () => {
    const rank = (tool: string): number => {
      const at = CLAUDE_TOOL_ORDER.indexOf(tool as (typeof CLAUDE_TOOL_ORDER)[number]);
      expect(at, `"${tool}" is not in CLAUDE_TOOL_ORDER`).toBeGreaterThanOrEqual(0);
      return at;
    };

    for (const file of listFiles(LIVE_CC_AGENTS)) {
      for (const key of ["tools", "disallowedTools"]) {
        const line = new RegExp(`^${key}: (.+)$`, "m").exec(readFileSync(file, "utf-8"));
        if (line === null) continue;

        const tools = line[1]!.split(",").map((tool) => tool.trim());
        expect(tools, `${basename(file)} ${key}:`).toEqual(
          [...tools].sort((a, b) => rank(a) - rank(b))
        );
      }
    }
  });
});

// ============================================================================
// RED — adapters must reproduce the goldens
// ============================================================================

describe.each(TARGETS)("%s adapter goldens", (target) => {
  it.each(AGENTS)(`reproduces expected/${target}/%s.md byte-for-byte`, async (agent) => {
    const adapter = await adapterFor(
      target,
      `emitting fixtures/${agent}.md for ${target} reproduces expected/${target}/${agent}.md exactly`
    );

    const { content } = await adapter.fromCanonical(fixture(agent));

    expect(content).toBe(golden(target, agent));
  });
});

describe("claude-code adapter against the live corpus", () => {
  const OWED_BY = "subtasks 07 + 09 (ClaudeAdapter + content/agents/)";

  it("warns when it degrades an ordered bash allowlist to a binary deny", async () => {
    const adapter = await adapterFor(
      "claude-code",
      "degrading an ordered rule list to Claude Code's binary model emits a warning rather " +
        "than silently dropping the allowlist"
    );

    const { warnings } = await adapter.fromCanonical(fixture("fixture-planner"));

    expect(warnings ?? []).toEqual(
      expect.arrayContaining([expect.stringMatching(/bash/i)])
    );
  });

  it("regenerates all 7 committed agents byte-for-byte", async () => {
    // The strongest gate in this file: no expectation was authored, so nothing here can be
    // wrong-by-guess. If the rebuild does not reproduce these bytes, the build is not yet a
    // faithful replacement for what is already shipping.
    const live = listFiles(LIVE_CC_AGENTS);
    expect(live.length, "expected the 7 committed Claude Code agents").toBe(7);

    const { buildAgent } = await importPendingSymbols<{
      buildAgent: (id: string, target: string) => Promise<string>;
    }>(
      "src/core/BuildPipeline.ts",
      ["buildAgent"],
      OWED_BY,
      "rebuilding each of the 7 committed Claude Code agents from content/agents/ reproduces " +
        "the file already on disk, byte-for-byte"
    );

    for (const file of live) {
      const id = basename(file, ".md");
      expect(await buildAgent(id, "claude-code"), `${id} drifted from its committed file`).toBe(
        readFileSync(file, "utf-8")
      );
    }
  });
});
