# Feature Compatibility Matrices

Comprehensive comparison of feature support across OpenAgents Control (OAC), Claude Code, Cursor IDE, and Windsurf platforms. Use these matrices to understand conversion impact before migrating agent configurations.

---

## Quick Reference - Platform Support Summary

| Platform | Config Format | Structure | Multiple Agents | Skills | Hooks | Granular Perms |
|----------|---------------|-----------|-----------------|--------|-------|----------------|
| **OAC** | Markdown+YAML | Directory | ✅ | ✅ | ✅ | ✅ |
| **Claude Code** | JSON/Markdown | Directory | ✅ | ✅ | ✅ | ❌ |
| **Cursor IDE** | Plain text | Single file | ❌ | ❌ | ❌ | ❌ |
| **Windsurf** | JSON | Directory | ✅ | ⚠️ | ❌ | ❌ |

**Legend:** ✅ Full support | ⚠️ Partial support | ❌ Not supported

---

## Detailed Matrices

### Tool/Permission Capabilities

| Feature | OAC | Claude Code | Cursor IDE | Windsurf |
|---------|-----|-------------|------------|----------|
| **bash/shell execution** | ✅ | ✅ | ✅ | ✅ |
| **file read** | ✅ | ✅ | ✅ | ✅ |
| **file write** | ✅ | ✅ | ✅ | ✅ |
| **file edit/patch** | ✅ | ✅ | ✅ | ✅ |
| **glob search** | ✅ | ✅ | ✅ | ✅ |
| **grep content search** | ✅ | ✅ | ✅ | ✅ |
| **task delegation** | ✅ | ✅ | ❌ | ⚠️ |
| **granular permissions** | ✅ | ❌ | ❌ | ❌ |
| **ask permissions** | ✅ | ❌ | ❌ | ❌ |
| **path pattern rules** | ✅ | ❌ | ❌ | ⚠️ |

**Notes:**
- Cursor has no task delegation - all work happens in a single agent
- All platforms reduce OAC granular permissions (allow/deny/ask per path) to binary on/off
- Windsurf's delegation is limited compared to Claude's full subagent system

---

### Configuration Features

| Feature | OAC | Claude Code | Cursor IDE | Windsurf |
|---------|-----|-------------|------------|----------|
| **custom model selection** | ✅ | ✅ | ✅ | ✅ |
| **temperature control** | ✅ | ❌ | ⚠️ | ⚠️ |
| **maxSteps limit** | ✅ | ❌ | ❌ | ❌ |
| **agent disable/hidden** | ✅ | ⚠️ | ❌ | ⚠️ |
| **custom prompts** | ✅ | ✅ | ✅ | ✅ |
| **version metadata** | ✅ | ⚠️ | ❌ | ⚠️ |
| **author metadata** | ✅ | ⚠️ | ❌ | ⚠️ |
| **tags** | ✅ | ❌ | ❌ | ⚠️ |

**Notes:**
- Claude does not support temperature configuration
- Cursor has limited temperature range support
- Windsurf maps temperature to "creativity" setting (low/medium/high)
- maxSteps is OAC-exclusive

---

### Context/Memory Features

| Feature | OAC | Claude Code | Cursor IDE | Windsurf |
|---------|-----|-------------|------------|----------|
| **external context files** | ✅ | ✅ | ❌ | ✅ |
| **context priority levels** | ✅ | ❌ | ❌ | ❌ |
| **context subdirectories** | ✅ | ✅ | ❌ | ✅ |
| **skills/modules system** | ✅ | ✅ | ❌ | ⚠️ |
| **context descriptions** | ✅ | ⚠️ | ❌ | ⚠️ |
| **dependency declarations** | ✅ | ✅ | ❌ | ⚠️ |

**Notes:**
- Cursor requires all context to be inline in `.cursorrules`
- OAC supports 4 priority levels: critical, high, medium, low
- Windsurf only supports high/low priority (medium/critical get degraded)
- Skills in Windsurf become basic context file references

---

### Agent/Mode Features

| Feature | OAC | Claude Code | Cursor IDE | Windsurf |
|---------|-----|-------------|------------|----------|
| **multiple agents** | ✅ | ✅ | ❌ | ✅ |
| **primary/subagent modes** | ✅ | ✅ | ❌ | ⚠️ |
| **agent categories** | ✅ | ⚠️ | ❌ | ⚠️ |
| **event hooks** | ✅ | ✅ | ❌ | ❌ |
| **hook matchers** | ✅ | ✅ | ❌ | ❌ |
| **priority levels** | ✅ (4) | ⚠️ (2) | ❌ | ⚠️ (2) |

