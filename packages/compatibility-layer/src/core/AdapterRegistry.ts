import type { BaseAdapter } from "../adapters/BaseAdapter.js";
import type { ToolCapabilities } from "../types.js";

// ============================================================================
// ADAPTER REGISTRY TYPES
// ============================================================================

/**
 * Information about a registered adapter including its capabilities
 */
export interface AdapterInfo {
  name: string;
  adapter: BaseAdapter;
  capabilities: ToolCapabilities;
}

/**
 * Registry error for missing or duplicate adapters
 */
export class AdapterRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdapterRegistryError";
  }
}

// ============================================================================
// ADAPTER REGISTRY CLASS
// ============================================================================

/**
 * Registry for managing tool adapters.
 * 
 * The registry maintains a collection of adapters and provides
 * type-safe registration, lookup, and querying capabilities.
 * 
 * Features:
 * - Type-safe adapter storage with Map
 * - Alias support for adapter names
 * - Capability-based adapter discovery
 * - Singleton pattern for global registry
 * 
 * @example
 * ```ts
 * const registry = new AdapterRegistry();
 * 
 * // Register adapter with aliases
 * registry.register(new CursorAdapter(), ['cursor-ide', 'cursor-editor']);
 * 
 * // Get adapter by name or alias
 * const adapter = registry.get('cursor'); // or 'cursor-ide'
 * 
 * // List all adapters
 * const names = registry.list(); // ['claude', 'cursor', 'windsurf']
 * ```
 */
export class AdapterRegistry {
  private adapters: Map<string, BaseAdapter> = new Map();
  private aliases: Map<string, string> = new Map();

  constructor() {
    // Registry starts empty - adapters registered manually or via registerBuiltInAdapters()
  }

  /**
   * Register a tool adapter with optional aliases.
   * 
   * @param adapter - The adapter instance to register
   * @param aliases - Optional array of alias names
   * @throws {AdapterRegistryError} If adapter with same name already exists
   * 
   * @example
   * ```ts
   * registry.register(new CursorAdapter(), ['cursor-ide', 'cursor-editor']);
   * ```
   */
  register(adapter: BaseAdapter, aliases?: string[]): void {
    const normalizedName = adapter.name.toLowerCase();

    // Check for duplicate registration
    if (this.adapters.has(normalizedName)) {
      throw new AdapterRegistryError(
        `Adapter '${adapter.name}' is already registered. Use a different name or unregister the existing adapter first.`
      );
    }

    // Register main adapter
    this.adapters.set(normalizedName, adapter);

    // Register aliases
    if (aliases && aliases.length > 0) {
      aliases.forEach((alias) => {
        const normalizedAlias = alias.toLowerCase();
        
        // Check if alias conflicts with existing adapter name
        if (this.adapters.has(normalizedAlias)) {
          throw new AdapterRegistryError(
            `Alias '${alias}' conflicts with existing adapter name '${normalizedAlias}'`
          );
        }

        // Check if alias is already registered
        if (this.aliases.has(normalizedAlias)) {
          throw new AdapterRegistryError(
            `Alias '${alias}' is already registered for adapter '${this.aliases.get(normalizedAlias)}'`
          );
        }

        this.aliases.set(normalizedAlias, normalizedName);
      });
    }
  }

  /**
   * Get an adapter by name or alias.
   * 
   * @param nameOrAlias - The adapter name or alias (case-insensitive)
   * @returns The adapter instance, or undefined if not found
   * 
   * @example
   * ```ts
   * const adapter = registry.get('cursor'); // or 'cursor-ide'
   * if (adapter) {
   *   const result = await adapter.fromOAC(agent);
   * }
   * ```
   */
  get(nameOrAlias: string): BaseAdapter | undefined {
    const normalized = nameOrAlias.toLowerCase();

    // Try direct lookup
    if (this.adapters.has(normalized)) {
      return this.adapters.get(normalized);
    }

    // Try alias lookup
    if (this.aliases.has(normalized)) {
      const actualName = this.aliases.get(normalized);
      if (actualName) {
        return this.adapters.get(actualName);
      }
    }

    return undefined;
  }

