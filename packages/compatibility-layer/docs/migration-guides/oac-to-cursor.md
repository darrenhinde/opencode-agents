# Migrating from OAC to Cursor

> Convert OpenAgents Control agents to Cursor IDE's `.cursorrules` format

## Overview

Export to Cursor format when you:
- Use Cursor IDE as your primary development environment
- Want to share agent configurations with Cursor-only teams
- Need a simpler, single-file agent configuration

**Important**: Cursor uses a single `.cursorrules` file. Multiple OAC agents will be merged into one file with potential feature loss.

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | >= 18 | Required for CLI |
| @openagents-control/compatibility-layer | Latest | Install via npm |
| Cursor IDE | Any | Target platform |

```bash
npm install -g @openagents-control/compatibility-layer
```

## Quick Migration

```bash
# Single agent conversion
oac-compat convert agent.md -f cursor -o .cursorrules

# Convert with verbose output
oac-compat convert agent.md -f cursor -o .cursorrules --verbose

# Validate before converting
oac-compat validate --target cursor agent.md
```

## Step-by-Step Manual Migration

### 1. OAC Agent Structure

Typical OAC agent with full features:

```yaml
---
name: DocWriter
description: Documentation authoring agent
mode: subagent
temperature: 0.2
model: claude-opus-4
tools:
  read: true
  write: true
  edit: true
  bash: false
permission:
  bash:
    "*": "deny"
  edit:
    "**/*.md": "allow"
    "**/*.env*": "deny"
skills:
  - context-manager
  - task-management
hooks:
  - event: PreToolUse
    matchers: ["edit"]
    commands:
      - type: command
        command: "echo 'Editing file...'"
maxSteps: 50
---

# DocWriter

> Mission: Create and update documentation

## Rules

1. Always follow project documentation standards
2. Use concise, example-driven writing
3. Propose changes before implementing

## Context

Load documentation standards before writing.
```

### 2. Cursor Rules Structure

Equivalent `.cursorrules` format:

```yaml
---
name: DocWriter
description: Documentation authoring agent
model: claude-3-opus
temperature: 0.2
---

# DocWriter

> Mission: Create and update documentation

## Rules

1. Always follow project documentation standards
2. Use concise, example-driven writing
3. Propose changes before implementing

## Context

Load documentation standards before writing.

---

# Tool Access

Enabled tools:
- read
- write
- edit
```

### 3. Key Differences

| Aspect | OAC | Cursor |
|--------|-----|--------|
| File format | Markdown with YAML frontmatter | Plain text with optional frontmatter |
| File location | `.opencode/agent/*.md` | `.cursorrules` (project root) |
| Multiple agents | Supported | Single file only |
| Permissions | Granular (allow/deny/ask per path) | Binary (on/off) |
| Skills | Full system | Not supported |
| Hooks | Full system | Not supported |
| Contexts | Referenced files | Must inline or reference manually |
| Model names | OAC format | Cursor format |

### 4. Feature Mapping

| OAC Feature | Cursor Equivalent | Notes |
|-------------|-------------------|-------|
| `frontmatter.name` | `name` in frontmatter | Direct mapping |
| `frontmatter.description` | `description` in frontmatter | Direct mapping |
| `frontmatter.model` | `model` in frontmatter | Model name converted |
| `frontmatter.temperature` | `temperature` in frontmatter | Direct mapping |
| `frontmatter.mode` | N/A | Cursor doesn't distinguish modes |
| `frontmatter.tools` | Listed in body | Converted to tool list |
| `frontmatter.permission` | N/A | Lost - degraded to binary |
| `frontmatter.skills` | N/A | Lost - consider inlining |
| `frontmatter.hooks` | N/A | Lost entirely |
| `frontmatter.maxSteps` | N/A | Not supported |
| `contexts` | Inlined references | Manual loading required |
| `systemPrompt` | Body content | Direct mapping |

### 5. Model Name Mapping

