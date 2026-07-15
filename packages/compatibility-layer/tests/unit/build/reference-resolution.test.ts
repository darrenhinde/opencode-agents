/**
 * Reference resolution — every `context:` / `subagent:` dep must resolve to a real component.
 *
 * ─── Why this suite is the important one ────────────────────────────────────────────────
 *
 * `scripts/registry/validate-registry.sh` currently prints:
 *
 *     Total paths checked:    244
 *     Valid paths:            244
 *     Missing paths:          0
 *     Missing dependencies:   0
 *     ✓ All component dependencies are valid!
 *
 * and exits 0. That is a FALSE GREEN, reproduced on disk 2026-07-15. Four references are
 * broken right now and the validator reports none of them, because it is blind in two ways
 * that the tests below pin down structurally:
 *
 *   1. It reads `registry.json` and nothing else. It never parses the `dependencies:`
 *      frontmatter that actually ships in the component files, so drift between a registry
 *      entry and its own file is undetectable. `.opencode/command/add-context.md` is exactly
 *      that: its registry entry lists the four correct bare ids while its frontmatter lists
 *      three path-style ids that resolve to nothing.
 *   2. It iterates `.components.*[].dependencies` only. `.profiles.*.components` — 209 refs
 *      across 5 profiles — is never validated, which is how a wildcard expanding to zero
 *      matches sits in the `advanced` profile unnoticed.
 *
 * ─── The dead-ref count is 4, not 9 ─────────────────────────────────────────────────────
 *
 * A "9 known dead context import paths" figure circulated in earlier planning notes. It was
 * never substantiated: no doc, commit or script produces it, and no scan of this tree
 * reproduces it. The repo's own docs say three
 * (`01-feature-inventory.md:955`, `06-REVIEW.md:309`); a fourth — the profile wildcard —
 * was found while writing this suite and is recorded in `task.json` notes. The oracle in
 * `tests/support/references.ts` finds exactly these 4 and no others. `9` is treated here as
 * folklore and is asserted against, so it cannot quietly return.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  allReferences,
  deadReferences,
  format,
  frontmatterReferences,
  loadRegistry,
  profileReferences,
  registryComponentReferences,
  resolveAll,
  type Resolution,
} from "../../support/references.js";
import { importPendingSymbols, repoPath } from "../../support/pending.js";

/**
 * The four dead references in this tree, verified on disk 2026-07-15.
 *
 * This is a snapshot of a KNOWN BUG, not an invariant to preserve. When a subtask repairs
 * one of these refs, the "is still dead" test below turns red — that is correct and
 * intended: fixing a dead ref must be a deliberate edit here, never a silent drift.
 */
const KNOWN_DEAD: readonly { ref: string; source: string; why: string }[] = [
  {
    ref: "context:core/context-system/standards/mvi.md",
    source: ".opencode/command/add-context.md",
    why: "path-style-with-.md, but the registry id is the bare slug `mvi`",
  },
  {
    ref: "context:core/context-system/standards/frontmatter.md",
    source: ".opencode/command/add-context.md",
    why: "path-style-with-.md, but the registry id is the bare slug `frontmatter`",
  },
  {
    ref: "context:core/standards/project-intelligence.md",
    source: ".opencode/command/add-context.md",
    why: "path-style-with-.md, but the registry id is the bare slug `project-intelligence`",
  },
  {
    ref: "context:context-system/*",
    source: "registry.json profiles.advanced.components",
    why: "expands to 0 matches — the real directory is .opencode/context/core/context-system/",
  },
];

/** The count that folklore claims. Asserted against so it cannot creep back in. */
const UNSUBSTANTIATED_COUNT = 9;

function describeAll(resolutions: readonly Resolution[]): string {
  return `\n${format(resolutions)}\n`;
}

// ============================================================================
// The facts — green today, and they lock the ground truth
// ============================================================================

