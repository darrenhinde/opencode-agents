# Migrating from OAC to Claude Code

> Convert OpenAgents Control agents to Claude Code's `.claude/` directory format

## Overview

Export to Claude Code format when you want to use your agents with Claude Code IDE. Claude Code supports subagents (`.claude/agents/*.md`), Skills (`.claude/skills/`), and hooks, making it a feature-rich target with good OAC compatibility.

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | >= 18 | Required for CLI |
| @openagents-control/compatibility-layer | Latest | Install via npm |
| Claude Code | Any | Target platform |

```bash
npm install -g @openagents-control/compatibility-layer
```

## Quick Migration

```bash
# Single agent conversion
oac-compat convert agent.md -f claude -o .claude/

# Convert with verbose output
oac-compat convert agent.md -f claude -o .claude/ --verbose

# Validate before converting
oac-compat validate --target claude agent.md
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
model: claude-sonnet-4
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
```

### 2. Claude Code Structure

Equivalent `.claude/agents/DocWriter.md` format:

```yaml
---
name: "DocWriter"
description: "Documentation authoring agent"
tools: "Read, Write, Edit"
model: "claude-sonnet-4-20250514"
permissionMode: "default"
skills: ["context-manager", "task-management"]
hooks: {"PreToolUse": [{"matcher": "edit", "hooks": [{"type": "command", "command": "echo 'Editing file...'"}]}]}
---

# DocWriter

> Mission: Create and update documentation

## Rules

1. Always follow project documentation standards
2. Use concise, example-driven writing
3. Propose changes before implementing
```

### 3. Key Differences

| Aspect | OAC | Claude Code |
|--------|-----|-------------|
| File format | Markdown + YAML frontmatter | Markdown + YAML frontmatter |
| File location | `.opencode/agent/*.md` | `.claude/agents/*.md` (subagents) or `.claude/config.json` (primary) |
| Multiple agents | Supported | Supported (as subagents) |
| Permissions | Granular (allow/deny/ask per path) | Binary (permissionMode) |
| Skills | Full system | Supported (`.claude/skills/`) |
| Hooks | Full system | Supported (PreToolUse, PostToolUse, etc.) |
| Contexts | Referenced files | Converted to Skills |
| Temperature | Supported | Not supported |
| maxSteps | Supported | Not supported |

### 4. Feature Mapping

| OAC Feature | Claude Code Equivalent | Notes |
|-------------|------------------------|-------|
| `frontmatter.name` | `name` in frontmatter | Direct mapping |
| `frontmatter.description` | `description` in frontmatter | Direct mapping |
| `frontmatter.model` | `model` in frontmatter | Model name converted |
| `frontmatter.temperature` | N/A | Not supported - warning emitted |
| `frontmatter.mode` | File location | `primary` → `config.json`, `subagent` → `agents/*.md` |
| `frontmatter.tools` | `tools` in frontmatter | Converted to comma-separated string |
| `frontmatter.permission` | `permissionMode` | Degraded to binary mode |
| `frontmatter.skills` | `skills` array | Direct mapping |
| `frontmatter.hooks` | `hooks` object | Converted to Claude format |
| `frontmatter.maxSteps` | N/A | Not supported - warning emitted |
| `contexts` | `.claude/skills/` | Converted to skill files |
| `systemPrompt` | Body content | Direct mapping |

### 5. Model Name Mapping

| OAC Model | Claude Code Model |
|-----------|-------------------|
| `claude-sonnet-4` | `claude-sonnet-4-20250514` |
| `claude-opus-4` | `claude-opus-4` |
| `claude-haiku-4` | `claude-haiku-4` |
| Other models | `sonnet` (default alias) |

## Common Patterns

### Pattern 1: Basic Subagent

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

**After (Claude Code `.claude/agents/CodeReviewer.md`):**

```yaml
---
name: "CodeReviewer"
description: "Reviews code for quality"
tools: "Read, Grep, Glob"
---

# Code Reviewer

Review code for:
- Code style consistency
- Potential bugs
- Performance issues
```

