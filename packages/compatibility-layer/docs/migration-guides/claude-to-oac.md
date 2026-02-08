# Migrating from Claude Code to OAC

> Convert your `.claude/` configuration to OpenAgents Control format and gain temperature control, maxSteps limits, and granular per-path permissions.

## Overview

Claude Code uses `.claude/config.json` for primary agents and `.claude/agents/*.md` for subagents. OAC provides all Claude Code capabilities plus temperature control, step limits, and granular permissions that Claude's binary permission modes can't express.

## Prerequisites

**Required:**
- Node.js >= 18
- npm or pnpm

**Install the compatibility layer:**

```bash
npm install @openagents-control/compatibility-layer
```

## Quick Migration

**One command conversion:**

```bash
oac-compat convert .claude/config.json -f oac -o agent.md
```

For subagents:

```bash
oac-compat convert .claude/agents/code-reviewer.md -f oac -o .opencode/agent/code-reviewer.md
```

**Verify the result:**

```bash
oac-compat validate agent.md
```

## Step-by-Step Manual Migration

### 1. Claude Code Structure

Claude Code uses a directory-based structure:

```
.claude/
├── config.json           # Primary agent configuration
├── agents/               # Subagent definitions
│   ├── code-reviewer.md
│   └── doc-writer.md
└── skills/               # Context injection
    └── project-context/
        └── SKILL.md
```

**Primary agent (config.json):**

```json
{
  "name": "main-agent",
  "description": "Primary development assistant",
  "systemPrompt": "You are a senior developer.",
  "model": "claude-sonnet-4-20250514",
  "tools": ["Read", "Write", "Bash"],
  "permissionMode": "default",
  "skills": ["project-context"],
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write",
        "hooks": [{ "type": "command", "command": "npm run lint" }]
      }
    ]
  }
}
```

**Subagent (agents/code-reviewer.md):**

```yaml
---
name: "code-reviewer"
description: "Reviews code for quality"
tools: "Read, Grep, Glob"
model: "sonnet"
permissionMode: "default"
---

You are a code reviewer. Analyze code for:
- Best practices
- Performance issues
- Security vulnerabilities
```

### 2. OAC Agent Structure

OAC agents use markdown with YAML frontmatter:

```yaml
---
name: main-agent
description: Primary development assistant
mode: primary
model: claude-sonnet-4
temperature: 0.7
maxSteps: 50
tools:
  read: true
  write: true
  bash: true
permission:
  write:
    "/src/**": allow
    "/config/**": ask
    "/**": deny
skills:
  - context-manager
hooks:
  - event: PreToolUse
    matchers:
      - "write"
    commands:
      - type: command
        command: "npm run lint"
---

# Main Agent

You are a senior developer.

## Guidelines

- Write clean, maintainable code
- Follow project conventions
```

### 3. Key Differences

| Aspect | Claude Code | OAC |
|--------|-------------|-----|
| **Config location** | `.claude/` directory | `.opencode/agent/` directory |
| **Primary config** | `config.json` (JSON) | `agent.md` (YAML frontmatter) |
| **Subagent format** | Markdown with YAML | Markdown with YAML |
| **Model IDs** | `claude-sonnet-4-20250514` | `claude-sonnet-4` |
| **Tools format** | Array: `["Read", "Write"]` | Object: `{ read: true, write: true }` |
| **Permissions** | Binary modes only | Granular per-path rules |
| **Temperature** | Not supported | Full control (0.0-2.0) |
| **Max steps** | Not supported | Configurable limit |
| **Skills path** | `.claude/skills/` | `.opencode/skills/` |

### 4. Feature Mapping

| Claude Code Feature | OAC Equivalent | Notes |
|---------------------|----------------|-------|
| `name` | `frontmatter.name` | Direct mapping |
| `description` | `frontmatter.description` | Direct mapping |
| `systemPrompt` | Body content (markdown) | Becomes structured markdown |
| `model: "claude-sonnet-4-20250514"` | `model: claude-sonnet-4` | Simplified ID |
| `model: "sonnet"` | `model: claude-sonnet-4` | Alias resolved |
| `model: "opus"` | `model: claude-opus-4` | Alias resolved |
| `model: "haiku"` | `model: claude-haiku-4` | Alias resolved |
| `tools: ["Read", "Write"]` | `tools: { read: true, write: true }` | Object format |
| `permissionMode: "default"` | `permission: { ... }` | Granular rules available |
| `permissionMode: "bypassPermissions"` | `permission: { "*": "allow" }` | Full access |
| `permissionMode: "dontAsk"` | `permission: { "*": "deny" }` | Auto-deny |
| `skills: ["name"]` | `skills: [name]` | Direct mapping |
| `hooks.PreToolUse` | `hooks: [{ event: PreToolUse }]` | Array format |
| (not available) | `frontmatter.temperature` | New capability |
| (not available) | `frontmatter.maxSteps` | New capability |
| (not available) | Granular path permissions | New capability |