describe("dead references in this tree", () => {
  it("finds exactly 4 dead references — not the unsubstantiated 9", () => {
    const dead = deadReferences();

    expect(dead.length, `dead references found:${describeAll(dead)}`).toBe(KNOWN_DEAD.length);
    expect(dead.length).not.toBe(UNSUBSTANTIATED_COUNT);
  });

  it.each(KNOWN_DEAD)("still reports $ref as dead ($why)", ({ ref, source }) => {
    const dead = deadReferences();
    const match = dead.find((d) => d.ref === ref && d.source.includes(source));

    expect(
      match,
      `expected ${ref} (authored in ${source}) to resolve to nothing.\n` +
        `If a subtask has repaired it, delete its entry from KNOWN_DEAD in this file — ` +
        `do not weaken the resolver.\nCurrently dead:${describeAll(dead)}`
    ).toBeDefined();
  });

  it("reports no dead references beyond the 4 known ones", () => {
    const unexpected = deadReferences().filter(
      (dead) => !KNOWN_DEAD.some((known) => known.ref === dead.ref)
    );

    expect(
      unexpected,
      `new reference rot has appeared since 2026-07-15:${describeAll(unexpected)}`
    ).toEqual([]);
  });

  it("classifies the three add-context refs as dead ids and the profile ref as a dead wildcard", () => {
    const dead = deadReferences();

    expect(dead.filter((d) => d.status === "dead-id").length).toBe(3);
    expect(dead.filter((d) => d.status === "dead-wildcard").length).toBe(1);
  });
});

// ============================================================================
// Why the shell validator cannot see them — the mechanism, asserted structurally
// ============================================================================

describe("validate-registry.sh blind spots", () => {
  it("cannot see frontmatter drift: add-context.md's file and registry entry disagree", () => {
    const registry = loadRegistry();
    const entry = registry.components.commands?.find((c) => c.id === "add-context");
    const onDisk = frontmatterReferences().filter((r) =>
      r.source.endsWith("command/add-context.md")
    );

    // The registry entry is correct — which is precisely why a registry-only validator is happy.
    expect(entry?.dependencies).toEqual([
      "subagent:context-organizer",
      "context:mvi",
      "context:frontmatter",
      "context:project-intelligence",
    ]);

    // The file that actually ships says something else, and three of its refs resolve to nothing.
    expect(onDisk.map((r) => r.ref)).toEqual([
      "subagent:context-organizer",
      "context:core/context-system/standards/mvi.md",
      "context:core/context-system/standards/frontmatter.md",
      "context:core/standards/project-intelligence.md",
    ]);

    expect(
      resolveAll(onDisk).filter((r) => r.status !== "ok").length,
      "the shipped frontmatter should contain 3 dead refs the registry entry hides"
    ).toBe(3);
  });

  it("never validates profile component lists, where the dead wildcard lives", () => {
    const registry = loadRegistry();
    const profileRefs = profileReferences(registry);
    const componentRefs = registryComponentReferences(registry);

    expect(Object.keys(registry.profiles).sort()).toEqual([
      "advanced",
      "business",
      "developer",
      "essential",
      "full",
    ]);
    expect(profileRefs.length).toBeGreaterThan(200);

    // The dead wildcard is authored ONLY in a profile — no component depends on it — so a
    // validator that walks components alone cannot reach it by any path.
    expect(profileRefs.map((r) => r.ref)).toContain("context:context-system/*");
    expect(componentRefs.map((r) => r.ref)).not.toContain("context:context-system/*");
  });

  it("wildcard misses are silent: the sibling context:openagents-repo/* does resolve", () => {
    const registry = loadRegistry();
    const [openagentsRepo] = resolveAll(
      [{ ref: "context:openagents-repo/*", source: "control" }],
      registry
    );
    const [contextSystem] = resolveAll(
      [{ ref: "context:context-system/*", source: "control" }],
      registry
    );

    // Both are authored in the same profile list, one line apart. Only one expands. That is
    // what makes the miss invisible to eyeballing as well as to the validator.
    expect(openagentsRepo?.status).toBe("ok");
    expect(contextSystem?.status).toBe("dead-wildcard");
  });

  it("registry context ids are bare slugs, so a path-style ref is genuinely a different namespace", () => {
    const registry = loadRegistry();
    const pathish = (registry.components.contexts ?? []).filter(
      (c) => c.id.includes("/") || c.id.endsWith(".md")
    );

    // If this ever becomes non-empty, path-style refs stop being a namespace error and this
    // whole diagnosis needs revisiting.
    expect(
      pathish.map((c) => c.id),
      "no registry context id may contain '/' or end in '.md'"
    ).toEqual([]);

    // The three add-context targets exist on disk — the files are fine, the refs are not.
    for (const id of ["mvi", "frontmatter", "project-intelligence"]) {
      const component = (registry.components.contexts ?? []).find((c) => c.id === id);
      expect(component, `registry should carry the bare context id "${id}"`).toBeDefined();
      expect(() => readFileSync(repoPath(component!.path), "utf-8")).not.toThrow();
    }
  });
});

