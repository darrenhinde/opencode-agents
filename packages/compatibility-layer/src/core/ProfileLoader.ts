/**
 * Loads install profiles and computes their transitive closures.
 *
 * ─── What a profile promises ────────────────────────────────────────────────────────────
 *
 * A profile is a promise: "install `developer` and you get a working set". That promise is
 * only kept if every component the profile names resolves, AND every dependency of those
 * components resolves, recursively. A profile naming a live component that depends on a dead
 * one is just as broken as one naming the dead component directly — the install fails at the
 * same point, one level deeper. So the unit of validation is the CLOSURE, not the named list.
 *
 * ─── Two sources that disagree ──────────────────────────────────────────────────────────
 *
 * Profiles are authored in two places, and they have drifted apart (verified on disk
 * 2026-07-15):
 *
 *   - `.opencode/profiles/<name>/profile.json` — the per-profile file. Read only by
 *     `scripts/registry/check-dependencies.ts`.
 *   - `registry.json` `.profiles.<name>.components` — what `install.sh` ACTUALLY reads
 *     (`get_profile_components`, install.sh:292). This is the runtime authority.
 *
 * They disagree on every profile (e.g. `advanced`: 51 components on disk vs 68 in the
 * registry). Neither is a superset of the other. Since no single source is both authoritative
 * and complete, {@link ProfileLoader.resolveClosure} validates the UNION: a profile is only
 * sound if it installs cleanly no matter which list a consumer believes. Use
 * {@link ProfileLoader.drift} to inspect the disagreement itself.
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { ReferenceResolver, type Reference, type Resolution } from "./ReferenceResolver.js";

// ============================================================================
// SCHEMA
// ============================================================================

/**
 * A `.opencode/profiles/<name>/profile.json` file.
 *
 * Strict: an unknown key is an error, never silently dropped. Verified against all 5 profiles
 * on disk — `badge` appears on `developer` only, `additionalPaths` on `advanced` only.
 */
export const ProfileSchema = z
  .object({
    name: z.string().min(1),
    description: z.string().min(1),
    badge: z.string().optional(),
    components: z.array(z.string()).min(1, "a profile that names no components installs nothing"),
    additionalPaths: z.array(z.string()).default([]),
  })
  .strict();

export type Profile = z.infer<typeof ProfileSchema>;

/** A profile as loaded, with its identity and both component lists. */
export interface LoadedProfile {
  /** Directory name under `.opencode/profiles/`, e.g. `developer`. This is the profile id. */
  id: string;
  /** Repo-relative path of the `profile.json` that backs it. */
  filePath: string;
  /** The validated `profile.json` contents. */
  profile: Profile;
  /** Component refs from `profile.json`. */
  components: string[];
  /** Component refs from `registry.json` `.profiles.<id>.components` — what `install.sh` reads. */
  registryComponents: string[];
}

export interface ClosureResult {
  /** Every ref in the transitive closure, deduplicated and sorted. */
  ids: string[];
  /** The closure with source attribution, in discovery order. */
  refs: Reference[];
  /** The subset of the closure that does not resolve. */
  missing: Resolution[];
}

/** How `profile.json` and `registry.json` disagree about one profile. */
export interface ProfileDrift {
  id: string;
  /** Refs in `profile.json` that `registry.json` omits. */
  onlyInProfileJson: string[];
  /** Refs in `registry.json` that `profile.json` omits. `install.sh` installs these anyway. */
  onlyInRegistry: string[];
}

const PROFILES_DIR = ".opencode/profiles";

/** Locale-independent ordering. `localeCompare` is locale-dependent — never use it here. */
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export class ProfileLoadError extends Error {
  public readonly filePath: string;
  public override readonly cause?: unknown;

  constructor(message: string, filePath: string, cause?: unknown) {
    super(message);
    this.filePath = filePath;
    this.cause = cause;
    this.name = "ProfileLoadError";
  }
}

// ============================================================================
// LOADER
// ============================================================================

export class ProfileLoader {
  private readonly root: string;
  private readonly resolver: ReferenceResolver;

  /**
   * @param root     - Repository root, so the loader is testable against a fixture tree.
   * @param resolver - Reference resolver to validate closures with. Defaults to one rooted at
   *                   `root`; injectable so a caller can share one index across loaders.
   */
  constructor(root: string, resolver: ReferenceResolver = new ReferenceResolver(root)) {
    this.root = root;
    this.resolver = resolver;
  }

