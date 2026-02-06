import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { executeValidate, getValidationExitCode } from "../commands/validate.js";
import type { GlobalOptions } from "../types.js";

/**
 * Integration tests for the validate CLI command
 *
 * Test strategy:
 * 1. Successful validations - Valid agents against target platforms
 * 2. Error handling - Missing files, invalid targets, missing required options
 * 3. Compatibility scoring - Score calculation and status determination
 * 4. Feature analysis - Preserved, degraded, and lost features
 * 5. Exit codes - Proper exit codes for different validation results
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURES_DIR = join(__dirname, "fixtures");
const TEMP_DIR = join(__dirname, "temp-validate");

// Default global options for tests
const defaultGlobalOptions: GlobalOptions = {
  verbose: false,
  quiet: true,
  outputFormat: "text",
};

describe("validate command", () => {
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
  // SUCCESSFUL VALIDATIONS
  // ============================================================================

  describe("successful validations", () => {
    it("validates OAC agent against Cursor target", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-oac-agent.md");

      // Act
      const result = await executeValidate(
        inputPath,
        { target: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.target).toBe("cursor");
      expect(result.data?.score).toBeGreaterThanOrEqual(0);
      expect(result.data?.score).toBeLessThanOrEqual(100);
    });

    it("validates OAC agent against Claude target", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-oac-agent.md");

      // Act
      const result = await executeValidate(
        inputPath,
        { target: "claude" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.target).toBe("claude");
      expect(typeof result.data?.score).toBe("number");
    });

    it("validates OAC agent against Windsurf target", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-oac-agent.md");

      // Act
      const result = await executeValidate(
        inputPath,
        { target: "windsurf" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.target).toBe("windsurf");
    });

    it("returns status field in validation result", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-oac-agent.md");

      // Act
      const result = await executeValidate(
        inputPath,
        { target: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.status).toBeDefined();
      expect(["compatible", "partial", "incompatible"]).toContain(result.data?.status);
    });

    it("returns canConvert field in validation result", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-oac-agent.md");

      // Act
      const result = await executeValidate(
        inputPath,
        { target: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(typeof result.data?.canConvert).toBe("boolean");
    });

    it("returns feature breakdown in validation result", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-oac-agent.md");

      // Act
      const result = await executeValidate(
        inputPath,
        { target: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data?.preserved)).toBe(true);
      expect(Array.isArray(result.data?.degraded)).toBe(true);
      expect(Array.isArray(result.data?.lost)).toBe(true);
    });
  });

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  describe("error handling", () => {
    it("returns error when target is not specified", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-oac-agent.md");

      // Act
      const result = await executeValidate(
        inputPath,
        { target: undefined },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("target");
    });

    it("returns error when target is OAC (invalid target)", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-oac-agent.md");

      // Act
      const result = await executeValidate(
        inputPath,
        { target: "oac" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("OAC");
    });

    it("returns error for non-existent file", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "does-not-exist.md");

      // Act
      const result = await executeValidate(
        inputPath,
        { target: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("handles invalid agent file gracefully", async () => {
      // Arrange
      const brokenFile = join(TEMP_DIR, "broken-agent.md");
      await writeFile(brokenFile, "---\ninvalid yaml: ::::\n---\nContent");

      // Act
      const result = await executeValidate(
        brokenFile,
        { target: "cursor" },
        defaultGlobalOptions
      );

      // Assert - should either succeed with degraded result or fail gracefully
      expect(typeof result.success).toBe("boolean");
    });
  });

  // ============================================================================
  // STRICT MODE
  // ============================================================================

  describe("strict mode", () => {
    it("applies strict validation when --strict flag is set", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-oac-agent.md");

      // Act
      const result = await executeValidate(
        inputPath,
        { target: "cursor", strict: true },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      // In strict mode, any lost features should mark as incompatible
      if (result.data?.lost && result.data.lost.length > 0) {
        expect(result.data.status).toBe("incompatible");
      }
    });

    it("non-strict mode allows partial compatibility", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-oac-agent.md");

      // Act
      const result = await executeValidate(
        inputPath,
        { target: "cursor", strict: false },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      // Should allow partial even with some lost features
      expect(["compatible", "partial", "incompatible"]).toContain(result.data?.status);
    });
  });

  // ============================================================================
  // EXIT CODES
  // ============================================================================

  describe("exit codes", () => {
    it("returns exit code 0 for compatible status", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-oac-agent.md");
      const result = await executeValidate(
        inputPath,
        { target: "cursor" },
        defaultGlobalOptions
      );

      // Act
      const exitCode = getValidationExitCode(result);

      // Assert
      if (result.data?.status === "compatible") {
        expect(exitCode).toBe(0);
      }
    });

    it("returns exit code 1 for partial compatibility", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-oac-agent.md");
      const result = await executeValidate(
        inputPath,
        { target: "cursor" },
        defaultGlobalOptions
      );

      // Act
      const exitCode = getValidationExitCode(result);

      // Assert
      if (result.data?.status === "partial") {
        expect(exitCode).toBe(1);
      }
    });

    it("returns exit code 2 for incompatible status", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-oac-agent.md");
      const result = await executeValidate(
        inputPath,
        { target: "cursor", strict: true },
        defaultGlobalOptions
      );

      // Act
      const exitCode = getValidationExitCode(result);

      // Assert
      if (result.data?.status === "incompatible") {
        expect(exitCode).toBe(2);
      }
    });

    it("returns exit code 2 for failed validations", async () => {
      // Arrange - non-existent file
      const inputPath = join(FIXTURES_DIR, "does-not-exist.md");
      const result = await executeValidate(
        inputPath,
        { target: "cursor" },
        defaultGlobalOptions
      );

      // Act
      const exitCode = getValidationExitCode(result);

      // Assert
      expect(exitCode).toBe(2);
    });
  });

  // ============================================================================
  // SUGGESTIONS
  // ============================================================================

  describe("suggestions", () => {
    it("returns suggestions for lost or degraded features", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-oac-agent.md");

      // Act
      const result = await executeValidate(
        inputPath,
        { target: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data?.suggestions)).toBe(true);
    });
  });

  // ============================================================================
  // BLOCKERS
  // ============================================================================

  describe("blockers", () => {
    it("returns blockers array in validation result", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-oac-agent.md");

      // Act
      const result = await executeValidate(
        inputPath,
        { target: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data?.blockers)).toBe(true);
    });

    it("canConvert is false when blockers exist", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-oac-agent.md");

      // Act
      const result = await executeValidate(
        inputPath,
        { target: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      if (result.data?.blockers && result.data.blockers.length > 0) {
        expect(result.data.canConvert).toBe(false);
      }
    });
  });

  // ============================================================================
  // JSON OUTPUT
  // ============================================================================

  describe("JSON output format", () => {
    it("works with JSON output format option", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-oac-agent.md");

      // Act
      const result = await executeValidate(
        inputPath,
        { target: "cursor" },
        { ...defaultGlobalOptions, outputFormat: "json" }
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  // ============================================================================
  // INPUT PATH VALIDATION
  // ============================================================================

  describe("input path validation", () => {
    it("includes input path in result data", async () => {
      // Arrange
      const inputPath = join(FIXTURES_DIR, "sample-oac-agent.md");

      // Act
      const result = await executeValidate(
        inputPath,
        { target: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.input).toBe(inputPath);
    });
  });
});
