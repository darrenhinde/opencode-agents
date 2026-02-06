/**
 * Unit tests for ToolMapper
 * 
 * Tests tool name mapping between OAC and other platforms.
 */

import { describe, it, expect } from "vitest";
import {
  mapToolToOAC,
  mapToolFromOAC,
  mapToolAccessFromOAC,
  mapToolAccessToOAC,
  getSupportedTools,
  getUnsupportedTools,
  isToolSupported,
} from "../../../src/mappers/ToolMapper";

describe("ToolMapper", () => {
  // ==========================================================================
  // mapToolFromOAC - OAC to Platform
  // ==========================================================================
  describe("mapToolFromOAC()", () => {
    describe("Claude platform", () => {
      it("maps bash to Bash", () => {
        const result = mapToolFromOAC("bash", "claude");
        expect(result.name).toBe("Bash");
        expect(result.exact).toBe(true);
        expect(result.warning).toBeUndefined();
      });

      it("maps read to Read", () => {
        const result = mapToolFromOAC("read", "claude");
        expect(result.name).toBe("Read");
        expect(result.exact).toBe(true);
      });

      it("maps write to Write", () => {
        const result = mapToolFromOAC("write", "claude");
        expect(result.name).toBe("Write");
        expect(result.exact).toBe(true);
      });

      it("maps edit to Edit", () => {
        const result = mapToolFromOAC("edit", "claude");
        expect(result.name).toBe("Edit");
        expect(result.exact).toBe(true);
      });

      it("maps task to Task", () => {
        const result = mapToolFromOAC("task", "claude");
        expect(result.name).toBe("Task");
        expect(result.exact).toBe(true);
      });

      it("maps patch to Edit (Claude uses Edit for patching)", () => {
        const result = mapToolFromOAC("patch", "claude");
        expect(result.name).toBe("Edit");
        expect(result.exact).toBe(true);
      });
    });

    describe("Cursor platform", () => {
      it("maps bash to terminal", () => {
        const result = mapToolFromOAC("bash", "cursor");
        expect(result.name).toBe("terminal");
        expect(result.exact).toBe(true);
      });

      it("maps read to file_read", () => {
        const result = mapToolFromOAC("read", "cursor");
        expect(result.name).toBe("file_read");
        expect(result.exact).toBe(true);
      });

      it("maps grep to content_search", () => {
        const result = mapToolFromOAC("grep", "cursor");
        expect(result.name).toBe("content_search");
        expect(result.exact).toBe(true);
      });

      it("warns about unsupported task tool", () => {
        const result = mapToolFromOAC("task", "cursor");
        expect(result.exact).toBe(false);
        expect(result.warning).toContain("not supported");
      });
    });

    describe("Windsurf platform", () => {
      it("maps bash to shell", () => {
        const result = mapToolFromOAC("bash", "windsurf");
        expect(result.name).toBe("shell");
        expect(result.exact).toBe(true);
      });

      it("maps task to delegate", () => {
        const result = mapToolFromOAC("task", "windsurf");
        expect(result.name).toBe("delegate");
        expect(result.exact).toBe(true);
      });

      it("maps glob to find_files", () => {
        const result = mapToolFromOAC("glob", "windsurf");
        expect(result.name).toBe("find_files");
        expect(result.exact).toBe(true);
      });
    });

    describe("unknown tools", () => {
      it("returns tool name as-is with warning for unknown tools", () => {
        const result = mapToolFromOAC("unknown_tool", "claude");
        expect(result.name).toBe("unknown_tool");
        expect(result.exact).toBe(false);
        expect(result.warning).toContain("No mapping");
      });
    });
  });

  // ==========================================================================
  // mapToolToOAC - Platform to OAC
  // ==========================================================================
  describe("mapToolToOAC()", () => {
    describe("from Claude", () => {
      it("maps Bash to bash", () => {
        const result = mapToolToOAC("Bash", "claude");
        expect(result.name).toBe("bash");
        expect(result.exact).toBe(true);
      });

      it("maps Read to read", () => {
        const result = mapToolToOAC("Read", "claude");
        expect(result.name).toBe("read");
        expect(result.exact).toBe(true);
      });

      it("maps WebSearch to bash (approximation)", () => {
        const result = mapToolToOAC("WebSearch", "claude");
        expect(result.name).toBe("bash");
        expect(result.exact).toBe(true);
      });
    });

    describe("from Cursor", () => {
      it("maps terminal to bash", () => {
        const result = mapToolToOAC("terminal", "cursor");
        expect(result.name).toBe("bash");
        expect(result.exact).toBe(true);
      });

      it("maps file_read to read", () => {
        const result = mapToolToOAC("file_read", "cursor");
        expect(result.name).toBe("read");
        expect(result.exact).toBe(true);
      });

      it("maps content_search to grep", () => {
        const result = mapToolToOAC("content_search", "cursor");
        expect(result.name).toBe("grep");
        expect(result.exact).toBe(true);
      });
    });

    describe("from Windsurf", () => {
      it("maps shell to bash", () => {
        const result = mapToolToOAC("shell", "windsurf");
        expect(result.name).toBe("bash");
        expect(result.exact).toBe(true);
      });

      it("maps delegate to task", () => {
        const result = mapToolToOAC("delegate", "windsurf");
        expect(result.name).toBe("task");
        expect(result.exact).toBe(true);
      });
    });

    describe("unknown tools", () => {
      it("returns lowercase version with warning", () => {
        const result = mapToolToOAC("UnknownTool", "claude");
        expect(result.name).toBe("unknowntool");
        expect(result.exact).toBe(false);
        expect(result.warning).toContain("Unknown tool");
      });
    });
  });

  // ==========================================================================
  // mapToolAccessFromOAC - Batch OAC to Platform
  // ==========================================================================
  describe("mapToolAccessFromOAC()", () => {
    it("maps multiple tools at once", () => {
      const tools = { bash: true, read: true, write: false };
      const result = mapToolAccessFromOAC(tools, "claude");

      expect(result.tools["Bash"]).toBe(true);
      expect(result.tools["Read"]).toBe(true);
      expect(result.tools["Write"]).toBe(false);
      expect(result.warnings).toHaveLength(0);
    });

    it("skips undefined tools", () => {
      const tools = { bash: true, read: undefined };
      const result = mapToolAccessFromOAC(tools, "claude");

      expect(result.tools["Bash"]).toBe(true);
      expect(result.tools["Read"]).toBeUndefined();
    });

    it("collects warnings for unsupported tools", () => {
      const tools = { task: true };
      const result = mapToolAccessFromOAC(tools, "cursor");

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain("not supported");
    });
  });

  // ==========================================================================
  // mapToolAccessToOAC - Batch Platform to OAC
  // ==========================================================================
  describe("mapToolAccessToOAC()", () => {
    it("maps multiple tools back to OAC format", () => {
      const tools = { terminal: true, file_read: true, file_write: false };
      const result = mapToolAccessToOAC(tools, "cursor");

      expect(result.tools.bash).toBe(true);
      expect(result.tools.read).toBe(true);
      expect(result.tools.write).toBe(false);
    });

    it("handles unknown tools with warnings", () => {
      const tools = { unknown_tool: true };
      const result = mapToolAccessToOAC(tools, "cursor");

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Utility Functions
  // ==========================================================================
  describe("getSupportedTools()", () => {
    it("returns list of supported tools for Claude", () => {
      const tools = getSupportedTools("claude");
      expect(tools).toContain("bash");
      expect(tools).toContain("read");
      expect(tools).toContain("task");
    });

    it("returns list of supported tools for Cursor", () => {
      const tools = getSupportedTools("cursor");
      expect(tools).toContain("bash");
      expect(tools).toContain("read");
    });
  });

  describe("getUnsupportedTools()", () => {
    it("returns empty array for Claude (supports most tools)", () => {
      const tools = getUnsupportedTools("claude");
      expect(tools).toHaveLength(0);
    });

    it("returns task for Cursor (no delegation support)", () => {
      const tools = getUnsupportedTools("cursor");
      expect(tools).toContain("task");
    });
  });

  describe("isToolSupported()", () => {
    it("returns true for supported tools", () => {
      expect(isToolSupported("bash", "claude")).toBe(true);
      expect(isToolSupported("read", "cursor")).toBe(true);
    });

    it("returns false for unsupported tools", () => {
      expect(isToolSupported("task", "cursor")).toBe(false);
    });
  });
});
