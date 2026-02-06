import { describe, it, expect } from "vitest";
import { executeInfo } from "../commands/info.js";
import type { GlobalOptions } from "../types.js";

/**
 * Integration tests for the info CLI command
 *
 * Test strategy:
 * 1. Feature matrix - Display all platforms info
 * 2. Single platform info - Detailed info for one platform
 * 3. Platform comparison - Compare two platforms
 * 4. Error handling - Invalid platform names
 * 5. Output format - JSON and text output
 */

// Default global options for tests
const defaultGlobalOptions: GlobalOptions = {
  verbose: false,
  quiet: true,
  outputFormat: "text",
};

describe("info command", () => {
  // ============================================================================
  // FEATURE MATRIX (NO PLATFORM SPECIFIED)
  // ============================================================================

  describe("feature matrix (no platform specified)", () => {
    it("returns info for all platforms when no platform specified", async () => {
      // Act
      const result = await executeInfo(
        undefined,
        {},
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.platforms).toBeDefined();
      expect(Array.isArray(result.data?.platforms)).toBe(true);
    });

    it("includes all four platforms in matrix", async () => {
      // Act
      const result = await executeInfo(
        undefined,
        {},
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      const platformNames = result.data?.platforms?.map(p => p.platform) || [];
      expect(platformNames).toContain("oac");
      expect(platformNames).toContain("cursor");
      expect(platformNames).toContain("claude");
      expect(platformNames).toContain("windsurf");
    });

    it("each platform has required fields", async () => {
      // Act
      const result = await executeInfo(
        undefined,
        {},
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      for (const platform of result.data?.platforms || []) {
        expect(platform.platform).toBeDefined();
        expect(platform.displayName).toBeDefined();
        expect(platform.capabilities).toBeDefined();
        expect(platform.features).toBeDefined();
      }
    });
  });

  // ============================================================================
  // SINGLE PLATFORM INFO
  // ============================================================================

  describe("single platform info", () => {
    it("returns detailed info for OAC platform", async () => {
      // Act
      const result = await executeInfo(
        "oac",
        {},
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.platform).toBeDefined();
      expect(result.data?.platform?.platform).toBe("oac");
      expect(result.data?.platform?.displayName).toBe("OpenAgents Control");
    });

    it("returns detailed info for Cursor platform", async () => {
      // Act
      const result = await executeInfo(
        "cursor",
        {},
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.platform?.platform).toBe("cursor");
      expect(result.data?.platform?.displayName).toBe("Cursor IDE");
    });

    it("returns detailed info for Claude platform", async () => {
      // Act
      const result = await executeInfo(
        "claude",
        {},
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.platform?.platform).toBe("claude");
      expect(result.data?.platform?.displayName).toBe("Claude Code");
    });

    it("returns detailed info for Windsurf platform", async () => {
      // Act
      const result = await executeInfo(
        "windsurf",
        {},
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.platform?.platform).toBe("windsurf");
      expect(result.data?.platform?.displayName).toBe("Windsurf");
    });

    it("includes capabilities in platform info", async () => {
      // Act
      const result = await executeInfo(
        "cursor",
        {},
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      const caps = result.data?.platform?.capabilities;
      expect(caps).toBeDefined();
      expect(typeof caps?.supportsMultipleAgents).toBe("boolean");
      expect(typeof caps?.supportsSkills).toBe("boolean");
      expect(typeof caps?.supportsHooks).toBe("boolean");
      expect(typeof caps?.supportsGranularPermissions).toBe("boolean");
      expect(typeof caps?.supportsContexts).toBe("boolean");
      expect(typeof caps?.supportsCustomModels).toBe("boolean");
      expect(typeof caps?.supportsTemperature).toBe("boolean");
      expect(typeof caps?.supportsMaxSteps).toBe("boolean");
      expect(caps?.configFormat).toBeDefined();
      expect(caps?.outputStructure).toBeDefined();
    });

    it("includes features list in platform info", async () => {
      // Act
      const result = await executeInfo(
        "oac",
        {},
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data?.platform?.features)).toBe(true);
      
      for (const feature of result.data?.platform?.features || []) {
        expect(feature.name).toBeDefined();
        expect(feature.category).toBeDefined();
        expect(feature.description).toBeDefined();
        expect(["full", "partial", "none"]).toContain(feature.support);
      }
    });
  });

  // ============================================================================
  // PLATFORM COMPARISON
  // ============================================================================

  describe("platform comparison", () => {
    it("compares OAC with Cursor", async () => {
      // Act
      const result = await executeInfo(
        "oac",
        { compare: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.comparison).toBeDefined();
      expect(result.data?.comparison?.platformA).toBe("oac");
      expect(result.data?.comparison?.platformB).toBe("cursor");
    });

    it("compares Claude with Windsurf", async () => {
      // Act
      const result = await executeInfo(
        "claude",
        { compare: "windsurf" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.comparison).toBeDefined();
      expect(result.data?.comparison?.platformA).toBe("claude");
      expect(result.data?.comparison?.platformB).toBe("windsurf");
    });

    it("comparison includes identical features list", async () => {
      // Act
      const result = await executeInfo(
        "oac",
        { compare: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data?.comparison?.identical)).toBe(true);
    });

    it("comparison includes betterInA features list", async () => {
      // Act
      const result = await executeInfo(
        "oac",
        { compare: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data?.comparison?.betterInA)).toBe(true);
    });

    it("comparison includes betterInB features list", async () => {
      // Act
      const result = await executeInfo(
        "oac",
        { compare: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data?.comparison?.betterInB)).toBe(true);
    });

    it("also returns platform info when comparing", async () => {
      // Act
      const result = await executeInfo(
        "oac",
        { compare: "claude" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.platform).toBeDefined();
      expect(result.data?.comparison).toBeDefined();
    });
  });

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  describe("error handling", () => {
    it("returns error for invalid platform name", async () => {
      // Act
      const result = await executeInfo(
        "invalid-platform",
        {},
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown platform");
    });

    it("returns error for invalid comparison platform", async () => {
      // Act
      const result = await executeInfo(
        "oac",
        { compare: "invalid-platform" as any },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown platform");
    });

    it("handles case-sensitive platform names", async () => {
      // Act
      const result = await executeInfo(
        "OAC", // uppercase should fail
        {},
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // JSON OUTPUT FORMAT
  // ============================================================================

  describe("JSON output format", () => {
    it("works with JSON output format for matrix", async () => {
      // Act
      const result = await executeInfo(
        undefined,
        {},
        { ...defaultGlobalOptions, outputFormat: "json" }
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.platforms).toBeDefined();
    });

    it("works with JSON output format for single platform", async () => {
      // Act
      const result = await executeInfo(
        "cursor",
        {},
        { ...defaultGlobalOptions, outputFormat: "json" }
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.platform).toBeDefined();
    });

    it("works with JSON output format for comparison", async () => {
      // Act
      const result = await executeInfo(
        "oac",
        { compare: "claude" },
        { ...defaultGlobalOptions, outputFormat: "json" }
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.comparison).toBeDefined();
    });
  });

  // ============================================================================
  // DETAILED OPTION
  // ============================================================================

  describe("detailed option", () => {
    it("respects detailed flag", async () => {
      // Act
      const result = await executeInfo(
        "oac",
        { detailed: true },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // CAPABILITY VALUES
  // ============================================================================

  describe("capability values", () => {
    it("OAC supports all features", async () => {
      // Act
      const result = await executeInfo(
        "oac",
        {},
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      const caps = result.data?.platform?.capabilities;
      expect(caps?.supportsMultipleAgents).toBe(true);
      expect(caps?.supportsSkills).toBe(true);
      expect(caps?.supportsHooks).toBe(true);
      expect(caps?.supportsGranularPermissions).toBe(true);
      expect(caps?.supportsContexts).toBe(true);
    });

    it("Cursor has limited feature support", async () => {
      // Act
      const result = await executeInfo(
        "cursor",
        {},
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      const caps = result.data?.platform?.capabilities;
      expect(caps?.supportsMultipleAgents).toBe(false);
      expect(caps?.supportsSkills).toBe(false);
      expect(caps?.supportsHooks).toBe(false);
    });

    it("Claude supports skills and hooks", async () => {
      // Act
      const result = await executeInfo(
        "claude",
        {},
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      const caps = result.data?.platform?.capabilities;
      expect(caps?.supportsMultipleAgents).toBe(true);
      expect(caps?.supportsSkills).toBe(true);
      expect(caps?.supportsHooks).toBe(true);
    });
  });

  // ============================================================================
  // FEATURE CATEGORIES
  // ============================================================================

  describe("feature categories", () => {
    it("features are organized by category", async () => {
      // Act
      const result = await executeInfo(
        "oac",
        {},
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      
      const categories = new Set(
        result.data?.platform?.features?.map(f => f.category) || []
      );
      
      // Should have multiple categories
      expect(categories.size).toBeGreaterThan(1);
    });

    it("includes expected categories", async () => {
      // Act
      const result = await executeInfo(
        "oac",
        {},
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      
      const categories = new Set(
        result.data?.platform?.features?.map(f => f.category) || []
      );
      
      // Should include common categories
      const expectedCategories = ["agents", "permissions", "tools", "context", "model", "advanced"];
      for (const cat of expectedCategories) {
        expect(categories.has(cat)).toBe(true);
      }
    });
  });

  // ============================================================================
  // CONFIG FORMAT AND OUTPUT STRUCTURE
  // ============================================================================

  describe("config format and output structure", () => {
    it("OAC uses markdown format and directory structure", async () => {
      // Act
      const result = await executeInfo(
        "oac",
        {},
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.platform?.capabilities?.configFormat).toBe("markdown");
      expect(result.data?.platform?.capabilities?.outputStructure).toBe("directory");
    });

    it("Cursor uses plain format and single-file structure", async () => {
      // Act
      const result = await executeInfo(
        "cursor",
        {},
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.platform?.capabilities?.configFormat).toBe("plain");
      expect(result.data?.platform?.capabilities?.outputStructure).toBe("single-file");
    });

    it("Claude uses JSON format and directory structure", async () => {
      // Act
      const result = await executeInfo(
        "claude",
        {},
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      // Note: CapabilityMatrix defines Claude as 'json' format (not markdown)
      // because Claude Code settings.json uses JSON configuration
      expect(result.data?.platform?.capabilities?.configFormat).toBe("json");
      expect(result.data?.platform?.capabilities?.outputStructure).toBe("directory");
    });
  });
});
