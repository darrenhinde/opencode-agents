# 02 — Canonical IR Schema — **v2**

> **Status:** Specification only — v2 (realigned to `00-INDEX.md` v2). No implementation.
> Zod blocks are *illustrative*: they define the target shape of `packages/core/src/schema/*.ts`,
> not code to ship as-is.
> **Read `00-INDEX.md` (v2) first.** Where this doc conflicts with the index, **the index wins**.
>
> **Changes from v1:**
> - §1.2 **Capabilities rewritten to Option A** (ordered rule list + scalar sugar) per locked
>   decision #5. The v1 flat model is withdrawn — verified provably lossy (§1.2.1).
> - **`guards` hint deleted.** Option A puts safety globs in content natively; the v1 open
>   question about globs is resolved and removed.
> - §4 **Context rewritten** around the MVI HTML-comment format per locked decision #6.
>   No YAML migration. Adds a precise parser spec — **the highest-risk parser requirement in
>   the project**.
> - Census corrected (§0.1); `CapabilityMatrix` row corrections folded into §8.

## 0. What this document is

The canonical **Intermediate Representation (IR)** is the tool-neutral in-memory shape that
`oac build --target <tool>` consumes. Authors write neutral content in `/content/`; the parser
produces IR objects validated by these schemas; adapters (Agent C) transform IR → per-tool
output. This doc defines the IR for **all seven content types** — Agent, Skill, Command, Context,
Tool, Hook, Registry entry.