### Pattern 2: Primary Agent with Hooks

**Before (OAC):**

```yaml
---
name: MainAgent
description: Primary development agent
mode: primary
model: claude-opus-4
hooks:
  - event: PreToolUse
    matchers: ["bash"]
    commands:
      - type: command
        command: "echo 'Running bash command...'"
  - event: PostToolUse
    matchers: ["write"]
    commands:
      - type: command
        command: "npm run lint"
---

# Main Agent

Primary agent for development tasks.
```

**After (Claude Code `.claude/config.json`):**

```json
{
  "name": "MainAgent",
  "description": "Primary development agent",
  "systemPrompt": "# Main Agent\n\nPrimary agent for development tasks.",
  "model": "claude-opus-4",
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "bash",
        "hooks": [
          { "type": "command", "command": "echo 'Running bash command...'" }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "write",
        "hooks": [
          { "type": "command", "command": "npm run lint" }
        ]
      }
    ]
  }
}
```

### Pattern 3: Agent with Contexts (→ Skills)

**Before (OAC):**

```yaml
---
name: StyleGuide
description: Enforces code style
mode: subagent
---

# Style Guide Agent

Follow the project style guide.
```

With `contexts`:
```json
[
  { "path": ".opencode/context/style-guide.md", "priority": "critical", "description": "Project style guidelines" }
]
```

**After (Claude Code):**

`.claude/agents/StyleGuide.md`:
```yaml
---
name: "StyleGuide"
description: "Enforces code style"
skills: ["style-guide"]
---

# Style Guide Agent

Follow the project style guide.
```

`.claude/skills/style-guide/SKILL.md`:
```yaml
---
name: style-guide
description: Project style guidelines
---

# style-guide

This skill provides context from: `.opencode/context/style-guide.md`

Priority: critical

Load the full context file for detailed information:
```bash
cat .opencode/context/style-guide.md
```
```

### Pattern 4: Agent with Granular Permissions

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
  bash:
    "*": "deny"
---

# Secure Writer

Write TypeScript files only. Never access secrets.
```

**After (Claude Code `.claude/agents/SecureWriter.md`):**

```yaml
---
name: "SecureWriter"
description: "Writes files with restrictions"
permissionMode: "default"
---

# Secure Writer

Write TypeScript files only. Never access secrets.

## Permission Notes

> **Warning**: Granular OAC permissions were degraded to `permissionMode: default`.
> Original restrictions:
> - edit: Only `src/**/*.ts` allowed
> - edit: `**/*.env*` denied
> - bash: Completely denied
>
> Enforce these manually.
```

## Limitations

### Features Lost in Conversion

| Feature | Impact | Workaround |
|---------|--------|------------|
| **temperature** | Not supported | Use creativity settings in Claude Code |
| **maxSteps** | Not supported | Claude Code manages internally |
| **Granular permissions** | Degraded to `permissionMode` | Document restrictions in prompt |

### Permission Mode Mapping

| OAC Permission Pattern | Claude `permissionMode` |
|------------------------|------------------------|
| All `"allow"` / `true` | `bypassPermissions` |
| All `"deny"` / `false` | `dontAsk` |
| Contains `"ask"` | `default` |
| Mixed/complex rules | `default` (with warning) |

### Conversion Warnings

The converter emits warnings for:

```
⚠️  Agent name is required for Claude Code
⚠️  Agent description is required for Claude Code
⚠️  temperature not supported in Claude Code (value: 0.2)
⚠️  maxSteps not supported in Claude Code (value: 50)
⚠️  granular permissions degraded: allow/deny/ask per operation → binary permissionMode (default/acceptEdits/dontAsk/bypassPermissions)
⚠️  Complex permission rules degraded to 'default' permissionMode. Claude Code does not support granular allow/deny/ask per operation.
```

### What's Preserved

- Agent name and description
- Model selection (with name mapping)
- System prompt content
- Tool access list
- Skills references
- Hooks (full conversion)
- Contexts (converted to Skills)

## Validation

### Verify Conversion Success

```bash
# 1. Run conversion with verbose output
oac-compat convert agent.md -f claude -o .claude/ --verbose

