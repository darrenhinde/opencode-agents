# OpenCode Setup for Mastra RAG Template

## Install

1. Install OpenCode CLI (see official docs)

## Agents

See `AGENTS.md` for roles and usage. Configure defaults via `.opencode/config.json`.

## Permissions

Repository guardrails live in `.opencode/permissions.json`. You can also scope rules per-agent inside each agent file under `permissions`.

By default:
- Risky bash commands like `rm -rf *` are set to `ask`
- Sensitive paths (`.env`, `.key`, `.secret`, `node_modules`, `.git`) are denied

## Commands

Custom commands live in `.opencode/commands/`. Example: `/feature-setup`.

## Plugins

Notifications are enabled via `.opencode/plugin/notification.js`. On macOS this uses `osascript` to display alerts for session completion and approval-required events.