**Notes:**
- Cursor merges all agents into a single `.cursorrules` file
- Hook events supported by Claude: PreToolUse, PostToolUse, PermissionRequest, AgentStart, AgentEnd
- Windsurf has limited mode distinction

---

## Conversion Impact

### Lossless Conversions

These conversions preserve all features without degradation:

| From | To | Notes |
|------|-----|-------|
| Cursor | OAC | Full upgrade - gains all OAC features |
| Cursor | Claude | Gains hooks, skills, multiple agents |
| Cursor | Windsurf | Gains multiple agents, contexts |
| Claude | OAC | Full upgrade - gains granular permissions, temperature |
| Windsurf | OAC | Full upgrade - gains hooks, granular permissions |

---

### Lossy Conversions

These conversions result in feature loss or degradation:

| From | To | What's Lost/Degraded |
|------|-----|---------------------|
| OAC | Claude | Temperature, maxSteps, granular permissions → binary |
| OAC | Cursor | **Significant loss**: hooks, skills, multiple agents, contexts (inline only), granular permissions |
| OAC | Windsurf | Hooks, granular permissions, context priority (4→2 levels), temperature → creativity |
| Claude | Cursor | **Significant loss**: hooks, skills, multiple agents, contexts |
| Claude | Windsurf | Hooks, temperature |
| Windsurf | Cursor | Multiple agents merged, skills lost, contexts inline only |
| Windsurf | Claude | Temperature mapping may be imprecise |

---

## Platform-Specific Notes

### OpenAgents Control (OAC)
- **Config location**: `.opencode/agent/` directory
- **Format**: Markdown files with YAML frontmatter
- **Strengths**: Full feature support, granular permissions, 4-level priorities
- **Best for**: Complex multi-agent workflows requiring fine-grained control

### Claude Code
- **Config location**: `.claude/` directory
- **Primary config**: `.claude/config.json` or `.claude/agents/*.md`
- **Strengths**: Full hooks support, skills system, multiple agents
- **Limitations**: No temperature control, binary permissions only
- **Permission modes**: default, acceptEdits, dontAsk, bypassPermissions

### Cursor IDE
- **Config location**: `.cursorrules` (single file in project root)
- **Format**: Plain text with optional YAML frontmatter
- **Strengths**: Simple setup, universal tool support
- **Limitations**: Single agent only, no external contexts, no hooks/skills
- **Best for**: Simple, single-purpose project rules

### Windsurf
- **Config location**: `.windsurf/` directory
- **Primary config**: `.windsurf/config.json`
- **Strengths**: Multiple agents, context files, creativity settings
- **Limitations**: No hooks, binary permissions, 2-level priority only
- **Temperature mapping**: `≤0.4` → low, `0.4-0.8` → medium, `>0.8` → high

---

## Version Compatibility

| Package Version | OAC Schema | Claude Support | Cursor Support | Windsurf Support |
|-----------------|------------|----------------|----------------|------------------|
| 1.0.x | v1.0 | ✅ Full | ✅ Full | ✅ Full |

### Model Mappings

| OAC Model ID | Claude Code | Cursor IDE | Windsurf |
|--------------|-------------|------------|----------|
| `claude-sonnet-4` | `claude-sonnet-4-20250514` | `claude-sonnet-4` | `claude-4-sonnet` |
| `claude-opus-4` | `claude-opus-4-20250514` | `claude-opus-4` | `claude-4-opus` |
| `claude-3.5-sonnet` | `claude-3-5-sonnet-20241022` | `claude-3.5-sonnet` | `claude-3-5-sonnet` |
| `gpt-4` | — | `gpt-4` | `gpt-4` |
| `gpt-4-turbo` | — | `gpt-4-turbo` | `gpt-4-turbo` |
| `gpt-4o` | — | `gpt-4o` | `gpt-4o` |

### Tool Name Mappings

| OAC Tool | Claude Code | Cursor IDE | Windsurf |
|----------|-------------|------------|----------|
| `bash` | `Bash` | `terminal` | `shell` |
| `read` | `Read` | `file_read` | `read_file` |
| `write` | `Write` | `file_write` | `write_file` |
| `edit` | `Edit` | `file_edit` | `edit_file` |
| `glob` | `Glob` | `file_search` | `find_files` |
| `grep` | `Grep` | `content_search` | `search_content` |
| `task` | `Task` | ❌ (unsupported) | `delegate` |
| `patch` | `Edit` | `file_edit` | `edit_file` |
