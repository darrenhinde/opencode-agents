# OAC to Windsurf Migration Guide

Migrate your OpenAgents Control (OAC) agent configurations to Windsurf format. This guide covers the CLI migration command, manual conversion steps, and feature mapping differences between the two formats.

---

## Prerequisites

- **Node.js** v18+
- **@openagents/compatibility-layer** CLI installed:
  ```bash
  npm install -g @openagents/compatibility-layer
  ```

---

## Quick Migration

One command converts your OAC agent to Windsurf:

```bash
oac convert --from oac --to windsurf --input .opencode/agent/my-agent.md --output .windsurf/
```

**Output:**
- Primary agents → `.windsurf/config.json`
- Subagents → `.windsurf/agents/{name}.json`

---

## Step-by-Step Manual Migration

### Step 1: Extract Frontmatter

**Before (OAC `.md` file):**
```yaml
---
name: code-reviewer
description: Reviews code for quality and security
mode: subagent
model: claude-sonnet-4
temperature: 0.3
tools:
  read: true
  write: false
  bash: false
---
```

**After (Windsurf `.json`):**
```json
{
  "name": "code-reviewer",
  "description": "Reviews code for quality and security",
  "type": "subagent",
  "model": "claude-4-sonnet",
  "creativity": "low",
  "tools": {
    "read": true,
    "write": false,
    "bash": false
  }
}
```

### Step 2: Convert System Prompt

**Before (OAC):**
```markdown
---
name: code-reviewer
---

You are a code reviewer. Analyze code for:
- Security vulnerabilities
- Performance issues
- Best practices
```

**After (Windsurf):**
```json
{
  "name": "code-reviewer",
  "systemPrompt": "You are a code reviewer. Analyze code for:\n- Security vulnerabilities\n- Performance issues\n- Best practices"
}
```

### Step 3: Map Contexts

**Before (OAC):**
```yaml
contexts:
  - path: .opencode/context/code-standards.md
    priority: critical
    description: Company coding standards
  - path: .opencode/context/security-rules.md
    priority: high
```

**After (Windsurf):**
```json
{
  "contexts": [
    {
      "path": ".windsurf/context/code-standards.md",
      "priority": "high",
      "description": "Company coding standards"
    },
    {
      "path": ".windsurf/context/security-rules.md",
      "priority": "high"
    }
  ]
}
```

> **Note:** Copy context files from `.opencode/context/` to `.windsurf/context/`

---

## Key Differences

| Aspect | OAC | Windsurf |
|--------|-----|----------|
| **Format** | Markdown + YAML frontmatter | JSON |
| **Location** | `.opencode/agent/*.md` | `.windsurf/config.json` or `.windsurf/agents/*.json` |
| **Temperature** | Numeric (0.0-2.0) | String: `low`, `medium`, `high` |
| **Permissions** | Granular (allow/deny/ask per path) | Binary (on/off) |
| **Hooks** | Full support | Not supported |
| **Priority Levels** | 4 levels (critical/high/medium/low) | 2 levels (high/low) |
| **Skills** | Full Skills system | Basic context references |

---

## Feature Mapping

| OAC Feature | Windsurf Equivalent | Notes |
|-------------|---------------------|-------|
| `name` | `name` | Direct mapping |
| `description` | `description` | Direct mapping |
| `mode: primary` | `type: "primary"` | Renamed field |
| `mode: subagent` | `type: "subagent"` | Renamed field |
| `model: claude-sonnet-4` | `model: "claude-4-sonnet"` | Model ID format differs |
| `model: claude-opus-4` | `model: "claude-4-opus"` | Model ID format differs |
| `model: gpt-4o` | `model: "gpt-4o"` | Direct mapping |
| `temperature: 0.0-0.4` | `creativity: "low"` | Mapped to string |
| `temperature: 0.4-0.8` | `creativity: "medium"` | Mapped to string |
| `temperature: 0.8-2.0` | `creativity: "high"` | Mapped to string |
| `tools: { read: true }` | `tools: { read: true }` | Direct mapping |
| `permission: { read: "allow" }` | `permissions: { read: true }` | Simplified to boolean |
| `permission: { write: "ask" }` | `permissions: { write: false }` | "ask" → false (cautious) |
| `skills: ["skill-name"]` | `contexts: [{ path: ".windsurf/context/skill-name.md" }]` | Converted to context refs |
| `hooks` | ❌ Not supported | Lost in conversion |
| `maxSteps` | ❌ Not supported | Lost in conversion |
| `priority: critical` | `priority: "high"` | Downgraded |
| `priority: medium` | `priority: "low"` | Downgraded |

---

## Common Patterns

### Pattern 1: Agent with Restricted Tools

**Before (OAC):**
```yaml
---
name: doc-writer
description: Writes documentation
mode: subagent
tools:
  read: true
  write: true
  edit: true
  bash: false
  task: false
---

You write technical documentation following project standards.
```

**After (Windsurf):**
```json
{
  "name": "doc-writer",
  "description": "Writes documentation",
  "type": "subagent",
  "tools": {
    "read": true,
    "write": true,
    "edit": true,
    "bash": false,
    "task": false
  },
  "systemPrompt": "You write technical documentation following project standards."
}
```

### Pattern 2: Agent with Granular Permissions

**Before (OAC):**
```yaml
---
name: safe-coder
description: Writes code with restricted access
mode: subagent
permission:
  read: allow
  write:
    allow: ["src/**/*.ts"]
    deny: ["src/secrets/**"]
  bash: ask
---
```

**After (Windsurf):**
```json
{
  "name": "safe-coder",
  "description": "Writes code with restricted access",
  "type": "subagent",
  "permissions": {
    "read": true,
    "write": true,
    "bash": false
  }
}
```

