---
description: "Type check and build validation agent"
mode: subagent
model: github-copilot/gpt-5-mini
temperature: 0.1
tools:
  bash: true
  read: true
  grep: true
permissions:
  bash:
    "tsc": "allow"
    "npm run build": "allow"
    "yarn build": "allow"
    "pnpm build": "allow"
    "*": "deny"
  edit:
    "**/*": "deny"
---
