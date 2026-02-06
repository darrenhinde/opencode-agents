# Creating Subagents

**Purpose**: Step-by-step guide to create custom subagents

---

## Interactive Method (/agents)

1. Run `/agents` in Claude Code
2. Select **Create new agent**
3. Choose scope: **User-level** or **Project-level**
4. Select **Generate with Claude** and describe the subagent
5. Select tools (or keep all)
6. Choose model
7. Pick a color
8. Save - available immediately

---

## Manual Method (Markdown File)

Create file at `~/.claude/agents/` (personal) or `.claude/agents/` (project):

```markdown
---
name: code-reviewer
description: Reviews code for quality and best practices
tools: Read, Glob, Grep
model: sonnet
---

You are a code reviewer. Analyze code and provide specific, 
actionable feedback on quality, security, and best practices.
```

Restart session or use `/agents` to load.

---

## CLI Method (JSON)

```bash
claude --agents '{
  "code-reviewer": {
    "description": "Expert code reviewer",
    "prompt": "You are a senior code reviewer...",
    "tools": ["Read", "Grep", "Glob", "Bash"],
    "model": "sonnet"
  }
}'
```

Session-only, not saved to disk.

---

## Key Points

- Filename becomes subagent name (without `.md`)
- Description determines when Claude delegates
- Body becomes system prompt
- Subagents only get their system prompt, not full Claude Code prompt
- Include "use proactively" in description for automatic delegation

---

## Related

- `../concepts/subagents-system.md` - Subagents overview
- `../lookup/subagent-frontmatter.md` - All configuration fields
- `../examples/subagents/` - Example subagents

**Reference**: https://docs.anthropic.com/en/docs/claude-code/sub-agents