| OAC Model | Cursor Model |
|-----------|--------------|
| `gpt-4` | `gpt-4` |
| `gpt-4-turbo` | `gpt-4-turbo` |
| `gpt-4o` | `gpt-4o` |
| `gpt-3.5-turbo` | `gpt-3.5-turbo` |
| `claude-opus-3` | `claude-3-opus` |
| `claude-sonnet-3` | `claude-3-sonnet` |
| `claude-haiku-3` | `claude-3-haiku` |
| `claude-opus-4` | `claude-3-opus` (fallback) |
| `claude-sonnet-4` | `claude-3-sonnet` (fallback) |
| `claude-haiku-4` | `claude-3-haiku` (fallback) |

## Common Patterns

### Pattern 1: Basic Agent

**Before (OAC):**

```yaml
---
name: CodeReviewer
description: Reviews code for quality
mode: subagent
tools:
  read: true
  grep: true
  glob: true
---

# Code Reviewer

Review code for:
- Code style consistency
- Potential bugs
- Performance issues
```

**After (Cursor):**

```yaml
---
name: CodeReviewer
description: Reviews code for quality
---

# Code Reviewer

Review code for:
- Code style consistency
- Potential bugs
- Performance issues

---

# Tool Access

Enabled tools:
- read
- grep
- glob
```

### Pattern 2: Agent with Contexts

**Before (OAC):**

```yaml
---
name: StyleGuide
description: Enforces code style
mode: subagent
---

# Style Guide Agent

Follow the project style guide.

<!-- References context files -->
```

With `contexts`:
```json
[
  { "path": ".opencode/context/style-guide.md", "priority": "critical" }
]
```

**After (Cursor):**

```yaml
---
name: StyleGuide
description: Enforces code style
---

# Style Guide Agent

Follow the project style guide.

---

# Context Files

The following contexts from OpenAgents Control have been inlined:

## .opencode/context/style-guide.md
**Priority**: critical

> **Note**: Original context file: `.opencode/context/style-guide.md`. Load this file for full details.
```

### Pattern 3: Agent with Granular Permissions

**Before (OAC):**

```yaml
---
name: SecureWriter
description: Writes files with restrictions
mode: subagent
permission:
  edit:
    "src/**/*.ts": "allow"
    "**/*.env*": "deny"
    "**/*.secret": "deny"
  bash:
    "*": "deny"
---

# Secure Writer

Write TypeScript files only. Never access secrets.
```

**After (Cursor):**

```yaml
---
name: SecureWriter
description: Writes files with restrictions
---

# Secure Writer

Write TypeScript files only. Never access secrets.

---

# Tool Access

Enabled tools:
- edit

# IMPORTANT: Permission Restrictions

This agent had granular permissions in OAC that cannot be enforced in Cursor:
- edit: Only `src/**/*.ts` files allowed
- edit: `**/*.env*` and `**/*.secret` files denied
- bash: Completely denied

Please enforce these restrictions manually.
```

## Multi-Agent Handling

Cursor only supports a single `.cursorrules` file. When converting multiple OAC agents:

```bash
# Multiple agents are merged automatically
oac-compat convert agent1.md agent2.md agent3.md -f cursor -o .cursorrules
```

**Merge behavior:**

1. **Names** - Combined: `agent1-agent2-agent3`
2. **System prompts** - Concatenated with separators
3. **Tools** - Union of all enabled tools
4. **Temperature** - Highest value used
5. **Model** - First available model used
6. **Contexts** - All contexts merged

**Example merged output:**

```yaml
---
name: agent1-agent2-agent3
description: Merged agent: Agent 1, Agent 2, Agent 3
model: gpt-4
temperature: 0.7
---

# Agent 1: Agent 1
First agent description

[First agent system prompt]

---

# Agent 2: Agent 2
Second agent description

[Second agent system prompt]

---

# Agent 3: Agent 3
Third agent description

[Third agent system prompt]

---

# Tool Access

Enabled tools:
- read
- write
- edit
- bash
```

## Limitations

### Features Lost in Conversion

| Feature | Impact | Workaround |
|---------|--------|------------|
| **Skills** | Completely lost | Inline skill content into main prompt |
| **Hooks** | Completely lost | No equivalent - manual process required |
| **maxSteps** | Not supported | None - Cursor manages this internally |
| **Granular permissions** | Degraded to binary | Document restrictions in prompt |
| **Multiple agents** | Must merge | Use merged file or choose primary agent |
| **Agent modes** | Ignored | Cursor doesn't distinguish primary/subagent |

