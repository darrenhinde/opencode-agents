# OpenAgents Control ↔ Gemini Antigravity CLI Integration

A bridge that allows Gemini Antigravity 2.0 (Antigravity CLI 1.0) to use OpenAgents Control standards, subagents, and context files.

## Overview

This integration provides a seamless bridge between OpenAgents Control and Gemini Antigravity CLI (`agy`):

1. **Auto-Convert**: Compiles OpenAgents Control's agent specifications into Antigravity CLI-native plugins
2. **Global & Local Workspaces**: Deploys plugins globally for all projects or locally under repository workspaces

## Directory Structure

```
integrations/antigravity/
├── README.md               # This guide
├── install-antigravity.sh  # Build & installation script (Global & Local)
└── converter/              # Conversion subsystem
    ├── package.json        # Dependencies
    └── src/
        └── convert-agents.js # Node-based compiler and YAML mapper
```

## Quick Start

### 1. Compile & Install the Plugin

To compile OAC agents and install the plugin to your Antigravity environments, run:

```bash
cd integrations/antigravity
./install-antigravity.sh
```

This will automatically:
1. Translate `.opencode/agent/*.md` specifications to Antigravity format in `integrations/antigravity/generated/`.
2. Generate the necessary `plugin.json` manifest.
3. Install the plugin globally to `~/.gemini/antigravity-cli/plugins/openagents-control-bridge`.
4. Install the plugin locally to `.agents/plugins/openagents-control-bridge` for workspace-specific runs.

### 2. Verify in Antigravity CLI

Start your Antigravity session and verify that the plugin has loaded correctly:

```bash
# Start your CLI session
agy

# Inspect active subagents and skills
/agents
/skills
```

You should see `openagents-control-standards` and `context-scout` registered and active.

---

## How It Works

### Context Discovery & Pre-loading

1. **Skill Triggers**: The `openagents-control-standards` Skill triggers automatically before any development or architectural task.
2. **Subagent Invocation**: The skill delegates to `context-scout` to search `.opencode/context/` for relevant conventions, naming standards, and workflows.
3. **Upfront Loading**: Discovered files are read and pre-loaded into the prompt context to keep subsequent task execution fast, consistent, and highly token-efficient.

### Agent Specification Mapping

The converter translates OAC agent frontmatter properties to Antigravity CLI specifications:

| OpenAgents Control Field | Gemini Antigravity Field | Notes / Conversions |
|--------------------------|--------------------------|---------------------|
| `id`                     | `name`                   | Uniquely names the subagent |
| `description`            | `description`            | Description used for auto-routing |
| `permissions`            | `tools`                  | Maps `read` ➔ `read_file`, `write` ➔ `write_file`, `edit` ➔ `edit_file`, `bash` ➔ `run_command`, `grep` ➔ `grep_search`, `glob` ➔ `list_dir` |
| `model`                  | `model`                  | Translates models to user-approved designations: Grok/Sonnet ➔ `gemini-3.1-pro`, Haiku ➔ `gemini-3.5-flash` |
| `mode: subagent`         | `permissionMode: plan`   | Restricts executing subagents to planned/approved paths |

---

## Adding Custom Agents & Workflows

### For Local Workspace Use
Add your customized agent definitions under `.agents/agents/` and skills under `.agents/skills/`. The Antigravity Agent will auto-load them upon starting a session inside the workspace root.

### For Global Distribution
1. Place the new OAC agent configuration in `.opencode/agent/{category}/{agent}.md`.
2. Run the compiler installer: `./install-antigravity.sh`
3. Your updated agent will instantly be active across all your CLI sessions.

## Requirements

- Node.js 18+
- Gemini Antigravity CLI 1.0+ (with local plugin-loading enabled for repo-level runs)

---

## Command Reference

| Action | Claude Code CLI | Gemini Antigravity CLI |
|--------|-----------------|------------------------|
| Start interactive run | `claude` | `agy` |
| Browse Active Skills | `/print-plugins` | `/skills` |
| Browse Active Subagents| `/print-plugins` | `/agents` |
| Settings & Config | `~/.claude/settings.json` | `/config` or `/settings` |
| Keybindings Map | `/keybindings` | `/keybindings` |
| Directory Search | `/glob` / `/grep` | `@` (autocomplete) or `/skills` search |
| Run single bash command| `!command` | `!command` |
