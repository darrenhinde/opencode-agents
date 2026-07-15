/**
 * Unit tests for the canonical `oac:` frontmatter block.
 *
 * The block carries what `.opencode/config/agent-metadata.json` holds today. The sidecar
 * exists only because OpenCode rejects unknown frontmatter keys; `oac build` strips the
 * block on emit, which is what lets the sidecar be dissolved.
 *
 * The load-bearing test here is `accepts every entry in the real corpus` — a schema that
 * does not accept its own corpus is not a schema, it is a wish.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  OacBlockSchema,
  CanonicalAgentSchema,
  OacCategorySchema,
  BuildTargetsSchema,
} from "../../../src/types.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../../../..");
const METADATA_PATH = join(REPO_ROOT, ".opencode/config/agent-metadata.json");

interface MetadataEntry {
  id: string;
  name: string;
  category: string;
  type: string;
  version: string;
  author: string;
  tags?: string[];
  dependencies?: string[];
}

function corpus(): Record<string, MetadataEntry> {
  const raw = JSON.parse(readFileSync(METADATA_PATH, "utf-8")) as {
    agents: Record<string, MetadataEntry>;
  };
  return raw.agents;
}

const VALID_BLOCK = {
  id: "openagent",
  name: "OpenAgent",
  category: "core",
  type: "agent",
  version: "1.0.0",
  author: "opencode",
  tags: ["universal", "coordination"],
  dependencies: ["subagent:contextscout", "context:standards-code"],
  targets: ["opencode", "claude-code"],
};

describe("OacBlockSchema", () => {
  describe("valid blocks", () => {
    it("accepts a fully populated block", () => {
      const result = OacBlockSchema.parse(VALID_BLOCK);

      expect(result.id).toBe("openagent");
      expect(result.targets).toEqual(["opencode", "claude-code"]);
    });

    it("normalizes flat typed dependency strings to { type, id }", () => {
      const result = OacBlockSchema.parse(VALID_BLOCK);

      expect(result.dependencies).toEqual([
        { type: "subagent", id: "contextscout" },
        { type: "context", id: "standards-code" },
      ]);
    });

    it("accepts structured dependency objects alongside the string form", () => {
      const result = OacBlockSchema.parse({
        ...VALID_BLOCK,
        dependencies: [{ type: "skill", id: "task-management" }, "context:standards-docs"],
      });

      expect(result.dependencies).toEqual([
        { type: "skill", id: "task-management" },
        { type: "context", id: "standards-docs" },
      ]);
    });

    it("accepts path-style dependency ids (registry uses them)", () => {
      const result = OacBlockSchema.parse({
        ...VALID_BLOCK,
        dependencies: ["context:core/standards/code-quality"],
      });

      expect(result.dependencies).toEqual([
        { type: "context", id: "core/standards/code-quality" },
      ]);
    });

    it("defaults version, author, tags, dependencies and targets", () => {
      const result = OacBlockSchema.parse({
        id: "contextscout",
        name: "ContextScout",
        category: "subagents/core",
        type: "subagent",
      });

      expect(result).toEqual({
        id: "contextscout",
        name: "ContextScout",
        category: "subagents/core",
        type: "subagent",
        version: "1.0.0",
        author: "opencode",
        tags: [],
        dependencies: [],
        targets: ["opencode"],
      });
    });
  });

  describe("rejected blocks", () => {
    it("rejects an unknown top-level key (strict)", () => {
      const result = OacBlockSchema.safeParse({ ...VALID_BLOCK, colour: "blue" });

      expect(result.success).toBe(false);
    });

    it("rejects targets: [] — a component that emits nowhere", () => {
      const result = OacBlockSchema.safeParse({ ...VALID_BLOCK, targets: [] });

      expect(result.success).toBe(false);
    });

    it("rejects an unknown target", () => {
      const result = OacBlockSchema.safeParse({ ...VALID_BLOCK, targets: ["emacs"] });

      expect(result.success).toBe(false);
    });

    it("rejects a non-kebab-case id", () => {
      for (const id of ["OpenAgent", "open_agent", "open agent", "-openagent", ""]) {
        expect(OacBlockSchema.safeParse({ ...VALID_BLOCK, id }).success).toBe(false);
      }
    });

    it("rejects a missing id or name", () => {
      const { id: _id, ...noId } = VALID_BLOCK;
      const { name: _name, ...noName } = VALID_BLOCK;

      expect(OacBlockSchema.safeParse(noId).success).toBe(false);
      expect(OacBlockSchema.safeParse(noName).success).toBe(false);
    });

    it("rejects a non-SemVer version", () => {
      for (const version of ["1.0", "v1.0.0", "latest"]) {
        expect(OacBlockSchema.safeParse({ ...VALID_BLOCK, version }).success).toBe(false);
      }
    });

    it("rejects an unknown category root", () => {
      expect(OacBlockSchema.safeParse({ ...VALID_BLOCK, category: "kore" }).success).toBe(
        false
      );
    });

    it("rejects an untyped or unknown-typed dependency", () => {
      for (const dep of ["contextscout", "wizard:merlin", ":contextscout"]) {
        expect(
          OacBlockSchema.safeParse({ ...VALID_BLOCK, dependencies: [dep] }).success
        ).toBe(false);
      }
    });

    it("rejects an unknown type", () => {
      expect(OacBlockSchema.safeParse({ ...VALID_BLOCK, type: "plugin" }).success).toBe(
        false
      );
    });
  });

  describe("the real corpus", () => {
    it("accepts every entry in .opencode/config/agent-metadata.json", () => {
      const entries = Object.entries(corpus());
      expect(entries.length).toBeGreaterThan(0);

      const rejected = entries
        .map(([key, entry]) => ({ key, result: OacBlockSchema.safeParse(entry) }))
        .filter(({ result }) => !result.success)
        .map(({ key, result }) => `${key}: ${JSON.stringify(result.error?.issues)}`);

      expect(rejected).toEqual([]);
    });

    it("covers every field the sidecar uses, so nothing is lost dissolving it", () => {
      const used = new Set(Object.values(corpus()).flatMap((entry) => Object.keys(entry)));
      const known = new Set(Object.keys(OacBlockSchema.shape));

      expect([...used].filter((field) => !known.has(field))).toEqual([]);
    });

    it("round-trips sidecar dependency strings back to their authored form", () => {
      for (const entry of Object.values(corpus())) {
        const parsed = OacBlockSchema.parse(entry);
        const reemitted = parsed.dependencies.map((dep) => `${dep.type}:${dep.id}`);

        expect(reemitted).toEqual(entry.dependencies ?? []);
      }
    });
  });
});

describe("OacCategorySchema", () => {
  it("accepts the corpus categories, including the subagents/* paths", () => {
    for (const category of ["core", "meta", "content", "data", "testing", "subagents/core"]) {
      expect(OacCategorySchema.safeParse(category).success).toBe(true);
    }
  });

  it("rejects deep paths and bad segments", () => {
    for (const category of ["subagents/core/extra", "subagents/Core", "/core", "core/"]) {
      expect(OacCategorySchema.safeParse(category).success).toBe(false);
    }
  });
});

describe("BuildTargetsSchema", () => {
  it("defaults to opencode when omitted", () => {
    expect(BuildTargetsSchema.parse(undefined)).toEqual(["opencode"]);
  });

  it("rejects an explicit empty list", () => {
    expect(BuildTargetsSchema.safeParse([]).success).toBe(false);
  });
});

describe("CanonicalAgentSchema", () => {
  const AGENT = {
    name: "OpenAgent",
    description: "Universal coordination agent",
    mode: "primary",
    oac: VALID_BLOCK,
  };

  it("accepts OpenCode-legal frontmatter plus an oac block", () => {
    const result = CanonicalAgentSchema.parse(AGENT);

    expect(result.oac.id).toBe("openagent");
    expect(result.mode).toBe("primary");
  });

  it("requires the oac block", () => {
    const { oac: _oac, ...withoutOac } = AGENT;

    expect(CanonicalAgentSchema.safeParse(withoutOac).success).toBe(false);
  });

  it("still requires OpenCode-legal frontmatter", () => {
    const { description: _description, ...withoutDescription } = AGENT;

    expect(CanonicalAgentSchema.safeParse(withoutDescription).success).toBe(false);
  });

  it("desugars authored permission map sugar into ordered rules", () => {
    const result = CanonicalAgentSchema.parse({
      ...AGENT,
      permission: { edit: "deny", bash: { "*": "deny", "ls*": "allow" } },
    });

    expect(result.permission).toEqual([
      { capability: "edit", rules: [{ pattern: "*", action: "deny" }] },
      {
        capability: "bash",
        rules: [
          { pattern: "*", action: "deny" },
          { pattern: "ls*", action: "allow" },
        ],
      },
    ]);
  });
});