  /**
   * Every profile id on disk, sorted.
   *
   * Enumerated from the filesystem rather than hard-coded, so adding a profile directory is
   * enough to make it real.
   */
  list(): Promise<string[]> {
    const dir = join(this.root, PROFILES_DIR);

    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
      throw new ProfileLoadError(`Profiles directory not found: ${PROFILES_DIR}`, dir);
    }

    const ids = readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((id) => existsSync(join(dir, id, "profile.json")))
      .sort(compare);

    return Promise.resolve(ids);
  }

  /** Load and validate one profile by id. */
  load(id: string): Promise<LoadedProfile> {
    const relativePath = `${PROFILES_DIR}/${id}/profile.json`;
    const absolute = join(this.root, PROFILES_DIR, id, "profile.json");

    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(absolute, "utf-8"));
    } catch (cause) {
      throw new ProfileLoadError(
        `Failed to read or parse profile: ${relativePath}`,
        relativePath,
        cause
      );
    }

    const parsed = ProfileSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ProfileLoadError(
        `Invalid profile ${relativePath}:\n${parsed.error.errors
          .map((e) => `  - ${e.path.join(".")}: ${e.message}`)
          .join("\n")}`,
        relativePath,
        parsed.error
      );
    }

    return Promise.resolve({
      id,
      filePath: relativePath,
      profile: parsed.data,
      components: parsed.data.components,
      registryComponents: this.resolver.registry().profiles[id]?.components ?? [],
    });
  }

  /** Load and validate every profile, in id order. */
  async loadAll(): Promise<LoadedProfile[]> {
    const ids = await this.list();
    return Promise.all(ids.map((id) => this.load(id)));
  }

  /**
   * Expand a profile to its transitive closure and report what does not resolve.
   *
   * Seeds from the union of `profile.json` and `registry.json` (see the file header: they have
   * drifted and neither is a superset), then follows each component's declared `dependencies`
   * from the registry. Cycles terminate on the `seen` set.
   */
  async resolveClosure(id: string): Promise<ClosureResult> {
    const loaded = await this.load(id);
    const registry = this.resolver.registry();

    // `type:id` -> component, so a ref can be followed to its dependencies.
    const byRef = new Map<string, { dependencies?: string[] }>();
    for (const [category, components] of Object.entries(registry.components)) {
      // agents -> agent, contexts -> context, ...; `config` is already singular and stays put.
      const type = category.replace(/s$/, "");
      for (const component of components) byRef.set(`${type}:${component.id}`, component);
    }

    const seeds: Reference[] = [
      ...loaded.components.map((ref) => ({
        ref,
        source: `${loaded.filePath} components`,
      })),
      ...loaded.registryComponents.map((ref) => ({
        ref,
        source: `registry.json profiles.${id}.components`,
      })),
    ];

    const seen = new Set<string>();
    const refs: Reference[] = [];
    const queue = [...seeds];

    while (queue.length > 0) {
      const reference = queue.shift()!;
      if (seen.has(reference.ref)) continue;
      seen.add(reference.ref);
      refs.push(reference);

      for (const dependency of byRef.get(reference.ref)?.dependencies ?? []) {
        queue.push({
          ref: dependency,
          source: `${reference.source} -> ${reference.ref} depends on`,
        });
      }
    }

    return {
      ids: [...seen].sort(compare),
      refs,
      missing: this.resolver.resolveMany(refs).filter((resolution) => !resolution.ok),
    };
  }

  /**
   * How `profile.json` and `registry.json` disagree about a profile.
   *
   * Not a validation step — a diagnostic. The two lists have genuinely drifted, and only
   * `registry.json` is read at install time.
   */
  async drift(id: string): Promise<ProfileDrift> {
    const { components, registryComponents } = await this.load(id);
    const onDisk = new Set(components);
    const inRegistry = new Set(registryComponents);

    return {
      id,
      onlyInProfileJson: components.filter((ref) => !inRegistry.has(ref)).sort(compare),
      onlyInRegistry: registryComponents.filter((ref) => !onDisk.has(ref)).sort(compare),
    };
  }
}