### Conversion Warnings

The converter will emit warnings for:

```
⚠️  Agent name missing - using 'cursor-agent' as default
⚠️  Cursor IDE does not distinguish between primary and subagent modes
⚠️  skills not supported in Cursor IDE (2 skills)
💡 Consider inlining skill content into the main prompt for Cursor
⚠️  hooks not supported in Cursor IDE (1 hooks)
⚠️  maxSteps not supported in Cursor IDE
⚠️  granular permissions degraded: allow/deny/ask per path → binary on/off per tool
💡 2 context file(s) referenced - consider loading them manually in Cursor
```

### What's Preserved

- Agent name and description
- Model selection (with name mapping)
- Temperature setting
- System prompt content
- Tool access (binary on/off)
- Context references (as inlined notes)

## Validation

### Verify Conversion Success

```bash
# 1. Run conversion with verbose output
oac-compat convert agent.md -f cursor -o .cursorrules --verbose

# 2. Check for warnings
# Review any warnings about lost features

# 3. Validate output file exists
ls -la .cursorrules

# 4. Test in Cursor IDE
# Open project in Cursor and verify agent behavior
```

### Manual Verification Checklist

- [ ] `.cursorrules` file created in project root
- [ ] Agent name and description present in frontmatter
- [ ] Model and temperature settings correct
- [ ] System prompt content complete
- [ ] Tool access section lists expected tools
- [ ] Context references noted (if applicable)
- [ ] Warnings reviewed and addressed

### Programmatic Validation

```typescript
import { CursorAdapter, loadAgent } from '@openagents-control/compatibility-layer';

async function validateConversion() {
  const agent = await loadAgent('./agent.md');
  const adapter = new CursorAdapter();
  
  // Check capabilities
  const caps = adapter.getCapabilities();
  console.log('Cursor capabilities:', caps);
  
  // Validate conversion
  const warnings = adapter.validateConversion(agent);
  if (warnings.length > 0) {
    console.log('Conversion warnings:', warnings);
  }
  
  // Convert
  const result = await adapter.fromOAC(agent);
  
  if (result.success) {
    console.log('Conversion successful!');
    console.log('Output files:', result.configs.map(c => c.fileName));
    console.log('Warnings:', result.warnings);
  } else {
    console.error('Conversion failed:', result.errors);
  }
}
```

## Troubleshooting

### Common Issues

#### "Agent name missing" warning

**Cause**: OAC agent doesn't have a `name` in frontmatter.

**Solution**: Add name to your OAC agent:
```yaml
---
name: MyAgent
---
```

#### Skills content not appearing

**Cause**: Cursor doesn't support the Skills system.

**Solution**: Manually inline skill content into your system prompt before conversion, or add it to the `.cursorrules` file after conversion.

#### Hooks not working

**Cause**: Cursor has no hooks system.

**Solution**: No direct equivalent. Consider:
- Using Cursor's built-in features
- Documenting manual steps in the prompt
- Accepting this feature loss

#### Model not recognized

**Cause**: Model name mapping failed.

**Solution**: The converter defaults to `gpt-4`. Update the `model` field in `.cursorrules` manually if needed.

#### Permissions not enforced

**Cause**: Cursor only supports binary tool access.

**Solution**: Document permission restrictions in your system prompt:
```
# IMPORTANT RESTRICTIONS
- Only edit files in src/ directory
- Never access .env files
- Do not run bash commands
```

#### Multiple agents merged unexpectedly

**Cause**: Cursor only supports single agent.

**Solution**: Either accept the merged configuration or:
1. Convert only your primary agent
2. Create separate projects for different agents

## Next Steps

- [Cursor → OAC Migration](./cursor-to-oac.md) - Import Cursor configurations
- [OAC → Claude Migration](./oac-to-claude.md) - Convert to Claude Code format
- [Feature Capabilities Matrix](../feature-matrices/capabilities-overview.md) - Full feature comparison
- [Cursor IDE Documentation](https://cursor.sh/docs) - Official Cursor docs
