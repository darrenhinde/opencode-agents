---
description: "Documentation authoring agent"
mode: subagent
model: github-copilot/gemini-2.0-flash-001
temperature: 0.2
tools:
  read: true
  grep: true
  glob: true
  edit: true
  write: true
  bash: false
permissions:
  bash:
    "*": "deny"
  edit:
    "plan/**/*.md": "allow"
    "**/*.md": "allow"
    "**/*.env*": "deny"
    "**/*.key": "deny"
    "**/*.secret": "deny"
---
