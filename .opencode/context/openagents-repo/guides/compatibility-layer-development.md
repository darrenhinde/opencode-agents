# Guide: Compatibility Layer Development Workflow

**Purpose**: Step-by-step workflow for developing compatibility layer features

**Last Updated**: 2026-02-04

---

## Core Workflow

Development follows a structured 6-stage approach:

```
1. Discover (Context)
   ↓
2. Propose (Approval)
   ↓
3. Init Session (Setup)
   ↓
4. Plan (Breakdown)
   ↓
5. Execute (Implement)
   ↓
6. Validate & Handoff
```

---

## Stage 1: Discover

**Goal**: Understand requirements before implementation

**Actions**:
1. Use `ContextScout` to discover relevant context files
2. For external packages: Check install scripts first, then use `ExternalScout`
3. Read context standards (code-quality.md is MANDATORY)

**No files created** - Read-only exploration

---

## Stage 2: Propose

**Goal**: Get user approval BEFORE any file creation

**Present lightweight summary**:
- What we're building (1-2 sentences)
- Components list
- Approach (direct execution vs delegation)
- Context discovered

**Wait for user approval** before proceeding

---

## Stage 3: Init Session

**Goal**: Create session and persist context (ONLY after approval)

**Actions**:
1. Create session directory: `.tmp/sessions/{YYYY-MM-DD}-{task-slug}/`
2. Write `context.md` with:
   - Task requirements
   - Context files (standards to follow)
   - Reference files (source material)
   - Components
   - Exit criteria

**This becomes single source of truth for all agents**

---

## Stage 4: Plan

**Decision**: Simple vs Complex?

**Simple** (1-3 files, <30min):
- Skip TaskManager
- Execute directly in Stage 5

**Complex** (4+ files, >60min):
- Delegate to `TaskManager`
- Creates `.tmp/tasks/{feature}/task.json` + subtasks
- Present plan for confirmation

---

## Stage 5: Execute

**Incremental approach** (one component at a time):

1. **Plan Component** (if using component-planning):
   - Create `component-{name}.md`
   - Request approval for design

2. **Execute**:
   - Load context from session
   - Implement → Validate → Mark complete
   - If delegating: Pass subtask JSON to `CoderAgent`

3. **Integrate**:
   - Verify integration with previous components

**Critical**: Never implement entire plan at once

---

## Stage 6: Validate & Handoff

**Actions**:
1. Run full system integration tests
2. Delegate to `TestEngineer` or `CodeReviewer` (pass session context)
3. Summarize what was built
4. Ask user to clean up `.tmp` files

---

## Key Principles

**Context First**: Load standards BEFORE coding
**Approval Gates**: Never execute without approval
**Incremental**: One step at a time, validate each
**Stop on Failure**: Report → Propose fix → Request approval → Then fix

---

## Example: Adapter Implementation

```
1. Discover:
   - ContextScout finds baseadapter-pattern.md
   - Load code-quality.md standards

2. Propose:
   "Implement WindsurfAdapter (514 lines)
    - Bidirectional conversion
    - Extends BaseAdapter
    - JSON config format"
   
3. Init Session:
   Create .tmp/sessions/2026-02-04-windsurf-adapter/
   Write context.md with standards + references

4. Plan:
   Simple (1 file) → Skip TaskManager

5. Execute:
   - Create WindsurfAdapter.ts
   - Implement toOAC(), fromOAC()
   - Export in index.ts
   - npm run build (validate)

6. Validate:
   - Compilation: ✅ 0 errors
   - Ready for unit tests (next phase)
```

---

## Reference

**Related**:
- standards/code-quality.md (MANDATORY before coding)
- concepts/compatibility-layer.md
- examples/baseadapter-implementation.md