For every field: name, type, required/optional, default, and whether it is a **neutral invariant**
(all adapters honor it) or a **hint** (adapters may drop it, but must report the drop via
`CapabilityMatrix` — never silently, per the index's "known and reported" rule).

`packages/compatibility-layer/src/types.ts` is the starting point but is still OpenCode-shaped in
several places. Each section ends with a **"Too OpenCode-shaped — must change"** callout citing
concrete lines.

### 0.1 Corrected census (re-verified independently for this doc)

| Item | Count | Method |
|---|---|---|
| Agents | **34** `.md` | `find .opencode/agent -name '*.md'` |
| Commands | **20** `.md` | `find .opencode/command -name '*.md'` |
| Context | **297** `.md` | `find .opencode/context -name '*.md'` |

⚠️ **Context count delta vs index.** The index states **296** (286 HTML-comment / 3 YAML /
7 neither). My reproducible count over `.opencode/context/**/*.md` gives **297**, and the
format breakdown is materially different from a naive reading — see §4.1, which supersedes the
"286/3/7" summary with a verified line-position analysis. The 1-file delta does not change any
design decision (the parser must handle every bucket regardless), but the *bucket semantics* do
change the parser spec. Flagged for reconciliation in Open Questions.

### 0.2 Design rules for neutrality

1. **Intent over syntax.** The IR encodes what the author wants, never a tool's serialization.
2. **Closed vocabularies for invariants, open strings for hints.** Anything an adapter must reason
   about is a Zod `enum`; free-form author intent stays `string`.
3. **`null` means "tool default"; absent means "unspecified".** Per locked decision #2.
4. **Metadata is folded into frontmatter.** No sidecar in `/content/`. The OpenCode *adapter* may
   re-emit `agent-metadata.json`; the IR has no sidecar concept.
5. **The authored on-disk format and the IR shape do not have to match** (locked decision #6).
   This is load-bearing for Context (§4): MVI HTML-comment on disk → structured fields in memory.

### 0.3 Shared primitives

```ts
import { z } from "zod";

/** Stable machine identity. Slug form; adapters re-case per tool (kebab for Claude,
 *  PascalCase for OpenCode). NEUTRAL INVARIANT — the join key across registry + deps. */
export const IdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  "id must be kebab-case: lowercase alphanumeric words joined by single hyphens");

/** Human display name. HINT for casing — adapters slugify/re-case freely. */
export const NameSchema = z.string().min(1);

/** One-line purpose. NEUTRAL INVARIANT — every tool surfaces a description. */
export const DescriptionSchema = z.string().min(1);

/** Free-form discovery labels. NEUTRAL but non-semantic — adapters may ignore. */
export const TagsSchema = z.array(z.string()).default([]);

/** Semver of the authored component. NEUTRAL for the registry/update engine; most tools
 *  drop it (HINT at the tool layer). NOTE: context files use X.Y on disk → normalized (§4). */
export const VersionSchema = z.string().regex(/^\d+\.\d+\.\d+$/).default("1.0.0");
```

---

## 1. Agent

Anchor of the refactor; must serialize to the three worked-example outputs in `00-INDEX.md` v2.
Real sources modelled against: `.opencode/agent/subagents/code/reviewer.md`,
`.opencode/agent/subagents/code/coder-agent.md`, `.opencode/agent/core/openagent.md`.

### 1.1 Role — `mode` → `role`

```ts
/** Whether the agent is user-facing or only reachable via delegation.
 *  NEUTRAL INVARIANT. Rationale: "who can invoke this" is universal (Claude: agent vs
 *  sub-agent; OpenCode: mode primary|subagent). We drop OpenCode's third value "all" —
 *  a tool quirk, not an authoring intent; no other tool models it. */
export const RoleSchema = z.enum(["primary", "subagent"]);
```

`types.ts:88` `AgentModeSchema` leaks `"all"`. On import, legacy `all` normalizes to `primary`
(widest reach) with a migration note; the IR never stores it.

⚠️ Per index v2 finding #5, `agentModes: claude` is **partial**, not full: the CC *plugin* layout
has no per-agent `mode:` — every file under `agents/` is a subagent, so `role: primary` flattens
and **must warn**. Reflected in §8.

### 1.2 Capabilities — **Option A: ordered rule list + scalar sugar** (locked)

#### 1.2.1 Why the v1 flat model is withdrawn (verified)

I re-verified the two agents the index cites. Both refute a flat scalar model:

```yaml
# .opencode/agent/subagents/code/coder-agent.md — deny-all-then-allowlist
permission:
  bash:
    "*": "deny"
    "bash .opencode/skills/task-management/router.sh complete*": "allow"
    "bash .opencode/skills/task-management/router.sh status*": "allow"
  edit:
    "**/*.env*": "deny"      # real per-agent security controls
    "**/*.key": "deny"
    "**/*.secret": "deny"
    "node_modules/**": "deny"
    ".git/**": "deny"
```

```yaml
# .opencode/agent/core/openagent.md — ask-by-default with specific denies
permission:
  bash:
    "*": "ask"
    "rm -rf *": "ask"
    "rm -rf /*": "deny"
    "sudo *": "deny"
    "> /dev/*": "deny"
```

No flat scalar expresses either: `bash: deny` breaks coder-agent's own `router.sh`; `bash: allow`
defeats the deny-all; and `coder-agent` (deny-by-default) vs `openagent` (ask-by-default) is a
deliberate distinction a flat model erases. **Option A is required.**

#### 1.2.2 The rule model

```ts
/** A single permission decision. NEUTRAL across allow/deny. "ask" is neutral in intent but
 *  UNSUPPORTED by claude/cursor/windsurf (CapabilityMatrix askPermissions = none) — a HINT
 *  there: adapters degrade per a documented strategy and MUST warn. */
export const DecisionSchema = z.enum(["allow", "deny", "ask"]);

/** One scoped rule. `scope` is a glob whose namespace depends on the capability (§1.2.3).
 *  NEUTRAL INVARIANT — {scope, decision} is the irreducible unit of authored intent. */
export const RuleSchema = z.object({
  scope: z.string().min(1),
  decision: DecisionSchema,
});

/** The full ordered form. Order is SEMANTIC and must be preserved end-to-end (§1.2.4). */
export const RuleListSchema = z.array(RuleSchema);
```

#### 1.2.3 Scope namespaces (per capability)

The closed capability vocabulary is unchanged from v1; what changes is that each maps to a
`RuleList` rather than a scalar. **`delegate` is not a special case** — it is simply the capability
whose scope namespace is *agent ids* instead of path/command globs. That unification is the main
elegance of Option A:

| Capability | Scope namespace | Example scope |
|---|---|---|
| `read` `write` `edit` `glob` `grep` | path glob | `**/*.env*`, `node_modules/**` |
| `bash` | command glob | `sudo *`, `bash …/router.sh status*` |
| `web` | URL/domain glob | `https://internal.*` |
| `delegate` | agent id (kebab) or `*` | `contextscout` |

#### 1.2.4 Precedence — ⚠️ index prose and index example conflict; needs ratification

The index v2 says *"first-match-wins ordering preserved"*, but its own worked example — and
**100% of the real scoped agents** — author **broad-first, specific-after**:

- coder-agent: `"*": deny` is **first**, allowlist entries follow.
- openagent: `"*": ask` is **first**, specific denies follow.

Under **naive first-match-wins in authored order**, `"*"` matches everything and every later rule
is unreachable: coder-agent's `router.sh` would be **denied** (breaking the exact behavior locked
decision #5 exists to protect), and openagent's `sudo *` would resolve to **ask**, not **deny** —
a real security regression. So first-match-wins over the authored order is provably wrong against
the current corpus.

Two semantics produce correct results on all real data:

| Semantics | Definition | Verdict on real data |
|---|---|---|
| **Last-match-wins** *(recommended)* | Evaluate in authored order; the **last** matching rule wins. | ✅ correct for both agents |
| Most-specific-wins | Order-independent; the most specific matching pattern wins. | ✅ correct for both agents |
| Naive first-match-wins | First matching rule wins. | ❌ breaks both |

**Recommendation: last-match-wins.** It (a) makes the index's own worked example correct *as
written*, with no re-authoring of 34 agents; (b) reads the way humans write policy — broad
default, then exceptions; (c) maps 1:1 to OpenCode's YAML mapping key order (JS string keys
preserve insertion order), so IR→OpenCode→IR round-trips order-preserving and lossless.
Most-specific-wins would need a specificity metric (pattern length? segment count?) that is
ambiguous for equal-specificity overlaps.

**Both candidates agree on every one of the 34 current agents**, so this choice is about
future-proofing, not migration risk. Critically, **the schema shape is identical either way** —
only the resolver's evaluation differs. So the shape below can be locked now and the semantics
ratified independently without blocking any workstream. Raised in Open Questions.

```ts
/** Resolve a request against a rule list. Illustrative signature only.
 *  Terminal fallback when NO rule matches = "allow" (§1.2.5). */
declare function resolve(rules: Rule[], request: string): "allow" | "deny" | "ask";
```

#### 1.2.5 Defaults — absent capability vs. no-rule-matched

Two distinct "nothing said" cases, and getting them wrong breaks every existing agent:

- **Capability absent** from `capabilities` → empty list `[]` → *no author constraint* → the
  tool's own default applies. Rationale: `openagent` declares no `write` key and OpenCode
  therefore **allows** write. If the IR defaulted `write: deny` (as v1 did), the build would
  silently strip a capability the agent relies on.
- **Rules present, none match** → terminal fallback **`allow`**.

Rationale for both: OpenCode's `permission` block is a **restriction list** over an
otherwise-permitted tool, and all 34 agents were authored against that semantics. Reinterpreting
them as deny-by-default would break the corpus. Authors wanting deny-by-default write it
explicitly — exactly as `coder-agent` does with a leading `{scope: "*", decision: "deny"}`.

> **v1 correction:** the v1 `CapabilitiesSchema` defaulted `write/edit/bash/web` to `deny`. That
> was wrong on this evidence and is withdrawn along with the flat model.

#### 1.2.6 Sugar ↔ full desugaring

Authors use sugar for the simple case; the parser desugars to the canonical list form. **The IR
stores only the desugared full form** — one shape for adapters to consume.

```ts
/** Scalar sugar:  read: allow            → [{ scope: "*", decision: "allow" }] */
const ScalarSugar = DecisionSchema;

/** Map sugar (delegate): { contextscout: allow, externalscout: allow }
 *                        → [{ scope: "contextscout",  decision: "allow" },
 *                           { scope: "externalscout", decision: "allow" }]
 *  Map iteration order = authored key order (preserved by YAML→JS object key order).
 *  Map sugar is accepted for ANY capability, not just delegate — it is just a rule list
 *  whose keys are scopes. This is precisely OpenCode's on-disk shape, which makes the
 *  OpenCode importer a pure desugar with zero information loss. */
const MapSugar = z.record(z.string(), DecisionSchema);

/** What an author may write for one capability. */
export const CapabilityInputSchema = z.union([ScalarSugar, MapSugar, RuleListSchema]);

/** Desugaring (illustrative):
 *    "deny"                          → [{ scope: "*", decision: "deny" }]
 *    { "a": "allow", "b": "deny" }   → [{ scope: "a", decision: "allow" },
 *                                       { scope: "b", decision: "deny" }]
 *    [ {scope,decision}, … ]         → as authored (identity)
 *  Desugaring is total and order-preserving. Re-sugaring on output is an adapter
 *  concern: a single {scope:"*"} rule MAY re-emit as a scalar. */
declare function desugar(input: z.infer<typeof CapabilityInputSchema>): Rule[];
```

#### 1.2.7 The capability set

```ts
/** Authored form — sugar allowed per capability. */
export const CapabilitiesInputSchema = z.object({
  read:     CapabilityInputSchema.optional(),
  write:    CapabilityInputSchema.optional(),
  edit:     CapabilityInputSchema.optional(),
  bash:     CapabilityInputSchema.optional(),
  grep:     CapabilityInputSchema.optional(),
  glob:     CapabilityInputSchema.optional(),
  web:      CapabilityInputSchema.optional(),
  delegate: CapabilityInputSchema.optional(),
}).default({});

/** Canonical IR form — always desugared rule lists. Absent capability ⇒ [] ⇒ tool default.
 *  Verb rationale (unchanged from v1): each is an intent verb every target can express or
 *  be told to refuse. `delegate` replaces OpenCode's `task`; `patch` (an OpenCode alias of
 *  edit) and `question` are dropped as tool quirks. */
export const CapabilitiesSchema = z.object({
  read:     RuleListSchema.default([]),
  write:    RuleListSchema.default([]),
  edit:     RuleListSchema.default([]),
  bash:     RuleListSchema.default([]),
  grep:     RuleListSchema.default([]),
  glob:     RuleListSchema.default([]),
  web:      RuleListSchema.default([]),
  delegate: RuleListSchema.default([]),
}).default({});
```

Round-trip of the index's worked examples: `code-reviewer`'s all-sugar block desugars to eight
single-rule lists and re-emits as OpenCode's `{ "*": "deny" }` form; `coder-agent`'s bash list
survives intact in both directions. **OpenCode round-trips Option A exactly** (index v2).

#### 1.2.8 Collapsing for lossy targets

Claude/Cursor/Windsurf have no scoped permissions (`granularPermissions` + `pathPatterns` =
`none` everywhere but OAC). They need a **collapse** from `RuleList` → a single grant:

```ts
/** Collapse a rule list to a coarse grant for targets without scoping.
 *  Reuses the existing permissive strategy in PermissionMapper.resolvePermissionRule's
 *  record branch (hasAllow || !hasDeny) so behavior stays continuous with today's adapters.
 *  MUST warn whenever rules.length > 1 or any rule.scope !== "*" — per index v2:
 *  "Scoped rules degrade to a coarse allowlist and MUST warn."
 *  Reuse the existing warning templates at BaseAdapter.ts:187-208 verbatim. */
declare function collapse(
  rules: Rule[],
  strategy: "permissive" | "restrictive" | "ask-as-deny",
): { grant: "allow" | "deny" | "ask"; warnings: string[] };
```

Worked: `coder-agent.bash` collapses to `allow` under `permissive` (it has allows) — meaning
Claude gets `Bash` with **none of the deny-all scoping**. That is a genuine, material capability
loss and exactly why it must warn loudly rather than degrade quietly.

### 1.3 Inference block (temperature, maxSteps, model=null)

```ts
/** Model tuning knobs, grouped so adapters process them as a unit and the degradation
 *  report is legible ("inference.temperature dropped; inference.model → tool default"). */
export const InferenceSchema = z.object({
  /** null ⇒ tool default (locked decision #2 — NO hardcoded models). When set, a neutral
   *  family id (e.g. "claude-sonnet-4"); ModelMapper resolves to the tool's dated id. */
  model: z.string().nullable().default(null),
  /** 0.0–2.0. NEUTRAL intent; HINT at Claude (temperatureControl = none → dropped + warned),
   *  partial at cursor/windsurf. */
  temperature: z.number().min(0).max(2).optional(),
  /** HINT — only OAC/OpenCode honor it (maxSteps: claude/cursor/windsurf = none). */
  maxSteps: z.number().int().positive().optional(),
}).default({ model: null });
```

`types.ts` puts these as flat siblings (181–184) and — **confirmed defect, index v2** —
`ModelIdentifierSchema = z.union([z.string(), z.string()])` (line 116) is a **no-op union** with
no null default, so it cannot enforce decision #2.

### 1.4 Context references

```ts
/** Priority vocabulary. See §4.3 — real data contains a value outside this enum. */
export const PrioritySchema = z.enum(["critical", "high", "medium", "low"]);

/** Pointer to a Context document. NEUTRAL: the reference survives wherever externalContext
 *  is supported (Claude bundles + injects via SessionStart hook; OpenCode/Windsurf copy;
 *  Cursor inlines). priority/description are HINTS — dropped by claude/cursor/windsurf
 *  (contextPriority = none). */
export const ContextRefSchema = z.object({
  /** Registry id of a context OR a repo-relative path under /content/context. */
  path: z.string().min(1),
  priority: PrioritySchema.optional(),
  description: z.string().optional(),
});
```

Matches `types.ts:63-67` (already neutral). Only change: prefer `id` references over raw
`.opencode/...` paths, which bake in the source tool.

### 1.5 Dependencies (typed refs)

```ts
export const DependencyKindSchema = z.enum([
  "subagent", "context", "command", "skill", "tool",
]);

export const DependencyRefSchema = z.object({
  kind: DependencyKindSchema,
  id: IdSchema,
});

/** Also accepts the compact "kind:id" string — the REAL on-disk format in both
 *  .opencode/config/agent-metadata.json and registry.json ("subagent:contextscout"). */
export const DependencyInputSchema = z.union([
  DependencyRefSchema,
  z.string().regex(/^(subagent|context|command|skill|tool):[a-z0-9-]+$/),
]);
```

Rename `type` → `kind` (avoids collision with the codebase's several other `type` fields).
Neutral because tools consume the resolved closure, not the notation.

### 1.6 Examples (few-shot)

```ts
/** NEUTRAL as authored data; HINT at the tool layer. Claude BAKES these into the agent
 *  description as <example> blocks (index worked example → claude target); OpenCode has no
 *  field for them and drops them (an enhancement, not a capability loss → no warning).
 *  Index v2 finding #3: hand-authored <example> blocks exist in the CC plugin and NOWHERE
 *  in .opencode/ — so seeding /content/ must MERGE, or this data is destroyed. */
export const AgentExampleSchema = z.object({
  context: z.string(),
  user: z.string(),
  assistant: z.string(),
});
```

### 1.7 Category vs. profile (confirmed conflation)

Confirmed by index v2: `types.ts` `AgentCategorySchema` (line 93) means *domain*
(`core`/`development`) while `registry.json`'s `category` means *distribution tier*
(`essential`/`standard`). Two axes sharing one name → split:

```ts
/** Domain grouping. NEUTRAL but low-stakes (agentCategories: claude ≈ none per index v2
 *  finding #5 — survives only as plugin.json keywords). Open string, not enum: the
 *  types.ts list is arbitrary and real data already exceeds it ("subagents/core",
 *  "testing", "data"…). */
export const CategorySchema = z.string().optional();

/** Distribution profile — which install tier ships this. Owned by the registry entry (§7). */
export const ProfileSchema = z.enum([
  "essential", "standard", "extended", "specialized", "meta",
]);
```

### 1.8 Full Agent IR

```ts
export const AgentSchema = z.object({
  // ---- identity (folded-in metadata; NO sidecar) ----
  id: IdSchema,
  name: NameSchema,
  description: DescriptionSchema,
  role: RoleSchema,                          // was `mode`
  category: CategorySchema,                  // domain; tier lives in registry.profiles
  tags: TagsSchema,
  version: VersionSchema,
  author: z.string().default("oac"),
  dependencies: z.array(DependencyInputSchema).default([]),

  // ---- behavior ----
  capabilities: CapabilitiesSchema,          // Option A; replaces tools + permission
  inference: InferenceSchema,                // model = null default
  context: z.array(ContextRefSchema).default([]),
  examples: z.array(AgentExampleSchema).default([]),

  // ---- lifecycle flags (HINTS) ----
  disable: z.boolean().default(false),
  hidden:  z.boolean().default(false),

  // ---- authored prose ----
  /** System prompt / instructions. NEUTRAL INVARIANT. From the Markdown body,
   *  NOT frontmatter. */
  systemPrompt: z.string().min(1),
});
```

> **Too OpenCode-shaped — must change (Agent).**
> - **Three overlapping identity carriers** (index v2, confirmed): `AgentFrontmatterSchema`
>   (177–191) + `AgentMetadataSchema` (201–210) + `OpenAgentSchema.metadata` (225–234), plus a
>   sidecar → collapse to one flat `AgentSchema`.
> - `ToolAccessSchema` (11–21): booleans keyed by OpenCode tool names (`task`, `patch`,
>   `question`) → replaced by the Option A capability set (`delegate`, `web`).
> - `GranularPermissionSchema`/`PermissionRuleSchema` (33–49): the glob-record model is
>   OpenCode's *serialization*, but it is **not** discarded — under Option A it is exactly the
>   `MapSugar` input form (§1.2.6), making the OpenCode importer a lossless desugar. What must
>   change is that the IR stores the **ordered list**, not the record, because record key order
>   is a fragile carrier of semantic ordering.
> - `AgentModeSchema` "all" (88) → drop. `AgentTypeSchema` (107) duplicates `role` → delete.
> - `ModelIdentifierSchema` (116) no-op union, no null default → replaced by `InferenceSchema`.
> - `sections` grab-bag (237–242) → superseded by typed `dependencies` + structured `examples`.

---

## 2. Skill

Real source: `.opencode/skill/project-orchestration/SKILL.md` + `scripts/`/`workflows/` siblings;
registry `skills` entries carry a `files: [...]` array. A Skill is a **directory** rooted at
`SKILL.md` (lean YAML frontmatter: `name`, `description`, `version`, `type`, `category`, `tags`);
body = instructions; bundled files travel with it.

⚠️ Index v2 finding #3: OpenCode has **2** skill dirs, the CC plugin has **~11**, and the sets are
**disjoint**. Seeding `/content/` from `.opencode/` alone destroys the CC set — a merge concern
for Agent E, but it means `SkillSchema` must model both origins.

```ts
/** A file shipping alongside SKILL.md. NEUTRAL as a manifest entry; whether a target can
 *  EXECUTE it is a HINT (skillsSystem: cursor = none, windsurf = partial). */
export const SkillFileSchema = z.object({
  /** Path relative to the skill directory root, e.g. "scripts/stage-cli.ts". */
  path: z.string().min(1),
  role: z.enum(["script", "workflow", "reference", "test", "asset", "entry"]).default("reference"),
  description: z.string().optional(),
});

export const SkillSchema = z.object({
  id: IdSchema,
  name: NameSchema,
  description: DescriptionSchema,
  category: CategorySchema,
  tags: TagsSchema,
  version: VersionSchema,
  author: z.string().default("oac"),
  dependencies: z.array(DependencyInputSchema).default([]),

  /** Directory basename rooting the skill (contains SKILL.md). NEUTRAL — every tool with
   *  skills is directory-based (.claude/skills/<dir>/SKILL.md, .opencode/skill/<dir>/SKILL.md). */
  directory: z.string().min(1),
  /** The OTHER bundled files (SKILL.md implicit). Mirrors the registry `files` array. */
  files: z.array(SkillFileSchema).default([]),

  /** SKILL.md body. NEUTRAL INVARIANT. */
  instructions: z.string().min(1),
});
```

> **Too OpenCode-shaped — must change (Skill).** `types.ts` has no first-class Skill — only
> `SkillReferenceSchema` (132–138), a *reference* permitting inline `config` that no target
> honors (`ContextMapper.mapSkillsToClaudeFormat` warns and drops it). Add `SkillSchema`;
> collapse `SkillReferenceSchema` into `DependencyRef{ kind:"skill" }`; drop inline config.

---

## 3. Command

Real source: `.opencode/command/add-context.md`, `context.md`. Verified frontmatter across the
**20** commands: `description` (18×), `tags` (3×), `dependencies` (3×), plus OpenCode extras
(`tools`, `temperature`, `mode`, `permissions` — ≤2× each). Body = prompt/template.

```ts
export const CommandSchema = z.object({
  id: IdSchema,
  name: NameSchema.optional(),           // often absent; derive from id
  description: DescriptionSchema,        // NEUTRAL INVARIANT — the only universal field
  tags: TagsSchema,
  dependencies: z.array(DependencyInputSchema).default([]),

  /** OPTIONAL, HINT. OpenCode lets a slash-command pin an agent/inference/capabilities;
   *  Claude/Cursor slash-commands are plain prompt templates. Reuses Agent primitives
   *  (incl. Option A) rather than inventing parallel shapes. */
  agent: IdSchema.optional(),
  inference: InferenceSchema.partial().optional(),
  capabilities: CapabilitiesInputSchema.optional(),

  version: VersionSchema,

  /** Prompt/template body (may contain $ARGUMENTS-style placeholders). NEUTRAL. */
  body: z.string().min(1),
});
```

Commands are the most portable type — neutral core is `{ id, description, tags, dependencies,
body }`. `types.ts` has no Command schema; this is net-new from already-neutral primitives.

---

## 4. Context document — **MVI HTML-comment (locked decision #6)**

Locked: context metadata **stays** the compact MVI HTML-comment line on disk. **No YAML
migration.** It is deliberate token-efficiency — the model reads it on every context load — and
multi-line YAML would cost tokens on all ~297 files. The IR normalizes it in memory; **on-disk
format ≠ IR shape**.

### 4.1 ⚠️ Verified format census — the highest-risk parser requirement

I re-derived the breakdown by **marker line position**, which the "286/3/7" summary obscures:

| Bucket | Count | Detail |
|---|---|---|
| Marker on **line 1** (happy path) | **287** | `<!-- Context: … -->` first line |
| Marker present but **NOT line 1** | **7** | see below — two very different kinds |
| **No marker at all** | **3** | `index.md`, `core/workflows/task-delegation.md`, `core/context-system/standards/typescript-coding.md` |
| **Total** | **297** | |

The 7 "marker not on line 1" files split into two kinds that must be handled **oppositely**:

1. **Dual-format (3)** — YAML frontmatter on line 1 *and* an MVI marker at line 11:
   `core/standards/csharp.md`, `core/standards/csharp-project-structure.md`,
   `openagents-repo/quality/registry-dependencies.md`. These are the index's "3 YAML" files —
   but note they carry **both**, so a YAML-only parser still loses nothing here while an
   MVI-only parser would need to look past the YAML block.
2. **Marker-as-prose (4)** — the marker appears *deep in the body as documentation*, not as
   metadata: `openagents-repo/core-concepts/agents.md` (**line 232**),
   `openagents-repo/core-concepts/categories.md` (**line 301**),
   `core/context-system/standards/templates.md` (line 25, placeholder literals),
   `core/context-system/standards/frontmatter.md` (line 43, the standard doc showing examples).

> ### 🚨 Two parser traps, both verified
>
> **Trap 1 — `gray-matter` silently drops everything.** A generic frontmatter parser finds **no
> frontmatter** in 287/297 files, yielding `{}` metadata with **no error**. Priority drives
> context ordering, so this silently degrades every agent's context loading. This is the
> single highest-risk parser requirement in the project.
>
> **Trap 2 — "grep the first marker anywhere" is also wrong.** It would assign
> `standards/code | critical` to `openagents-repo/core-concepts/agents.md` from a marker at
> **line 232** that is prose *about* the format. The parser MUST only honor a marker in a
> **leading window** (line 1, or the first line after a closing YAML `---`), and treat every
> later occurrence as body text. `templates.md` additionally contains **placeholder literals**
> (`{category}/concepts`, `Priority: {critical|high|medium|low}`, `Updated: YYYY-MM-DD`) that
> would fail validation — template/standard files must be excluded from metadata parsing.

### 4.2 Parser specification

```
parseContext(file):
  1. If line 1 starts with "---" → parse the YAML block; remember where it closes.
     Set cursor = first non-blank line after the closing "---".  [3 files]
     Else cursor = line 1.                                        [294 files]
  2. If the line at `cursor` matches /^<!--\s*Context:\s*(.*?)\s*-->$/ →
     parse it as MVI metadata (§4.3). Consume it; it is NOT body.  [287 + 3 files]
     Else → NO metadata in the leading window.                     [7 files]
  3. NEVER scan beyond the leading window for a marker. Later markers are body. [Trap 2]
  4. Merge precedence when both YAML and MVI are present: MVI wins for the four MVI
     fields (it is the maintained convention); YAML supplies any extra keys.
  5. No metadata found → derive: id/name from path, priority = "medium" (schema default),
     and record a `doctor` finding. NEVER silently succeed with {} metadata.  [Trap 1]
  6. Exclude from metadata parsing (template/standard exemplars, by path allowlist):
     core/context-system/standards/templates.md, .../frontmatter.md.
```

The MVI line grammar is pipe-delimited `Key: Value`, tolerant of missing trailing fields:

```
<!-- Context: {category}/{function} | Priority: {level} | Version: X.Y | Updated: YYYY-MM-DD -->
```

**Verified tolerance requirements** (real deviations, all 4 found):

| File | Marker | Missing |
|---|---|---|
| `core/workflows/component-planning.md` | `Context: … \| Priority: high \| Version: 1.0` | `Updated` |
| `openagents-repo/core-concepts/categories.md` | `Context: … \| Priority: high` | `Version`, `Updated` |
| `openagents-repo/core-concepts/agents.md` | `Context: … \| Priority: critical` | `Version`, `Updated` |
| `core/context-system/standards/templates.md` | placeholder literals | — (exclude) |

So: **`Context` and `Priority` are required; `Version` and `Updated` are optional.** A grammar
demanding all four fails on real content.

### 4.3 ⚠️ Priority vocabulary — real data escapes the documented enum

`.opencode/context/core/context-system/standards/frontmatter.md` documents
`critical|high|medium|low`. Verified actual distribution across the parseable markers:

| Value | Count |
|---|---|
| `high` | 113 |
| `critical` | 111 |
| `low` | 34 |
| `medium` | 29 |
| **`reference`** | **1** ← outside the enum |

The outlier is `core/workflows/lightweight-context-handoff-example.md`
(`Priority: reference`). A strict `z.enum` **rejects a real file**. Options: (a) coerce
`reference` → `low` on parse with a `doctor` warning; (b) fix the one file; (c) widen the enum.
Recommend (b) + keep the strict enum — one-file fix, keeps the vocabulary closed. Raised in Open
Questions.

`Version` on disk is **X.Y**, not semver (verified: `1.0` ×271, `2.0` ×10, `1.1` ×4, plus `3.1`,
`2.1`, `1.3`) → normalize `X.Y` → `X.Y.0` for `VersionSchema`.

### 4.4 The Context IR

```ts
export const ContextSchema = z.object({
  id: IdSchema,
  name: NameSchema,
  description: DescriptionSchema,
  /** "{category}/{function}" from the MVI marker, e.g. "core/standards". Open string. */
  category: CategorySchema,
  tags: TagsSchema,
  /** From the MVI marker. NEUTRAL intent; HINT at every non-OAC target
   *  (contextPriority = none for claude/cursor/windsurf). Drives context ORDERING —
   *  losing it is the Trap 1 failure mode. */
  priority: PrioritySchema.default("medium"),
  /** X.Y on disk → normalized to semver in memory (§4.3). */
  version: VersionSchema,
  /** ISO date from "Updated:". Optional — real files omit it. HINT at tool layer. */
  updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dependencies: z.array(DependencyInputSchema).default([]),

  /** Markdown body, marker consumed. NEUTRAL INVARIANT. */
  body: z.string().min(1),
});
```

**Serialization back to disk** is the inverse: the OpenCode/Claude adapters re-emit the MVI
one-liner (not YAML), preserving the token-efficiency the format exists for.

**MVI lint rules** (validated by `doctor`, not by Zod — Agent E's test spec): ≤200 lines, marker
in the leading window, priority in-enum, a "📂 Codebase References" section, `updated` matching
any in-body date stamp.

> **Too OpenCode-shaped — must change (Context).** `types.ts` has only
> `ContextReferenceSchema` (a pointer) — **no Context *document* schema**. And
> `ContextMapper.ts` anchors `.opencode/context` as the privileged **source** base
> (`CONTEXT_CONFIGS.oac`, 55–61); post-refactor the source is `/content/context` and OpenCode is
> just a target, so the `oac` key must be renamed (`content`/`ir`) and re-rooted (index v2).

---

## 5. Tool

Real source: `.opencode/tool/gemini/index.ts` + `README.md`; registry `tools` entries carry
`tool:env`-style deps. A Tool is an **executable module**; the IR describes and locates it, it
does not model the runtime.

```ts
export const ToolParamSchema = z.object({
  name: z.string(),
  type: z.enum(["string", "number", "boolean", "object", "array"]),
  description: z.string().optional(),
  required: z.boolean().default(false),
});

export const ToolSchema = z.object({
  id: IdSchema,
  name: NameSchema,
  description: DescriptionSchema,        // NEUTRAL — the model needs to know what it does
  tags: TagsSchema,
  version: VersionSchema,
  dependencies: z.array(DependencyInputSchema).default([]),  // e.g. tool:env

  /** Entry module relative to the tool dir, e.g. "index.ts". NEUTRAL as a locator; whether a
   *  target can LOAD a custom tool is a HINT (OpenCode plugins vs Claude MCP). */
  entry: z.string().min(1),
  runtime: z.enum(["node", "bun", "deno", "shell", "mcp"]).default("node"),

  /** HINT — only targets with typed tool schemas use these. */
  parameters: z.array(ToolParamSchema).default([]),

  /** Env var NAMES only, never values. NEUTRAL doc + doctor check.
   *  Build hygiene (index v2): a filesystem-globbing build must not sweep local .env files
   *  into /content/. (There is NO committed-.env security issue — 0 tracked, gitignored.) */
  env: z.array(z.string()).default([]),
});
```

> **Too OpenCode-shaped — must change (Tool).** `types.ts` `ToolConfigSchema` (253–257) is not a
> tool description — it is the adapter *output envelope*. Rename to `EmittedFileSchema` and move
> to the adapter contract (Agent C). `ToolSchema` is net-new. Note the naming trap: capability
> verbs (§1.2) are unrelated to first-class custom `Tool`s despite both being called "tools".

---

## 6. Hook

No per-agent hooks are authored in the corpus today, but `types.ts` has `HookDefinitionSchema`
(158–167) and `CapabilityMatrix` tracks `hooks` (full on oac/claude; none on cursor/windsurf).

⚠️ Index v2 finding #3: **`session-start.sh`** (skill catalogue, first-run onboarding,
context-discovery bootstrap, injection defense) has **no OpenCode equivalent** and lives in a
directory slated for deletion. It is arguably the most important runtime feature and **must be
preserved into `/content/`**. It is a `session-start` hook in this model — which makes the Hook
schema load-bearing, not theoretical.

```ts
/** Neutral lifecycle events — named by the MOMENT, not a tool's callback id. The current
 *  enum (types.ts:147) is Claude-shaped. Adapters map to tool names (Claude:
 *  PreToolUse/PostToolUse/SessionStart; OpenCode plugin events). NEUTRAL vocabulary; the
 *  whole feature is a HINT for cursor/windsurf (hooks = none → drop + blocking warning). */
export const HookEventSchema = z.enum([
  "before-tool",     // was PreToolUse
  "after-tool",      // was PostToolUse
  "permission-ask",  // was PermissionRequest
  "session-start",   // was AgentStart  ← session-start.sh lands here
  "session-end",     // was AgentEnd
]);

/** A shell action. NEUTRAL — a command string is universal. */
export const HookActionSchema = z.object({
  type: z.literal("command"),
  command: z.string().min(1),
});

export const HookSchema = z.object({
  event: HookEventSchema,
  /** Optional filters (tool names/globs). HINT — matcher semantics vary; empty = always. */
  matchers: z.array(z.string()).default([]),
  actions: z.array(HookActionSchema).min(1),   // was `commands`
});
```

> **Too OpenCode-shaped — must change (Hook).** Rename events off Claude's
> `PreToolUse`/`AgentStart` vocabulary; rename `commands` → `actions` (it holds actions, and
> "commands" collides with the Command content type). Otherwise structurally adoptable.

---

## 7. Registry entry

Real source: `registry.json` v2.0.0 — `components: { agents, subagents, commands, tools, plugins,
skills, contexts, config }`, each an array of `{ id, name, type, path, description, tags,
dependencies, category, files? }`. This is the neutral catalog the CLI and build closure walk.

Adds what the current registry lacks: **profiles** and **checksums** — the latter directly
addresses index v2 finding #2 (dependency resolution is broken; `install.sh`'s resolver swallows
`jq` errors via `|| echo ""`, so unknown refs yield **zero deps, no error**) and the
bidirectional drift in finding #3.

```ts
export const ComponentTypeSchema = z.enum([
  "agent", "subagent", "command", "skill", "context", "tool", "hook", "plugin", "config",
]);

export const RegistryEntrySchema = z.object({
  id: IdSchema,
  name: NameSchema,
  type: ComponentTypeSchema,
  /** Source path under /content/ (NOT .opencode/). NEUTRAL INVARIANT — catalog→source join. */
  path: z.string().min(1),
  description: DescriptionSchema,
  tags: TagsSchema,
  category: CategorySchema,                                  // domain
  /** Compact "kind:id" refs. Drives the build closure. An unresolvable ref MUST be a hard
   *  error — never `|| echo ""` (index v2 finding #2). */
  dependencies: z.array(DependencyInputSchema).default([]),
  files: z.array(z.string()).default([]),                    // multi-file components

  // ---- new in the refactor ----
  /** Install tiers including this component. Replaces the overloaded registry `category`
   *  tier with an explicit, multi-valued set. */
  profiles: z.array(ProfileSchema).default(["standard"]),
  /** Content hash at publish time — drift/update detection. */
  checksum: z.string().optional(),
  version: VersionSchema,
});

export const RegistrySchema = z.object({
  version: VersionSchema,
  schema_version: VersionSchema,
  repository: z.string().url().optional(),
  targets: z.array(z.enum(["opencode", "claude", "cursor", "windsurf"])).default([
    "opencode", "claude", "cursor", "windsurf",
  ]),
  components: z.record(z.string(), z.array(RegistryEntrySchema)),
});
```

> **Too OpenCode-shaped — must change (Registry).**
> - Every `path` starts with `.opencode/...` → rewrite to `/content/...`. `.opencode/` is a build
>   target; it cannot also be the catalog's source of truth.
> - `category` overloaded as *tier* (`essential|standard|…`) vs agent metadata's *domain*
>   (`core|development|…`) → split into `category` + `profiles` (index v2, confirmed).
> - Add `checksum` — without it `oac update` cannot detect the drift the index calls out as the
>   core failure of the `cp`-based bridge.

---

## 8. Neutral-vs-hint summary (adapter contract)

Every droppable field must be reported via `CapabilityMatrix` — never silently.

| IR field | Status | Degrades on | Matrix feature |
|---|---|---|---|
| `role` | invariant | **claude = partial** ⚠️ (plugin layout has no per-agent mode; `primary` flattens → warn) | `agentModes` |
| `capabilities.<verb>` allow/deny | invariant | — | `fileOperations`, `bashExecution`, `searchOperations` |
| **rule `scope`** (any non-`*`) | **hint** | claude/cursor/windsurf — collapse to coarse grant, **MUST warn** | `granularPermissions`, `pathPatterns` |
| **rule ordering** | **hint** | all but OpenCode (collapse discards order) | `granularPermissions` |
| `decision: ask` | hint | claude/cursor/windsurf | `askPermissions` = none |
| `capabilities.delegate` | invariant\* | cursor (none) | `taskDelegation` |
| `inference.model` (null) | invariant | — (null ⇒ default) | `modelSelection` |
| `inference.temperature` | hint | claude (none); cursor/windsurf (partial) | `temperatureControl` |
| `inference.maxSteps` | hint | claude/cursor/windsurf | `maxSteps` |
| `context[].path` | invariant | cursor (inline-only) | `externalContext` |
| `context[].priority` | hint | claude/cursor/windsurf | `contextPriority` |
| `category` | hint | **claude ≈ none** ⚠️ (plugin.json keywords only) | `agentCategories` |
| `examples` | hint | OpenCode (no field; enhancement → no warning) | — |
| `dependencies` | invariant | cursor (none), windsurf (partial) | `dependencies` |
| `skill.files` executability | hint | cursor (none), windsurf (partial) | `skillsSystem` |
| `hooks` | hint (**blocking**) | cursor/windsurf (none) | `hooks` |

\* `delegate` is invariant wherever delegation exists; on Cursor it is a hard drop → **blocker**,
not a soft warning.

⚠️ Two rows marked above reflect index v2 finding #5: `CapabilityMatrix.ts` currently **lies** —
`agentModes: claude = full` should be **partial**, and `agentCategories: claude` should likely be
**none**. Both must be corrected before the matrix can be trusted as the degradation oracle.

---

## Open Questions

1. **Precedence semantics — index prose vs. index example (§1.2.4). ⚠️ Needs ratification.**
   The index says *"first-match-wins"*, but its own worked example and **all 34 real agents**
   author broad-first/specific-after, under which naive first-match-wins denies coder-agent's
   `router.sh` and downgrades openagent's `sudo *` deny to `ask`. **Recommend last-match-wins**
   (makes the index example correct as written; maps 1:1 to OpenCode key order). Most-specific-wins
   also works and agrees on 100% of current data. **The schema shape is identical under all three**
   — only the resolver differs — so this can be ratified without blocking any workstream.

2. **`Priority: reference` escapes the documented enum (§4.3).** One real file
   (`core/workflows/lightweight-context-handoff-example.md`) uses a value the standard doesn't
   define, so a strict `z.enum` rejects real content. Coerce→`low` with a warning, fix the one
   file, or widen the enum? *Recommend fixing the file and keeping the enum closed.*

3. **Should `model` be authorable in `/content/` at all?** (Carried from v1; still open per index
   decision #2.) Since content must never hardcode a model, `inference.model` could be dropped
   from the *authored* schema entirely and exist only as an always-null IR field plus a build-time
   user/project override layer. Keeping it authorable invites the exact violation #2 forbids.

4. **Context census delta: 296 (index) vs 297 (my count) (§0.1).** My reproducible count over
   `.opencode/context/**/*.md` gives 297 (287 marker-on-line-1 / 7 marker-elsewhere / 3 no-marker).
   Likely a scope difference in what was enumerated. No design impact — but the numbers should be
   reconciled before they're quoted in shipping docs.

5. **Template/standard exemplar exclusion (§4.2 step 6).** `templates.md` and `frontmatter.md`
   contain placeholder/example markers that must not be parsed as metadata. Is a hardcoded path
   allowlist acceptable, or should such files carry an explicit opt-out marker (e.g.
   `<!-- oac:no-parse -->`)? A path allowlist is brittle as content grows.

6. **`web` as a first-class capability?** No current agent uses a `web` permission; included
   because Claude has WebFetch/WebSearch and it is a real intent. Confirm it belongs in the closed
   capability set, or defer until a target needs it.

7. **`id` vs `path` in `ContextRefSchema` and dependency joins.** Require registry `id`s (fully
   neutral, but forces every one of ~297 contexts into the registry) or keep allowing relative
   paths (flexible, weaker neutral anchor)? Affects how strict the build closure can be — and
   interacts with index v2 finding #2 (unresolvable refs must hard-error).

8. **Where does the emitted-file envelope live?** `types.ts` `ToolConfigSchema`/`ConversionResult`
   (253–316) are adapter outputs, not IR. Confirm they move wholesale into Agent C's adapter
   contract and out of `packages/core`.

9. **Profiles source of truth.** Proposed on the registry entry (§7). Should agents/skills also
   self-declare a profile in frontmatter (author-controlled but duplicated), or is the registry
   sole owner (single source, but authors can't express intent locally)?

10. **`primary|subagent` — are two roles enough?** Locking to two matches Claude + the worked
    example. Flag before the enum freezes if any target needs a third (e.g. background/always-on).
