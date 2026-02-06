/**
 * Unit tests for ModelMapper
 * 
 * Tests AI model identifier mapping between platforms.
 */

import { describe, it, expect } from "vitest";
import {
  mapModelFromOAC,
  mapModelToOAC,
  getModelFamily,
  getModelInfo,
  getAllModels,
  getModelsForPlatform,
  isModelAvailable,
  getDefaultModel,
} from "../../../src/mappers/ModelMapper";

describe("ModelMapper", () => {
  // ==========================================================================
  // mapModelFromOAC
  // ==========================================================================
  describe("mapModelFromOAC()", () => {
    describe("Claude models", () => {
      it("maps claude-sonnet-4 to Claude format with date suffix", () => {
        const result = mapModelFromOAC("claude-sonnet-4", "claude");
        expect(result.id).toBe("claude-sonnet-4-20250514");
        expect(result.exact).toBe(true);
      });

      it("maps claude-sonnet-4 to Cursor format", () => {
        const result = mapModelFromOAC("claude-sonnet-4", "cursor");
        expect(result.id).toBe("claude-sonnet-4");
        expect(result.exact).toBe(true);
      });

      it("maps claude-sonnet-4 to Windsurf format", () => {
        const result = mapModelFromOAC("claude-sonnet-4", "windsurf");
        expect(result.id).toBe("claude-4-sonnet");
        expect(result.exact).toBe(true);
      });

      it("maps claude-3.5-sonnet correctly", () => {
        const result = mapModelFromOAC("claude-3.5-sonnet", "claude");
        expect(result.id).toBe("claude-3-5-sonnet-20241022");
        expect(result.exact).toBe(true);
      });

      it("maps claude-3-opus correctly", () => {
        const result = mapModelFromOAC("claude-3-opus", "claude");
        expect(result.id).toBe("claude-3-opus-20240229");
        expect(result.exact).toBe(true);
      });
    });

    describe("GPT models", () => {
      it("maps gpt-4 to Cursor", () => {
        const result = mapModelFromOAC("gpt-4", "cursor");
        expect(result.id).toBe("gpt-4");
        expect(result.exact).toBe(true);
      });

      it("maps gpt-4-turbo to Windsurf", () => {
        const result = mapModelFromOAC("gpt-4-turbo", "windsurf");
        expect(result.id).toBe("gpt-4-turbo");
        expect(result.exact).toBe(true);
      });

      it("maps gpt-4o to Cursor", () => {
        const result = mapModelFromOAC("gpt-4o", "cursor");
        expect(result.id).toBe("gpt-4o");
        expect(result.exact).toBe(true);
      });
    });

    describe("unknown models", () => {
      it("returns model as-is with warning", () => {
        const result = mapModelFromOAC("unknown-model", "claude");
        expect(result.id).toBe("unknown-model");
        expect(result.exact).toBe(false);
        expect(result.warning).toContain("Unknown model");
      });

      it("recognizes platform format and returns as-is", () => {
        const result = mapModelFromOAC("claude-sonnet-4-20250514", "claude");
        expect(result.id).toBe("claude-sonnet-4-20250514");
        expect(result.exact).toBe(true);
      });
    });
  });

  // ==========================================================================
  // mapModelToOAC
  // ==========================================================================
  describe("mapModelToOAC()", () => {
    describe("from Claude", () => {
      it("maps Claude format to OAC", () => {
        const result = mapModelToOAC("claude-sonnet-4-20250514", "claude");
        expect(result.id).toBe("claude-sonnet-4");
        expect(result.exact).toBe(true);
      });

      it("maps claude-3-5-sonnet with date to OAC", () => {
        const result = mapModelToOAC("claude-3-5-sonnet-20241022", "claude");
        expect(result.id).toBe("claude-3.5-sonnet");
        expect(result.exact).toBe(true);
      });
    });

    describe("from Cursor", () => {
      it("maps Cursor format to OAC", () => {
        const result = mapModelToOAC("claude-sonnet-4", "cursor");
        expect(result.id).toBe("claude-sonnet-4");
        expect(result.exact).toBe(true);
      });

      it("maps gpt-4 from Cursor", () => {
        const result = mapModelToOAC("gpt-4", "cursor");
        expect(result.id).toBe("gpt-4");
        expect(result.exact).toBe(true);
      });
    });

    describe("from Windsurf", () => {
      it("maps Windsurf format to OAC", () => {
        const result = mapModelToOAC("claude-4-sonnet", "windsurf");
        expect(result.id).toBe("claude-sonnet-4");
        expect(result.exact).toBe(true);
      });
    });

    describe("unknown models", () => {
      it("attempts pattern matching", () => {
        const result = mapModelToOAC("claude-sonnet-new-20260101", "claude");
        // Should strip date and attempt normalization
        expect(result.exact).toBe(false);
        expect(result.warning).toBeDefined();
      });

      it("returns as-is for completely unknown models", () => {
        const result = mapModelToOAC("some-new-model", "cursor");
        expect(result.id).toBe("some-new-model");
        expect(result.exact).toBe(false);
      });
    });
  });

  // ==========================================================================
  // getModelFamily
  // ==========================================================================
  describe("getModelFamily()", () => {
    it("identifies Claude models", () => {
      expect(getModelFamily("claude-sonnet-4")).toBe("claude");
      expect(getModelFamily("claude-3-opus")).toBe("claude");
      expect(getModelFamily("CLAUDE-HAIKU")).toBe("claude");
    });

    it("identifies GPT models", () => {
      expect(getModelFamily("gpt-4")).toBe("gpt");
      expect(getModelFamily("gpt-4-turbo")).toBe("gpt");
      expect(getModelFamily("GPT-4o")).toBe("gpt");
    });

    it("identifies Gemini models", () => {
      expect(getModelFamily("gemini-pro")).toBe("gemini");
      expect(getModelFamily("gemini-2.0-flash")).toBe("gemini");
    });

    it("identifies Llama models", () => {
      expect(getModelFamily("llama-3")).toBe("llama");
    });

    it("identifies Mistral models", () => {
      expect(getModelFamily("mistral-large")).toBe("mistral");
    });

    it("returns 'other' for unknown models", () => {
      expect(getModelFamily("some-unknown-model")).toBe("other");
    });
  });

  // ==========================================================================
  // getModelInfo
  // ==========================================================================
  describe("getModelInfo()", () => {
    it("returns model info for known OAC model", () => {
      const info = getModelInfo("claude-sonnet-4");
      expect(info).toBeDefined();
      expect(info?.displayName).toBe("Claude Sonnet 4");
      expect(info?.family).toBe("claude");
    });

    it("returns undefined for unknown model", () => {
      const info = getModelInfo("unknown-model");
      expect(info).toBeUndefined();
    });
  });

  // ==========================================================================
  // getAllModels
  // ==========================================================================
  describe("getAllModels()", () => {
    it("returns array of all registered models", () => {
      const models = getAllModels();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
    });

    it("includes Claude models", () => {
      const models = getAllModels();
      const claudeModels = models.filter((m) => m.family === "claude");
      expect(claudeModels.length).toBeGreaterThan(0);
    });

    it("includes GPT models", () => {
      const models = getAllModels();
      const gptModels = models.filter((m) => m.family === "gpt");
      expect(gptModels.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // getModelsForPlatform
  // ==========================================================================
  describe("getModelsForPlatform()", () => {
    it("returns models available on Claude", () => {
      const models = getModelsForPlatform("claude");
      expect(models.length).toBeGreaterThan(0);
      expect(models.every((m) => m.platformIds.claude !== undefined)).toBe(true);
    });

    it("returns models available on Cursor", () => {
      const models = getModelsForPlatform("cursor");
      expect(models.length).toBeGreaterThan(0);
    });

    it("returns models available on Windsurf", () => {
      const models = getModelsForPlatform("windsurf");
      expect(models.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // isModelAvailable
  // ==========================================================================
  describe("isModelAvailable()", () => {
    it("returns true for available models", () => {
      expect(isModelAvailable("claude-sonnet-4", "claude")).toBe(true);
      expect(isModelAvailable("gpt-4", "cursor")).toBe(true);
    });

    it("returns false for unavailable models", () => {
      expect(isModelAvailable("unknown-model", "claude")).toBe(false);
    });

    it("returns false for models not on specific platform", () => {
      // GPT models are not available on Claude platform
      expect(isModelAvailable("gpt-4", "claude")).toBe(false);
    });
  });

  // ==========================================================================
  // getDefaultModel
  // ==========================================================================
  describe("getDefaultModel()", () => {
    it("returns Claude format default for Claude", () => {
      const model = getDefaultModel("claude");
      expect(model).toContain("claude");
      expect(model).toMatch(/\d{8}$/); // Date suffix
    });

    it("returns Cursor format default for Cursor", () => {
      const model = getDefaultModel("cursor");
      expect(model).toContain("claude");
    });

    it("returns Windsurf format default for Windsurf", () => {
      const model = getDefaultModel("windsurf");
      expect(model).toContain("claude");
    });
  });
});
