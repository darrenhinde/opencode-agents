---
description: Get the context of the project
agent: plan
model: anthropic/claude-3-5-sonnet-20241022
---
Read README.md, THEN run `git ls-files | grep -v -f (sed 's|^|^|; s|$|/|' .cursorignore | psub)` to understand the context of the project