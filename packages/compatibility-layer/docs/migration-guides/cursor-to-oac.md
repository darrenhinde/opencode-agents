# Migrating from Cursor to OAC

> Convert your `.cursorrules` to OpenAgents Control format and unlock Skills, Hooks, multi-agent support, and granular permissions.

## Overview

**Why migrate?**

| Feature | Cursor | OAC |
|---------|--------|-----|
| Multiple agents | Single file only | Unlimited agents |
| Skills system | Not supported | Full support |
| Hooks | Not supported | Event-driven hooks |
| Permissions | Binary (on/off) | Granular (allow/deny/ask per path) |
| Contexts | Inline only | External context files |

OAC provides a superset of Cursor's capabilities while maintaining backward compatibility.

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
oac-compat convert .cursorrules -f oac -o agent.md
```

This reads your `.cursorrules` file and generates an OAC-compatible `agent.md`.

**Verify the result:**

```bash
oac-compat validate agent.md
```

## Step-by-Step Manual Migration

### 1. Cursor Rules Structure

Cursor uses a single `.cursorrules` file in the project root. Two formats are supported:

**Plain text format:**

```
You are a senior TypeScript developer.
Always use strict mode.
Prefer functional programming patterns.
Write comprehensive tests for all code.
```

**Frontmatter format (optional):**

```yaml
---
name: typescript-dev
description: TypeScript development assistant
model: gpt-4
temperature: 0.7
---

You are a senior TypeScript developer.
Always use strict mode.
Prefer functional programming patterns.
Write comprehensive tests for all code.
```

### 2. OAC Agent Structure

OAC agents use markdown with YAML frontmatter:

```yaml
---
name: typescript-dev
description: TypeScript development assistant
mode: primary
model: gpt-4
temperature: 0.7
tools:
  read: true
  write: true
  edit: true
  bash: true
  grep: true
  glob: true
---

# TypeScript Developer

You are a senior TypeScript developer.

## Guidelines

- Always use strict mode
- Prefer functional programming patterns
- Write comprehensive tests for all code

## Skills

<!-- Skills can be loaded dynamically -->

## Contexts

<!-- External context files for domain knowledge -->
```

### 3. Key Differences

| Aspect | Cursor | OAC |
|--------|--------|-----|
| **File format** | `.cursorrules` (plain/YAML) | `.md` with YAML frontmatter |
| **Location** | Project root | `.opencode/agent/` directory |
| **Multiple agents** | Not supported | Full support |
| **Tool config** | Implicit or comma-separated | Explicit object with booleans |
| **Permissions** | Binary only | Granular rules per path |
| **Context handling** | Inline in prompt | External files with priority |
| **Skills** | Not supported | Dynamic skill loading |
| **Hooks** | Not supported | Event-driven lifecycle hooks |

### 4. Feature Mapping

| Cursor Feature | OAC Equivalent | Notes |
|----------------|----------------|-------|
| `name` | `frontmatter.name` | Direct mapping |
| `description` | `frontmatter.description` | Direct mapping |
| `model: gpt-4` | `frontmatter.model: gpt-4` | Direct mapping |
| `model: claude-3-opus` | `frontmatter.model: claude-opus-3` | Model ID normalized |
| `model: claude-3-sonnet` | `frontmatter.model: claude-sonnet-3` | Model ID normalized |
| `model: claude-3-haiku` | `frontmatter.model: claude-haiku-3` | Model ID normalized |
| `temperature` | `frontmatter.temperature` | Direct mapping |
| `tools: "read, write"` | `tools: { read: true, write: true }` | Object format |
| Plain text body | `systemPrompt` | Becomes the agent prompt |
| (not available) | `frontmatter.mode` | Set to `primary` or `subagent` |
| (not available) | `frontmatter.skills` | Add skill references |
| (not available) | `frontmatter.hooks` | Add lifecycle hooks |
| (not available) | `frontmatter.permission` | Add granular permissions |
| (not available) | `contexts` | Add external context files |

### 5. Common Patterns

#### Pattern 1: Basic Rules

**Before (Cursor):**

```
You are a helpful coding assistant.
Follow best practices for clean code.
Always explain your changes.
```

**After (OAC):**

```yaml
---
name: code-assistant
description: Helpful coding assistant
mode: primary
---

# Code Assistant

You are a helpful coding assistant.

## Guidelines

- Follow best practices for clean code
- Always explain your changes
```

---

#### Pattern 2: Tool Configuration

**Before (Cursor):**

```yaml
---
name: restricted-agent
tools: read, grep, glob
---

You can only read and search files.
Do not modify any files.
```

**After (OAC):**

```yaml
---
name: restricted-agent
description: Read-only agent for code analysis
mode: primary
tools:
  read: true
  grep: true
  glob: true
  write: false
  edit: false
  bash: false
---

