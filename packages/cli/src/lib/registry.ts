import { z } from "zod";
import { join } from "node:path";

// ── Constants ──────────────────────────────────────────────────────────────────

const REGISTRY_FILENAME = "registry.json";

/** Install destinations for each component type (relative to project root). */
const INSTALL_DIRS = {
  agent: ".opencode/agent/",
  context: ".opencode/context/",
  skill: ".opencode/skills/",
} as const;

/** Source directories inside the npm bundle for each component type. */
const BUNDLE_DIRS = {
  agent: ".opencode/agent/",
  context: ".opencode/context/",
  skill: ".opencode/skills/",
} as const;

// ── Schemas ────────────────────────────────────────────────────────────────────

/**
 * The component types that the CLI can install via `oac add`.
 * Matches the user-facing ref prefix: `agent:X`, `context:X`, `skill:X`.
 */
export const ComponentTypeSchema = z.enum(["agent", "context", "skill"]);

/**
 * A single installable component entry from registry.json.
 * The registry also contains subagents, commands, tools, plugins — those are
 * not user-installable via `oac add` and are excluded from RegistryComponent.
 */
export const RegistryComponentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: ComponentTypeSchema,
  path: z.string(),
  description: z.string(),
  tags: z.array(z.string()).default([]),
  dependencies: z.array(z.string()).default([]),
  category: z.string().default("standard"),
  /** Skills may list multiple files to install. */
  files: z.array(z.string()).optional(),
});

/**
 * Loose schema for non-installable component categories (subagents, commands,
 * tools, plugins). We only need to parse them without strict validation.
 */
const AnyComponentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  path: z.string(),
  description: z.string(),
}).passthrough();

export const RegistrySchema = z.object({
  version: z.string(),
  schema_version: z.string().optional(),
  repository: z.string().optional(),
  categories: z.record(z.string(), z.string()).optional(),
  components: z.object({
    agents: z.array(RegistryComponentSchema).default([]),
    skills: z.array(RegistryComponentSchema).default([]),
    contexts: z.array(RegistryComponentSchema).default([]),
    // Non-installable sections — parsed loosely so schema changes don't break us
    subagents: z.array(AnyComponentSchema).default([]),
    commands: z.array(AnyComponentSchema).default([]),
    tools: z.array(AnyComponentSchema).default([]),
    plugins: z.array(AnyComponentSchema).default([]),
  }),
});

// ── Types ──────────────────────────────────────────────────────────────────────

export type ComponentType = z.infer<typeof ComponentTypeSchema>;
export type RegistryComponent = z.infer<typeof RegistryComponentSchema>;
export type Registry = z.infer<typeof RegistrySchema>;

// ── Path helpers ───────────────────────────────────────────────────────────────

/** Returns the absolute path to registry.json given the package root. */
export const getRegistryPath = (packageRoot: string): string =>
  join(packageRoot, REGISTRY_FILENAME);

// ── Pure query helpers ─────────────────────────────────────────────────────────

/**
 * Returns all installable components (agents + skills + contexts) from the
 * registry, optionally filtered to a single type.
 * Pure — no side effects.
 */
export const listComponents = (
  registry: Registry,
  type?: ComponentType,
): RegistryComponent[] => {
  const all: RegistryComponent[] = [
    ...registry.components.agents,
    ...registry.components.skills,
    ...registry.components.contexts,
  ];
  return type === undefined ? all : all.filter((c) => c.type === type);
};

/**
 * Alias matching the acceptance criteria name.
 * Filters installable components by type string.
 * Pure — no side effects.
 */
export const listComponentsByType = (
  registry: Registry,
  type: string,
): RegistryComponent[] => {
  const parsed = ComponentTypeSchema.safeParse(type);
  if (!parsed.success) return [];
  return listComponents(registry, parsed.data);
};

/**
 * Resolves a `type:name` ref (e.g. `"context:react-patterns"`) to a component.
 * Returns `null` — never throws — when the component is not found or the ref
 * format is invalid.
 * Pure — no side effects.
 */
export const resolveComponent = (
  registry: Registry,
  ref: string,
): RegistryComponent | null => {
  const colonIndex = ref.indexOf(":");
  if (colonIndex === -1) return null;

  const rawType = ref.slice(0, colonIndex);
  const id = ref.slice(colonIndex + 1);
  if (!rawType || !id) return null;

  const typeResult = ComponentTypeSchema.safeParse(rawType);
  if (!typeResult.success) return null;

  const candidates = listComponents(registry, typeResult.data);
  return candidates.find((c) => c.id === id) ?? null;
};

/**
 * Returns the directory (relative to project root) where a component should
 * be installed.
 * Pure — no side effects.
 */
export const getInstallPath = (component: RegistryComponent): string =>
  INSTALL_DIRS[component.type];

/**
 * Returns the directory (relative to the npm bundle / package root) where the
 * component's source files live.
 * Pure — no side effects.
 */
export const getBundledSourcePath = (component: RegistryComponent): string =>
  BUNDLE_DIRS[component.type];

// ── I/O ────────────────────────────────────────────────────────────────────────

/**
 * Reads and validates registry.json from `packageRoot`.
 * Throws with a clear, actionable message when:
 *   - the file does not exist
 *   - the JSON is malformed
 *   - the schema validation fails
 */
export const readRegistry = async (packageRoot: string): Promise<Registry> => {
  const registryPath = getRegistryPath(packageRoot);

  const exists = await Bun.file(registryPath).exists();
  if (!exists) {
    throw new Error(
      `registry.json not found at "${registryPath}".\n` +
        `This file should be bundled with the @nextsystems/oac package.\n` +
        `Try reinstalling: npm install -g @nextsystems/oac`,
    );
  }

  const raw = await Bun.file(registryPath).json().catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to parse registry.json at "${registryPath}": ${msg}\n` +
        `The file may be corrupted. Try reinstalling: npm install -g @nextsystems/oac`,
    );
  }) as unknown;

  const result = RegistrySchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid registry.json at "${registryPath}":\n${issues}\n` +
        `The registry schema may have changed. Try reinstalling: npm install -g @nextsystems/oac`,
    );
  }

  return result.data;
};

/**
 * Convenience alias: reads registry.json from `packageRoot`.
 * Identical to `readRegistry` — provided for callers that prefer this name.
 */
export const loadRegistry = readRegistry;
