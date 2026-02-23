#!/usr/bin/env bash
# SessionStart hook for OAC plugin

set -euo pipefail

# Determine plugin root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SKILL_FILE="${PLUGIN_ROOT}/skills/using-oac/SKILL.md"

# Read using-oac content
using_oac_content=$(cat "${SKILL_FILE}" 2>&1 || echo "Error reading using-oac skill")


# Escape string for JSON embedding
# SECURITY: Prevents command injection attacks from malicious SKILL.md files
escape_for_json() {
    local s="$1"
    # Escape backslashes FIRST - order matters!
    s="${s//\\/\\\\}"
    # Escape double quotes
    s="${s//\"/\\\"}"
    # Escape newlines, carriage returns, tabs
    s="${s//$'\n'/\\n}"
    s="${s//$'\r'/\\r}"
    s="${s//$'\t'/\\t}"
    printf '%s' "$s"
}

using_oac_escaped=$(escape_for_json "$using_oac_content")

# Build skill catalogue from skills directory
# Use real newlines (not literal \n) so escape_for_json encodes them correctly as \n in JSON
skill_catalogue=""
if [ -d "${PLUGIN_ROOT}/skills" ]; then
    for skill_dir in "${PLUGIN_ROOT}/skills"/*/; do
        skill_name=$(basename "$skill_dir")
        skill_file="${skill_dir}SKILL.md"
        if [ -f "$skill_file" ]; then
            # Extract description from frontmatter
            description=$(grep -m1 '^description:' "$skill_file" 2>/dev/null | sed 's/^description: *//;s/^"//;s/"$//' || echo "")
            if [ -n "$description" ]; then
                skill_catalogue="${skill_catalogue}"$'\n'"- oac:${skill_name} — ${description}"
            else
                skill_catalogue="${skill_catalogue}"$'\n'"- oac:${skill_name}"
            fi
        fi
    done
fi

# Build warning message for first-time users
# Context can be installed project-local (.claude/.context-manifest.json)
# or globally (~/.claude/.context-manifest.json)
PROJECT_MANIFEST="$(pwd)/.claude/.context-manifest.json"
GLOBAL_MANIFEST="${HOME}/.claude/.context-manifest.json"
warning_message=""
if [[ ! -f "${PROJECT_MANIFEST}" ]] && [[ ! -f "${GLOBAL_MANIFEST}" ]]; then
    warning_message="\n\n<important-reminder>IN YOUR FIRST REPLY AFTER SEEING THIS MESSAGE YOU MUST TELL THE USER: **No context files found.** Invoke the context-setup skill now to set up context for this project — it will check your project type and recommend the right profile. Say: \"I notice you don't have context files set up. Let me get that sorted for you.\" Then immediately run the context-setup skill.</important-reminder>"
fi

warning_escaped=$(escape_for_json "$warning_message")
skill_catalogue_escaped=$(escape_for_json "$skill_catalogue")

# Build OAC system paths block
PROTOCOL_PATH="${PLUGIN_ROOT}/skills/context-discovery/context-discovery-protocol.md"
plugin_root_escaped=$(escape_for_json "$PLUGIN_ROOT")
protocol_path_escaped=$(escape_for_json "$PROTOCOL_PATH")
OAC_SYSTEM_PATHS="## OAC System Paths\n- Plugin Root: ${plugin_root_escaped}\n- Context Discovery Protocol: ${protocol_path_escaped}"

# Context scout instruction — run proactively at session start when context is available
CONTEXT_SCOUT_INSTRUCTION="## Context Discovery\nBefore responding to any coding or implementation request this session, use the 'oac:context-discovery' skill to locate the project's coding standards. This runs once per session — do not repeat it if already done."

context_scout_escaped=$(escape_for_json "$CONTEXT_SCOUT_INSTRUCTION")

# Build context string
OAC_CONTEXT="<EXTREMELY_IMPORTANT>\nYou have OAC (OpenAgents Control).\n\n**Below is the full content of your 'oac:using-oac' skill — your introduction to using OAC skills. For all other skills, use the 'Skill' tool:**\n\n${using_oac_escaped}\n\n## Available OAC Skills (invoke with the Skill tool):\n${skill_catalogue_escaped}\n\n${OAC_SYSTEM_PATHS}\n\n${context_scout_escaped}\n\n${warning_escaped}\n</EXTREMELY_IMPORTANT>"

# Output dual-format JSON for cross-tool compatibility
# - additionalContext: Claude Code (hookSpecificOutput)
# - additional_context: Cursor / OpenCode / other tools
cat <<EOF
{
  "additional_context": "${OAC_CONTEXT}",
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "${OAC_CONTEXT}"
  }
}
EOF

exit 0
