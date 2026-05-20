#!/usr/bin/env bash
#
# install-antigravity.sh
# Installs OpenAgents Control to Gemini Antigravity CLI with automatic relative symlink mapping
#

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Determine paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
NODE_BIN="${NODE_BIN:-node}"

echo -e "${GREEN}🚀 OpenAgents Control → Gemini Antigravity CLI Installer${NC}"
echo -e "   Workspace Root: $REPO_ROOT"
echo ""

# Check prerequisites
if ! command -v "$NODE_BIN" >/dev/null 2>&1; then
    echo -e "${RED}✗ Missing required command: node${NC}" >&2
    echo -e "  Please install Node.js: https://nodejs.org/" >&2
    exit 1
fi

# 1. Run local bridge setup
echo -e "${YELLOW}🔄 Configuring local Antigravity Bridge...${NC}"
if ! "$NODE_BIN" "$REPO_ROOT/scripts/setup-gemini-bridge.js"; then
    echo -e "${RED}✗ Bridge configuration failed${NC}" >&2
    exit 1
fi

# Define global plugin locations
GLOBAL_CLI_DEST="$HOME/.gemini/antigravity-cli/plugins/openagents-control-bridge"
GLOBAL_CONFIG_DEST="$HOME/.gemini/config/plugins/openagents-control-bridge"
LOCAL_PLUGIN_SRC="$REPO_ROOT/.agents/plugins/openagents-control-bridge"

# 2. Install global plugins (optional fallback/global access)
echo -e "\n${YELLOW}📦 Installing global plugins...${NC}"

# Global CLI Destination
mkdir -p "$HOME/.gemini/antigravity-cli/plugins"
if [ -d "$GLOBAL_CLI_DEST" ] || [ -L "$GLOBAL_CLI_DEST" ]; then
    rm -rf "$GLOBAL_CLI_DEST"
fi
cp -R "$LOCAL_PLUGIN_SRC" "$GLOBAL_CLI_DEST"
echo -e "  ✓ Installed global CLI plugin ──► $GLOBAL_CLI_DEST"

# Global Config Destination
mkdir -p "$HOME/.gemini/config/plugins"
if [ -d "$GLOBAL_CONFIG_DEST" ] || [ -L "$GLOBAL_CONFIG_DEST" ]; then
    rm -rf "$GLOBAL_CONFIG_DEST"
fi
cp -R "$LOCAL_PLUGIN_SRC" "$GLOBAL_CONFIG_DEST"
echo -e "  ✓ Installed global config plugin ──► $GLOBAL_CONFIG_DEST"

echo -e "\n${GREEN}✨ Antigravity Integration Successful!${NC}"
echo -e "✓ The original .opencode/ folder structure remains pristine."
echo -e "✓ All local workspace mappings use portable, relative symlinks."
echo -e "✓ Ready for both OpenCode and Google Antigravity!"