### 5. Common Patterns

#### Pattern 1: Primary Agent Config

**Before (Claude Code - config.json):**

```json
{
  "name": "typescript-dev",
  "description": "TypeScript development assistant",
  "systemPrompt": "You are a senior TypeScript developer. Follow strict mode. Write tests.",
  "model": "claude-sonnet-4-20250514",
  "tools": ["Read", "Write", "Edit", "Bash"],
  "permissionMode": "default"
}
```

**After (OAC):**

```yaml
---
name: typescript-dev
description: TypeScript development assistant
mode: primary
model: claude-sonnet-4
temperature: 0.7
tools:
  read: true
  write: true
  edit: true
  bash: true
permission:
  write:
    "/src/**": allow
    "/tests/**": allow
    "/**": ask
---

# TypeScript Developer

You are a senior TypeScript developer.

## Guidelines

- Follow strict mode
- Write tests for all code
- Use type-safe patterns
```

---

#### Pattern 2: Subagent Migration

**Before (Claude Code - agents/code-reviewer.md):**

```yaml
---
name: "code-reviewer"
description: "Reviews code for quality and best practices"
tools: "Read, Grep, Glob"
model: "sonnet"
permissionMode: "default"
---

You are a code reviewer. Focus on:
- Code quality
- Performance issues
- Security vulnerabilities
```

**After (OAC):**

```yaml
---
name: code-reviewer
description: Reviews code for quality and best practices
mode: subagent
model: claude-sonnet-4
tools:
  read: true
  grep: true
  glob: true
  write: false
  edit: false
  bash: false
---

# Code Reviewer

You are a code reviewer.

## Focus Areas

- Code quality and maintainability
- Performance issues and bottlenecks
- Security vulnerabilities and risks

## Output Format

Provide findings as:
1. **Issue**: Description
2. **Location**: File and line
3. **Severity**: High/Medium/Low
4. **Recommendation**: Fix suggestion
```

---

#### Pattern 3: Hooks Migration

**Before (Claude Code - config.json hooks):**

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write",
        "hooks": [{ "type": "command", "command": "npm run lint:check" }]
      },
      {
        "matcher": "Bash",
        "hooks": [{ "type": "command", "command": "echo 'Executing bash...'" }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [{ "type": "command", "command": "npm run test:affected" }]
      }
    ]
  }
}
```

**After (OAC):**

```yaml
---
name: validated-dev
description: Developer with validation hooks
mode: primary
hooks:
  - event: PreToolUse
    matchers:
      - "write"
    commands:
      - type: command
        command: "npm run lint:check"
  - event: PreToolUse
    matchers:
      - "bash"
    commands:
      - type: command
        command: "echo 'Executing bash...'"
  - event: PostToolUse
    matchers:
      - "*"
    commands:
      - type: command
        command: "npm run test:affected"
---
```

---

#### Pattern 4: Skills to Contexts Migration

**Before (Claude Code - .claude/skills/api-docs/SKILL.md):**

```yaml
---
name: api-docs
description: API documentation context
---

# API Documentation

This skill provides API documentation context.

Load from: `docs/api/`
```

**After (OAC contexts):**

```yaml
---
name: api-aware-agent
description: Agent with API documentation context
mode: primary
---

# API-Aware Agent

<!-- Contexts auto-loaded from .opencode/context/ -->
```

With context file `.opencode/context/api-docs.md`:

```yaml
---
path: docs/api/
priority: high
description: API documentation for reference
---

# API Documentation Context

Reference these docs when working with API endpoints.
```

---

#### Pattern 5: Granular Permissions (OAC Exclusive)

Claude Code only supports binary permission modes. OAC enables per-path rules:

**Claude Code (limited):**

```json
{
  "permissionMode": "default"
}
```

**OAC (granular):**

```yaml
---
name: safe-developer
description: Developer with path-based permissions
mode: primary
permission:
  write:
    "/src/**": allow
    "/tests/**": allow
    "/docs/**": allow
    "/config/**": ask
    "/package.json": ask
    "/.env*": deny
    "/**": deny
  bash:
    "npm run *": allow
    "git *": allow
    "rm *": deny
    "*": ask
