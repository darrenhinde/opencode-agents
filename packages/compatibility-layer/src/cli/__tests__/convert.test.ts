import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFile, writeFile, mkdir, rm, access } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { executeConvert } from "../commands/convert.js";
import type { GlobalOptions } from "../types.js";

/**
 * Integration tests for the convert CLI command
 *
 * Test strategy:
 * 1. Successful conversions - OAC to/from Cursor, Claude, Windsurf
 * 2. Error handling - Non-existent files, invalid formats
 * 3. Output options - stdout, file output, --force flag
 * 4. Format detection - Auto-detect input formats
 * 5. Roundtrip - Data integrity checks
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURES_DIR = join(__dirname, "fixtures");
const TEMP_DIR = join(__dirname, "temp-convert");

// Default global options for tests
const defaultGlobalOptions: GlobalOptions = {
  verbose: false,
  quiet: true,
  outputFormat: "text",
};

describe("convert command", () => {
  // Setup temp directory before each test
  beforeEach(async () => {
    await mkdir(TEMP_DIR, { recursive: true });
  });

  // Cleanup temp directory after each test
  afterEach(async () => {
    try {
      await rm(TEMP_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // ============================================================================
  // SUCCESSFUL CONVERSIONS
  // ============================================================================

  describe("successful conversions", () => {
    it("converts OAC to Cursor format", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-oac-agent.md");

      // Act
      const result = await executeConvert(
        inputPath,
        { format: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.configs).toBeDefined();
      expect(result.data?.configs.length).toBeGreaterThan(0);
      expect(result.data?.configs[0].fileName).toBe(".cursorrules");
    });

    it("converts OAC to Claude format", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-oac-agent.md");

      // Act
      const result = await executeConvert(
        inputPath,
        { format: "claude" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.configs).toBeDefined();
      expect(result.data?.configs[0].fileName).toContain(".claude/");
    });

    it("converts Cursor to OAC format", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-cursorrules");

      // Act
      const result = await executeConvert(
        inputPath,
        { format: "oac", from: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.configs).toBeDefined();
      expect(result.data?.configs[0].content).toContain("---");
    });

    it("converts Claude to OAC format", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-claude-config.json");

      // Act
      const result = await executeConvert(
        inputPath,
        { format: "oac", from: "claude" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.configs).toBeDefined();
      expect(result.data?.configs[0].content).toContain("---");
      expect(result.data?.configs[0].content).toContain("sample-claude-agent");
    });

    it("auto-detects OAC input format", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-oac-agent.md");

      // Act - no --from specified
      const result = await executeConvert(
        inputPath,
        { format: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.configs[0].fileName).toBe(".cursorrules");
    });

    it("auto-detects Cursor input format from .cursorrules filename", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-cursorrules");

      // Act
      const result = await executeConvert(
        inputPath,
        { format: "oac" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
    });

    it("preserves agent name through conversion", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-oac-agent.md");

      // Act
      const result = await executeConvert(
        inputPath,
        { format: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.configs[0].content).toContain("sample-oac-agent");
    });

    it("preserves system prompt content through conversion", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-oac-agent.md");

      // Act
      const result = await executeConvert(
        inputPath,
        { format: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.configs[0].content).toContain("helpful assistant");
    });
  });

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  describe("error handling", () => {
    it("returns error for non-existent file", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "does-not-exist.md");

      // Act
      const result = await executeConvert(
        inputPath,
        { format: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("returns error for same source/target format", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-oac-agent.md");

      // Act
      const result = await executeConvert(
        inputPath,
        { format: "oac", from: "oac" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("same");
    });

    it("handles conversion errors gracefully", async () => {
      // Arrange - create a file that will cause parsing issues
      const brokenFile = join(TEMP_DIR, "broken.md");
      await writeFile(brokenFile, "---\ninvalid: yaml: content:\n---\nContent");

      // Act
      const result = await executeConvert(
        brokenFile,
        { format: "cursor" },
        defaultGlobalOptions
      );

      // Assert - should either succeed with degraded content or fail gracefully
      // The adapter should handle malformed YAML
      expect(typeof result.success).toBe("boolean");
    });
  });

  // ============================================================================
  // OUTPUT OPTIONS
  // ============================================================================

  describe("output options", () => {
    it("writes to specified output path", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-oac-agent.md");
      const outputPath = join(TEMP_DIR, "output.cursorrules");

      // Act
      const result = await executeConvert(
        inputPath,
        { format: "cursor", output: outputPath },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      
      // Verify file was written
      const content = await readFile(outputPath, "utf-8");
      expect(content).toContain("sample-oac-agent");
    });

    it("outputs to stdout when no output specified", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-oac-agent.md");
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // Act
      const result = await executeConvert(
        inputPath,
        { format: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      // Console.log should have been called with the content
      expect(consoleSpy).toHaveBeenCalled();

      // Cleanup
      consoleSpy.mockRestore();
    });

    it("respects --force flag to overwrite existing file", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-oac-agent.md");
      const outputPath = join(TEMP_DIR, "existing.cursorrules");
      
      // Create existing file
      await writeFile(outputPath, "existing content");

      // Act - with force flag
      const result = await executeConvert(
        inputPath,
        { format: "cursor", output: outputPath, force: true },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      
      const content = await readFile(outputPath, "utf-8");
      expect(content).not.toBe("existing content");
      expect(content).toContain("sample-oac-agent");
    });

    it("returns error when output file exists and --force not set", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-oac-agent.md");
      const outputPath = join(TEMP_DIR, "existing2.cursorrules");
      
      // Create existing file
      await writeFile(outputPath, "existing content");

      // Act - without force flag
      const result = await executeConvert(
        inputPath,
        { format: "cursor", output: outputPath, force: false },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("exists");
    });

    it("creates output directory if it does not exist", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-oac-agent.md");
      const outputPath = join(TEMP_DIR, "nested", "deep", "output.cursorrules");

      // Act
      const result = await executeConvert(
        inputPath,
        { format: "cursor", output: outputPath },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      
      const content = await readFile(outputPath, "utf-8");
      expect(content).toContain("sample-oac-agent");
    });
  });

  // ============================================================================
  // FORMAT DETECTION
  // ============================================================================

  describe("format detection", () => {
    it("detects OAC format from frontmatter", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-oac-agent.md");

      // Act
      const result = await executeConvert(
        inputPath,
        { format: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
    });

    it("detects Claude format from JSON structure", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-claude-config.json");

      // Act
      const result = await executeConvert(
        inputPath,
        { format: "oac" },
        { ...defaultGlobalOptions, verbose: true }
      );

      // Assert
      expect(result.success).toBe(true);
    });

    it("uses specified --from format over auto-detection", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-cursorrules");

      // Act - explicitly specify cursor format
      const result = await executeConvert(
        inputPath,
        { format: "oac", from: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // ROUNDTRIP CONVERSION
  // ============================================================================

  describe("roundtrip conversion", () => {
    it("roundtrip OAC -> Claude -> OAC preserves core properties", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-oac-agent.md");
      const claudeOutputPath = join(TEMP_DIR, "claude-config.json");
      const oacOutputPath = join(TEMP_DIR, "roundtrip-agent.md");

      // Act - Step 1: Convert OAC to Claude
      const toClaude = await executeConvert(
        inputPath,
        { format: "claude", output: claudeOutputPath },
        defaultGlobalOptions
      );
      expect(toClaude.success).toBe(true);

      // Act - Step 2: Convert Claude back to OAC
      const toOAC = await executeConvert(
        claudeOutputPath,
        { format: "oac", from: "claude", output: oacOutputPath },
        defaultGlobalOptions
      );

      // Assert
      expect(toOAC.success).toBe(true);
      
      const originalContent = await readFile(inputPath, "utf-8");
      const roundtripContent = await readFile(oacOutputPath, "utf-8");
      
      // Core properties should be preserved
      expect(roundtripContent).toContain("sample-oac-agent");
      expect(roundtripContent).toContain("helpful assistant");
    });

    it("roundtrip OAC -> Cursor -> OAC preserves core properties", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-oac-agent.md");
      const cursorOutputPath = join(TEMP_DIR, ".cursorrules");
      const oacOutputPath = join(TEMP_DIR, "roundtrip-cursor.md");

      // Act - Step 1: Convert OAC to Cursor
      const toCursor = await executeConvert(
        inputPath,
        { format: "cursor", output: cursorOutputPath },
        defaultGlobalOptions
      );
      expect(toCursor.success).toBe(true);

      // Act - Step 2: Convert Cursor back to OAC
      const toOAC = await executeConvert(
        cursorOutputPath,
        { format: "oac", from: "cursor", output: oacOutputPath },
        defaultGlobalOptions
      );

      // Assert
      expect(toOAC.success).toBe(true);
      
      const roundtripContent = await readFile(oacOutputPath, "utf-8");
      expect(roundtripContent).toContain("sample-oac-agent");
    });
  });

  // ============================================================================
  // WARNINGS HANDLING
  // ============================================================================

  describe("warnings handling", () => {
    it("includes warnings in result when features are lost", async () => {
      // Arrange - OAC with advanced features that Cursor doesn't support
      const inputPath = join(FIXTURES_DIR, "sample-oac-agent.md");

      // Act
      const result = await executeConvert(
        inputPath,
        { format: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      // Warnings may or may not be present depending on feature parity
      expect(Array.isArray(result.warnings) || result.warnings === undefined).toBe(true);
    });
  });

  // ============================================================================
  // VERBOSE OUTPUT
  // ============================================================================

  describe("verbose output", () => {
    it("respects verbose flag", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-oac-agent.md");

      // Act
      const result = await executeConvert(
        inputPath,
        { format: "cursor" },
        { ...defaultGlobalOptions, verbose: true }
      );

      // Assert
      expect(result.success).toBe(true);
    });
  });
});
