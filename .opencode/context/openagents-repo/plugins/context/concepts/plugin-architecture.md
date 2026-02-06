# Plugin Architecture

**Purpose**: Extend Claude Code with slash commands, agents, Skills, hooks, and MCP servers

---

## Core Concept

Plugins are directories containing a manifest (`.claude-plugin/plugin.json`) plus optional components (commands, agents, skills, hooks). They enable sharing functionality across projects and teams with namespaced commands.

**Key Difference**:
- **Standalone** (`.claude/`): Personal workflows, short names like `/hello`
- **Plugins**: Shareable, versioned, namespaced like `/plugin-name:hello`

---

## Key Points

- Plugin manifest at `.claude-plugin/plugin.json` defines identity (name, description, version)
- Name field becomes namespace prefix for all slash commands
- Components live at plugin root, NOT inside `.claude-plugin/`
- Load with `--plugin-dir ./my-plugin` for testing
- Multiple plugins can be loaded simultaneously

---

## Quick Example

```json
// .claude-plugin/plugin.json
{
  "name": "my-plugin",
  "description": "A greeting plugin",
  "version": "1.0.0",
  "author": { "name": "Your Name" }
}
```

---

## Related

- `../guides/creating-plugins.md` - How to create plugins
- `../lookup/plugin-structure.md` - Directory structure
- `../../guides/adding-skill.md` - Adding skills to plugins

**Reference**: https://docs.anthropic.com/en/docs/claude-code/plugins