---
```

### 6. Limitations

Features that don't fully translate between formats:

| Feature | Claude Code | OAC | Migration Notes |
|---------|-------------|-----|-----------------|
| Temperature | Not supported | Full support | Set desired value after migration |
| Max steps | Not supported | Configurable | Add limit after migration |
| Granular permissions | Binary modes | Per-path rules | Expand after migration |
| Permission mode `acceptEdits` | Supported | No direct equivalent | Use `permission: { edit: "allow" }` |
| Skill directory structure | `.claude/skills/` | `.opencode/skills/` | Move and rename |
| Agent directory | `.claude/agents/` | `.opencode/agent/` | Move and rename |

### 7. Validation

**Validate your migrated agent:**

```bash
# Check OAC format validity
oac-compat validate agent.md

# Compare capabilities
oac-compat info --tool claude
oac-compat info --tool oac

# Test round-trip conversion
oac-compat convert agent.md -f claude -o .claude/config.test.json
```

**Programmatic validation:**

```typescript
import { loadAgent, validateAgent } from '@openagents-control/compatibility-layer';

const agent = await loadAgent('./agent.md');
const errors = validateAgent(agent);

if (errors.length === 0) {
  console.log('Agent is valid!');
} else {
  console.error('Validation errors:', errors);
}
```

**Verify feature preservation:**

```typescript
import { ClaudeAdapter } from '@openagents-control/compatibility-layer';

const adapter = new ClaudeAdapter();
const capabilities = adapter.getCapabilities();

console.log('Claude supports:');
console.log('- Multiple agents:', capabilities.supportsMultipleAgents);
console.log('- Skills:', capabilities.supportsSkills);
console.log('- Hooks:', capabilities.supportsHooks);
console.log('- Temperature:', capabilities.supportsTemperature); // false
console.log('- Max steps:', capabilities.supportsMaxSteps);       // false
console.log('- Granular perms:', capabilities.supportsGranularPermissions); // false
```

## Troubleshooting

### Model ID not recognized

**Symptom:** Model defaults to `sonnet` or conversion warning appears.

**Cause:** Claude Code uses full version IDs like `claude-sonnet-4-20250514`.

**Fix:** OAC uses simplified model IDs:

| Claude Code | OAC |
|-------------|-----|
| `claude-sonnet-4-20250514` | `claude-sonnet-4` |
| `claude-opus-4` | `claude-opus-4` |
| `claude-haiku-4` | `claude-haiku-4` |
| `sonnet` | `claude-sonnet-4` |
| `opus` | `claude-opus-4` |
| `haiku` | `claude-haiku-4` |

---

### Tools array not converting

**Symptom:** Tools show as all disabled or wrong format.

**Cause:** Claude uses capitalized array format; OAC uses lowercase object format.

**Fix:** Convert manually:

```json
// Claude Code
"tools": ["Read", "Write", "Bash"]
```

```yaml
# OAC
tools:
  read: true
  write: true
  bash: true
  edit: false
  grep: false
  glob: false
```

---

### Permission mode warning

**Symptom:** Warning about permission degradation.

**Cause:** Claude's `permissionMode` is binary; can't express granular rules.

**Fix:** After migration, expand to granular permissions:

```yaml
# Instead of permissionMode: "default"
permission:
  write:
    "/src/**": allow
    "/config/**": ask
    "/**": deny
  bash:
    "npm *": allow
    "git *": allow
    "*": ask
```

---

### Hooks not triggering

**Symptom:** Hooks defined but not executing.

**Cause:** Hook event names or matchers may differ.

**Fix:** Verify hook format:

```yaml
hooks:
  - event: PreToolUse    # Exact event name
    matchers:
      - "write"          # Lowercase tool name
      - "edit"
    commands:
      - type: command
        command: "npm run lint"
```

Valid events: `PreToolUse`, `PostToolUse`, `PermissionRequest`, `AgentStart`, `AgentEnd`

---

### Skills not found

**Symptom:** Skills referenced but not loading.

**Cause:** Different directory structure between Claude Code and OAC.

**Fix:** Move skills to OAC location:

```bash
# Claude Code location
.claude/skills/my-skill/SKILL.md

# OAC location
.opencode/skills/my-skill/SKILL.md
```

Update skill references in agent:

```yaml
skills:
  - my-skill  # Name matches directory
```

## Next Steps

- **[OAC Agent Configuration](../configuration/agent-format.md)** - Deep dive into OAC format
- **[Granular Permissions](../features/permissions.md)** - Per-path permission rules
- **[Skills System](../features/skills.md)** - Dynamic skill loading
- **[Hooks Reference](../features/hooks.md)** - Event-driven automation
- **[OAC → Claude Migration](./oac-to-claude.md)** - Reverse migration guide
