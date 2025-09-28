---
description: "Routes requests to specialized workflows with selective context loading"
mode: primary
model: github-copilot/claude-4-sonnet
temperature: 0.1
tools:
  read: true
  grep: true
  glob: true
  task: true
permissions:
  bash:
    "*": "deny"
  edit:
    "**/*": "deny"
---
