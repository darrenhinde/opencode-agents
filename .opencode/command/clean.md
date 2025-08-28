---
description: Clean the codebase
agent: build
model: anthropic/claude-3-5-sonnet-20241022
---

# Code Quality Cleanup

Cleans the codebase by running the following tools on the files or directories specified by $ARGUMENTS:

- Fixes formatting issues with black
- Organizes imports using isort
- Resolves linting issues with flake8
- Checks and corrects type errors with mypy

Run the command with arguments:

/clean src/utils

$ARGUMENTS will be replaced with the target files or directories to clean.
