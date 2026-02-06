#!/bin/bash

# sync-to-claude.sh
# Syncs OpenCode Agents to Claude Code plugin directory

SOURCE_DIR=".opencode/agent"
DEST_DIR=".opencode/integrations/claude-code/agents"
CLAUDE_DIR=".claude/plugins/openagent"

echo "🚀 Starting OpenBridge Sync..."

# Ensure destination exists
mkdir -p "$DEST_DIR"

# 1. Sync Subagents (Core logic)
echo "📦 Syncing subagents..."
cp .opencode/agent/subagents/core/*.md "$DEST_DIR/" 2>/dev/null

# 2. Sync Category Agents (Convert to Claude Subagents)
# Note: We rename them to be flatter for Claude's /agents menu
echo "🤖 Syncing category agents..."
find "$SOURCE_DIR" -maxdepth 2 -name "*.md" -not -path "*/subagents/*" | while read -r agent; do
    filename=$(basename "$agent")
    # Add Claude-specific frontmatter if missing (simple approach)
    # Claude needs name and description in frontmatter
    cp "$agent" "$DEST_DIR/$filename"
done
# shellcheck disable=SC2094

# 3. Installation - Link to .claude directory for immediate use
echo "🔗 Installing plugin to .claude/plugins/openagent..."
mkdir -p .claude/plugins
# Use a symbolic link so changes in integrations/ are reflected
rm -rf "$CLAUDE_DIR"
ln -s "$(pwd)/.opencode/integrations/claude-code" "$CLAUDE_DIR"

echo "✅ Sync complete!"
echo "💡 To use in Claude Code, run: claude"
echo "   Claude will now automatically use 'context-scout' and apply 'repo-standards'."