  /**
   * Check if an adapter exists by name or alias.
   * 
   * @param nameOrAlias - The adapter name or alias (case-insensitive)
   * @returns True if adapter exists, false otherwise
   * 
   * @example
   * ```ts
   * if (registry.has('cursor')) {
   *   console.log('Cursor adapter is available');
   * }
   * ```
   */
  has(nameOrAlias: string): boolean {
    return this.get(nameOrAlias) !== undefined;
  }

  /**
   * List all registered adapter names (sorted alphabetically).
   * 
   * @returns Array of adapter names
   * 
   * @example
   * ```ts
   * const names = registry.list(); // ['claude', 'cursor', 'windsurf']
   * ```
   */
  list(): string[] {
    return Array.from(this.adapters.keys()).sort();
  }

  /**
   * Get all adapters with their capabilities.
   * 
   * @returns Array of adapter info objects (sorted by name)
   * 
   * @example
   * ```ts
   * const all = registry.getAll();
   * all.forEach(({ name, capabilities }) => {
   *   console.log(`${name}: supports ${capabilities.multipleAgents ? 'multiple' : 'single'} agents`);
   * });
   * ```
   */
  getAll(): AdapterInfo[] {
    const result: AdapterInfo[] = [];

    this.adapters.forEach((adapter, name) => {
      result.push({
        name,
        adapter,
        capabilities: adapter.getCapabilities(),
      });
    });

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get capabilities for a specific adapter.
   * 
   * @param nameOrAlias - The adapter name or alias
   * @returns Tool capabilities, or undefined if adapter not found
   * 
   * @example
   * ```ts
   * const caps = registry.getCapabilities('cursor');
   * if (caps?.multipleAgents === false) {
   *   console.warn('Cursor only supports single agent files');
   * }
   * ```
   */
  getCapabilities(nameOrAlias: string): ToolCapabilities | undefined {
    const adapter = this.get(nameOrAlias);
    return adapter?.getCapabilities();
  }

  /**
   * Find all adapters that support a specific feature.
   * 
   * @param feature - The feature key to search for
   * @returns Array of adapters that support the feature
   * 
   * @example
   * ```ts
   * const withMultiAgent = registry.findByFeature('multipleAgents');
   * console.log(`${withMultiAgent.length} adapters support multiple agents`);
   * ```
   */
  findByFeature(feature: keyof ToolCapabilities): BaseAdapter[] {
    const result: BaseAdapter[] = [];

    this.adapters.forEach((adapter) => {
      const capabilities = adapter.getCapabilities();
      if (capabilities[feature] === true) {
        result.push(adapter);
      }
    });

    return result;
  }

  /**
   * Unregister an adapter by name.
   * 
   * @param name - The adapter name to remove
   * @returns True if adapter was removed, false if not found
   * 
   * @example
   * ```ts
   * registry.unregister('cursor');
   * ```
   */
  unregister(name: string): boolean {
    const normalized = name.toLowerCase();

    // Remove adapter
    const removed = this.adapters.delete(normalized);

    // Remove all aliases pointing to this adapter
    if (removed) {
      const aliasesToRemove: string[] = [];
      this.aliases.forEach((adapterName, alias) => {
        if (adapterName === normalized) {
          aliasesToRemove.push(alias);
        }
      });
      aliasesToRemove.forEach((alias) => this.aliases.delete(alias));
    }

    return removed;
  }

  /**
   * Clear all registered adapters and aliases.
   * 
   * @example
   * ```ts
   * registry.clear();
   * console.log(registry.list()); // []
   * ```
   */
  clear(): void {
    this.adapters.clear();
    this.aliases.clear();
  }

  /**
   * Get the number of registered adapters.
   * 
   * @returns Count of registered adapters (excluding aliases)
   */
  get size(): number {
    return this.adapters.size;
  }

  /**
   * Register built-in adapters (lazy loading).
   * 
   * This method is called on-demand to avoid circular dependencies.
   * Adapters are imported dynamically when first needed.
   * 
   * @example
   * ```ts
   * await registry.registerBuiltInAdapters();
   * ```
   */
  async registerBuiltInAdapters(): Promise<void> {
    // Dynamic imports to avoid circular dependencies.
    //
    // These four used to be wrapped in `try { … } catch { /* skip silently */ }`, dating from
    // when the adapters genuinely might not exist yet. All four now ship, and the swallow had
    // become a hazard rather than tolerance: it ate the duplicate-registration
    // AdapterRegistryError from register() as readily as a bad import path, so a typo could
    // leave registry.get("opencode") returning undefined with nothing written anywhere. For a
    // build whose entire value is determinism, a silent missing target is the worst outcome
    // available — worse than a crash, which at least tells you.
    //
    // A failure here means the package is broken, not that a target is unavailable. Let it throw.
    const [{ CursorAdapter }, { ClaudeAdapter }, { WindsurfAdapter }, { OpenCodeAdapter }] =
      await Promise.all([
        import("../adapters/CursorAdapter.js"),
        import("../adapters/ClaudeAdapter.js"),
        import("../adapters/WindsurfAdapter.js"),
        import("../adapters/OpenCodeAdapter.js"),
      ]);

    const builtIns: ReadonlyArray<{ adapter: BaseAdapter; aliases: string[] }> = [
      { adapter: new CursorAdapter(), aliases: ["cursor-ide", "cursor-editor"] },
      { adapter: new ClaudeAdapter(), aliases: ["claude-code", "anthropic-claude"] },
      { adapter: new WindsurfAdapter(), aliases: ["windsurf-ide"] },
      { adapter: new OpenCodeAdapter(), aliases: ["open-code"] },
    ];

    for (const { adapter, aliases } of builtIns) {
      // Registering the built-ins twice is a no-op, not an error. This has to be explicit:
      // `registry` is a module singleton and BOTH cli/commands/convert.ts and
      // cli/commands/migrate.ts call this on it, so a process touching both used to hit
      // "Adapter 'cursor' is already registered". The old blanket catch swallowed that
      // duplicate error, which is the only reason it never surfaced — the non-idempotence
      // was real, just hidden. Skipping a name that is already present keeps this callable
      // from anywhere while leaving register()'s duplicate check meaningful for everyone else
      // (including a caller who deliberately overrode a built-in before calling this).
      if (this.has(adapter.name)) continue;
      this.register(adapter, aliases);
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Global singleton registry instance.
 * 
 * Use this for most cases unless you need isolated registries for testing.
 * 
 * @example
 * ```ts
 * import { registry } from './core/AdapterRegistry.js';
 * 
 * const adapter = registry.get('cursor');
 * ```
 */
export const registry = new AdapterRegistry();

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Get an adapter from the global registry.
 * 
 * @param nameOrAlias - The adapter name or alias
 * @returns The adapter instance, or undefined if not found
 * 
 * @example
 * ```ts
 * const adapter = getAdapter('cursor');
 * ```
 */
export function getAdapter(nameOrAlias: string): BaseAdapter | undefined {
  return registry.get(nameOrAlias);
}

/**
 * List all adapters in the global registry.
 * 
 * @returns Array of adapter names
 * 
 * @example
 * ```ts
 * const names = listAdapters(); // ['claude', 'cursor', 'windsurf']
 * ```
 */
export function listAdapters(): string[] {
  return registry.list();
}

/**
 * Get all adapter capabilities from the global registry.
 * 
 * @returns Array of objects with name and capabilities
 * 
 * @example
 * ```ts
 * const capabilities = getAllCapabilities();
 * capabilities.forEach(({ name, capabilities }) => {
 *   console.log(`${name}:`, capabilities);
 * });
 * ```
 */
export function getAllCapabilities(): Array<{ name: string; capabilities: ToolCapabilities }> {
  return registry.getAll().map(({ name, capabilities }) => ({
    name,
    capabilities,
  }));
}