// ============================================================================
// Coverage of the reference corpus
// ============================================================================

describe("reference corpus", () => {
  it("collects references from all three sources the repo authors", () => {
    const registry = loadRegistry();

    expect(registryComponentReferences(registry).length).toBeGreaterThan(0);
    expect(profileReferences(registry).length).toBeGreaterThan(0);
    expect(frontmatterReferences().length).toBeGreaterThan(0);
  });

  it("resolves the overwhelming majority of references, so the 4 stand out", () => {
    const resolutions = resolveAll(allReferences());
    const ok = resolutions.filter((r) => r.status === "ok");

    expect(resolutions.length).toBeGreaterThan(200);
    expect(ok.length).toBe(resolutions.length - KNOWN_DEAD.length);
  });
});

// ============================================================================
// RED — the shipped resolver (subtask 05) must agree with the oracle
// ============================================================================

const OWED_BY = "subtask 05 (src/core/ReferenceResolver.ts)";

describe("ReferenceResolver (shipped)", () => {
  it("exports a resolver", async () => {
    await importPendingSymbols(
      "src/core/ReferenceResolver.ts",
      ["ReferenceResolver"],
      OWED_BY,
      "the build has a real resolver rather than a test-local oracle"
    );
  });

  it("finds the same 4 dead references the oracle finds", async () => {
    const { ReferenceResolver } = await importPendingSymbols<{
      ReferenceResolver: new (root: string) => {
        findDeadReferences(): Promise<{ ref: string; source: string }[]>;
      };
    }>(
      "src/core/ReferenceResolver.ts",
      ["ReferenceResolver"],
      OWED_BY,
      "the shipped resolver finds exactly the 4 dead refs the oracle finds — and therefore " +
        "catches what validate-registry.sh reports as 244/244 green"
    );

    const found = await new ReferenceResolver(repoPath()).findDeadReferences();

    expect(found.map((f) => f.ref).sort()).toEqual(KNOWN_DEAD.map((k) => k.ref).sort());
  });

  it("resolves a live reference to the component's real path on disk", async () => {
    const { ReferenceResolver } = await importPendingSymbols<{
      ReferenceResolver: new (root: string) => {
        resolve(ref: string): { ok: boolean; path?: string };
      };
    }>(
      "src/core/ReferenceResolver.ts",
      ["ReferenceResolver"],
      OWED_BY,
      "a good reference resolves to the file that backs it"
    );

    const result = new ReferenceResolver(repoPath()).resolve("context:mvi");

    expect(result.ok).toBe(true);
    expect(result.path).toBe(".opencode/context/core/context-system/standards/mvi.md");
  });

  it("reports a dead reference with its source and a reason, not just a boolean", async () => {
    const { ReferenceResolver } = await importPendingSymbols<{
      ReferenceResolver: new (root: string) => {
        resolve(ref: string): { ok: boolean; reason?: string };
      };
    }>(
      "src/core/ReferenceResolver.ts",
      ["ReferenceResolver"],
      OWED_BY,
      "a dead reference is reported with a diagnostic reason a human can act on"
    );

    const result = new ReferenceResolver(repoPath()).resolve("context:context-system/*");

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/0 matches|expands to nothing|no .* match/i);
  });
});
