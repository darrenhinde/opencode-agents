#!/usr/bin/env bash
#
# install-antigravity.sh
# Installs OpenAgents Control to Gemini Antigravity CLI with automatic conversion
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
OPENCODE_DIR="$REPO_ROOT/.opencode/agent"
CONVERTER_DIR="$SCRIPT_DIR/converter"
PLUGIN_DEST="$HOME/.gemini/antigravity-cli/plugins/openagents-control-bridge"
LOCAL_PLUGIN_DEST="$REPO_ROOT/.agents/plugins/openagents-control-bridge"
NODE_BIN="${NODE_BIN:-node}"

echo -e "${GREEN}🚀 OpenAgents Control → Gemini Antigravity CLI Installer${NC}"
echo -e "   Source: $OPENCODE_DIR"
echo -e "   Global Destination: $PLUGIN_DEST"
echo -e "   Local Workspace Destination: $LOCAL_PLUGIN_DEST"
echo ""

# Check prerequisites
check_prereqs() {
    local missing=()

    # Check for node
    if ! command -v "$NODE_BIN" >/dev/null 2>&1; then
        missing+=("$NODE_BIN")
    fi

    # Check for bash
    if ! command -v bash >/dev/null 2>&1; then
        missing+=("bash")
    fi

    if [ ${#missing[@]} -gt 0 ]; then
        echo -e "${RED}✗ Missing required commands: ${missing[*]}${NC}" >&2
        echo -e "  Install Node.js: https://nodejs.org/" >&2
        exit 1
    fi
}

# Run converter
run_converter() {
    echo -e "${YELLOW}🔄 Converting agents to Antigravity format...${NC}"
    cd "$CONVERTER_DIR"

    if ! "$NODE_BIN" src/convert-agents.js 2>&1 | grep -q "Conversion complete"; then
        echo -e "${RED}✗ Conversion failed${NC}" >&2
        exit 1
    fi

    echo -e "${GREEN}✅ Conversion complete${NC}"
}

# Install plugin
install_plugin() {
    # 1. Global Installation (antigravity-cli)
    echo -e "${YELLOW}📦 Installing global CLI plugin...${NC}"
    mkdir -p "$HOME/.gemini/antigravity-cli/plugins"
    
    if [ -d "$PLUGIN_DEST" ]; then
        echo "🗑️  Removing old global CLI installation..."
        rm -rf "$PLUGIN_DEST"
    fi
    
    cp -r "$CONVERTER_DIR/generated" "$PLUGIN_DEST"
    echo -e "${GREEN}✅ Global CLI installation complete${NC}"

    # 2. Global Configuration Plugins (Desktop & CLI Auto-Load)
    echo -e "${YELLOW}📦 Installing global config plugin...${NC}"
    local config_plugin_dest="/Users/benpriebe/.gemini/config/plugins/openagents-control-bridge"
    mkdir -p "/Users/benpriebe/.gemini/config/plugins"
    if [ -d "$config_plugin_dest" ]; then
        rm -rf "$config_plugin_dest"
    fi
    cp -r "$CONVERTER_DIR/generated" "$config_plugin_dest"
    echo -e "${GREEN}✅ Global config installation complete${NC}"

    # 3. Local/Workspace Installation (.agents/plugins)
    echo -e "${YELLOW}📦 Installing workspace plugin...${NC}"
    mkdir -p "$REPO_ROOT/.agents/plugins"
    
    if [ -d "$LOCAL_PLUGIN_DEST" ]; then
        echo "🗑️  Removing old workspace installation..."
        rm -rf "$LOCAL_PLUGIN_DEST"
    fi
    
    cp -r "$CONVERTER_DIR/generated" "$LOCAL_PLUGIN_DEST"
    echo -e "${GREEN}✅ Workspace installation complete${NC}"

    # 4. Standard Workspace Paths (.agents/skills and .agents/agents)
    echo -e "${YELLOW}📦 Installing to standard workspace paths (.agents/skills/ and .agents/agents/)...${NC}"
    mkdir -p "$REPO_ROOT/.agents/skills"
    mkdir -p "$REPO_ROOT/.agents/agents"

    # Clean old workspace skills/agents directories
    rm -rf "$REPO_ROOT/.agents/skills"/*
    rm -rf "$REPO_ROOT/.agents/agents"/*

    cp -r "$CONVERTER_DIR/generated/skills"/* "$REPO_ROOT/.agents/skills/"
    cp -r "$CONVERTER_DIR/generated/agents"/* "$REPO_ROOT/.agents/agents/"
    echo -e "${GREEN}✅ Standard workspace paths installation complete${NC}"
}

# Verify installation
verify() {
    if [ ! -f "$PLUGIN_DEST/agents/openagent.md" ]; then
        echo -e "${RED}✗ Installation verification failed${NC}" >&2
        echo "  Expected: $PLUGIN_DEST/agents/openagent.md" >&2
        exit 1
    fi

    echo ""
    echo -e "${GREEN}✨ Installation successful!${NC}"
    echo ""
    echo "To use with Gemini Antigravity CLI:"
    echo "   - View active skills using the: /skills command"
    echo "   - View active subagents using the: /agents command"
    echo ""
    echo "Your OAC plug-in is loaded and ready to trigger on your next task!"
}

# Main workflow
main() {
    check_prereqs
    run_converter
    install_plugin
    verify
}

# Allow specifying custom Node.js binary via NODE_BIN environment variable
main "$@"