# 2. Check for warnings
# Review any warnings about degraded features

# 3. Validate output files exist
ls -la .claude/
ls -la .claude/agents/
ls -la .claude/skills/

# 4. Test in Claude Code
# Open project in Claude Code and verify agent behavior
```

### Manual Verification Checklist

- [ ] `.claude/config.json` created (for primary agents)
- [ ] `.claude/agents/*.md` created (for subagents)
- [ ] `.claude/skills/` created (if contexts present)
- [ ] Agent name and description present in frontmatter
- [ ] Model setting correct (with Claude naming)
- [ ] System prompt content complete
- [ ] Tools list includes expected tools
- [ ] Skills references match generated skill files
- [ ] Hooks converted correctly (if applicable)
- [ ] Warnings reviewed and addressed

### Programmatic Validation

```typescript
import { ClaudeAdapter, loadAgent } from '@openagents-control/compatibility-layer';

async function validateConversion() {
  const agent = await loadAgent('./agent.md');
  const adapter = new ClaudeAdapter();
  
  // Check capabilities
  const caps = adapter.getCapabilities();
  console.log('Claude Code capabilities:', caps);
  // Output: { supportsSkills: true, supportsHooks: true, supportsTemperature: false, ... }
  
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
    // Output: ['.claude/agents/MyAgent.md', '.claude/skills/context-skill/SKILL.md']
    console.log('Warnings:', result.warnings);
  } else {
    console.error('Conversion failed:', result.errors);
  }
}
```

## Troubleshooting

### Common Issues

#### "Agent name is required" warning

**Cause**: OAC agent doesn't have a `name` in frontmatter.

**Solution**: Add name to your OAC agent:
```yaml
---
name: MyAgent
description: My agent description
---
```

#### Temperature setting ignored

**Cause**: Claude Code doesn't support temperature control.

**Solution**: No direct equivalent. Claude Code manages creativity internally. Remove temperature from your expectations or use Claude Code's built-in settings.

#### maxSteps not available

**Cause**: Claude Code doesn't expose step limits.

**Solution**: No workaround - Claude Code manages execution internally.

#### Permissions not enforced granularly

**Cause**: Claude Code only supports `permissionMode` (binary modes).

**Solution**: Document permission restrictions in your system prompt:
```
# IMPORTANT RESTRICTIONS
- Only edit files in src/ directory
- Never access .env files
- Do not run bash commands without approval
```

Or accept the degraded `permissionMode`:
- `default` - Prompts for permission
- `acceptEdits` - Auto-accepts edits
- `dontAsk` - Auto-denies
- `bypassPermissions` - Full access

#### Skills not loading in Claude Code

**Cause**: Skills must be in `.claude/skills/{name}/SKILL.md` format.

**Solution**: Verify the skill directory structure:
```
.claude/
  skills/
    my-skill/
      SKILL.md    # Must be named SKILL.md
```

#### Hooks not triggering

**Cause**: Hook format mismatch or unsupported event.

**Solution**: Verify hooks use supported events:
- `PreToolUse` - Before tool execution
- `PostToolUse` - After tool execution
- `PermissionRequest` - On permission prompt
- `AgentStart` - Agent session start
- `AgentEnd` - Agent session end

Check hook format in converted file:
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "bash",
        "hooks": [{ "type": "command", "command": "echo 'test'" }]
      }
    ]
  }
}
```

## Next Steps

- [Claude → OAC Migration](./claude-to-oac.md) - Import Claude Code configurations
- [OAC → Cursor Migration](./oac-to-cursor.md) - Convert to Cursor format
- [Feature Capabilities Matrix](../feature-matrices/capabilities-overview.md) - Full feature comparison
- [Claude Code Documentation](https://code.claude.com/docs) - Official Claude Code docs
