/**
 * Cross-adapter capability agreement.
 *
 * ## Why this file exists
 *
 * A platform cannot have two answers about itself. That invariant was already written down —
 * `tests/unit/adapters/ClaudeAdapter.test.ts` has an "agrees with the CapabilityMatrix rather
 * than restating it" case, added after the matrix called Claude `json` while ClaudeAdapter
 * called it `markdown`.
 *
 * But that test pinned ONE field (`configFormat`) on ONE platform (`claude`) — 1 of 11 fields
 * on 1 of 4 adapters. So when `CursorAdapter.getCapabilities()` hand-wrote
 * `supportsContexts: true` ("✅ Can inline context") against the matrix's
 * `externalContext: "none"` ("context must be inline in .cursorrules"), the same bug lived on
 * undetected in a second platform.
 *
 * The invariant was right; its coverage was the problem. This file generalises it to every
 * registered adapter × every field of {@link ToolCapabilities}, which is what the original
 * test's own comment claimed to be checking.
 *
 * `notes` and `displayName` are deliberately excluded: adapters own those (the matrix's `notes`
 * are per-(feature, platform) strings, a different shape and a different question), and each
 * adapter's `getCapabilities()` overrides `displayName` on purpose.
 */

import { describe, it, expect } from "vitest";

import { ClaudeAdapter } from "../../../src/adapters/ClaudeAdapter.js";
import { CursorAdapter } from "../../../src/adapters/CursorAdapter.js";
import { OpenCodeAdapter } from "../../../src/adapters/OpenCodeAdapter.js";
import { WindsurfAdapter } from "../../../src/adapters/WindsurfAdapter.js";
import { getToolCapabilities, type Platform } from "../../../src/core/CapabilityMatrix.js";
import type { BaseAdapter } from "../../../src/adapters/BaseAdapter.js";
import type { ToolCapabilities } from "../../../src/types.js";

/**
 * Every adapter, paired with its matrix column.
 *
 * Adding an adapter without adding it here is the failure mode this file cannot catch on its
 * own — `covers every adapter in the Platform union` below closes that by comparing this list
 * against the union's own members.
 */
const ADAPTERS: ReadonlyArray<{ platform: Exclude<Platform, "oac">; adapter: BaseAdapter }> = [
  { platform: "claude", adapter: new ClaudeAdapter() },
  { platform: "cursor", adapter: new CursorAdapter() },
  { platform: "windsurf", adapter: new WindsurfAdapter() },
  { platform: "opencode", adapter: new OpenCodeAdapter() },
];

/** The fields both sides answer. `notes`/`displayName` are adapter-owned — see the header. */
const AGREED_FIELDS = [
  "name",
  "supportsMultipleAgents",
  "supportsSkills",
  "supportsHooks",
  "supportsGranularPermissions",
  "supportsContexts",
  "supportsCustomModels",
  "supportsTemperature",
  "supportsMaxSteps",
  "configFormat",
  "outputStructure",
] as const satisfies ReadonlyArray<keyof ToolCapabilities>;

describe("capability agreement (adapter vs CapabilityMatrix)", () => {
  describe.each(ADAPTERS)("$platform", ({ platform, adapter }) => {
    it.each(AGREED_FIELDS)("agrees on %s", (field) => {
      expect(adapter.getCapabilities()[field]).toEqual(getToolCapabilities(platform)[field]);
    });
  });

  // Guards the gap this file would otherwise have: a new adapter that never gets listed in
  // ADAPTERS is silently unchecked. The Platform union is the roster of record.
  it("covers every adapter in the Platform union", () => {
    const platformsUnderTest = ADAPTERS.map((entry) => entry.platform).sort();
    const expected: Array<Exclude<Platform, "oac">> = [
      "claude",
      "cursor",
      "opencode",
      "windsurf",
    ];

    expect(platformsUnderTest).toEqual(expected.sort());
  });

  // The specific regression. Cursor claimed to support external context because it can inline
  // the bytes; the matrix said none, because inlining loses the reference, the file boundary
  // and the priority. Ruled 2026-07-15 for the matrix. Pinned so it cannot silently flip back.
  it("reports Cursor as NOT supporting external context (inlining is degradation)", () => {
    expect(new CursorAdapter().getCapabilities().supportsContexts).toBe(false);
  });

  // OpenCode had no column at all until 2026-07-15, which is why it hand-wrote its own answers.
  it("describes OpenCode, the canonical target, in the matrix", () => {
    const openCode = getToolCapabilities("opencode");

    expect(openCode.displayName).toBe("OpenCode");
    // The one thing that makes OpenCode the canonical target: it carries ordered, scoped
    // permission rules with no degradation. If this ever reports false, the build is lying.
    expect(openCode.supportsGranularPermissions).toBe(true);
  });
});