# Restricted Agent

You can only read and search files.

## Restrictions

- Read files: ALLOWED
- Search files: ALLOWED  
- Modify files: DENIED
- Execute commands: DENIED
```

---

#### Pattern 3: Model Configuration

**Before (Cursor):**

```yaml
---
name: creative-writer
model: claude-3-opus
temperature: 0.9
---

Write creative and engaging documentation.
```

**After (OAC):**

```yaml
---
name: creative-writer
description: Creative documentation writer
mode: primary
model: claude-opus-3
temperature: 0.9
tools:
  read: true
  write: true
  edit: true
---

# Creative Writer

Write creative and engaging documentation.

## Style Guidelines

- Use vivid language
- Include examples
- Make content accessible
```

> **Note:** Claude model IDs are normalized (`claude-3-opus` → `claude-opus-3`).

---

#### Pattern 4: Adding OAC-Exclusive Features

After migrating, enhance your agent with OAC-exclusive features:

**Add Skills:**

```yaml
---
name: full-stack-dev
description: Full-stack development assistant
mode: primary
skills:
  - context-manager
  - task-management
---
```

**Add Hooks:**

```yaml
---
name: validated-writer
description: Writer with validation hooks
mode: primary
hooks:
  - event: PreToolUse
    matchers:
      - "write"
      - "edit"
    commands:
      - type: command
        command: "npm run lint:check"
---
```

**Add Granular Permissions:**

```yaml
---
name: safe-modifier
description: Agent with path-based permissions
mode: primary
permission:
  write:
    "/src/**": allow
    "/tests/**": allow
    "/config/**": ask
    "/**": deny
---
```

**Add Contexts:**

```yaml
---
name: context-aware
description: Agent with external context files
mode: primary
---

# Context-Aware Agent

<!-- Contexts loaded automatically -->
```

With context files in `.opencode/context/`:

```
.opencode/context/
├── core/
│   ├── architecture.md
│   └── conventions.md
└── domain/
    └── business-rules.md
```

### 6. Limitations

Features that don't exist in Cursor (gained during migration):

| Feature | Cursor | OAC | Workaround |
|---------|--------|-----|------------|
| Multiple agents | Single file | Unlimited | Create separate agent files |
| Skills system | None | Full support | Inline skill content in prompt |
| Hooks | None | Event-driven | Manual validation steps |
| Granular permissions | Binary | Per-path rules | Document restrictions in prompt |
| External contexts | None | Priority-based | Inline context in prompt |
| Subagent mode | None | Delegation support | Use primary mode only |
| Max steps | None | Configurable | Not available in Cursor |

### 7. Validation

**Validate your migrated agent:**

```bash
# Check OAC format validity
oac-compat validate agent.md

# Compare capabilities
oac-compat info --tool cursor
oac-compat info --tool oac

# Test round-trip conversion
oac-compat convert agent.md -f cursor -o .cursorrules.test
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

## Troubleshooting

### Frontmatter not parsing

**Symptom:** Agent name shows as `cursor-agent` instead of your custom name.

**Cause:** Frontmatter must have exact format with `---` delimiters.

**Fix:**

```yaml
---
name: my-agent
---

Content here...
```

Not:

```yaml
---
name: my-agent
Content here...
```

---

### Model not recognized

**Symptom:** Model defaults to `gpt-4`.

**Cause:** Cursor model IDs differ from OAC.

**Fix:** Use OAC model IDs:

| Cursor | OAC |
|--------|-----|
| `claude-3-opus` | `claude-opus-3` |
| `claude-3-sonnet` | `claude-sonnet-3` |
| `claude-3-haiku` | `claude-haiku-3` |
| `gpt-4` | `gpt-4` |
| `gpt-4-turbo` | `gpt-4-turbo` |
| `gpt-4o` | `gpt-4o` |

---

### Tools not working

**Symptom:** Agent can't use expected tools.

**Cause:** Tools must be explicitly enabled in OAC.

**Fix:** Add tools to frontmatter:

```yaml
tools:
  read: true
  write: true
  edit: true
  bash: true
  grep: true
  glob: true
```

---

### Content appears duplicated

**Symptom:** System prompt contains frontmatter text.

**Cause:** Frontmatter delimiters missing or malformed.

**Fix:** Ensure proper YAML frontmatter format:

```yaml
---
name: agent-name
---

Content starts here (not in frontmatter).
```

## Next Steps

- **[OAC Agent Configuration](../configuration/agent-format.md)** - Deep dive into OAC format
- **[Skills System](../features/skills.md)** - Learn to use dynamic skills
- **[Hooks Reference](../features/hooks.md)** - Event-driven automation
- **[Multi-Agent Setup](../features/multi-agent.md)** - Configure agent delegation
- **[OAC → Cursor Migration](./oac-to-cursor.md)** - Reverse migration guide
