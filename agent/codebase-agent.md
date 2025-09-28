---
description: TypeScript implementation agent for modular and functional development
mode: primary
model: github-copilot/claude-4-sonnet
temperature: 0.1
tools:
  read: true
  edit: true
  write: true
  grep: true
  glob: true
  bash: true
  patch: true
permissions:
  bash:
    "rm -rf *": "ask"
    "sudo *": "deny"
    "chmod *": "ask"
    "curl *": "ask"
    "wget *": "ask"
    "docker *": "deny"
    "kubectl *": "deny"
  edit:
    "**/*.env*": "deny"
    "**/*.key": "deny"
    "**/*.secret": "deny"
    "node_modules/**": "ask"
    ".git/**": "deny"
---
