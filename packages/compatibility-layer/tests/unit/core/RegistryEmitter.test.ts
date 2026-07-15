/**
 * Registry emission — `registry.json` is GENERATED from `content/agents/**`, not hand-edited.
 *
 * ─── What is actually at stake ──────────────────────────────────────────────────────────
 *
 * `install.sh` reads `registry.json` and is the only shipping install path. Every assertion
 * here is really a statement about whether a real user can install this repo, which is why
 * this suite leans on the LIVE corpus rather than fixtures alone: a fixture tree cannot tell
 * us that the thing we ship is intact.
 *
 * Three properties matter, in this order:
 *
 *   1. Nothing that install.sh reads is lost (carry-through, aliases, eval-runner).
 *   2. The output is byte-stable and a fixed point over itself, or the subtask-11
 *      `oac build && git diff --exit-code` gate is a coin flip.
 *   3. The generated entries actually come from the canonical files.
 *
 * ─── Two snapshots of known defects live here ───────────────────────────────────────────
 *
 * {@link MISSING_FROM_REGISTRY} and {@link REGISTRY_ONLY_DEPENDENCIES} pin bugs, not
 * invariants — same pattern as `KNOWN_DEAD` in `reference-resolution.test.ts`. When a subtask
 * repairs one, the test turns red and forces a deliberate edit here. That is the point: the
 * drift these record is exactly the kind that accumulated silently for months because the only
 * validator in the repo could not see it.
 */

import { describe, it, expect } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  RegistryEmitter,
  emitRegistry,
  serializeRegistry,
  entryForAgent,
  type RegistryDocument,
  type RegistryEntry,
} from "../../../src/core/RegistryEmitter.js";
import { CanonicalAgentLoader } from "../../../src/core/AgentLoader.js";
import { repoPath } from "../../support/pending.js";

const COMMITTED_JSON = readFileSync(repoPath("registry.json"), "utf-8");
const COMMITTED = JSON.parse(COMMITTED_JSON) as RegistryDocument;

/** Categories phase 1 generates. Everything else is carried through verbatim. */
const GENERATED_CATEGORIES = ["agents", "subagents"] as const;

