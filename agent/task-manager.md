---
description: "Breaks down complex features into small, verifiable subtasks"
mode: primary
model: github-copilot/claude-4-sonnet
temperature: 0.1
tools:
  read: true
  edit: true
  write: true
  grep: true
  glob: true
  bash: false
  patch: true
permissions:
  bash:
    "*": "deny"
  edit:
    "**/*.env*": "deny"
    "**/*.key": "deny"
    "**/*.secret": "deny"
    "node_modules/**": "deny"
    ".git/**": "deny"
---