> **Warning:** Granular path rules (`allow: ["src/**/*.ts"]`) are lost. Windsurf only supports binary on/off.

### Pattern 3: Agent with Skills

**Before (OAC):**
```yaml
---
name: context-expert
description: Manages project context
mode: subagent
skills:
  - context-manager
  - task-management
---
```

**After (Windsurf):**
```json
{
  "name": "context-expert",
  "description": "Manages project context",
  "type": "subagent",
  "contexts": [
    {
      "path": ".windsurf/context/context-manager.md",
      "priority": "medium",
      "description": "Skill: context-manager"
    },
    {
      "path": ".windsurf/context/task-management.md",
      "priority": "medium",
      "description": "Skill: task-management"
    }
  ]
}
```

> **Note:** You must manually create the skill context files in `.windsurf/context/`

### Pattern 4: Primary Agent with Full Config

**Before (OAC):**
```yaml
---
name: main-agent
description: Primary development agent
mode: primary
model: claude-opus-4
temperature: 0.7
tools:
  read: true
  write: true
  edit: true
  bash: true
  task: true
  grep: true
  glob: true
---

You are the primary development agent for this project.
```

**After (Windsurf `.windsurf/config.json`):**
```json
{
  "name": "main-agent",
  "description": "Primary development agent",
  "type": "primary",
  "model": "claude-4-opus",
  "creativity": "medium",
  "tools": {
    "read": true,
    "write": true,
    "edit": true,
    "bash": true,
    "task": true,
    "grep": true,
    "glob": true
  },
  "systemPrompt": "You are the primary development agent for this project."
}
```

---

## Limitations

| OAC Feature | Windsurf Support | Impact |
|-------------|------------------|--------|
| **Hooks** | ❌ Not supported | Behavioral rules (PreToolUse, PostToolUse, etc.) are completely lost |
| **maxSteps** | ❌ Not supported | Execution step limits cannot be enforced |
| **Granular Permissions** | ⚠️ Degraded | Path-based allow/deny rules become binary on/off |
| **"ask" Permission** | ⚠️ Degraded | Converted to `false` (deny) for safety |
| **4-Level Priority** | ⚠️ Degraded | `critical` → `high`, `medium` → `low` |
| **Skills System** | ⚠️ Partial | Converted to basic context file references |
| **Markdown Format** | ⚠️ Changed | Agent definition moves from `.md` to `.json` |

---

## Validation Steps

After migration, verify your configuration:

### 1. Validate JSON Syntax

```bash
# Check JSON is valid
cat .windsurf/config.json | jq .
```

### 2. Verify Required Fields

```bash
# Check required fields exist
jq 'has("name") and has("description") and has("systemPrompt")' .windsurf/config.json
```

### 3. Test Agent Loading

```bash
# If Windsurf CLI available
windsurf validate .windsurf/config.json
```

### 4. Check Context Files Exist

```bash
# Verify all referenced contexts exist
jq -r '.contexts[]?.path // empty' .windsurf/config.json | while read path; do
  [ -f "$path" ] || echo "Missing: $path"
done
```

### 5. Review Conversion Warnings

The CLI outputs warnings for feature degradation:

```
⚠️  Permission "ask" for bash degraded to false (deny). Windsurf only supports binary on/off.
⚠️  Granular permissions degraded from allow/deny/ask per path to binary on/off per tool
❌ Windsurf does not support hooks - behavioral rules will be lost
💡 2 context file(s) referenced - ensure they exist in .windsurf/context/
```

---

## Troubleshooting

### Issue: "Invalid Windsurf config format"

**Cause:** Input file is not valid JSON or has unexpected structure.

**Solution:**
```bash
# Validate your source OAC file first
oac validate .opencode/agent/my-agent.md

# Check for YAML syntax errors in frontmatter
```

### Issue: Hooks Not Working

**Cause:** Windsurf does not support hooks. They are silently dropped.

**Solution:**
- Document hook behavior manually in context files
- Use Windsurf's native features if available
- Accept limitation or stay on OAC

### Issue: Permissions Too Restrictive

**Cause:** `ask` permissions convert to `false` (deny).

**Solution:**
```json
// Manually change if you want to allow
"permissions": {
  "bash": true  // Changed from false
}
```

### Issue: Context Files Not Found

**Cause:** Context paths reference `.opencode/context/` but Windsurf expects `.windsurf/context/`.

**Solution:**
```bash
# Copy context files to Windsurf location
mkdir -p .windsurf/context
cp .opencode/context/*.md .windsurf/context/
```

### Issue: Model Not Recognized

**Cause:** Model ID format differs between OAC and Windsurf.

**Solution:**
```json
// OAC model IDs map to Windsurf:
// claude-sonnet-4 → claude-4-sonnet
// claude-opus-4 → claude-4-opus
// claude-haiku-4 → claude-4-haiku
```

### Issue: Skills Not Loading

**Cause:** Skills are converted to context references but the context files don't exist.

**Solution:**
1. Export skill content from OAC
2. Create `.windsurf/context/{skill-name}.md` files
3. Include skill instructions in each context file

---

## Next Steps

1. **Run the migration:**
   ```bash
   oac convert --from oac --to windsurf --input .opencode/agent/ --output .windsurf/
   ```

2. **Review warnings** for feature degradation

3. **Copy context files:**
   ```bash
   cp -r .opencode/context/* .windsurf/context/
   ```

4. **Create skill context files** for any referenced skills

5. **Test the converted agent** in Windsurf

6. **Document lost features** (hooks, granular permissions) in your project README

7. **Consider keeping OAC as source of truth** if you need features Windsurf doesn't support
