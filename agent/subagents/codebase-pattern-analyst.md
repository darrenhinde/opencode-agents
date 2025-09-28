---
description: "TypeScript implementation agent for modular and functional development"
mode: subagent
model: github-copilot/gpt-5-mini
temperature: 0.1
tools:
  read: true
  grep: true
  glob: true
  bash: false
  edit: false
  write: false
permissions:
  bash:
    "*": "deny"
  edit:
    "**/*": "deny"
---
