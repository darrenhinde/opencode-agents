---
description: "Code review, security, and quality assurance agent"
mode: subagent
model: github-copilot/gemini-2.5-pro
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