/** Anything that would make two runs differ. */
const NONDETERMINISM = [
  { name: "an ISO timestamp", pattern: /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/ },
  { name: "a 'generated at' stamp", pattern: /generated (at|on)[:\s]/i },
  { name: "an absolute home path", pattern: /\/(Users|home)\/[^/\s"]+/ },
];

/**
 * Agents that ship on disk, are referenced, and are ABSENT from the committed registry.
 *
 * Verified on disk 2026-07-15. `batch-executor` is the load-bearing one: both `openagent` and
 * `opencoder` declare `subagent:batch-executor`, so the registry has advertised a dependency
 * on a component it does not contain. The other six are in neither the registry nor
 * `.opencode/config/agent-metadata.json` — they were added to `.opencode/agent/` and nothing
 * ever noticed. `auto-detect-components.sh --dry-run` reports all 7 as "New Components" today.
 *
 * The emitter fixes all of these BY CONSTRUCTION, which is the whole argument for generating.
 */
const MISSING_FROM_REGISTRY = [
  "adr-manager",
  "architecture-analyzer",
  "batch-executor",
  "contract-manager",
  "prioritization-engine",
  "stage-orchestrator",
  "story-mapper",
] as const;

/**
 * Dependency edges that exist ONLY in `registry.json` — no agent file and no sidecar entry
 * declares them, so generating from the canonical tree DROPS them.
 *
 * This is a real regression, not a cleanup: `install.sh` resolves these transitively today
 * (`resolve_dependencies`, install.sh:420), so installing `subagent:externalscout` currently
 * pulls in `skill:context7` and would stop doing so. They were hand-authored straight into
 * `registry.json` and never made it into any file, which is precisely the drift this refactor
 * exists to end — but the fix is to backfill `oac.dependencies` in `content/agents/**`, not to
 * let the emitter delete them silently.
 *
 * Pinned here so subtask 10 cannot emit for real while the loss is unresolved.
 */
const REGISTRY_ONLY_DEPENDENCIES: Readonly<Record<string, readonly string[]>> = {
  contextscout: [
    "command:check-context-deps",
    "context:registry-dependencies",
    "context:context-system",
    "context:mvi",
    "context:structure",
    "context:workflows",
    "subagent:externalscout",
    "context:root-navigation",
    "context:context-paths-config",
  ],
  externalscout: ["skill:context7", "context:context-system"],
  "image-specialist": ["tool:gemini"],
  "context-organizer": ["context:core/context-system/*"],
};

function entries(document: RegistryDocument, category: string): RegistryEntry[] {
  return document.components[category] ?? [];
}

function byId(document: RegistryDocument, category: string): Map<string, RegistryEntry> {
  return new Map(entries(document, category).map((entry) => [entry.id, entry]));
}

/** A throwaway repo root containing only a `registry.json`, for fixed-point testing. */
function scratchRoot(registryJson: string): string {
  const root = mkdtempSync(join(tmpdir(), "oac-registry-"));
  writeFileSync(join(root, "registry.json"), registryJson);
  return root;
}

// ============================================================================
// SERIALISATION — the diff must be semantic, never formatting
// ============================================================================

describe("serializeRegistry", () => {
  it("reproduces the committed registry.json byte-for-byte from its own parse", () => {
    // If this drifts, every generated-vs-committed diff drowns in whitespace and escaping
    // noise and the subtask-11 gate stops meaning anything. It also pins the non-ASCII
    // escaping: the committed file writes `—` and two emoji as escapes, which bare
    // `JSON.stringify` would emit as raw UTF-8.
    expect(serializeRegistry(COMMITTED)).toBe(COMMITTED_JSON);
  });

  it("escapes non-ASCII rather than emitting raw UTF-8", () => {
    const json = serializeRegistry({ components: {}, note: "em—dash ⛔" } as RegistryDocument);

    expect(json).toContain("em\\u2014dash \\u26d4");
    expect(json).not.toContain("—");
  });

  it("ends with exactly one trailing newline", () => {
    expect(serializeRegistry(COMMITTED).endsWith("}\n")).toBe(true);
    expect(serializeRegistry(COMMITTED).endsWith("}\n\n")).toBe(false);
  });
});

// ============================================================================
// DETERMINISM
// ============================================================================

describe("determinism", () => {
  it("emits byte-identical output across two runs", async () => {
    expect(await emitRegistry(repoPath())).toBe(await emitRegistry(repoPath()));
  });

  it("emits nothing that varies between runs", async () => {
    const json = await emitRegistry(repoPath());

    for (const { name, pattern } of NONDETERMINISM) {
      expect(json, `generated registry.json contains ${name}`).not.toMatch(pattern);
    }
  });

  it("carries metadata.lastUpdated from the base instead of stamping the clock", async () => {
    // auto-detect-components.sh:872 did `now | strftime("%Y-%m-%d")`, which alone would make
    // every rebuild a diff and every `git diff --exit-code` gate fail on an unchanged tree.
    const document = await new RegistryEmitter(repoPath()).emit();

    expect(document.metadata).toEqual(COMMITTED.metadata);
  });

  it("sorts generated entries by id, not by filesystem or insertion order", async () => {
    const document = await new RegistryEmitter(repoPath()).emit();

    for (const category of GENERATED_CATEGORIES) {
      const ids = entries(document, category).map((entry) => entry.id);
      expect(ids, `${category} is not id-sorted`).toEqual([...ids].sort());
    }
  });

  it("is a fixed point over its own output", async () => {
    // Subtask 10 writes this output back to registry.json, and the emitter then reads that as
    // its own base. If emitting were not idempotent the tree would oscillate and the diff gate
    // would fail forever on a tree nobody touched.
    const first = await emitRegistry(repoPath());
    const root = scratchRoot(first);

    try {
      const second = await new RegistryEmitter(root, {
        contentRoot: repoPath("content/agents"),
      }).emitJson();

      expect(second).toBe(first);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// ============================================================================
// CARRY-THROUGH — phase 1 owns agents only
// ============================================================================

describe("carry-through of everything the canonical tree does not own", () => {
  it("leaves non-agent component categories byte-identical", async () => {
    const document = await new RegistryEmitter(repoPath()).emit();
    const carried = Object.keys(COMMITTED.components).filter(
      (category) => !GENERATED_CATEGORIES.includes(category as (typeof GENERATED_CATEGORIES)[number])
    );

    expect(carried).toContain("contexts");
    for (const category of carried) {
      expect(entries(document, category), `${category} was modified`).toEqual(
        entries(COMMITTED, category)
      );
    }
  });

  it("leaves every non-components top-level key untouched, in order", async () => {
    const document = await new RegistryEmitter(repoPath()).emit();

    expect(Object.keys(document)).toEqual(Object.keys(COMMITTED));
    for (const key of Object.keys(COMMITTED).filter((k) => k !== "components")) {
      expect(document[key], `top-level "${key}" was modified`).toEqual(COMMITTED[key]);
    }
  });

  it("preserves the component category order", async () => {
    const document = await new RegistryEmitter(repoPath()).emit();

    expect(Object.keys(document.components)).toEqual(Object.keys(COMMITTED.components));
  });

  it("preserves context aliases", async () => {
    // install.sh resolve_dependencies matches `.id == $id or (.aliases | index($id))`
    // (install.sh:420). Dropping an alias silently uninstalls a component for anyone naming
    // it the aliased way.
    const document = await new RegistryEmitter(repoPath()).emit();
    const aliased = entries(document, "contexts").filter((entry) => entry.aliases !== undefined);

    expect(aliased.map((entry) => entry.id).sort()).toEqual([
      "component-planning",
      "feature-breakdown",
      "session-management",
    ]);
  });

  it("keeps registry profiles verbatim and never consults profile.json", async () => {
    // `.profiles` is what install.sh reads (get_profile_components, install.sh:292).
    // `.opencode/profiles/<name>/profile.json` has drifted from it on all 5 profiles and is
    // read only by check-dependencies.ts, which no install path invokes. Reconciling them is
    // a content decision; generating from the wrong one silently changes what users install.
    const document = await new RegistryEmitter(repoPath()).emit();

    expect(document.profiles).toEqual(COMMITTED.profiles);
  });

  it("leaves the dead advanced-profile wildcard exactly as authored", async () => {
    // `context:context-system/*` expands to zero registry paths. Repairing it to
    // `context:core/context-system/*` would change what `--profile advanced` installs, so it
    // stays a known-dead ref that ReferenceResolver reports rather than an emitter rewrite.
    const document = await new RegistryEmitter(repoPath()).emit();
    const advanced = document.profiles as Record<string, { components: string[] }>;

    expect(advanced.advanced?.components).toContain("context:context-system/*");
  });

  it("carries agents that have no canonical counterpart", async () => {
    // `agent:eval-runner` ships in `.opencode/agent/eval-runner.md` and is in the committed
    // registry, but `content/agents/` does not carry it yet. Generating agents purely from the
    // canonical tree would delete it and uninstall the eval harness.
    const document = await new RegistryEmitter(repoPath()).emit();

    expect(byId(document, "agents").get("eval-runner")).toEqual(
      byId(COMMITTED, "agents").get("eval-runner")
    );
  });

  it("never drops an id the committed registry publishes", async () => {
    const document = await new RegistryEmitter(repoPath()).emit();

    for (const category of Object.keys(COMMITTED.components)) {
      const generated = byId(document, category);
      const dropped = entries(COMMITTED, category)
        .map((entry) => entry.id)
        .filter((id) => !generated.has(id));

      expect(dropped, `${category} ids dropped by the emitter`).toEqual([]);
    }
  });
});

// ============================================================================
// GENERATION — entries come from the canonical files
// ============================================================================

describe("generation from the canonical tree", () => {
  it("derives every field of an entry from the canonical file", async () => {
    const document = await new RegistryEmitter(repoPath()).emit();
    const agents = await new CanonicalAgentLoader(repoPath("content/agents")).loadFromDirectory();
    const tester = agents.find((agent) => agent.oac.id === "tester");

    expect(tester).toBeDefined();
    expect(byId(document, "subagents").get("tester")).toEqual({
      id: "tester",
      name: "TestEngineer",
      type: "subagent",
      // Identity is oac.id, never the filename: the file is `test-engineer.md` but the
      // registry, the profiles and every context doc reference `tester`.
      path: ".opencode/agent/subagents/code/test-engineer.md",
      version: "1.0.0",
      description: tester!.frontmatter.description,
      tags: ["testing", "tdd", "quality"],
      dependencies: ["context:standards-tests"],
      category: "subagents/code",
    });
  });

  it("emits entry keys in the committed field order", async () => {
    const document = await new RegistryEmitter(repoPath()).emit();

    for (const category of GENERATED_CATEGORIES) {
      for (const entry of entries(document, category)) {
        if (entry.id === "eval-runner") continue; // carried through, keeps its own shape

        expect(Object.keys(entry), `${entry.id} field order`).toEqual([
          "id",
          "name",
          "type",
          "path",
          "version",
          "description",
          "tags",
          "dependencies",
          "category",
        ]);
      }
    }
  });

  it("points path at the built install tree, not the canonical source", async () => {
    // install.sh copies `.path` verbatim. If it named `content/agents/**` the installer would
    // fetch files that do not exist in the published layout.
    const document = await new RegistryEmitter(repoPath()).emit();

    for (const category of GENERATED_CATEGORIES) {
      for (const entry of entries(document, category)) {
        expect(entry.path, `${entry.id} path`).toMatch(/^\.opencode\/agent\//);
      }
    }
  });

  it("registers every canonical agent", async () => {
    const document = await new RegistryEmitter(repoPath()).emit();
    const agents = await new CanonicalAgentLoader(repoPath("content/agents")).loadFromDirectory();
    const registered = new Set([
      ...byId(document, "agents").keys(),
      ...byId(document, "subagents").keys(),
    ]);

    const unregistered = agents.map((a) => a.oac.id).filter((id) => !registered.has(id));
    expect(unregistered, "canonical agents the emitter failed to register").toEqual([]);
  });

  it("files an agent under the components key its oac.type names", async () => {
    const document = await new RegistryEmitter(repoPath()).emit();

    for (const entry of entries(document, "agents")) expect(entry.type).toBe("agent");
    for (const entry of entries(document, "subagents")) expect(entry.type).toBe("subagent");
  });

  it("resolves a fixture tree independently of the live corpus", async () => {
    const agents = await new CanonicalAgentLoader(repoPath("content/agents")).loadFromDirectory();
    const openagent = agents.find((agent) => agent.oac.id === "openagent");

    expect(entryForAgent(openagent!, ".opencode/agent")).toMatchObject({
      id: "openagent",
      type: "agent",
      path: ".opencode/agent/core/openagent.md",
      category: "core",
    });
    expect(entryForAgent(openagent!, "custom/root").path).toBe("custom/root/core/openagent.md");
  });
});

// ============================================================================
// DEFECTS THE EMITTER FIXES, AND ONE IT WOULD CAUSE
// ============================================================================

describe("registry defects", () => {
  it.each(MISSING_FROM_REGISTRY)("registers %s, which the committed registry omits", async (id) => {
    const document = await new RegistryEmitter(repoPath()).emit();

    expect(byId(COMMITTED, "subagents").has(id), `${id} is unexpectedly already registered`).toBe(
      false
    );
    expect(byId(document, "subagents").get(id)?.path).toContain(id);
  });

  it("makes subagent:batch-executor resolvable for openagent and opencoder", async () => {
    // Both declare `subagent:batch-executor`; the committed registry contains no such
    // component, so install.sh resolves the dependency to nothing and silently installs an
    // orchestrator whose parallel executor is missing.
    const document = await new RegistryEmitter(repoPath()).emit();
    const agents = byId(document, "agents");

    expect(agents.get("openagent")?.dependencies).toContain("subagent:batch-executor");
    expect(agents.get("opencoder")?.dependencies).toContain("subagent:batch-executor");
    expect(byId(document, "subagents").has("batch-executor")).toBe(true);
  });

  it("still drops the dependency edges that only registry.json declares", async () => {
    // A SNAPSHOT OF A KNOWN REGRESSION, not an invariant. These edges are hand-authored in
    // registry.json and absent from both the agent files and agent-metadata.json, so
    // generating from the canonical tree loses them. When subtask 05 backfills
    // `oac.dependencies` in `content/agents/**`, this test turns red — which is correct:
    // repairing the loss must be a deliberate edit here, never a silent drift.
    const document = await new RegistryEmitter(repoPath()).emit();
    const subagents = byId(document, "subagents");

    for (const [id, lost] of Object.entries(REGISTRY_ONLY_DEPENDENCIES)) {
      const before = new Set(byId(COMMITTED, "subagents").get(id)?.dependencies ?? []);
      const after = new Set(subagents.get(id)?.dependencies ?? []);

      for (const dependency of lost) {
        expect(before.has(dependency), `${id} -> ${dependency} vanished from registry.json`).toBe(
          true
        );
        expect(after.has(dependency), `${id} -> ${dependency} is no longer lost — update this snapshot`).toBe(
          false
        );
      }
    }
  });
});
