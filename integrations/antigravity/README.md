# OpenAgents Control ↔ Gemini Antigravity CLI Integration

A pristine, high-performance bridge that allows Gemini Antigravity (`gemini` / `agy`) to seamlessly execute OpenAgents Control (OAC) commands, skills, and subagents.

---

## ⚡ Overview

This integration provides a seamless bridge between OpenAgents Control and Google Antigravity:

1. **Zero Redundancy**: Utilizes Git-portable **relative symbolic links** rather than copying files, ensuring that updates to `.opencode/` are instantly and automatically active in Antigravity.
2. **Pristine Backwards-Compatibility**: Automatically injects mandatory Antigravity YAML properties (e.g. `name`, `model`, `tools`) into your original `.opencode/` command and agent markdown files in-place, keeping the repository 100% compatible with both native OpenCode and Antigravity environments.
3. **Dual Global & Local Mapping**: Configures local workspace paths (.agents/) and deploys global plugins to `~/.gemini/` home directory paths simultaneously.

---

## 📂 Directory Structure

```
integrations/antigravity/
├── README.md               # This guide
└── install-antigravity.sh  # Bridge installer script (Local & Global)
```

---

## 🚀 Quick Start

### 1. Run the Installer

To establish the bridge mappings, run:

```bash
cd integrations/antigravity
./install-antigravity.sh
```

This will automatically:
1. Scan your native OAC skills, commands, and subagents.
2. Translate and inject YAML properties into original `.opencode/` markdown files in-place (safely and backwards-compatibly).
3. Establish relative symlinks under `.agents/skills/` and `.agents/agents/`.
4. Deploy the unified OAC bridge plugin globally under `~/.gemini/config/plugins/` and `~/.gemini/antigravity-cli/plugins/` to enable OAC support across *all* project workspaces.

### 2. Verify in Antigravity

Start an Antigravity session and verify that the plugin has loaded correctly:

```bash
# Start your CLI session
agy

# Inspect active subagents and skills
/agents
/skills
```

You should see `openagents-control-standards` and `context-scout` registered and active.

---

## 🔮 How It Works

### Context Discovery & Pre-loading
1. **Skill Triggers**: The `openagents-control-standards` skill triggers automatically before any development or architectural task.
2. **Subagent Invocation**: The skill delegates to `context-scout` to search `.opencode/context/` for relevant conventions, naming standards, and workflows.
3. **Upfront Loading**: Discovered files are read and pre-loaded into the prompt context to keep subsequent task execution fast, consistent, and highly token-efficient.

### In-Place Agent Frontmatter Mapping
The setup utility dynamically translates OAC agent specifications to Antigravity configurations:
- **`name`**: Map names directly.
- **`model`**: Defaults to `gemini-3.1-pro` for high-performance agentic coding.
- **`tools`**: Intelligently infers necessary tools (e.g., `run_command`, `replace_file_content`, `write_to_file`, `read_file`, `grep_search`, `list_dir`) by parsing the OAC permission structures in-place.
