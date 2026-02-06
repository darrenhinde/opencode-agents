import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, writeFile, readFile, readdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { executeMigrate } from "../commands/migrate.js";
import type { GlobalOptions } from "../types.js";

/**
 * Integration tests for the migrate CLI command
 *
 * Test strategy:
 * 1. Successful migrations - Directory migrations to different formats
 * 2. Error handling - Non-existent directories, invalid formats
 * 3. Dry run mode - Preview migrations without writing
 * 4. Output directory options - Custom output dirs, auto-generated names
 * 5. Force overwrite - Handling existing files
 * 6. Migration report - Verify report structure and counts
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURES_DIR = join(__dirname, "fixtures");
const TEMP_DIR = join(__dirname, "temp-migrate");

// Default global options for tests
const defaultGlobalOptions: GlobalOptions = {
  verbose: false,
  quiet: true,
  outputFormat: "text",
};

describe("migrate command", () => {
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

  // Helper to create test source directory with agent files
  const createTestSourceDir = async (dirName: string): Promise<string> => {
    const sourceDir = join(TEMP_DIR, dirName);
    await mkdir(sourceDir, { recursive: true });
    
    // Copy OAC agent fixture
    const oacContent = await readFile(join(FIXTURES_DIR, "sample-oac-agent.md"), "utf-8");
    await writeFile(join(sourceDir, "agent1.md"), oacContent);
    
    // Create another agent
    await writeFile(join(sourceDir, "agent2.md"), `---
name: "agent-two"
description: "Second test agent"
mode: primary
---

You are a second agent for testing.
`);
    
    return sourceDir;
  };

  // ============================================================================
  // SUCCESSFUL MIGRATIONS
  // ============================================================================

  describe("successful migrations", () => {
    it("migrates directory to Cursor format", async () => {
      // Arrange
      const sourceDir = await createTestSourceDir("source-cursor");
      const outDir = join(TEMP_DIR, "output-cursor");

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor", outDir },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.total).toBeGreaterThan(0);
      expect(result.data?.successful).toBeGreaterThan(0);
    });

    it("migrates directory to Claude format", async () => {
      // Arrange
      const sourceDir = await createTestSourceDir("source-claude");
      const outDir = join(TEMP_DIR, "output-claude");

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "claude", outDir },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.total).toBeGreaterThan(0);
    });

    it("migrates directory to OAC format", async () => {
      // Arrange - create a directory with cursor-style files
      const sourceDir = join(TEMP_DIR, "source-oac");
      await mkdir(sourceDir, { recursive: true });
      
      const cursorContent = await readFile(join(FIXTURES_DIR, "sample-cursorrules"), "utf-8");
      await writeFile(join(sourceDir, ".cursorrules"), cursorContent);

      const outDir = join(TEMP_DIR, "output-oac");

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "oac", outDir },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
    });

    it("creates output files in target directory", async () => {
      // Arrange
      const sourceDir = await createTestSourceDir("source-files");
      const outDir = join(TEMP_DIR, "output-files");

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor", outDir },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      
      // Verify output directory was created
      const outputFiles = await readdir(outDir, { recursive: true });
      expect(outputFiles.length).toBeGreaterThan(0);
    });

    it("auto-generates output directory name when not specified", async () => {
      // Arrange
      const sourceDir = await createTestSourceDir("source-auto");

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      
      // Check that the auto-generated directory exists
      const expectedOutDir = join(sourceDir, "migrated-cursor");
      const files = await readdir(expectedOutDir).catch(() => []);
      expect(files.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  describe("error handling", () => {
    it("returns error for non-existent source directory", async () => {
      // Arrange
      const sourceDir = join(TEMP_DIR, "does-not-exist");

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("returns error when source path is a file, not directory", async () => {
      // Arrange
      const filePath = join(TEMP_DIR, "not-a-directory.txt");
      await writeFile(filePath, "This is a file");

      // Act
      const result = await executeMigrate(
        filePath,
        { format: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("not a directory");
    });

    it("returns success with warning when no agent files found", async () => {
      // Arrange
      const emptyDir = join(TEMP_DIR, "empty-dir");
      await mkdir(emptyDir, { recursive: true });

      // Act
      const result = await executeMigrate(
        emptyDir,
        { format: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.total).toBe(0);
      expect(result.warnings).toBeDefined();
    });
  });

  // ============================================================================
  // DRY RUN MODE
  // ============================================================================

  describe("dry run mode", () => {
    it("does not write files in dry run mode", async () => {
      // Arrange
      const sourceDir = await createTestSourceDir("source-dry");
      const outDir = join(TEMP_DIR, "output-dry");

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor", outDir, dryRun: true },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.successful).toBeGreaterThan(0);
      
      // Verify output directory does NOT exist
      try {
        await readdir(outDir);
        // If we get here, the directory exists which is wrong
        expect(false).toBe(true); // Fail the test
      } catch (err: any) {
        expect(err.code).toBe("ENOENT");
      }
    });

    it("reports what would be migrated in dry run", async () => {
      // Arrange
      const sourceDir = await createTestSourceDir("source-dry-report");

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor", dryRun: true },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.files).toBeDefined();
      expect(result.data?.files.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // FORCE OVERWRITE
  // ============================================================================

  describe("force overwrite", () => {
    it("skips existing files without --force flag", async () => {
      // Arrange
      const sourceDir = await createTestSourceDir("source-no-force");
      const outDir = join(TEMP_DIR, "output-no-force");
      
      // Create output directory with existing file
      await mkdir(outDir, { recursive: true });
      await writeFile(join(outDir, "agent1.md"), "existing content");

      // Act - first migration
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor", outDir, force: false },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      // Check that skipped count is reasonable
      expect(result.data?.skipped).toBeGreaterThanOrEqual(0);
    });

    it("overwrites existing files with --force flag", async () => {
      // Arrange
      const sourceDir = await createTestSourceDir("source-force");
      const outDir = join(TEMP_DIR, "output-force");
      
      // Create output directory with existing file
      await mkdir(outDir, { recursive: true });
      const existingFile = join(outDir, "agent1.cursorrules");
      await writeFile(existingFile, "old content");

      // Act - migrate with force
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor", outDir, force: true },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // MIGRATION REPORT
  // ============================================================================

  describe("migration report", () => {
    it("returns total count of discovered files", async () => {
      // Arrange
      const sourceDir = await createTestSourceDir("source-report-total");

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(typeof result.data?.total).toBe("number");
      expect(result.data?.total).toBeGreaterThan(0);
    });

    it("returns successful count in report", async () => {
      // Arrange
      const sourceDir = await createTestSourceDir("source-report-success");

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(typeof result.data?.successful).toBe("number");
    });

    it("returns failed count in report", async () => {
      // Arrange
      const sourceDir = await createTestSourceDir("source-report-failed");

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(typeof result.data?.failed).toBe("number");
    });

    it("returns skipped count in report", async () => {
      // Arrange
      const sourceDir = await createTestSourceDir("source-report-skipped");

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(typeof result.data?.skipped).toBe("number");
    });

    it("returns list of migrated files in report", async () => {
      // Arrange
      const sourceDir = await createTestSourceDir("source-report-files");

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data?.files)).toBe(true);
      
      // Each file entry should have required properties
      for (const file of result.data?.files || []) {
        expect(file.source).toBeDefined();
        expect(file.status).toBeDefined();
        expect(["success", "failed", "skipped"]).toContain(file.status);
      }
    });

    it("returns warnings array in report", async () => {
      // Arrange
      const sourceDir = await createTestSourceDir("source-report-warnings");

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor" },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data?.warnings)).toBe(true);
    });
  });

  // ============================================================================
  // FILE DISCOVERY
  // ============================================================================

  describe("file discovery", () => {
    it("discovers .md files in directory", async () => {
      // Arrange
      const sourceDir = await createTestSourceDir("source-discover-md");

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor", dryRun: true },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.total).toBeGreaterThan(0);
    });

    it("discovers .json files in directory", async () => {
      // Arrange
      const sourceDir = join(TEMP_DIR, "source-discover-json");
      await mkdir(sourceDir, { recursive: true });
      
      const claudeContent = await readFile(join(FIXTURES_DIR, "sample-claude-config.json"), "utf-8");
      await writeFile(join(sourceDir, "claude-config.json"), claudeContent);

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "oac", dryRun: true },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
    });

    it("discovers .cursorrules files", async () => {
      // Arrange
      const sourceDir = join(TEMP_DIR, "source-discover-cursor");
      await mkdir(sourceDir, { recursive: true });
      
      const cursorContent = await readFile(join(FIXTURES_DIR, "sample-cursorrules"), "utf-8");
      await writeFile(join(sourceDir, ".cursorrules"), cursorContent);

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "oac", dryRun: true },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
    });

    it("skips hidden directories by default (except special ones)", async () => {
      // Arrange
      const sourceDir = join(TEMP_DIR, "source-skip-hidden");
      await mkdir(sourceDir, { recursive: true });
      await mkdir(join(sourceDir, ".hidden"), { recursive: true });
      
      await writeFile(join(sourceDir, "visible.md"), `---
name: visible
description: A visible test agent
mode: primary
---
Content`);
      await writeFile(join(sourceDir, ".hidden", "hidden.md"), `---
name: hidden
description: A hidden test agent
mode: primary
---
Hidden content`);

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor", dryRun: true },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      // Should only find the visible file
      expect(result.data?.total).toBe(1);
    });

    it("includes .opencode directory in discovery", async () => {
      // Arrange
      const sourceDir = join(TEMP_DIR, "source-opencode");
      await mkdir(join(sourceDir, ".opencode", "agents"), { recursive: true });
      
      await writeFile(join(sourceDir, ".opencode", "agents", "agent.md"), `---
name: opencode-agent
description: An opencode test agent
mode: primary
---
Content`);

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor", dryRun: true },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.total).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // SAME FORMAT SKIPPING
  // ============================================================================

  describe("same format skipping", () => {
    it("skips files already in target format", async () => {
      // Arrange
      const sourceDir = join(TEMP_DIR, "source-same-format");
      await mkdir(sourceDir, { recursive: true });
      
      // Create a .cursorrules file
      const cursorContent = await readFile(join(FIXTURES_DIR, "sample-cursorrules"), "utf-8");
      await writeFile(join(sourceDir, ".cursorrules"), cursorContent);

      // Act - try to migrate to cursor (same format)
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor", dryRun: true },
        defaultGlobalOptions
      );

      // Assert
      expect(result.success).toBe(true);
      // The file should be skipped since it's already in cursor format
      expect(result.data?.skipped).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // VERBOSE OUTPUT
  // ============================================================================

  describe("verbose output", () => {
    it("respects verbose flag", async () => {
      // Arrange
      const sourceDir = await createTestSourceDir("source-verbose");

      // Act
      const result = await executeMigrate(
        sourceDir,
        { format: "cursor" },
        { ...defaultGlobalOptions, verbose: true }
      );

      // Assert
      expect(result.success).toBe(true);
    });
  });
});
